const express = require('express');
const cors = require('cors');
const path = require('path');
const { authMiddleware } = require('./middleware/auth');
const { photoUpload } = require('./shared/upload');

const authRoutes = require('./routes/auth');
const classRoutes = require('./routes/classes');
const studentRoutes = require('./routes/students');
const examRoutes = require('./routes/exams');
const examGroupRoutes = require('./routes/exam-groups');
const scoreRoutes = require('./routes/scores');
const bannerRoutes = require('./routes/banners');
const teacherProfileRoutes = require('./routes/teacher-profiles');
const teacherHonorsRoutes = require('./routes/teacher-honors');
const classEventsRoutes = require('./routes/class-events');
const attendanceRoutes = require('./routes/attendances');
const studentCommentRoutes = require('./routes/student-comments');
const gradeRoutes = require('./routes/grades');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.get('/api/banners/enabled', require('./controllers/bannerController').enabled);
app.get('/api/public/classes', (req, res) => {
  const db = require('./db');
  let sql = `SELECT c.*, (SELECT COUNT(*) FROM students WHERE class_id = c.id) as student_count FROM classes c`;
  const params = [];
  if (req.query.teacher_id) {
    sql += ' WHERE c.teacher_id = ?';
    params.push(req.query.teacher_id);
  }
  sql += ' ORDER BY c.created_at DESC';
  const classes = db.prepare(sql).all(...params);
  const result = classes.map(c => {
    const teachers = db.prepare(`
      SELECT ct.*, tp.phone, tp.subjects as profile_subjects, tp.photo as teacher_photo
      FROM class_teachers ct
      LEFT JOIN teacher_profiles tp ON ct.teacher_id = tp.id
      WHERE ct.class_id = ?
      ORDER BY ct.id
    `).all(c.id);
    return { ...c, teachers };
  });
  res.json(result);
});
app.get('/api/public/classes/:id', (req, res) => {
  const db = require('./db');
  const c = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: '班级不存在' });
  c.student_count = db.prepare('SELECT COUNT(*) as count FROM students WHERE class_id = ?').get(c.id).count;
  c.teachers = db.prepare(`
    SELECT ct.*, tp.phone, tp.subjects as profile_subjects, tp.photo as teacher_photo
    FROM class_teachers ct
    LEFT JOIN teacher_profiles tp ON ct.teacher_id = tp.id
    WHERE ct.class_id = ?
    ORDER BY ct.id
  `).all(c.id);
  c.students = db.prepare('SELECT s.*, c2.name as class_name FROM students s JOIN classes c2 ON s.class_id = c2.id WHERE s.class_id = ? ORDER BY s.student_no').all(c.id);
  res.json(c);
});
app.get('/api/public/students', (req, res) => {
  const db = require('./db');
  const { keyword, class_id, teacher_id } = req.query;
  let sql = 'SELECT s.*, c.name as class_name FROM students s JOIN classes c ON s.class_id = c.id WHERE 1=1';
  const params = [];
  if (teacher_id) { sql += ' AND c.teacher_id = ?'; params.push(teacher_id); }
  if (keyword) { sql += ' AND (s.name LIKE ? OR s.student_no LIKE ?)'; params.push('%' + keyword + '%', '%' + keyword + '%'); }
  if (class_id && class_id !== 'all') { sql += ' AND s.class_id = ?'; params.push(class_id); }
  sql += ' ORDER BY s.student_no';
  res.json(db.prepare(sql).all(...params));
});
app.get('/api/public/students/:id', (req, res) => {
  const db = require('./db');
  const s = db.prepare('SELECT s.*, c.name as class_name FROM students s JOIN classes c ON s.class_id = c.id WHERE s.id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: '学生不存在' });
  res.json(s);
});
app.get('/api/public/scores', (req, res) => {
  const db = require('./db');
  const { student_id } = req.query;
  if (!student_id) return res.json([]);
  const scores = db.prepare(`
    SELECT sc.*, e.exam_name, e.exam_name as name, e.subject
    FROM scores sc JOIN exams e ON sc.exam_id = e.id
    WHERE sc.student_id = ? ORDER BY e.exam_time DESC, e.exam_date DESC
  `).all(student_id);
  res.json(scores);
});
app.get('/api/public/teachers/:id/honors', (req, res) => {
  const db = require('./db');
  const honors = db.prepare('SELECT * FROM teacher_honors WHERE teacher_id = ? ORDER BY date DESC').all(req.params.id);
  res.json(honors);
});
app.get('/api/public/classes/:id/events', (req, res) => {
  const db = require('./db');
  const events = db.prepare('SELECT * FROM class_events WHERE class_id = ? ORDER BY date DESC').all(req.params.id);
  res.json(events);
});
app.get('/api/public/attendances', (req, res) => {
  const db = require('./db');
  const { class_id, date, start_date, end_date } = req.query;
  let sql = 'SELECT a.*, c.name as class_name FROM attendances a JOIN classes c ON a.class_id = c.id WHERE 1=1';
  const params = [];
  if (class_id) { sql += ' AND a.class_id = ?'; params.push(class_id); }
  if (date) { sql += ' AND a.date = ?'; params.push(date); }
  if (start_date && end_date) { sql += ' AND a.date BETWEEN ? AND ?'; params.push(start_date, end_date); }
  sql += ' ORDER BY a.date DESC, a.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});
app.get('/api/public/attendances/:id', (req, res) => {
  const db = require('./db');
  const a = db.prepare('SELECT a.*, c.name as class_name FROM attendances a JOIN classes c ON a.class_id = c.id WHERE a.id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: '考勤记录不存在' });
  const records = db.prepare('SELECT ar.*, s.name as student_name, s.student_no, s.photo, s.gender FROM attendance_records ar JOIN students s ON ar.student_id = s.id WHERE ar.attendance_id = ? ORDER BY ar.status, s.student_no').all(a.id);
  res.json({ ...a, records });
});
app.post('/api/public/attendances', (req, res) => {
  const db = require('./db');
  const { class_id, type, date, role, total, should_attend, actual_attend, leave_count, late_count, absence_count, submitted_at, records } = req.body;
  if (!class_id || !date) return res.status(422).json({ error: '班级和日期为必填项' });
  const c = db.prepare('SELECT id FROM classes WHERE id = ?').get(class_id);
  if (!c) return res.status(404).json({ error: '班级不存在' });
  const now = new Date();
  const localTime = submitted_at || (now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0')+' '+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0'));
  const result = db.prepare('INSERT INTO attendances (class_id, type, date, role, total, should_attend, actual_attend, leave_count, late_count, absence_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(class_id, type || '教学考勤', date, role || '老师', total || 0, should_attend || 0, actual_attend || 0, leave_count || 0, late_count || 0, absence_count || 0, localTime);
  const aid = result.lastInsertRowid;
  if (records && records.length > 0) {
    const insert = db.prepare('INSERT OR REPLACE INTO attendance_records (attendance_id, student_id, status) VALUES (?, ?, ?)');
    for (const r of records) { if (r.student_id) insert.run(aid, r.student_id, r.status || '缺勤'); }
  }
  res.status(201).json(db.prepare('SELECT * FROM attendances WHERE id = ?').get(aid));
});
app.get('/api/public/attendance-summary', (req, res) => {
  const db = require('./db');
  const today = new Date().toISOString().slice(0, 10);
  const { class_id } = req.query;

  const classes = class_id
    ? [db.prepare('SELECT id, (SELECT COUNT(*) FROM students WHERE class_id = classes.id) as student_count FROM classes WHERE id = ?').get(class_id)].filter(Boolean)
    : db.prepare('SELECT id, (SELECT COUNT(*) FROM students WHERE class_id = classes.id) as student_count FROM classes').all();

  const result = classes.map(c => {
    const total = c.student_count || 0;
    const atts = db.prepare('SELECT id, type FROM attendances WHERE class_id = ? AND date = ?').all(c.id, today);

    function countDistinct(attList, status) {
      if (attList.length === 0) return 0;
      const ids = attList.map(a => a.id);
      const ph = ids.map(() => '?').join(',');
      const row = db.prepare(
        `SELECT COUNT(DISTINCT student_id) as cnt FROM attendance_records WHERE attendance_id IN (${ph}) AND status = ?`
      ).get(...ids, status);
      return row ? row.cnt : 0;
    }

    const teachAtts = atts.filter(a => a.type === '教学考勤');
    const exerAtts = atts.filter(a => a.type === '出操考勤');

    const teachLeave = countDistinct(teachAtts, '请假');
    const teachAbsence = countDistinct(teachAtts, '缺勤');
    const teachActual = total - teachLeave - teachAbsence;

    const exerLeave = countDistinct(exerAtts, '请假');
    const exerAbsence = countDistinct(exerAtts, '缺勤');
    const exerActual = total - exerLeave - exerAbsence;

    const allLeave = countDistinct(atts, '请假');
    const allAbsence = countDistinct(atts, '缺勤');

    return {
      class_id: c.id,
      total,
      has_teaching: teachAtts.length > 0,
      teach_rate: total > 0 ? Math.round(teachActual / total * 100) : 0,
      has_exercise: exerAtts.length > 0,
      exer_rate: total > 0 ? Math.round(exerActual / total * 100) : 0,
      leave_total: allLeave,
      absence_total: allAbsence
    };
  });

  res.json(class_id ? (result[0] || {}) : result);
});
app.get('/api/public/attendance-cal-status', (req, res) => {
  const db = require('./db');
  const { class_id } = req.query;
  if (!class_id) return res.status(422).json({ error: 'class_id 为必填项' });
  const rows = db.prepare(`
    SELECT a.date,
      (SELECT COUNT(DISTINCT ar.student_id) FROM attendance_records ar JOIN attendances a2 ON ar.attendance_id = a2.id WHERE a2.class_id = ? AND a2.date = a.date AND ar.status IN ('缺勤','请假')) as abnormal_cnt
    FROM attendances a
    WHERE a.class_id = ?
    GROUP BY a.date
  `).all(class_id, class_id);
  const result = {};
  for (const r of rows) {
    result[r.date] = r.abnormal_cnt > 0 ? '缺' : '全';
  }
  res.json(result);
});
app.get('/api/public/students/:id/attendance-stats', (req, res) => {
  const db = require('./db');
  const { id } = req.params;
  const { month } = req.query;

  const s = db.prepare('SELECT id, class_id FROM students WHERE id = ?').get(id);
  if (!s) return res.status(404).json({ error: '学生不存在' });

  const now = new Date();
  const year = month ? parseInt(month.substring(0, 4)) : now.getFullYear();
  const mon = month ? parseInt(month.substring(5, 7)) : (now.getMonth() + 1);
  const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const endDate = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const stats = db.prepare(`
    SELECT
      COUNT(CASE WHEN a.type != '出操考勤' THEN 1 END) as should_attend,
      COUNT(CASE WHEN a.type != '出操考勤' AND ar.status NOT IN ('缺勤','请假') THEN 1 END) as actual_attend,
      COUNT(CASE WHEN a.type = '出操考勤' THEN 1 END) as should_exercise,
      COUNT(CASE WHEN a.type = '出操考勤' AND ar.status NOT IN ('缺勤','请假') THEN 1 END) as actual_exercise,
      COUNT(CASE WHEN a.type != '出操考勤' AND ar.status = '请假' THEN 1 END) as leave_count,
      COUNT(CASE WHEN a.type != '出操考勤' AND ar.status = '迟到' THEN 1 END) as late_count,
      COUNT(CASE WHEN a.type != '出操考勤' AND ar.status = '缺勤' THEN 1 END) as absence_count
    FROM attendance_records ar
    JOIN attendances a ON ar.attendance_id = a.id
    WHERE ar.student_id = ? AND a.date BETWEEN ? AND ?
  `).get(id, startDate, endDate);

  const attendanceRate = stats.should_attend > 0
    ? Math.round((stats.actual_attend / stats.should_attend) * 100) : 0;
  const exerciseRate = stats.should_exercise > 0
    ? Math.round((stats.actual_exercise / stats.should_exercise) * 100) : 0;

  let todayStatus = '今日暂未出勤';
  const todayRecord = db.prepare(`
    SELECT ar.status FROM attendance_records ar
    JOIN attendances a ON ar.attendance_id = a.id
    WHERE ar.student_id = ? AND a.date = ?
  `).get(id, today);

  if (todayRecord) {
    todayStatus = todayRecord.status === '缺勤' || todayRecord.status === '请假' || todayRecord.status === '迟到'
      ? '今日缺勤' : '今日已出勤';
  } else {
    const todayAttendance = db.prepare(`
      SELECT ar.id FROM attendance_records ar
      JOIN attendances a ON ar.attendance_id = a.id
      WHERE a.class_id = ? AND a.date = ?
      LIMIT 1
    `).get(s.class_id, today);
    if (todayAttendance) {
      todayStatus = '今日已出勤';
    }
  }

  res.json({
    student_id: parseInt(id),
    month: `${year}-${String(mon).padStart(2, '0')}`,
    should_attend: stats.should_attend,
    actual_attend: stats.actual_attend,
    should_exercise: stats.should_exercise,
    actual_exercise: stats.actual_exercise,
    leave_count: stats.leave_count,
    late_count: stats.late_count,
    absence_count: stats.absence_count,
    attendance_rate: attendanceRate,
    exercise_rate: exerciseRate,
    today_status: todayStatus
  });
});
app.get('/api/public/grades', (req, res) => {
  const db = require('./db');
  res.json(db.prepare('SELECT * FROM grades WHERE status = 1 ORDER BY sort ASC').all());
});
app.get('/api/public/grade/list', (req, res) => {
  const db = require('./db');
  res.json(db.prepare('SELECT * FROM grades WHERE status = 1 ORDER BY sort ASC').all());
});
app.use('/api/banners', authMiddleware, bannerRoutes);
app.use('/api/classes', authMiddleware, classRoutes);

app.post('/api/upload-photo', authMiddleware, photoUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择文件' });
  res.json({ url: '/uploads/' + req.file.filename });
});

app.post('/api/students/upload-photo', authMiddleware, photoUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择文件' });
  res.json({ url: '/uploads/' + req.file.filename });
});

app.use('/api/students', authMiddleware, studentRoutes);
app.use('/api/exams', authMiddleware, examRoutes);
app.use('/api/exam-groups', authMiddleware, examGroupRoutes);
app.use('/api/scores', authMiddleware, scoreRoutes);
app.use('/api/teacher-profiles', authMiddleware, teacherProfileRoutes);
app.use('/api/teacher-profiles/:teacherId/honors', authMiddleware, teacherHonorsRoutes);
app.use('/api/classes/:classId/events', authMiddleware, classEventsRoutes);
app.use('/api/attendances', authMiddleware, attendanceRoutes);
app.use('/api/students/:studentId/comments', authMiddleware, studentCommentRoutes);
app.use('/api/grades', authMiddleware, gradeRoutes);

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: '服务器异常' });
});

app.listen(PORT, () => {
  console.log(`后端服务已启动: http://localhost:${PORT}`);
});
