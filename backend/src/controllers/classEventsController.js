const db = require('../db');

exports.list = (req, res) => {
  const events = db.prepare('SELECT * FROM class_events WHERE class_id = ? ORDER BY date DESC').all(req.params.classId);
  res.json(events);
};

exports.create = (req, res) => {
  const { type, name, date, photo } = req.body;
  if (!name || !name.trim()) return res.status(422).json({ error: '名称为必填项' });
  const result = db.prepare('INSERT INTO class_events (class_id, type, name, date, photo) VALUES (?, ?, ?, ?, ?)')
    .run(req.params.classId, type || '荣誉', name.trim(), date || '', photo || '');
  const event = db.prepare('SELECT * FROM class_events WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(event);
};

exports.update = (req, res) => {
  const e = db.prepare('SELECT * FROM class_events WHERE id = ? AND class_id = ?').get(req.params.id, req.params.classId);
  if (!e) return res.status(404).json({ error: '记录不存在' });
  const { type, name, date, photo } = req.body;
  db.prepare('UPDATE class_events SET type = ?, name = ?, date = ?, photo = ? WHERE id = ?')
    .run(type !== undefined ? type : e.type, (name || e.name).trim(), date !== undefined ? date : e.date, photo !== undefined ? photo : e.photo, req.params.id);
  const updated = db.prepare('SELECT * FROM class_events WHERE id = ?').get(req.params.id);
  res.json(updated);
};

exports.remove = (req, res) => {
  const e = db.prepare('SELECT * FROM class_events WHERE id = ? AND class_id = ?').get(req.params.id, req.params.classId);
  if (!e) return res.status(404).json({ error: '记录不存在' });
  db.prepare('DELETE FROM class_events WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
};
