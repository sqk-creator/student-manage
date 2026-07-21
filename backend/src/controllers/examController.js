const db = require('../db');

function calcLevel(score, totalScore) {
  if (!totalScore || totalScore <= 0) return '';
  const pct = (score / totalScore) * 100;
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 60) return 'C';
  return 'D';
}

exports.list = (req, res) => {
  const { class_id, group_id } = req.query;
  let sql = 'SELECT * FROM exams WHERE 1=1';
  const params = [];
  if (class_id) {
    const cls = db.prepare('SELECT grade_id FROM classes WHERE id = ?').get(class_id);
    if (cls && cls.grade_id) {
      sql += ' AND (e.class_id = ? OR e.group_id IN (SELECT id FROM exam_groups WHERE scope_type = \'grade\' AND grade_id = ?))';
      params.push(class_id, cls.grade_id);
    } else {
      sql += ' AND class_id = ?';
      params.push(class_id);
    }
    sql = sql.replace('SELECT ', 'SELECT e.*, ');
    sql = sql.replace('FROM exams', 'FROM exams e');
  } else {
    if (group_id) { sql += ' AND group_id = ?'; params.push(group_id); }
  }
  sql += ' ORDER BY exam_time DESC, exam_date DESC';
  res.json(db.prepare(sql).all(...params));
};

exports.getById = (req, res) => {
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
  if (!exam) return res.status(404).json({ error: '考试不存在' });
  res.json(exam);
};

exports.create = (req, res) => {
  const { class_id, group_id, subject, exam_name, exam_time, total_score, remark } = req.body;
  if (!class_id || !subject || !exam_name) return res.status(422).json({ error: '班级、科目和考试名称为必填项' });
  const result = db.prepare(
    'INSERT INTO exams (class_id, group_id, subject, name, exam_name, exam_time, exam_date, total_score, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(class_id, group_id || null, subject, exam_name, exam_name, exam_time || '', exam_time || '', total_score || 100, remark || '');
  res.status(201).json(db.prepare('SELECT * FROM exams WHERE id = ?').get(result.lastInsertRowid));
};

exports.update = (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM exams WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '考试不存在' });
  const { group_id, subject, exam_name, exam_time, total_score, remark } = req.body;
  db.prepare(
    'UPDATE exams SET group_id = ?, subject = ?, name = ?, exam_name = ?, exam_time = ?, exam_date = ?, total_score = ?, remark = ? WHERE id = ?'
  ).run(
    group_id !== undefined ? group_id : existing.group_id,
    subject || existing.subject,
    exam_name || existing.exam_name,
    exam_name || existing.exam_name,
    exam_time || existing.exam_time,
    exam_time || existing.exam_time,
    total_score !== undefined ? total_score : existing.total_score,
    remark !== undefined ? remark : existing.remark,
    id
  );
  res.json(db.prepare('SELECT * FROM exams WHERE id = ?').get(id));
};

exports.remove = (req, res) => {
  const existing = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '考试不存在' });
  db.prepare('DELETE FROM exams WHERE id = ?').run(req.params.id);
  res.json({ message: '考试已删除' });
};

exports.getScores = (req, res) => {
  const examId = req.params.examId;
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
  if (!exam) return res.status(404).json({ error: '考试不存在' });
  const scores = db.prepare(`
    SELECT sc.id, sc.score, sc.level, sc.single_rank, sc.student_id, s.name as student_name, s.student_no
    FROM scores sc JOIN students s ON sc.student_id = s.id
    WHERE sc.exam_id = ? ORDER BY sc.score DESC, s.student_no
  `).all(examId);
  res.json({ exam, scores });
};

exports.enterScores = (req, res) => {
  const examId = req.params.examId;
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
  if (!exam) return res.status(404).json({ error: '考试不存在' });
  const { scores } = req.body;
  if (!Array.isArray(scores)) return res.status(422).json({ error: '成绩数据格式错误' });

  const totalScore = exam.total_score || 100;

  const upsertScore = db.prepare(`
    INSERT INTO scores (score, student_id, exam_id, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(student_id, exam_id) DO UPDATE SET score = excluded.score, updated_at = datetime('now')
  `);

  const transaction = db.transaction((items) => {
    for (const item of items) {
      if (item.score < 0) throw new Error('成绩不能为负数');
      const student = db.prepare('SELECT id FROM students WHERE id = ? AND class_id = ?')
        .get(item.student_id, exam.class_id);
      if (!student) throw new Error(`学生 id=${item.student_id} 不属于该班级`);
      upsertScore.run(item.score, item.student_id, examId);
    }

    const allScores = db.prepare('SELECT id, score FROM scores WHERE exam_id = ? ORDER BY score DESC').all(examId);
    const updateRank = db.prepare('UPDATE scores SET single_rank = ?, level = ?, updated_at = datetime(\'now\') WHERE id = ?');
    let rank = 1;
    for (let i = 0; i < allScores.length; i++) {
      if (i > 0 && allScores[i].score < allScores[i - 1].score) rank = i + 1;
      updateRank.run(rank, calcLevel(allScores[i].score, totalScore), allScores[i].id);
    }
  });

  try {
    transaction(scores);
    const updated = db.prepare(`
      SELECT sc.id, sc.score, sc.level, sc.single_rank, sc.student_id, s.name as student_name, s.student_no
      FROM scores sc JOIN students s ON sc.student_id = s.id
      WHERE sc.exam_id = ? ORDER BY sc.score DESC, s.student_no
    `).all(examId);
    res.json({ message: '成绩保存成功', scores: updated });
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
};

exports.getStats = (req, res) => {
  const examId = req.params.examId;
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
  if (!exam) return res.status(404).json({ error: '考试不存在' });

  const stats = db.prepare(`
    SELECT COUNT(*) as total, ROUND(AVG(score), 1) as avg, MAX(score) as max, MIN(score) as min
    FROM scores WHERE exam_id = ?
  `).get(examId);

  const totalScore = exam.total_score || 100;
  const distribution = db.prepare(`
    SELECT
      SUM(CASE WHEN ROUND((score * 100.0 / ?), 0) >= 90 THEN 1 ELSE 0 END) as excellent,
      SUM(CASE WHEN ROUND((score * 100.0 / ?), 0) >= 80 AND ROUND((score * 100.0 / ?), 0) < 90 THEN 1 ELSE 0 END) as good,
      SUM(CASE WHEN ROUND((score * 100.0 / ?), 0) >= 60 AND ROUND((score * 100.0 / ?), 0) < 80 THEN 1 ELSE 0 END) as average,
      SUM(CASE WHEN ROUND((score * 100.0 / ?), 0) < 60 THEN 1 ELSE 0 END) as fail
    FROM scores WHERE exam_id = ?
  `).get(totalScore, totalScore, totalScore, totalScore, totalScore, totalScore, examId);

  res.json({ exam, stats, distribution });
};
