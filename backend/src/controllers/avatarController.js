const path = require('path');
const fs = require('fs');
const db = require('../db');

const TARGETS = {
  student: { table: 'students', label: '学生' },
  teacher: { table: 'teacher_profiles', label: '教师' }
};

function deletePhotoFile(photoUrl) {
  try {
    if (!/^\/(uploads|avatar)\//.test(photoUrl)) return;
    const publicDir = path.resolve(__dirname, '..', '..', 'public');
    const abs = path.resolve(publicDir, '.' + photoUrl);
    if (!abs.startsWith(publicDir + path.sep)) return;
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (_) {}
}

exports.removePhoto = (req, res) => {
  const target = TARGETS[req.params.target];
  if (!target) return res.status(400).json({ error: '无效的目标类型' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: '无效的记录 ID' });
  const row = db.prepare(`SELECT id, photo FROM ${target.table} WHERE id = ?`).get(id);
  if (!row) return res.status(404).json({ error: `${target.label}不存在` });
  if (!row.photo) return res.status(400).json({ error: '该记录当前没有照片' });

  deletePhotoFile(row.photo);
  db.prepare(`UPDATE ${target.table} SET photo = '' WHERE id = ?`).run(id);
  res.json({ ok: true });
};
