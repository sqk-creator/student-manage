const express = require('express');
const cors = require('cors');
const path = require('path');
const { authMiddleware } = require('./middleware/auth');
const { photoUpload, excelUpload, batchUpload } = require('./shared/upload');
const ExcelImporter = require('./shared/excel-import');
const dbModule = require('./db');
const db = dbModule;
const persistence = dbModule.persistence;

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
const photoBatchController = require('./controllers/photoBatchController');
const avatarController = require('./controllers/avatarController');

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
    const passCount = totals.filter(t => t >= maxPossible * 0.6 && t < maxPossible * 0.8).length;
    const passRate = totals.length ? Math.round(passCount/totals.length*100) : 0;
    return {
      group_id: grp.id,
      group_name: grp.group_name,
      grade_name: grp.grade_name || '',
      grade_id: grp.grade_id,
      exam_date: grp.exam_date,
      exam_type: grp.exam_type,
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
  const { grade_id, exam_type } = req.query;
  if (!grade_id) return res.status(422).json({ error: 'grade_id is required' });
  const grade = db.prepare('SELECT * FROM grades WHERE id = ?').get(grade_id);
  if (!grade) return res.status(404).json({ error: '年级不存在' });
  const defaultType = exam_type || db.prepare('SELECT exam_type FROM exam_groups WHERE grade_id = ? ORDER BY exam_date ASC LIMIT 1').pluck().get(grade_id) || 'comprehensive';
  const groups = db.prepare('SELECT * FROM exam_groups WHERE grade_id = ? AND exam_type = ? ORDER BY exam_date ASC').all(grade_id, defaultType);
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
    const passCount = totals.filter(t => t >= maxPossible * 0.6 && t < maxPossible * 0.8).length;
    const goodCount = totals.filter(t => t >= maxPossible * 0.8 && t < maxPossible * 0.9).length;
    const excCount = totals.filter(t => t >= maxPossible * 0.9).length;
    const passRate = totals.length ? Math.round(passCount/totals.length*100) : 0;
    const goodRate = totals.length ? Math.round(goodCount/totals.length*100) : 0;
    const excRate = totals.length ? Math.round(excCount/totals.length*100) : 0;
    const failRate = totals.length ? Math.max(0, 100 - excRate - goodRate - passRate) : 0;
    const scoreRate = maxPossible > 0 ? Math.round(avgTotal/maxPossible*100) : 0;
    const subjects = exams.map(ex => {
      const scs = db.prepare('SELECT score FROM scores WHERE exam_id = ?').all(ex.id);
      const avgSc = scs.length ? Math.round(scs.reduce((a,b)=>a+b.score,0)/scs.length*10)/10 : 0;
      const maxS = ex.total_score;
      const sPass = scs.filter(s => s.score >= maxS*0.6 && s.score < maxS*0.8).length;
      const sGood = scs.filter(s => s.score >= maxS*0.8 && s.score < maxS*0.9).length;
      const sExc  = scs.filter(s => s.score >= maxS*0.9).length;
      const sPassRate = scs.length ? Math.round(sPass/scs.length*100) : 0;
      const sGoodRate = scs.length ? Math.round(sGood/scs.length*100) : 0;
      const sExcRate  = scs.length ? Math.round(sExc/scs.length*100) : 0;
      const sFailRate = scs.length ? Math.max(0, 100 - sExcRate - sGoodRate - sPassRate) : 0;
      return { subject: ex.subject || ex.exam_name, avg_score: avgSc, max_score: ex.total_score, excellent_rate: sExcRate, good_rate: sGoodRate, pass_rate: sPassRate, fail_rate: sFailRate };
    });
    return { group_id: grp.id, group_name: grp.group_name, exam_date: grp.exam_date, total_score: maxPossible, avg_total: avgTotal, score_rate: scoreRate, excellent_rate: excRate, good_rate: goodRate, pass_rate: passRate, fail_rate: failRate, student_count: studentTotals.length, subjects };
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
      const passCount = clsTotals.filter(t => t >= maxPossible * 0.6 && t < maxPossible * 0.8).length;
      const goodCount = clsTotals.filter(t => t >= maxPossible * 0.8 && t < maxPossible * 0.9).length;
      const excCount = clsTotals.filter(t => t >= maxPossible * 0.9).length;
      return { group_id: grp.id, group_name: grp.group_name, avg_total: avg, pass_rate: clsTotals.length ? Math.round(passCount/clsTotals.length*100) : 0, good_count: goodCount, excellent_count: excCount, pass_count: passCount };
    });
    const avgAcross = trends.length ? Math.round(trends.reduce((a,b)=>a+b.avg_total,0)/trends.length) : 0;
    const recentChange = trends.length >= 2 ? trends[trends.length-1].avg_total - trends[trends.length-2].avg_total : 0;
    return { class_id: cls.id, class_name: cls.name, trends, avg_total: avgAcross, recent_change: recentChange };
  });
  const allScoreRates = groupStats.map(g => g.score_rate);
  const allExcRates = groupStats.map(g => g.excellent_rate);
  const allGoodRates = groupStats.map(g => g.good_rate);
  const allPassRates = groupStats.map(g => g.pass_rate);
  const avgExc = groupStats.length ? Math.round(allExcRates.reduce((a,b)=>a+b,0)/allExcRates.length) : 0;
  const avgGood = groupStats.length ? Math.round(allGoodRates.reduce((a,b)=>a+b,0)/allGoodRates.length) : 0;
  const avgPass = groupStats.length ? Math.round(allPassRates.reduce((a,b)=>a+b,0)/allPassRates.length) : 0;
  const avgFail = groupStats.length ? Math.max(0, 100 - avgExc - avgGood - avgPass) : 0;
  const summary = {
    avg_score_rate: groupStats.length ? Math.round(allScoreRates.reduce((a,b)=>a+b,0)/allScoreRates.length) : 0,
    avg_excellent_rate: avgExc,
    avg_good_rate: avgGood,
    avg_pass_rate: avgPass,
    avg_fail_rate: avgFail,
    total_exams: groupStats.length
  };
  const availableTypes = db.prepare('SELECT DISTINCT exam_type FROM exam_groups WHERE grade_id = ?').pluck().all(grade_id);
  res.json({ grade_id: grade.id, grade_name: grade.grade_name, exam_type: defaultType, available_types: availableTypes, summary, groups: groupStats, classes: classData });
});
app.get('/api/public/class-trend', (req, res) => {
  const db = require('./db');
  const { class_id } = req.query;
  if (!class_id) return res.status(422).json({ error: 'class_id is required' });
  const cls = db.prepare('SELECT c.*, g.grade_name FROM classes c LEFT JOIN grades g ON c.grade_id = g.id WHERE c.id = ?').get(class_id);
  if (!cls) return res.status(404).json({ error: '班级不存在' });
  if (!cls.grade_id) return res.status(422).json({ error: '该班级未关联年级' });
  const groups = db.prepare(`
    SELECT * FROM exam_groups WHERE grade_id = ? AND exam_type IN ('comprehensive','liberal_arts')
    ORDER BY exam_date ASC
  `).all(cls.grade_id);
  const groupStats = groups.map(grp => {
    const exams = db.prepare('SELECT id, exam_name, subject, total_score FROM exams WHERE group_id = ?').all(grp.id);
    const clsTotals = db.prepare(`
      SELECT SUM(sc.score) as total
      FROM scores sc JOIN exams e ON sc.exam_id = e.id
      JOIN students s ON sc.student_id = s.id
      WHERE e.group_id = ? AND s.class_id = ?
      GROUP BY sc.student_id
    `).all(grp.id, class_id).map(r => r.total);
    const avgTotal = clsTotals.length ? Math.round(clsTotals.reduce((a,b)=>a+b,0)/clsTotals.length) : 0;
    const maxPossible = grp.total_score || exams.reduce((s,e)=>s+e.total_score,0);
    const passCount = clsTotals.filter(t => t >= maxPossible * 0.6 && t < maxPossible * 0.8).length;
    const goodCount = clsTotals.filter(t => t >= maxPossible * 0.8 && t < maxPossible * 0.9).length;
    const excCount = clsTotals.filter(t => t >= maxPossible * 0.9).length;
    const passRate = clsTotals.length ? Math.round(passCount/clsTotals.length*100) : 0;
    const goodRate = clsTotals.length ? Math.round(goodCount/clsTotals.length*100) : 0;
    const excRate = clsTotals.length ? Math.round(excCount/clsTotals.length*100) : 0;
    const failRate = clsTotals.length ? Math.max(0, 100 - excRate - goodRate - passRate) : 0;
    const subjects = exams.map(ex => {
      const scs = db.prepare('SELECT sc.score FROM scores sc JOIN students s ON sc.student_id = s.id WHERE sc.exam_id = ? AND s.class_id = ?').all(ex.id, class_id);
      const avgSc = scs.length ? Math.round(scs.reduce((a,b)=>a+b.score,0)/scs.length*10)/10 : 0;
      return { subject: ex.subject || ex.exam_name, avg_score: avgSc, max_score: ex.total_score };
    });
    return { group_id: grp.id, group_name: grp.group_name, exam_date: grp.exam_date, exam_type: grp.exam_type, total_score: maxPossible, avg_total: avgTotal, pass_rate: passRate, good_rate: goodRate, excellent_rate: excRate, fail_rate: failRate, student_count: clsTotals.length, subjects };
  });
  const students = db.prepare('SELECT id, name, student_no, gender, photo FROM students WHERE class_id = ? ORDER BY name ASC').all(class_id);
  const studentData = students.map(st => {
    const trends = groups.map(grp => {
      const total = db.prepare('SELECT SUM(sc.score) as total FROM scores sc JOIN exams e ON sc.exam_id = e.id WHERE e.group_id = ? AND sc.student_id = ?').pluck().get(grp.id, st.id) || 0;
      return { group_id: grp.id, group_name: grp.group_name, total };
    });
    const avgAcross = trends.length ? Math.round(trends.reduce((a,b)=>a+b.total,0)/trends.length) : 0;
    const recentChange = trends.length >= 2 ? trends[trends.length-1].total - trends[trends.length-2].total : 0;
    return { student_id: st.id, student_name: st.name, student_no: st.student_no, gender: st.gender, photo: st.photo, trends, avg_total: avgAcross, recent_change: recentChange };
  });
  studentData.sort((a,b) => b.avg_total - a.avg_total);
  const allAvgs = groupStats.map(g => g.avg_total);
  const avgTotalAcross = groupStats.length ? Math.round(allAvgs.reduce((a,b)=>a+b,0)/allAvgs.length) : 0;
  const diffs = groupStats.length >= 2 ? groupStats.slice(1).map((g,i) => g.avg_total - groupStats[i].avg_total) : [];
  const avgChange = diffs.length ? Math.round(diffs.reduce((a,b)=>a+b,0)/diffs.length) : 0;
  const stableCount = diffs.filter(c => Math.abs(c) <= 10).length;
  const stabilityRate = diffs.length ? Math.round(stableCount/diffs.length*100) : 100;
  const summary = { avg_total: avgTotalAcross, avg_change: avgChange, stability_rate: stabilityRate, total_exams: groupStats.length };
  res.json({ class_id: cls.id, class_name: cls.name, class_type: cls.type, grade_name: cls.grade_name || '', grade_id: cls.grade_id, summary, groups: groupStats, students: studentData });
});
app.get('/api/public/student-history', (req, res) => {
  const db = require('./db');
  const { student_id } = req.query;
  if (!student_id) return res.status(422).json({ error: 'student_id is required' });
  const st = db.prepare('SELECT s.*, c.name as class_name, c.grade_id, g.grade_name FROM students s LEFT JOIN classes c ON s.class_id = c.id LEFT JOIN grades g ON c.grade_id = g.id WHERE s.id = ?').get(student_id);
  if (!st) return res.status(404).json({ error: '学生不存在' });
  if (!st.grade_id) return res.status(422).json({ error: '该学生未关联年级' });
  const groups = db.prepare("SELECT * FROM exam_groups WHERE grade_id = ? AND exam_type IN ('comprehensive','liberal_arts') ORDER BY exam_date ASC").all(st.grade_id);
  const history = groups.map(grp => {
    const exams = db.prepare('SELECT id, exam_name, subject, total_score FROM exams WHERE group_id = ?').all(grp.id);
    const maxPossible = grp.total_score || exams.reduce((s,e)=>s+e.total_score,0);
    const subjects = exams.map(ex => {
      const sc = db.prepare('SELECT score, single_rank as rank, level FROM scores WHERE exam_id = ? AND student_id = ?').get(ex.id, st.id);
      return {
        subject: ex.subject || ex.exam_name,
        score: sc ? sc.score : null,
        max_score: ex.total_score,
        rank: sc ? sc.rank : null,
        level: sc ? sc.level : null
      };
    });
    const totalScore = db.prepare('SELECT SUM(sc.score) as total FROM scores sc JOIN exams e ON sc.exam_id = e.id WHERE e.group_id = ? AND sc.student_id = ?').pluck().get(grp.id, st.id) || 0;
    const allStudentTotals = db.prepare(`
      SELECT sc.student_id, SUM(sc.score) as total
      FROM scores sc JOIN exams e ON sc.exam_id = e.id
      WHERE e.group_id = ? GROUP BY sc.student_id
      ORDER BY total DESC
    `).all(grp.id);
    const classStudents = db.prepare('SELECT id FROM students WHERE class_id = ?').pluck().all(st.class_id);
    const classIds = new Set(classStudents);
    const gradeRank = allStudentTotals.findIndex(s => s.student_id == st.id) + 1 || null;
    const classTotals = allStudentTotals.filter(s => classIds.has(s.student_id));
    const classRank = classTotals.findIndex(s => s.student_id == st.id) + 1 || null;
    return {
      group_id: grp.id, group_name: grp.group_name, exam_date: grp.exam_date, exam_type: grp.exam_type,
      total_score: maxPossible, student_total: totalScore, subjects,
      grade_rank: gradeRank, class_rank: classRank,
      grade_total: allStudentTotals.length, class_total: classTotals.length
    };
  });
  const valid = history.filter(h => h.student_total > 0);
  const avgTotal = valid.length ? Math.round(valid.reduce((a,b)=>a+b.student_total,0)/valid.length) : 0;
  const avgClassRank = valid.length ? Math.round(valid.reduce((a,b)=>a+(b.class_rank||0),0)/valid.length*10)/10 : 0;
  const avgGradeRank = valid.length ? Math.round(valid.reduce((a,b)=>a+(b.grade_rank||0),0)/valid.length*10)/10 : 0;
  const summary = { avg_total: avgTotal, avg_class_rank: avgClassRank, avg_grade_rank: avgGradeRank, total_exams: history.length };
  const strengths = [];
  const weaknesses = [];
  const allSubjects = {};
  valid.forEach(h => {
    h.subjects.forEach(s => {
      if (s.score !== null) {
        if (!allSubjects[s.subject]) allSubjects[s.subject] = { scores: [], ranks: [] };
        allSubjects[s.subject].scores.push(s.score);
        allSubjects[s.subject].ranks.push(s.rank);
      }
    });
  });
  Object.keys(allSubjects).forEach(subj => {
    const scores = allSubjects[subj].scores;
    const avgSc = Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*10)/10;
    const avgRk = allSubjects[subj].ranks.filter(r => r !== null);
    const avgRank = avgRk.length ? Math.round(avgRk.reduce((a,b)=>a+b,0)/avgRk.length) : null;
    allSubjects[subj].avg_score = avgSc;
    allSubjects[subj].avg_rank = avgRank;
  });
  const subjList = Object.entries(allSubjects).sort((a,b) => b[1].avg_score - a[1].avg_score);
  if (subjList.length >= 2) {
    const top = subjList.slice(0, Math.ceil(subjList.length/2));
    const bottom = subjList.slice(Math.ceil(subjList.length/2)).reverse();
    top.forEach(([s,d]) => strengths.push({ subject: s, avg_score: d.avg_score, avg_rank: d.avg_rank }));
    bottom.forEach(([s,d]) => weaknesses.push({ subject: s, avg_score: d.avg_score, avg_rank: d.avg_rank }));
  }
  res.json({
    student: { id: st.id, name: st.name, student_no: st.student_no, gender: st.gender, photo: st.photo, birth_date: st.birth_date, class_name: st.class_name, grade_name: st.grade_name, class_role: st.class_role },
    summary, groups: history, strengths, weaknesses
  });
});
app.get('/api/public/student-single-report', (req, res) => {
  const db = require('./db');
  const { student_id, group_id } = req.query;
  if (!student_id || !group_id) return res.status(422).json({ error: 'student_id and group_id are required' });
  const st = db.prepare('SELECT s.*, c.name as class_name, c.grade_id, g.grade_name FROM students s LEFT JOIN classes c ON s.class_id = c.id LEFT JOIN grades g ON c.grade_id = g.id WHERE s.id = ?').get(student_id);
  if (!st) return res.status(404).json({ error: '学生不存在' });
  const group = db.prepare('SELECT * FROM exam_groups WHERE id = ?').get(group_id);
  if (!group) return res.status(404).json({ error: '考试批次不存在' });
  const exams = db.prepare('SELECT id, exam_name, subject, total_score FROM exams WHERE group_id = ?').all(group_id);
  const maxPossible = group.total_score || exams.reduce((s,e)=>s+e.total_score,0);
  const subjects = exams.map(ex => {
    const sc = db.prepare('SELECT score, single_rank as rank, level FROM scores WHERE exam_id = ? AND student_id = ?').get(ex.id, st.id);
    const clsScores = db.prepare('SELECT AVG(sc2.score) as avg FROM scores sc2 JOIN students s2 ON sc2.student_id = s2.id WHERE sc2.exam_id = ? AND s2.class_id = ?').get(ex.id, st.class_id);
    return {
      subject: ex.subject || ex.exam_name,
      score: sc ? sc.score : null,
      max_score: ex.total_score,
      class_rank: sc ? sc.rank : null,
      level: sc ? sc.level : null,
      class_avg: Math.round((clsScores?.avg || 0) * 10) / 10
    };
  });
  const totalScore = db.prepare('SELECT SUM(sc.score) as total FROM scores sc JOIN exams e ON sc.exam_id = e.id WHERE e.group_id = ? AND sc.student_id = ?').pluck().get(group_id, st.id) || 0;
  const allStudentTotals = db.prepare('SELECT sc.student_id, SUM(sc.score) as total FROM scores sc JOIN exams e ON sc.exam_id = e.id WHERE e.group_id = ? GROUP BY sc.student_id ORDER BY total DESC').all(group_id);
  const classStudents = db.prepare('SELECT id FROM students WHERE class_id = ?').pluck().all(st.class_id);
  const classIds = new Set(classStudents);
  const gradeRank = allStudentTotals.findIndex(s => s.student_id == st.id) + 1 || null;
  const classTotals = allStudentTotals.filter(s => classIds.has(s.student_id));
  const classRank = classTotals.findIndex(s => s.student_id == st.id) + 1 || null;
  const scoreRate = maxPossible ? Math.round(totalScore / maxPossible * 100) : 0;
  const level = scoreRate >= 90 ? '优秀' : scoreRate >= 80 ? '良好' : scoreRate >= 60 ? '一般' : '不及格';
  const summary = { total_score: totalScore, max_score: maxPossible, score_rate: scoreRate, level, class_rank: classRank, class_total: classTotals.length, grade_rank: gradeRank, grade_total: allStudentTotals.length, exam_total: allStudentTotals.length };
  const advSubs = subjects.filter(s => s.score !== null && s.class_avg > 0 && s.score > s.class_avg).sort((a,b) => (b.score-b.class_avg) - (a.score-a.class_avg));
  const weakSubs = subjects.filter(s => s.score !== null && s.class_avg > 0 && s.score < s.class_avg).sort((a,b) => (a.score-a.class_avg) - (b.score-b.class_avg));
  const gradeGroups = db.prepare("SELECT id, group_name, exam_date FROM exam_groups WHERE grade_id = ? AND exam_type IN ('comprehensive','liberal_arts') ORDER BY exam_date ASC").all(st.grade_id);
  const rankTrend = gradeGroups.map(gg => {
    const gTotals = db.prepare('SELECT sc.student_id, SUM(sc.score) as total FROM scores sc JOIN exams e ON sc.exam_id = e.id WHERE e.group_id = ? GROUP BY sc.student_id ORDER BY total DESC').all(gg.id);
    const gIdx = gTotals.findIndex(t => t.student_id == st.id);
    const gRank = gIdx >= 0 ? gIdx + 1 : null;
    const cTotals = gTotals.filter(t => !!db.prepare('SELECT id FROM students WHERE id = ? AND class_id = ?').get(t.student_id, st.class_id));
    const cIdx = cTotals.findIndex(t => t.student_id == st.id);
    const cRank = cIdx >= 0 ? cIdx + 1 : null;
    return { group_id: gg.id, group_name: gg.group_name, exam_date: gg.exam_date, class_rank: cRank, grade_rank: gRank };
  });
  res.json({
    student: { id: st.id, name: st.name, student_no: st.student_no, gender: st.gender, photo: st.photo, class_role: st.class_role, class_name: st.class_name, grade_name: st.grade_name },
    group: { id: group.id, group_name: group.group_name, exam_date: group.exam_date, exam_type: group.exam_type },
    summary, subjects, rank_trend: rankTrend,
    advantages: advSubs.length ? advSubs.map(s => ({ subject: s.subject, score: s.score, class_avg: s.class_avg, diff: s.score - s.class_avg })) : [],
    weaknesses: weakSubs.length ? weakSubs.map(s => ({ subject: s.subject, score: s.score, class_avg: s.class_avg, diff: s.score - s.class_avg })) : []
  });
});
app.get('/api/public/grade-single-stats', (req, res) => {
  const db = require('./db');
  const { group_id } = req.query;
  if (!group_id) return res.status(422).json({ error: 'group_id is required' });
  const group = db.prepare('SELECT eg.*, g.grade_name FROM exam_groups eg LEFT JOIN grades g ON eg.grade_id = g.id WHERE eg.id = ?').get(group_id);
  if (!group) return res.status(404).json({ error: '考试批次不存在' });
  const exams = db.prepare('SELECT id, exam_name, subject, total_score FROM exams WHERE group_id = ?').all(group_id);
  const studentTotals = db.prepare(`
    SELECT sc.student_id, s.name as student_name, s.class_id, c.name as class_name, SUM(sc.score) as total
    FROM scores sc JOIN exams e ON sc.exam_id = e.id
    JOIN students s ON sc.student_id = s.id
    LEFT JOIN classes c ON s.class_id = c.id
    WHERE e.group_id = ? GROUP BY sc.student_id
  `).all(group_id);
  const totals = studentTotals.map(s => s.total);
  const maxPossible = group.total_score || exams.reduce((s,e)=>s+e.total_score,0);
  const avgTotal = totals.length ? Math.round(totals.reduce((a,b)=>a+b,0)/totals.length) : 0;
  const maxTotal = totals.length ? Math.max(...totals) : 0;
  const minTotal = totals.length ? Math.min(...totals) : 0;
  const passCount = totals.filter(t => t >= maxPossible*0.6 && t < maxPossible*0.8).length;
  const excCount = totals.filter(t => t >= maxPossible*0.9).length;
  const lowCount = totals.filter(t => t < maxPossible*0.6).length;
  const metrics = {
    avg_total: avgTotal, max_total: maxTotal, min_total: minTotal,
    total_score: maxPossible, student_count: totals.length,
    pass_rate: totals.length ? Math.round(passCount/totals.length*100) : 0,
    excellent_rate: totals.length ? Math.round(excCount/totals.length*100) : 0,
    low_rate: totals.length ? Math.round(lowCount/totals.length*100) : 0
  };
  const bucketCount = 10;
  const bucketWidth = Math.ceil(maxPossible/bucketCount);
  const buckets = [];
  for (let i = 0; i < bucketCount; i++) {
    const lo = i * bucketWidth;
    const hi = i === bucketCount-1 ? maxPossible : (i+1)*bucketWidth;
    const count = totals.filter(t => t >= lo && (i===bucketCount-1 ? t <= hi : t < hi)).length;
    buckets.push({ range: lo+'-'+hi, lo, hi, count });
  }
  const subjects = exams.map(ex => {
    const scs = db.prepare('SELECT score FROM scores WHERE exam_id = ?').all(ex.id);
    const avgSc = scs.length ? Math.round(scs.reduce((a,b)=>a+b.score,0)/scs.length*10)/10 : 0;
    const maxSc = scs.length ? Math.max(...scs.map(s=>s.score)) : 0;
    const minSc = scs.length ? Math.min(...scs.map(s=>s.score)) : 0;
    return { subject: ex.subject||ex.exam_name, avg_score: avgSc, max_score: ex.total_score, max_sc: maxSc, min_sc: minSc, count: scs.length };
  });
  const classMap = {};
  studentTotals.forEach(st => {
    if (!st.class_id) return;
    if (!classMap[st.class_id]) classMap[st.class_id] = { class_id: st.class_id, class_name: st.class_name, totals: [] };
    classMap[st.class_id].totals.push(st.total);
  });
  const classRanks = Object.values(classMap).map(c => {
    const clsAvg = Math.round(c.totals.reduce((a,b)=>a+b,0)/c.totals.length);
    const clsPass = c.totals.filter(t => t >= maxPossible*0.6 && t < maxPossible*0.8).length;
    return { class_id: c.class_id, class_name: c.class_name, avg_total: clsAvg, pass_rate: c.totals.length?Math.round(clsPass/c.totals.length*100):0, student_count: c.totals.length };
  });
  classRanks.sort((a,b) => b.avg_total - a.avg_total);
  classRanks.forEach((c,i) => { c.rank = i + 1; });
  res.json({
    group: { id: group.id, group_name: group.group_name, exam_date: group.exam_date, exam_type: group.exam_type, grade_name: group.grade_name||'' },
    metrics, buckets, subjects, classes: classRanks
  });
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

app.post('/api/photo-batch/upload', authMiddleware, batchUpload.array('files', 200), photoBatchController.upload);
app.get('/api/photo-batch/tasks/:id', authMiddleware, photoBatchController.getTask);
app.delete('/api/photo/:target/:id', authMiddleware, avatarController.removePhoto);

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

app.get('/api/template/students', authMiddleware, (req, res) => {
  ExcelImporter.sendTemplate(res, {
    name: '姓名', student_no: '学号', gender: '性别', birth_date: '出生日期',
    hometown: '籍贯', phone: '手机号', class_name: '班级', class_role: '职务'
  }, '学生批量导入模板.xlsx', [
    '姓名: 必填',
    '学号: 必填, 不可重复',
    '性别: 男/女, 留空默认空',
    '出生日期: 格式如 2006-01-15',
    '籍贯: 如 浙江杭州',
    '手机号: 11位手机号码',
    '班级: 填写班级名称, 如"高三1班", 系统自动匹配已有班级或创建',
    '职务: 班长/学习委员等, 留空默认空'
  ]);
});

app.get('/api/template/scores', authMiddleware, (req, res) => {
  ExcelImporter.sendTemplate(res, {
    student_no: '学号', exam_group: '考试批次', subject: '科目',
    score: '分数', class_rank: '班级排名', level: '等级'
  }, '成绩批量导入模板.xlsx', [
    '学号: 必填, 系统中已存在的学生学号',
    '考试批次: 必填, 如"期中考试"或"高三第一学期期末模拟考试", 系统自动匹配已有批次',
    '科目: 必填, 如"语文""数学""英语"',
    '分数: 必填, 数值',
    '班级排名: 选填, 数值',
    '等级: 选填, 如 A/B/C/D 或 优秀/良好/及格/不及格'
  ]);
});

app.post('/api/import/students', authMiddleware, excelUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传 Excel 文件' });
  try {
    const db = require('./db');
    const classes = db.prepare('SELECT id, name FROM classes').all();
    const insertStmt = db.prepare('INSERT INTO students (name, student_no, gender, birth_date, hometown, phone, class_id, class_role) VALUES (?,?,?,?,?,?,?,?)');
    const checkStmt = db.prepare('SELECT id FROM students WHERE student_no = ?');

    const importer = new ExcelImporter({
      columns: {
        name: '姓名', student_no: '学号', gender: '性别', birth_date: '出生日期',
        hometown: '籍贯', phone: '手机号', class_name: '班级', class_role: '职务'
      },
      required: ['name', 'student_no'],
      onRow: (data) => {
        if (!data.name || !data.student_no) return { error: '姓名或学号为空' };
        if (checkStmt.get(data.student_no)) return { skipped: true };
        const gender = (data.gender === '男' || data.gender === '女') ? data.gender : '';
        let classId = 0;
        if (data.class_name) {
          let cls = classes.find(c => c.name === data.class_name);
          if (!cls) {
            const r = db.prepare('INSERT INTO classes (name) VALUES (?)').run(data.class_name);
            cls = { id: r.lastInsertRowid, name: data.class_name };
            classes.push(cls);
          }
          classId = cls.id;
        }
        insertStmt.run(data.name, data.student_no, gender, data.birth_date, data.hometown, data.phone, classId, data.class_role);
        return { inserted: true };
      }
    });

    const result = importer.import(req.file.path, db);
    res.json(result);
  } catch (e) { res.status(500).json({ error: '文件解析失败: ' + e.message }); }
});

app.post('/api/import/scores', authMiddleware, excelUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传 Excel 文件' });
  try {
    const db = require('./db');
    const findStudent = db.prepare('SELECT id FROM students WHERE student_no = ?');
    const findGroup = db.prepare('SELECT id FROM exam_groups WHERE group_name = ?');
    const insertGroup = db.prepare('INSERT INTO exam_groups (class_id, group_name, exam_date, exam_type) VALUES (0, ?, ?, ?)');
    const findExam = db.prepare('SELECT id FROM exams WHERE group_id = ? AND (subject = ? OR exam_name = ?)');
    const insertExam = db.prepare('INSERT INTO exams (group_id, exam_name, subject, total_score) VALUES (?,?,?,150)');
    const findScore = db.prepare('SELECT id FROM scores WHERE student_id = ? AND exam_id = ?');
    const insertScore = db.prepare('INSERT INTO scores (student_id, exam_id, score, single_rank, level) VALUES (?,?,?,?,?)');
    const updateScore = db.prepare('UPDATE scores SET score=?, single_rank=?, level=? WHERE id=?');
    const groupCache = {}, examCache = {};

    db.pragma('foreign_keys = 0');

    const importer = new ExcelImporter({
      columns: {
        student_no: '学号', exam_group: '考试批次', subject: '科目',
        score: '分数', class_rank: '班级排名', level: '等级'
      },
      required: ['student_no', 'exam_group', 'subject', 'score'],
      onRow: (data) => {
        const st = findStudent.get(data.student_no);
        if (!st) return { error: '学号"' + data.student_no + '"不存在' };
        const scoreVal = parseFloat(data.score);
        if (isNaN(scoreVal)) return { error: '分数格式错误' };
        const gkey = data.exam_group;
        if (!groupCache[gkey]) {
          let grp = findGroup.get(gkey);
          if (!grp) {
            const r = insertGroup.run(gkey, new Date().toISOString().slice(0, 10), 'single');
            grp = { id: r.lastInsertRowid };
          }
          groupCache[gkey] = grp.id;
        }
        const gid = groupCache[gkey];
        const ekey = gid + '_' + data.subject;
        if (!examCache[ekey]) {
          let ex = findExam.get(gid, data.subject, data.subject);
          if (!ex) {
            const r = insertExam.run(gid, data.subject, data.subject);
            ex = { id: r.lastInsertRowid };
          }
          examCache[ekey] = ex.id;
        }
        const eid = examCache[ekey];
        const rank = parseInt(data.class_rank) || 0;
        const existing = findScore.get(st.id, eid);
        if (existing) updateScore.run(scoreVal, rank, data.level, existing.id);
        else insertScore.run(st.id, eid, scoreVal, rank, data.level);
        return { inserted: true };
      }
    });

    const result = importer.import(req.file.path, db);
    db.pragma('foreign_keys = 1');
    res.json(result);
  } catch (e) { res.status(500).json({ error: '文件解析失败: ' + e.message }); }
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: '服务器异常' });
});

