const db = require('../db');

exports.list = (req, res) => {
  const comments = db.prepare('SELECT * FROM student_comments WHERE student_id = ? ORDER BY created_at DESC').all(req.params.studentId);
  res.json(comments);
};

exports.create = (req, res) => {
  const { teacher_name, comment, semester } = req.body;
  if (!comment) return res.status(400).json({ error: '评语内容不能为空' });
  const result = db.prepare('INSERT INTO student_comments (student_id, teacher_name, comment, semester) VALUES (?, ?, ?, ?)')
    .run(req.params.studentId, teacher_name || '', comment, semester || '');
  const row = db.prepare('SELECT * FROM student_comments WHERE id = ?').get(result.lastInsertRowid);
  res.json(row);
};

exports.update = (req, res) => {
  const { comment, semester } = req.body;
  const row = db.prepare('SELECT * FROM student_comments WHERE id = ? AND student_id = ?').get(req.params.id, req.params.studentId);
  if (!row) return res.status(404).json({ error: '评语不存在' });
  db.prepare('UPDATE student_comments SET comment = ?, semester = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(comment || row.comment, semester || row.semester, req.params.id);
  res.json(db.prepare('SELECT * FROM student_comments WHERE id = ?').get(req.params.id));
};

exports.remove = (req, res) => {
  db.prepare('DELETE FROM student_comments WHERE id = ? AND student_id = ?').run(req.params.id, req.params.studentId);
  res.json({ success: true });
};
