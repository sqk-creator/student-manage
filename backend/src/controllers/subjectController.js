const db = require('../db');

exports.list = (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM subjects';
  const params = [];
  if (status !== undefined) { sql += ' WHERE status = ?'; params.push(status); }
  sql += ' ORDER BY sort ASC, id ASC';
  res.json(db.prepare(sql).all(...params));
};

exports.getById = (req, res) => {
  const s = db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: '科目不存在' });
  res.json(s);
};

exports.create = (req, res) => {
  const { subject_name, sort } = req.body;
  if (!subject_name || !subject_name.trim()) return res.status(422).json({ error: '科目名称不能为空' });
  const dup = db.prepare('SELECT id FROM subjects WHERE subject_name = ?').get(subject_name.trim());
  if (dup) return res.status(422).json({ error: '科目名称已存在' });
  const maxSort = db.prepare('SELECT COALESCE(MAX(sort), 0) as m FROM subjects').get();
  const result = db.prepare('INSERT INTO subjects (subject_name, sort) VALUES (?, ?)')
    .run(subject_name.trim(), sort || (maxSort.m + 1));
  res.status(201).json(db.prepare('SELECT * FROM subjects WHERE id = ?').get(result.lastInsertRowid));
};

exports.update = (req, res) => {
  const existing = db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '科目不存在' });
  const { subject_name, sort, status } = req.body;
  const nameDup = subject_name && subject_name.trim() !== existing.subject_name
    ? db.prepare('SELECT id FROM subjects WHERE subject_name = ? AND id != ?').get(subject_name.trim(), req.params.id) : null;
  if (nameDup) return res.status(422).json({ error: '科目名称已存在' });
  db.prepare('UPDATE subjects SET subject_name = ?, sort = ?, status = ? WHERE id = ?').run(
    subject_name !== undefined ? subject_name.trim() : existing.subject_name,
    sort !== undefined ? sort : existing.sort,
    status !== undefined ? status : existing.status,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id));
};

exports.remove = (req, res) => {
  const existing = db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '科目不存在' });
  db.prepare('DELETE FROM subjects WHERE id = ?').run(req.params.id);
  res.json({ message: '科目已删除' });
};
