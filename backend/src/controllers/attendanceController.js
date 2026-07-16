const db = require('../db');

exports.list = (req, res) => {
  const { class_id, start_date, end_date } = req.query;
  const conditions = [];
  const params = [];
  if (class_id) { conditions.push('a.class_id = ?'); params.push(class_id); }
  if (start_date) { conditions.push('a.date >= ?'); params.push(start_date); }
  if (end_date) { conditions.push('a.date <= ?'); params.push(end_date); }
  let sql = 'SELECT a.*, c.name as class_name FROM attendances a JOIN classes c ON a.class_id = c.id';
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY a.date DESC, a.created_at DESC';
  const attendances = db.prepare(sql).all(...params);
  res.json(attendances);
};

exports.get = (req, res) => {
  const a = db.prepare('SELECT a.*, c.name as class_name FROM attendances a JOIN classes c ON a.class_id = c.id WHERE a.id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: '考勤记录不存在' });
  const records = db.prepare(`
    SELECT ar.*, s.name as student_name, s.student_no, s.photo, s.gender
    FROM attendance_records ar
    JOIN students s ON ar.student_id = s.id
    WHERE ar.attendance_id = ?
    ORDER BY ar.status, s.student_no
  `).all(a.id);
  res.json({ ...a, records });
};

exports.create = (req, res) => {
  const { class_id, type, date, role, total, should_attend, actual_attend, leave_count, late_count, absence_count, records } = req.body;
  if (!class_id || !date) return res.status(422).json({ error: '班级和日期为必填项' });

  const c = db.prepare('SELECT id FROM classes WHERE id = ?').get(class_id);
  if (!c) return res.status(404).json({ error: '班级不存在' });

  const result = db.prepare(
    'INSERT INTO attendances (class_id, type, date, role, total, should_attend, actual_attend, leave_count, late_count, absence_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(class_id, type || '教学考勤', date, role || '老师', total || 0, should_attend || 0, actual_attend || 0, leave_count || 0, late_count || 0, absence_count || 0);

  const attendanceId = result.lastInsertRowid;

  if (records && records.length > 0) {
    const insert = db.prepare('INSERT OR REPLACE INTO attendance_records (attendance_id, student_id, status) VALUES (?, ?, ?)');
    for (const r of records) {
      if (r.student_id) insert.run(attendanceId, r.student_id, r.status || '缺勤');
    }
  }

  const attendance = db.prepare('SELECT * FROM attendances WHERE id = ?').get(attendanceId);
  res.status(201).json(attendance);
};

exports.remove = (req, res) => {
  const a = db.prepare('SELECT * FROM attendances WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: '考勤记录不存在' });
  db.prepare('DELETE FROM attendance_records WHERE attendance_id = ?').run(req.params.id);
  db.prepare('DELETE FROM attendances WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
};
