const path = require('path');
const fs = require('fs');
const db = require('../db');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');

exports.upload = (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择图片文件' });
  res.json({ url: '/uploads/' + req.file.filename });
};

exports.list = (req, res) => {
  res.json(db.prepare('SELECT * FROM feature_cards ORDER BY sort_order ASC, id ASC').all());
};

exports.enabled = (req, res) => {
  res.json(db.prepare('SELECT * FROM feature_cards WHERE is_enabled = 1 ORDER BY sort_order ASC, id ASC').all());
};

exports.getById = (req, res) => {
  const card = db.prepare('SELECT * FROM feature_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: '卡片不存在' });
  res.json(card);
};

exports.update = (req, res) => {
  const existing = db.prepare('SELECT * FROM feature_cards WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '卡片不存在' });
  const { title, subtitle, image_url, link_url, is_enabled, sort_order } = req.body;
  db.prepare(
    'UPDATE feature_cards SET title = ?, subtitle = ?, image_url = ?, link_url = ?, is_enabled = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(
    title !== undefined ? title : existing.title,
    subtitle !== undefined ? subtitle : existing.subtitle,
    image_url !== undefined ? image_url : existing.image_url,
    link_url !== undefined ? link_url : existing.link_url,
    is_enabled !== undefined ? (is_enabled ? 1 : 0) : existing.is_enabled,
    sort_order !== undefined ? sort_order : existing.sort_order,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM feature_cards WHERE id = ?').get(req.params.id));
};