// 持久化：数据备份接口
app.get('/api/persistence/backup', authMiddleware, (req, res) => {
  const result = persistence.saveBackup();
  res.json({ success: result, info: persistence.getBackupInfo() });
});

app.get('/api/persistence/info', (req, res) => {
  res.json(persistence.getBackupInfo());
});

// 持久化：启动定时备份（每60秒检查一次，有变化则备份）
let lastBackupTables = null;
setInterval(() => {
  try {
    const currentTables = {};
    ['classes', 'students', 'exams', 'banners', 'exam_groups', 'scores'].forEach(t => {
      try {
        currentTables[t] = db.prepare(`SELECT COUNT(*) as cnt FROM ${t}`).get().cnt;
      } catch (_) { currentTables[t] = 0; }
    });
    
    const changed = JSON.stringify(currentTables) !== JSON.stringify(lastBackupTables);
    if (changed) {
      persistence.saveBackup();
      lastBackupTables = { ...currentTables };
    }
  } catch (_) {}
}, 60000);

// 持久化：进程关闭时保存备份
process.on('SIGINT', () => {
  console.log('[DB Persistence] 收到终止信号，保存数据备份...');
  persistence.saveBackup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[DB Persistence] 收到终止信号，保存数据备份...');
  persistence.saveBackup();
  process.exit(0);
});

// 持久化：首次启动立即备份一次（确保初始数据被保存）
setTimeout(() => {
  console.log('[DB Persistence] 首次启动，保存初始数据备份...');
  persistence.saveBackup();
}, 5000);

app.listen(PORT, () => {
  console.log(`后端服务已启动: http://localhost:${PORT}`);
  console.log('[DB Persistence] 数据持久化已启用，备份目录: .monkeycode/db-backup/');
});
