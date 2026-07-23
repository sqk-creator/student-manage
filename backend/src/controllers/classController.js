const db = require('../db');

exports.list = (req, res) => {
  const { grade_id, type } = req.query;
  let where = 'WHERE c.teacher_id = ?';
  const params = [req.teacherId];
  if (grade_id) { where += ' AND c.grade_id = ?'; params.push(grade_id); }
  if (type) { where += ' AND c.type = ?'; params.push(type); }
  const classes = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM students WHERE class_id = c.id) as student_count
    FROM classes c
    ${where}
    ORDER BY c.created_at DESC
  `).all(...params);

  const result = classes.map(c => {
    const teachers = db.prepare(`
      SELECT ct.*, tp.phone, tp.subjects as profile_subjects
      FROM class_teachers ct
      LEFT JOIN teacher_profiles tp ON ct.teacher_id = tp.id
      WHERE ct.class_id = ?
      ORDER BY ct.id
    `).all(c.id);
    return { ...c, teachers };
  });
  res.json(result);
};

exports.get = (req, res) => {
  const c = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: '班级不存在' });
  c.student_count = db.prepare('SELECT COUNT(*) as count FROM students WHERE class_id = ?').get(c.id).count;
  c.teachers = db.prepare(`
    SELECT ct.*, tp.phone, tp.subjects as profile_subjects
    FROM class_teachers ct
    LEFT JOIN teacher_profiles tp ON ct.teacher_id = tp.id
    WHERE ct.class_id = ?
    ORDER BY ct.id
  `).all(c.id);
  c.students = db.prepare('SELECT * FROM students WHERE class_id = ? ORDER BY student_no').all(c.id);
  res.json(c);
};

exports.create = (req, res) => {
  const { name, grade, type, grade_id } = req.body;
  if (!name || !name.trim()) return res.status(422).json({ error: '班级名称为必填项' });

  const existing = db.prepare('SELECT id FROM classes WHERE name = ? AND teacher_id = ?').get(name.trim(), req.teacherId);
  if (existing) return res.status(409).json({ error: '班级名称已存在' });

  const teacher = db.prepare('SELECT id FROM teachers WHERE id = ?').get(req.teacherId);
  if (!teacher) {
    db.prepare('INSERT INTO teachers (id, openid, name) VALUES (?, ?, ?)').run(req.teacherId, 'wx_' + req.teacherId, '');
  }

  const result = db.prepare('INSERT INTO classes (name, grade, type, grade_id, teacher_id) VALUES (?, ?, ?, ?, ?)')
    .run(name.trim(), grade || '', type || '', grade_id || null, req.teacherId);
  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(cls);
};

exports.update = (req, res) => {
  const { name, grade, type, grade_id } = req.body;
  const cls = db.prepare('SELECT * FROM classes WHERE id = ? AND teacher_id = ?').get(req.params.id, req.teacherId);
  if (!cls) return res.status(404).json({ error: '班级不存在' });

  db.prepare('UPDATE classes SET name = ?, grade = ?, type = ?, grade_id = ? WHERE id = ?')
    .run(
      name || cls.name,
      grade !== undefined ? grade : cls.grade,
      type !== undefined ? type : cls.type,
      grade_id !== undefined ? grade_id : cls.grade_id,
      req.params.id
    );
  const updated = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id);
  res.json(updated);
};

exports.remove = (req, res) => {
  const cls = db.prepare('SELECT * FROM classes WHERE id = ? AND teacher_id = ?').get(req.params.id, req.teacherId);
  if (!cls) return res.status(404).json({ error: '班级不存在' });
  db.prepare('DELETE FROM classes WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
};

exports.addTeacher = (req, res) => {
  const { name, role, teacher_id } = req.body;
  if (!name || !name.trim()) return res.status(422).json({ error: '教师姓名为必填项' });
  const cls = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(req.params.classId, req.teacherId);
  if (!cls) return res.status(404).json({ error: '班级不存在' });
  const result = db.prepare('INSERT INTO class_teachers (class_id, name, role, teacher_id) VALUES (?, ?, ?, ?)')
    .run(req.params.classId, name.trim(), role || '任课教师', teacher_id || null);
  res.status(201).json({ id: result.lastInsertRowid });
};

exports.removeTeacher = (req, res) => {
  const ct = db.prepare(`
    SELECT ct.id FROM class_teachers ct
    JOIN classes c ON ct.class_id = c.id
    WHERE ct.id = ? AND c.teacher_id = ?
  `).get(req.params.teacherId, req.teacherId);
  if (!ct) return res.status(404).json({ error: '教师关联不存在' });
  db.prepare('DELETE FROM class_teachers WHERE id = ?').run(req.params.teacherId);
  res.json({ message: '删除成功' });
};

exports.updateTeacher = (req, res) => {
  const { class_id, name, role } = req.body;
  const ct = db.prepare(`
    SELECT ct.* FROM class_teachers ct
    JOIN classes c ON ct.class_id = c.id
    WHERE ct.id = ? AND c.teacher_id = ?
  `).get(req.params.teacherId, req.teacherId);
  if (!ct) return res.status(404).json({ error: '教师关联不存在' });

  const newClassId = class_id || ct.class_id;
  if (class_id) {
    const cls = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(newClassId, req.teacherId);
    if (!cls) return res.status(404).json({ error: '目标班级不存在' });
  }

  db.prepare('UPDATE class_teachers SET class_id = ?, name = ?, role = ? WHERE id = ?')
    .run(newClassId, name || ct.name, role || ct.role, req.params.teacherId);
  const updated = db.prepare('SELECT * FROM class_teachers WHERE id = ?').get(req.params.teacherId);
  res.json(updated);
};
