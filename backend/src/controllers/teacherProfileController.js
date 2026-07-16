const db = require('../db');

exports.list = (req, res) => {
  const teachers = db.prepare('SELECT * FROM teacher_profiles ORDER BY created_at DESC').all();

  const result = teachers.map(t => {
    const classes = db.prepare(`
      SELECT ct.id as ct_id, ct.role, ct.subject, c.id as class_id, c.name as class_name, c.grade
      FROM class_teachers ct
      JOIN classes c ON ct.class_id = c.id
      WHERE ct.teacher_id = ? AND c.teacher_id = ?
      ORDER BY c.name
    `).all(t.id, req.teacherId);
    const honors = db.prepare('SELECT * FROM teacher_honors WHERE teacher_id = ? ORDER BY date DESC').all(t.id);
    return { ...t, classes, honors };
  });

  res.json(result);
};

exports.get = (req, res) => {
  const t = db.prepare('SELECT * FROM teacher_profiles WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '教师不存在' });
  t.classes = db.prepare(`
    SELECT ct.id as ct_id, ct.role, ct.subject, c.id as class_id, c.name as class_name, c.grade
    FROM class_teachers ct
    JOIN classes c ON ct.class_id = c.id
    WHERE ct.teacher_id = ?
    ORDER BY c.name
  `).all(t.id);
  t.honors = db.prepare('SELECT * FROM teacher_honors WHERE teacher_id = ? ORDER BY date DESC').all(t.id);
  res.json(t);
};

exports.create = (req, res) => {
  const { name, phone, subjects, photo, class_ids, class_roles } = req.body;
  if (!name || !name.trim()) return res.status(422).json({ error: '教师姓名为必填项' });

  const existing = db.prepare('SELECT id FROM teacher_profiles WHERE name = ?').get(name.trim());
  if (existing) return res.status(409).json({ error: '教师姓名已存在' });

  const result = db.prepare('INSERT INTO teacher_profiles (name, phone, subjects, photo) VALUES (?, ?, ?, ?)')
    .run(name.trim(), phone || '', subjects || '', photo || '');
  const teacherId = result.lastInsertRowid;

  if (class_ids && class_ids.length > 0) {
    const insertCt = db.prepare('INSERT INTO class_teachers (class_id, name, role, subject, teacher_id) VALUES (?, ?, ?, ?, ?)');
    for (const cid of class_ids) {
      const cr = (class_roles && (class_roles[String(cid)] || class_roles[cid])) || {};
      insertCt.run(cid, name.trim(), cr.is_head ? '班主任' : '任课教师', cr.subject || '', teacherId);
    }
  }

  const teacher = db.prepare('SELECT * FROM teacher_profiles WHERE id = ?').get(teacherId);
  res.status(201).json(teacher);
};

exports.update = (req, res) => {
  const { name, phone, subjects, photo, class_ids, class_roles } = req.body;
  const t = db.prepare('SELECT * FROM teacher_profiles WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '教师不存在' });

  const newName = (name || t.name).trim();
  const conflicting = db.prepare('SELECT id FROM teacher_profiles WHERE name = ? AND id != ?').get(newName, req.params.id);
  if (conflicting) return res.status(409).json({ error: '教师姓名已存在' });

  db.prepare('UPDATE teacher_profiles SET name = ?, phone = ?, subjects = ?, photo = ? WHERE id = ?')
    .run(newName, phone !== undefined ? phone : t.phone, subjects !== undefined ? subjects : t.subjects, photo !== undefined ? photo : t.photo, req.params.id);

  if (class_ids !== undefined) {
    db.prepare('DELETE FROM class_teachers WHERE teacher_id = ?').run(req.params.id);
    if (class_ids.length > 0) {
      const insertCt = db.prepare('INSERT INTO class_teachers (class_id, name, role, subject, teacher_id) VALUES (?, ?, ?, ?, ?)');
      for (const cid of class_ids) {
        const cr = (class_roles && (class_roles[String(cid)] || class_roles[cid])) || {};
        insertCt.run(cid, newName, cr.is_head ? '班主任' : '任课教师', cr.subject || '', req.params.id);
      }
    }
  }

  const updated = db.prepare('SELECT * FROM teacher_profiles WHERE id = ?').get(req.params.id);
  res.json(updated);
};

exports.remove = (req, res) => {
  const t = db.prepare('SELECT * FROM teacher_profiles WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '教师不存在' });
  db.prepare('DELETE FROM teacher_honors WHERE teacher_id = ?').run(req.params.id);
  db.prepare('DELETE FROM class_teachers WHERE teacher_id = ?').run(req.params.id);
  db.prepare('DELETE FROM teacher_profiles WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
};
