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
  let sql = 'SELECT e.*, sub.subject_name FROM exams e LEFT JOIN subjects sub ON e.subject_id = sub.id WHERE 1=1';
  const params = [];
  if (class_id) {
    const cls = db.prepare('SELECT grade_id FROM classes WHERE id = ?').get(class_id);
    if (cls && cls.grade_id) {
      sql += ' AND (e.class_id = ? OR e.group_id IN (SELECT id FROM exam_groups WHERE scope_type = \'grade\' AND grade_id = ?))';
      params.push(class_id, cls.grade_id);
    } else {
      sql += ' AND e.class_id = ?';
      params.push(class_id);
    }
  }
  if (group_id) { sql += ' AND e.group_id = ?'; params.push(group_id); }
  sql += ' ORDER BY e.exam_time DESC, e.exam_date DESC';
  const exams = db.prepare(sql).all(...params);
  if (group_id) {
    const group = db.prepare('SELECT scope_type, grade_id, class_id, exam_type FROM exam_groups WHERE id = ?').get(group_id);
    let expectedQuery = '';
    let expectedParams = [];
    if (group) {
      if (group.scope_type === 'grade' && group.grade_id) {
        let typeFilter = '';
        if (group.exam_type === 'liberal_arts') typeFilter = " AND c.type = '文科班'";
        else if (group.exam_type === 'science') typeFilter = " AND c.type = '理科班'";
        expectedQuery = `SELECT COUNT(*) as cnt FROM students s JOIN classes c ON s.class_id = c.id WHERE c.grade_id = ?${typeFilter}`;
        expectedParams = [group.grade_id];
      } else if (group.class_id > 0) {
        expectedQuery = 'SELECT COUNT(*) as cnt FROM students WHERE class_id = ?';
        expectedParams = [group.class_id];
      }
    }
    const expected = expectedQuery ? db.prepare(expectedQuery).get(...expectedParams)?.cnt || 0 : 0;
    const examCounts = db.prepare('SELECT exam_id, COUNT(*) as cnt, ROUND(AVG(score), 1) as avg_score FROM scores WHERE exam_id IN (SELECT id FROM exams WHERE group_id = ?) GROUP BY exam_id').all(group_id);
    const countMap = {};
    const avgMap = {};
    examCounts.forEach((r) => { countMap[r.exam_id] = r.cnt; avgMap[r.exam_id] = r.avg_score; });
    exams.forEach((e) => { e.expected_count = expected; e.entered_count = countMap[e.id] || 0; e.avg_score = avgMap[e.id] ?? null; });
  }
  res.json(exams);
};

exports.getById = (req, res) => {
  const exam = db.prepare(
    'SELECT e.*, sub.subject_name FROM exams e LEFT JOIN subjects sub ON e.subject_id = sub.id WHERE e.id = ?'
  ).get(req.params.id);
  if (!exam) return res.status(404).json({ error: '考试不存在' });
  res.json(exam);
};

exports.create = (req, res) => {
  const { class_id, group_id, subject, subject_id, exam_name, exam_time, total_score, remark } = req.body;
  const finalSubject = subject_id ? (db.prepare('SELECT subject_name FROM subjects WHERE id = ?').get(subject_id)?.subject_name || subject) : subject;
  const group = group_id ? db.prepare('SELECT scope_type, grade_id FROM exam_groups WHERE id = ?').get(group_id) : null;
  const isGradeScope = group && group.scope_type === 'grade';
  if (!isGradeScope && (class_id === undefined || class_id === null || class_id === '')) return res.status(422).json({ error: '班级为必填项' });
  if (!finalSubject || !exam_name) return res.status(422).json({ error: '科目和考试名称为必填项' });
  if (isGradeScope) { db.pragma('foreign_keys = 0'); }
  const result = db.prepare(
    'INSERT INTO exams (class_id, group_id, subject, subject_id, name, exam_name, exam_time, exam_date, total_score, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(class_id || 0, group_id || null, finalSubject, subject_id || null, exam_name, exam_name, exam_time || '', exam_time || '', total_score || 100, remark || '');
  if (isGradeScope) { db.pragma('foreign_keys = 1'); }
  res.status(201).json(db.prepare('SELECT e.*, sub.subject_name FROM exams e LEFT JOIN subjects sub ON e.subject_id = sub.id WHERE e.id = ?').get(result.lastInsertRowid));
};

exports.update = (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM exams WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '考试不存在' });
  const { group_id, subject, subject_id, exam_name, exam_time, total_score, remark } = req.body;
  const finalSubject = subject_id !== undefined
    ? (subject_id ? (db.prepare('SELECT subject_name FROM subjects WHERE id = ?').get(subject_id)?.subject_name || subject || existing.subject) : subject)
    : (subject || existing.subject);
  db.prepare(
    'UPDATE exams SET group_id = ?, subject = ?, subject_id = ?, name = ?, exam_name = ?, exam_time = ?, exam_date = ?, total_score = ?, remark = ? WHERE id = ?'
  ).run(
    group_id !== undefined ? group_id : existing.group_id,
    finalSubject !== undefined ? finalSubject : existing.subject,
    subject_id !== undefined ? (subject_id || null) : existing.subject_id,
    exam_name || existing.exam_name,
    exam_name || existing.exam_name,
    exam_time || existing.exam_time,
    exam_time || existing.exam_time,
    total_score !== undefined ? total_score : existing.total_score,
    remark !== undefined ? remark : existing.remark,
    id
  );
  res.json(db.prepare('SELECT e.*, sub.subject_name FROM exams e LEFT JOIN subjects sub ON e.subject_id = sub.id WHERE e.id = ?').get(id));
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
      if (item.score < 0 || item.score > totalScore) throw new Error(`成绩应在0-${totalScore}之间`);
      if (exam.class_id) {
        const student = db.prepare('SELECT id FROM students WHERE id = ? AND class_id = ?')
          .get(item.student_id, exam.class_id);
        if (!student) throw new Error(`学生 id=${item.student_id} 不属于该班级`);
      }
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
