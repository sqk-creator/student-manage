const path = require('path');
const fs = require('fs');
const db = require('../db');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');

exports.upload = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请选择图片文件' });
  }
  const url = '/uploads/' + req.file.filename;
  res.json({ url });
};

exports.list = (req, res) => {
  const rows = db.prepare('SELECT * FROM banners ORDER BY sort_order ASC, id DESC').all();
  res.json(rows.map(r => ({ ...r, is_enabled: !!r.is_enabled })));
};

exports.enabled = (req, res) => {
  const rows = db.prepare('SELECT * FROM banners WHERE is_enabled = 1 ORDER BY sort_order ASC, id DESC').all();
  res.json(rows.map(r => ({ ...r, is_enabled: !!r.is_enabled })));
};

exports.get = (req, res) => {
  const row = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Banner不存在' });
  row.is_enabled = !!row.is_enabled;
  res.json(row);
};

exports.create = (req, res) => {
  const { title, image_url, sort_order, is_enabled } = req.body;
  if (!image_url) return res.status(400).json({ error: '请上传Banner图片' });
  const result = db.prepare(
    'INSERT INTO banners (title, image_url, sort_order, is_enabled) VALUES (?, ?, ?, ?)'
  ).run(title || '', image_url, sort_order || 0, is_enabled ? 1 : 0);
  res.json({ id: result.lastInsertRowid });
};

exports.update = (req, res) => {
  const { title, image_url, sort_order, is_enabled } = req.body;
  const existing = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Banner不存在' });

  db.prepare(
    'UPDATE banners SET title = ?, image_url = ?, sort_order = ?, is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(
    title !== undefined ? title : existing.title,
    image_url || existing.image_url,
    sort_order !== undefined ? sort_order : existing.sort_order,
    is_enabled !== undefined ? (is_enabled ? 1 : 0) : existing.is_enabled,
    req.params.id
  );

  const row = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
  row.is_enabled = !!row.is_enabled;
  res.json(row);
};

exports.remove = (req, res) => {
  const existing = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Banner不存在' });

  const filePath = path.join(UPLOAD_DIR, path.basename(existing.image_url));
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}

  db.prepare('DELETE FROM banners WHERE id = ?').run(req.params.id);
  res.json({ success: true });
};
