const db = require('../db');

exports.list = (req, res) => {
  const grades = db.prepare('SELECT * FROM grades ORDER BY sort ASC, id ASC').all();
  res.json(grades);
};

exports.getById = (req, res) => {
  const grade = db.prepare('SELECT * FROM grades WHERE id = ?').get(req.params.id);
  if (!grade) return res.status(404).json({ error: '年级不存在' });
  res.json(grade);
};

exports.create = (req, res) => {
  const { grade_name, sort } = req.body;
  if (!grade_name || !grade_name.trim()) return res.status(422).json({ error: '年级名称不能为空' });
  const existing = db.prepare('SELECT id FROM grades WHERE grade_name = ?').get(grade_name.trim());
  if (existing) return res.status(422).json({ error: '年级名称已存在' });
  const maxSort = db.prepare('SELECT COALESCE(MAX(sort), 0) as m FROM grades').get();
  const result = db.prepare('INSERT INTO grades (grade_name, sort) VALUES (?, ?)')
    .run(grade_name.trim(), sort || (maxSort.m + 1));
  res.status(201).json(db.prepare('SELECT * FROM grades WHERE id = ?').get(result.lastInsertRowid));
};

exports.update = (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM grades WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '年级不存在' });
  const { grade_name, sort, status } = req.body;
  const nameDup = grade_name && grade_name.trim() !== existing.grade_name
    ? db.prepare('SELECT id FROM grades WHERE grade_name = ? AND id != ?').get(grade_name.trim(), id) : null;
  if (nameDup) return res.status(422).json({ error: '年级名称已存在' });
  db.prepare('UPDATE grades SET grade_name = ?, sort = ?, status = ? WHERE id = ?').run(
    grade_name !== undefined ? grade_name.trim() : existing.grade_name,
    sort !== undefined ? sort : existing.sort,
    status !== undefined ? status : existing.status,
    id
  );
  res.json(db.prepare('SELECT * FROM grades WHERE id = ?').get(id));
};

exports.remove = (req, res) => {
  const existing = db.prepare('SELECT * FROM grades WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '年级不存在' });
  db.prepare('DELETE FROM grades WHERE id = ?').run(req.params.id);
  res.json({ message: '年级已删除' });
};
