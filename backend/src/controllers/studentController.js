const db = require('../db');

exports.list = (req, res) => {
  const classId = req.params.classId;
  if (classId) {
    const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
    if (!cls) return res.status(404).json({ error: '班级不存在' });
    const students = db.prepare('SELECT s.*, c.name as class_name FROM students s JOIN classes c ON s.class_id = c.id WHERE s.class_id = ? ORDER BY s.student_no').all(classId);
    return res.json(students);
  }
  res.json([]);
};

exports.listAll = (req, res) => {
  const { keyword, class_id } = req.query;
  let sql = 'SELECT s.*, c.name as class_name FROM students s JOIN classes c ON s.class_id = c.id WHERE c.teacher_id = ?';
  const params = [req.teacherId];
  if (keyword) {
    sql += ' AND (s.name LIKE ? OR s.student_no LIKE ?)';
    params.push('%' + keyword + '%', '%' + keyword + '%');
  }
  if (class_id && class_id !== 'all') {
    sql += ' AND s.class_id = ?';
    params.push(class_id);
  }
  sql += ' ORDER BY s.student_no';
  const students = db.prepare(sql).all(...params);
  res.json(students);
};

exports.create = (req, res) => {
  const classId = req.params.classId;
  const cls = db.prepare('SELECT * FROM classes WHERE id = ? AND teacher_id = ?').get(classId, req.teacherId);
  if (!cls) return res.status(404).json({ error: '班级不存在' });

  const { name, student_no, gender, phone, birth_date, hometown, photo, class_role } = req.body;
  if (!name || !name.trim()) return res.status(422).json({ error: '姓名为必填项' });
  if (!student_no || !student_no.trim()) return res.status(422).json({ error: '学号为必填项' });

  const existing = db.prepare('SELECT id FROM students WHERE class_id = ? AND student_no = ?').get(classId, student_no.trim());
  if (existing) return res.status(409).json({ error: '该学号已存在' });

  const result = db.prepare('INSERT INTO students (name, student_no, gender, phone, birth_date, hometown, photo, class_role, class_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(name.trim(), student_no.trim(), gender || '', phone || '', birth_date || '', hometown || '', photo || '', class_role || '', classId);
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(student);
};

exports.get = (req, res) => {
  const student = db.prepare(`
    SELECT s.*, c.name as class_name
    FROM students s
    JOIN classes c ON s.class_id = c.id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!student) return res.status(404).json({ error: '学生不存在' });

  const scores = db.prepare(`
    SELECT sc.score, e.name as exam_name, e.subject, e.exam_date
    FROM scores sc
    JOIN exams e ON sc.exam_id = e.id
    WHERE sc.student_id = ?
    ORDER BY e.exam_date DESC
  `).all(student.id);

  res.json({ ...student, scores });
};

exports.update = (req, res) => {
  const student = db.prepare('SELECT s.* FROM students s JOIN classes c ON s.class_id = c.id WHERE s.id = ? AND c.teacher_id = ?')
    .get(req.params.id, req.teacherId);

  if (!student) return res.status(404).json({ error: '学生不存在' });

  const { name, student_no, gender, phone, birth_date, hometown, photo, class_role, class_id } = req.body;
  if (!name || !name.trim()) return res.status(422).json({ error: '姓名为必填项' });
  if (!student_no || !student_no.trim()) return res.status(422).json({ error: '学号为必填项' });

  if (class_id !== undefined && class_id !== student.class_id) {
    const cls = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(class_id, req.teacherId);
    if (!cls) return res.status(404).json({ error: '目标班级不存在' });
  }

  if (student_no.trim() !== student.student_no) {
    const checkClassId = class_id !== undefined ? class_id : student.class_id;
    const existing = db.prepare('SELECT id FROM students WHERE class_id = ? AND student_no = ? AND id != ?')
      .get(checkClassId, student_no.trim(), student.id);
    if (existing) return res.status(409).json({ error: '该学号已存在' });
  }

  const newClassId = class_id !== undefined ? class_id : student.class_id;
  db.prepare('UPDATE students SET name = ?, student_no = ?, gender = ?, phone = ?, birth_date = ?, hometown = ?, photo = ?, class_role = ?, class_id = ? WHERE id = ?')
    .run(name.trim(), student_no.trim(), gender || '', phone || '', birth_date !== undefined ? birth_date : student.birth_date, hometown !== undefined ? hometown : student.hometown, photo !== undefined ? photo : student.photo, class_role !== undefined ? class_role : student.class_role, newClassId, student.id);

  const updated = db.prepare('SELECT * FROM students WHERE id = ?').get(student.id);
  res.json(updated);
};

exports.transfer = (req, res) => {
  const { class_id } = req.body;
  if (!class_id) return res.status(422).json({ error: '目标班级ID为必填项' });

  const student = db.prepare('SELECT s.* FROM students s JOIN classes c ON s.class_id = c.id WHERE s.id = ? AND c.teacher_id = ?')
    .get(req.params.id, req.teacherId);
  if (!student) return res.status(404).json({ error: '学生不存在' });

  const cls = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(class_id, req.teacherId);
  if (!cls) return res.status(404).json({ error: '目标班级不存在' });

  db.prepare('UPDATE students SET class_id = ? WHERE id = ?').run(class_id, req.params.id);
  const updated = db.prepare('SELECT s.*, c.name as class_name FROM students s JOIN classes c ON s.class_id = c.id WHERE s.id = ?').get(req.params.id);
  res.json(updated);
};

exports.remove = (req, res) => {
  const student = db.prepare('SELECT s.id FROM students s JOIN classes c ON s.class_id = c.id WHERE s.id = ? AND c.teacher_id = ?')
    .get(req.params.id, req.teacherId);
  if (!student) return res.status(404).json({ error: '学生不存在' });
  db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
};
