const db = require('../db');

exports.list = (req, res) => {
  const { class_id, grade_id } = req.query;
  let sql = 'SELECT eg.*, c.name as class_name, g.grade_name FROM exam_groups eg LEFT JOIN classes c ON eg.class_id = c.id LEFT JOIN grades g ON eg.grade_id = g.id WHERE 1=1';
  const params = [];
  if (class_id) { sql += ' AND (eg.class_id = ? OR (eg.scope_type = \'grade\' AND eg.grade_id = (SELECT grade_id FROM classes WHERE id = ?)))'; params.push(class_id, class_id); }
  if (grade_id) { sql += ' AND eg.grade_id = ?'; params.push(grade_id); }
  sql += ' ORDER BY eg.exam_date DESC, eg.created_at DESC';
  res.json(db.prepare(sql).all(...params));
};

exports.getById = (req, res) => {
  const group = db.prepare(
    'SELECT eg.*, c.name as class_name, g.grade_name FROM exam_groups eg LEFT JOIN classes c ON eg.class_id = c.id LEFT JOIN grades g ON eg.grade_id = g.id WHERE eg.id = ?'
  ).get(req.params.id);
  if (!group) return res.status(404).json({ error: '考试批次不存在' });
  res.json(group);
};

exports.create = (req, res) => {
  const { class_id, grade_id, scope_type, group_name, semester, exam_date, total_score, remark, exam_type } = req.body;
  if (!group_name || !group_name.trim()) return res.status(422).json({ error: '批次名称为必填项' });
  const scope = scope_type || 'class';
  if (scope === 'grade' && !grade_id) return res.status(422).json({ error: '年级模式下年级为必填项' });
  if (scope === 'class' && (class_id === undefined || class_id === null || class_id === '')) return res.status(422).json({ error: '班级模式下班级为必填项' });
  db.pragma('foreign_keys = 0');
  const result = db.prepare(
    'INSERT INTO exam_groups (class_id, grade_id, scope_type, group_name, semester, exam_date, total_score, remark, exam_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(class_id || 0, grade_id || null, scope, group_name.trim(), semester || '', exam_date || '', total_score || 0, remark || '', exam_type || 'comprehensive');
  db.pragma('foreign_keys = 1');
  res.status(201).json(db.prepare('SELECT * FROM exam_groups WHERE id = ?').get(result.lastInsertRowid));
};

exports.update = (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM exam_groups WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '考试批次不存在' });
  const { class_id, grade_id, scope_type, group_name, semester, exam_date, total_score, remark, exam_type } = req.body;
  db.prepare(
    'UPDATE exam_groups SET class_id = ?, grade_id = ?, scope_type = ?, group_name = ?, semester = ?, exam_date = ?, total_score = ?, remark = ?, exam_type = ? WHERE id = ?'
  ).run(
    class_id !== undefined ? class_id : existing.class_id,
    grade_id !== undefined ? grade_id : existing.grade_id,
    scope_type || existing.scope_type,
    group_name || existing.group_name,
    semester !== undefined ? semester : existing.semester,
    exam_date || existing.exam_date,
    total_score !== undefined ? total_score : existing.total_score,
    remark !== undefined ? remark : existing.remark,
    exam_type || existing.exam_type || 'comprehensive',
    id
  );
  res.json(db.prepare('SELECT * FROM exam_groups WHERE id = ?').get(id));
};

exports.remove = (req, res) => {
  const existing = db.prepare('SELECT * FROM exam_groups WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '考试批次不存在' });
  db.prepare('DELETE FROM exam_groups WHERE id = ?').run(req.params.id);
  res.json({ message: '考试批次已删除' });
};

exports.getStats = (req, res) => {
  const groupId = req.params.id;
  const group = db.prepare('SELECT * FROM exam_groups WHERE id = ?').get(groupId);
  if (!group) return res.status(404).json({ error: '考试批次不存在' });

  const exams = db.prepare('SELECT * FROM exams WHERE group_id = ?').all(groupId);
  if (exams.length === 0) return res.json({ group, exams: [], student_stats: [] });

  const students = db.prepare(`
    SELECT DISTINCT s.id, s.name, s.student_no FROM students s
    JOIN scores sc ON sc.student_id = s.id
    JOIN exams e ON sc.exam_id = e.id
    WHERE e.group_id = ?
    ORDER BY s.student_no
  `).all(groupId);

  const results = [];
  for (const student of students) {
    const subjectScores = {};
    let totalScore = 0;
    let subjectCount = 0;
    for (const exam of exams) {
      const score = db.prepare(
        'SELECT score, level, single_rank FROM scores WHERE exam_id = ? AND student_id = ?'
      ).get(exam.id, student.id);
      if (score) {
        subjectScores[exam.subject] = { score: score.score, level: score.level, rank: score.single_rank, exam_name: exam.exam_name };
        totalScore += score.score;
        subjectCount++;
      }
    }
    results.push({
      student_id: student.id,
      student_name: student.name,
      student_no: student.student_no,
      total_score: totalScore,
      subject_count: subjectCount,
      subjects: subjectScores
    });
  }

  results.sort((a, b) => b.total_score - a.total_score);
  let rank = 1;
  for (let i = 0; i < results.length; i++) {
    if (i > 0 && results[i].total_score < results[i - 1].total_score) rank = i + 1;
    results[i].total_rank = rank;
  }

  const examStats = exams.map(exam => {
    const stats = db.prepare(`
      SELECT COUNT(*) as total, ROUND(AVG(score), 1) as avg, MAX(score) as max, MIN(score) as min
      FROM scores WHERE exam_id = ?
    `).get(exam.id);
    const total = exam.total_score || 100;
    const dist = db.prepare(`
      SELECT
        SUM(CASE WHEN ROUND((score * 100.0 / ?), 0) >= 90 THEN 1 ELSE 0 END) as excellent,
        SUM(CASE WHEN ROUND((score * 100.0 / ?), 0) >= 80 AND ROUND((score * 100.0 / ?), 0) < 90 THEN 1 ELSE 0 END) as good,
        SUM(CASE WHEN ROUND((score * 100.0 / ?), 0) >= 60 AND ROUND((score * 100.0 / ?), 0) < 80 THEN 1 ELSE 0 END) as average,
        SUM(CASE WHEN ROUND((score * 100.0 / ?), 0) < 60 THEN 1 ELSE 0 END) as fail
      FROM scores WHERE exam_id = ?
    `).get(total, total, total, total, total, total, exam.id);
    return { exam_id: exam.id, exam_name: exam.exam_name, subject: exam.subject, stats, distribution: dist };
  });

  res.json({ group, exams: examStats, student_stats: results });
};
