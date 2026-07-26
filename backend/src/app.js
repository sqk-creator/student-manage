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
const subjectRoutes = require('./routes/subjects');
const featureCardRoutes = require('./routes/featureCards');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.get('/api/banners/enabled', require('./controllers/bannerController').enabled);
app.get('/api/feature-cards/enabled', require('./controllers/featureCardController').enabled);
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
app.get('/api/public/students/:id/score-summary', (req, res) => {
  const db = require('./db');
  const studentId = req.params.id;
  const type = req.query.type || 'comprehensive';
  const student = db.prepare('SELECT id, class_id, name FROM students WHERE id = ?').get(studentId);
  if (!student) return res.status(404).json({ error: '学生不存在' });

  if (type === 'comprehensive') {
    const records = db.prepare(`
      WITH stu_total AS (
        SELECT eg.id as group_id, eg.group_name,
          MAX(e.exam_date) as exam_date,
          SUM(e.total_score) as total_score,
          SUM(sc.score) as student_total
        FROM scores sc
        JOIN exams e ON sc.exam_id = e.id
        JOIN exam_groups eg ON e.group_id = eg.id
        WHERE sc.student_id = ?
        GROUP BY eg.id
      ),
      all_total AS (
        SELECT eg.id as group_id, sc.student_id, st.class_id,
          SUM(sc.score) as total
        FROM scores sc
        JOIN exams e ON sc.exam_id = e.id
        JOIN exam_groups eg ON e.group_id = eg.id
        JOIN students st ON sc.student_id = st.id
        GROUP BY eg.id, sc.student_id
      )
      SELECT st.*,
        (SELECT ROUND(AVG(at2.total),1) FROM all_total at2 WHERE at2.group_id = st.group_id) as avg_total,
        (SELECT COUNT(*)+1 FROM all_total at2 WHERE at2.group_id = st.group_id AND at2.class_id = ? AND at2.total > st.student_total) as class_rank,
        (SELECT COUNT(*)+1 FROM all_total at2 WHERE at2.group_id = st.group_id AND at2.total > st.student_total) as grade_rank
      FROM stu_total st
      ORDER BY st.exam_date ASC
    `).all(studentId, student.class_id);
    res.json({ student_id: student.id, class_id: student.class_id, student_name: student.name, exams: records, type: 'comprehensive' });
  } else {
    const exams = db.prepare(`
      SELECT
        e.id as exam_id, e.exam_name, e.exam_date, e.total_score,
        s.score as student_score,
        s.single_rank as grade_rank,
        (SELECT ROUND(AVG(sc.score),1) FROM scores sc WHERE sc.exam_id = e.id) as avg_score,
        (SELECT ROUND(AVG(sc.score),1) FROM scores sc JOIN students st ON sc.student_id = st.id WHERE sc.exam_id = e.id AND st.class_id = ?) as class_avg,
        (SELECT COUNT(*) + 1 FROM scores sc2 JOIN students st2 ON sc2.student_id = st2.id WHERE sc2.exam_id = e.id AND st2.class_id = ? AND sc2.score > s.score) as class_rank
      FROM scores s
      JOIN exams e ON s.exam_id = e.id
      WHERE s.student_id = ? AND (e.group_id IS NULL OR e.group_id = 0)
      ORDER BY e.exam_date ASC
    `).all(student.class_id, student.class_id, studentId);
    res.json({ student_id: student.id, class_id: student.class_id, student_name: student.name, exams, type: 'single' });
  }
});
app.get('/api/public/exams/list', (req, res) => {
  const db = require('./db');
  const { class_id } = req.query;
  let sql = 'SELECT e.id, e.exam_name, e.subject, e.exam_date, e.total_score FROM exams e WHERE (e.group_id IS NULL OR e.group_id = 0)';
  const params = [];
  if (class_id) { sql += ' AND e.class_id = ?'; params.push(class_id); }
  sql += ' ORDER BY e.exam_date DESC';
  res.json(db.prepare(sql).all(...params));
});
app.get('/api/public/exam-groups/list', (req, res) => {
  const db = require('./db');
  const { class_id, grade_id } = req.query;
  let sql = 'SELECT id, group_name, exam_date, total_score, scope_type, exam_type FROM exam_groups WHERE 1=1';
  const params = [];
  if (class_id) { sql += ' AND (class_id = ? OR (scope_type = \'grade\' AND grade_id = (SELECT grade_id FROM classes WHERE id = ?)))'; params.push(class_id, class_id); }
  if (grade_id) { sql += ' AND grade_id = ?'; params.push(grade_id); }
  sql += ' ORDER BY exam_date DESC';
  res.json(db.prepare(sql).all(...params));
});
app.get('/api/public/exam-stats', (req, res) => {
  const db = require('./db');
  const { exam_id } = req.query;
  if (!exam_id) return res.status(400).json({ error: '缺少 exam_id' });
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(exam_id);
  if (!exam) return res.status(404).json({ error: '考试不存在' });
  const dbStats = db.prepare('SELECT COUNT(*) as total, ROUND(AVG(score),1) as avg, MAX(score) as max, MIN(score) as min FROM scores WHERE exam_id = ?').get(exam_id);
  const dist = db.prepare(`
    SELECT
      SUM(CASE WHEN ROUND((score*100.0/ ?),0) >= 90 THEN 1 ELSE 0 END) as excellent,
      SUM(CASE WHEN ROUND((score*100.0/ ?),0) >= 80 AND ROUND((score*100.0/ ?),0) < 90 THEN 1 ELSE 0 END) as good,
      SUM(CASE WHEN ROUND((score*100.0/ ?),0) >= 60 AND ROUND((score*100.0/ ?),0) < 80 THEN 1 ELSE 0 END) as average,
      SUM(CASE WHEN ROUND((score*100.0/ ?),0) < 60 THEN 1 ELSE 0 END) as fail
    FROM scores WHERE exam_id = ?
  `).get(exam.total_score || 100, exam.total_score || 100, exam.total_score || 100, exam.total_score || 100, exam.total_score || 100, exam.total_score || 100, exam_id);
  const rankings = db.prepare(`
    SELECT s.id as student_id, s.name as student_name, s.student_no,
      sc.score, sc.single_rank as rank, sc.level
    FROM scores sc JOIN students s ON sc.student_id = s.id
    WHERE sc.exam_id = ? ORDER BY sc.score DESC
  `).all(exam_id);
  res.json({ exam, stats: dbStats, distribution: dist, rankings });
});
app.get('/api/public/group-stats', (req, res) => {
  const db = require('./db');
  const { group_id } = req.query;
  if (!group_id) return res.status(400).json({ error: '缺少 group_id' });
  const group = db.prepare('SELECT * FROM exam_groups WHERE id = ?').get(group_id);
  if (!group) return res.status(404).json({ error: '考试批次不存在' });
  const exams = db.prepare('SELECT e.id as exam_id, e.exam_name, e.subject, e.total_score FROM exams e WHERE e.group_id = ?').all(group_id);
  const examStats = exams.map(ex => {
    const st = db.prepare('SELECT COUNT(*) as total, ROUND(AVG(score),1) as avg, MAX(score) as max, MIN(score) as min FROM scores WHERE exam_id = ?').get(ex.exam_id);
    return { ...ex, stats: st };
  });
  const students = db.prepare(`
    SELECT DISTINCT s.id, s.name, s.student_no FROM students s
    JOIN scores sc ON sc.student_id = s.id
    JOIN exams e ON sc.exam_id = e.id
    WHERE e.group_id = ?
  `).all(group_id);
  const studentStats = students.map(st => {
    const subjects = {};
    let total = 0;
    exams.forEach(ex => {
      const sc = db.prepare('SELECT score, level, single_rank as rank FROM scores WHERE student_id = ? AND exam_id = ?').get(st.id, ex.exam_id);
      if (sc) {
        subjects[ex.subject || ex.exam_name] = { score: sc.score, level: sc.level, rank: sc.rank, exam_name: ex.exam_name };
        total += sc.score;
      }
    });
    return { student_id: st.id, student_name: st.name, student_no: st.student_no, total, subjects };
  });
  studentStats.sort((a, b) => b.total - a.total);
  studentStats.forEach((st, i) => { st.rank = i + 1; });
  res.json({ group, exams: examStats, rankings: studentStats });
});
app.get('/api/public/exam-group-summaries', (req, res) => {
  const db = require('./db');
  const { grade_id } = req.query;
  let sql = 'SELECT eg.*, g.grade_name FROM exam_groups eg LEFT JOIN grades g ON eg.grade_id = g.id WHERE 1=1';
  const params = [];
  if (grade_id) { sql += ' AND eg.grade_id = ?'; params.push(grade_id); }
  sql += ' ORDER BY eg.exam_date DESC';
  const groups = db.prepare(sql).all(...params);
  const summaries = groups.map(grp => {
    const exams = db.prepare('SELECT exam_name, subject, total_score FROM exams WHERE group_id = ?').all(grp.id);
    const subjects = exams.map(e => e.subject || e.exam_name);
    const studentTotals = db.prepare(`
      SELECT sc.student_id, SUM(sc.score) as total
      FROM scores sc JOIN exams e ON sc.exam_id = e.id
      WHERE e.group_id = ? GROUP BY sc.student_id
    `).all(grp.id);
    const totals = studentTotals.map(s => s.total);
    const avgTotal = totals.length ? Math.round(totals.reduce((a,b)=>a+b,0)/totals.length) : 0;
    const maxPossible = grp.total_score || exams.reduce((s,e)=>s+e.total_score,0);
    const passCount = totals.filter(t => t >= maxPossible * 0.6).length;
    const passRate = totals.length ? Math.round(passCount/totals.length*100) : 0;
    return {
      group_id: grp.id,
      group_name: grp.group_name,
      grade_name: grp.grade_name || '',
      grade_id: grp.grade_id,
      exam_date: grp.exam_date,
      total_score: maxPossible,
      subjects,
      student_count: studentTotals.length,
      avg_total: avgTotal,
      pass_rate: passRate + '%'
    };
  });
  res.json(summaries);
});
app.get('/api/public/grade-trend', (req, res) => {
  const db = require('./db');
  const { grade_id } = req.query;
  if (!grade_id) return res.status(422).json({ error: 'grade_id is required' });
  const grade = db.prepare('SELECT * FROM grades WHERE id = ?').get(grade_id);
  if (!grade) return res.status(404).json({ error: '年级不存在' });
  const groups = db.prepare('SELECT * FROM exam_groups WHERE grade_id = ? AND exam_type = ? ORDER BY exam_date ASC').all(grade_id, 'comprehensive');
  const groupStats = groups.map(grp => {
    const exams = db.prepare('SELECT id, exam_name, subject, total_score FROM exams WHERE group_id = ?').all(grp.id);
    const studentTotals = db.prepare(`
      SELECT sc.student_id, SUM(sc.score) as total
      FROM scores sc JOIN exams e ON sc.exam_id = e.id
      WHERE e.group_id = ? GROUP BY sc.student_id
    `).all(grp.id);
    const totals = studentTotals.map(s => s.total);
    const avgTotal = totals.length ? Math.round(totals.reduce((a,b)=>a+b,0)/totals.length) : 0;
    const maxPossible = grp.total_score || exams.reduce((s,e)=>s+e.total_score,0);
    const passCount = totals.filter(t => t >= maxPossible * 0.6).length;
    const excCount = totals.filter(t => t >= maxPossible * 0.8).length;
    const passRate = totals.length ? Math.round(passCount/totals.length*100) : 0;
    const excRate = totals.length ? Math.round(excCount/totals.length*100) : 0;
    const subjects = exams.map(ex => {
      const scs = db.prepare('SELECT score FROM scores WHERE exam_id = ?').all(ex.id);
      const avgSc = scs.length ? Math.round(scs.reduce((a,b)=>a+b.score,0)/scs.length*10)/10 : 0;
      return { subject: ex.subject || ex.exam_name, avg_score: avgSc, max_score: ex.total_score };
    });
    return { group_id: grp.id, group_name: grp.group_name, exam_date: grp.exam_date, total_score: maxPossible, avg_total: avgTotal, pass_rate: passRate, excellent_rate: excRate, student_count: studentTotals.length, subjects };
  });
  const classes = db.prepare('SELECT id, name FROM classes WHERE grade_id = ? ORDER BY name ASC').all(grade_id);
  const classData = classes.map(cls => {
    const trends = groups.map(grp => {
      const clsTotals = db.prepare(`
        SELECT SUM(sc.score) as total
        FROM scores sc JOIN exams e ON sc.exam_id = e.id
        JOIN students s ON sc.student_id = s.id
        WHERE e.group_id = ? AND s.class_id = ?
        GROUP BY sc.student_id
      `).all(grp.id, cls.id).map(r => r.total);
      const avg = clsTotals.length ? Math.round(clsTotals.reduce((a,b)=>a+b,0)/clsTotals.length) : 0;
      const maxPossible = grp.total_score || db.prepare('SELECT SUM(total_score) FROM exams WHERE group_id = ?').pluck().get(grp.id) || 0;
      const passCount = clsTotals.filter(t => t >= maxPossible * 0.6).length;
      return { group_id: grp.id, group_name: grp.group_name, avg_total: avg, pass_rate: clsTotals.length ? Math.round(passCount/clsTotals.length*100) : 0 };
    });
    const avgAcross = trends.length ? Math.round(trends.reduce((a,b)=>a+b.avg_total,0)/trends.length) : 0;
    const recentChange = trends.length >= 2 ? trends[trends.length-1].avg_total - trends[trends.length-2].avg_total : 0;
    return { class_id: cls.id, class_name: cls.name, trends, avg_total: avgAcross, recent_change: recentChange };
  });
  const allPassRates = groupStats.map(g => g.pass_rate);
  const allExcRates = groupStats.map(g => g.excellent_rate);
  const allAvgs = groupStats.map(g => g.avg_total);
  const summary = {
    avg_total: groupStats.length ? Math.round(allAvgs.reduce((a,b)=>a+b,0)/allAvgs.length) : 0,
    avg_pass_rate: groupStats.length ? Math.round(allPassRates.reduce((a,b)=>a+b,0)/allPassRates.length) : 0,
    avg_excellent_rate: groupStats.length ? Math.round(allExcRates.reduce((a,b)=>a+b,0)/allExcRates.length) : 0,
    total_exams: groupStats.length
  };
  res.json({ grade_id: grade.id, grade_name: grade.grade_name, summary, groups: groupStats, classes: classData });
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
app.get('/api/public/subject/list', (req, res) => {
  const db = require('./db');
  res.json(db.prepare('SELECT * FROM subjects WHERE status = 1 ORDER BY sort ASC').all());
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
app.use('/api/subjects', authMiddleware, subjectRoutes);
app.use('/api/feature-cards', authMiddleware, featureCardRoutes);

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: '服务器异常' });
});

app.listen(PORT, () => {
  console.log(`后端服务已启动: http://localhost:${PORT}`);
});
