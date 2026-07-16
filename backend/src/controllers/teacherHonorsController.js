const db = require('../db');

exports.listByTeacher = (req, res) => {
  const honors = db.prepare('SELECT * FROM teacher_honors WHERE teacher_id = ? ORDER BY date DESC').all(req.params.teacherId);
  res.json(honors);
};

exports.create = (req, res) => {
  const { name, date, photo } = req.body;
  if (!name || !name.trim()) return res.status(422).json({ error: '荣誉称号名称为必填项' });
  const result = db.prepare('INSERT INTO teacher_honors (teacher_id, name, date, photo) VALUES (?, ?, ?, ?)')
    .run(req.params.teacherId, name.trim(), date || '', photo || '');
  const honor = db.prepare('SELECT * FROM teacher_honors WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(honor);
};

exports.update = (req, res) => {
  const h = db.prepare('SELECT * FROM teacher_honors WHERE id = ? AND teacher_id = ?').get(req.params.id, req.params.teacherId);
  if (!h) return res.status(404).json({ error: '荣誉记录不存在' });
  const { name, date, photo } = req.body;
  db.prepare('UPDATE teacher_honors SET name = ?, date = ?, photo = ? WHERE id = ?')
    .run((name || h.name).trim(), date !== undefined ? date : h.date, photo !== undefined ? photo : h.photo, req.params.id);
  const updated = db.prepare('SELECT * FROM teacher_honors WHERE id = ?').get(req.params.id);
  res.json(updated);
};

exports.remove = (req, res) => {
  const h = db.prepare('SELECT * FROM teacher_honors WHERE id = ? AND teacher_id = ?').get(req.params.id, req.params.teacherId);
  if (!h) return res.status(404).json({ error: '荣誉记录不存在' });
  db.prepare('DELETE FROM teacher_honors WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
};

exports.clearAll = (req, res) => {
  db.prepare('DELETE FROM teacher_honors WHERE teacher_id = ?').run(req.params.teacherId);
  res.json({ message: '已清除所有荣誉' });
};
