const db = require('../db');

exports.list = (req, res) => {
  const classId = req.params.classId;
  const cls = db.prepare('SELECT * FROM classes WHERE id = ? AND teacher_id = ?').get(classId, req.teacherId);
  if (!cls) return res.status(404).json({ error: '班级不存在' });

  const exams = db.prepare('SELECT * FROM exams WHERE class_id = ? ORDER BY exam_date DESC').all(classId);
  res.json(exams);
};

exports.create = (req, res) => {
  const classId = req.params.classId;
  const cls = db.prepare('SELECT * FROM classes WHERE id = ? AND teacher_id = ?').get(classId, req.teacherId);
  if (!cls) return res.status(404).json({ error: '班级不存在' });

  const { name, subject, exam_date } = req.body;
  if (!name || !name.trim()) return res.status(422).json({ error: '考试名称为必填项' });

  const result = db.prepare('INSERT INTO exams (name, subject, exam_date, class_id) VALUES (?, ?, ?, ?)')
    .run(name.trim(), subject || '', exam_date || new Date().toISOString().split('T')[0], classId);
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(exam);
};

exports.getScores = (req, res) => {
  const examId = req.params.examId;
  const exam = db.prepare(`
    SELECT e.* FROM exams e
    JOIN classes c ON e.class_id = c.id
    WHERE e.id = ? AND c.teacher_id = ?
  `).get(examId, req.teacherId);
  if (!exam) return res.status(404).json({ error: '考试不存在' });

  const scores = db.prepare(`
    SELECT sc.id, sc.score, sc.student_id, s.name as student_name, s.student_no
    FROM scores sc
    JOIN students s ON sc.student_id = s.id
    WHERE sc.exam_id = ?
    ORDER BY s.student_no
  `).all(examId);
  res.json({ exam, scores });
};

exports.enterScores = (req, res) => {
  const examId = req.params.examId;
  const exam = db.prepare(`
    SELECT e.* FROM exams e
    JOIN classes c ON e.class_id = c.id
    WHERE e.id = ? AND c.teacher_id = ?
  `).get(examId, req.teacherId);
  if (!exam) return res.status(404).json({ error: '考试不存在' });

  const { scores } = req.body;
  if (!Array.isArray(scores)) return res.status(422).json({ error: '成绩数据格式错误' });

  const insertStmt = db.prepare(`
    INSERT INTO scores (score, student_id, exam_id)
    VALUES (?, ?, ?)
    ON CONFLICT(student_id, exam_id) DO UPDATE SET score = excluded.score
  `);

  const transaction = db.transaction((items) => {
    for (const item of items) {
      if (item.score < 0 || item.score > 100) {
        throw new Error('成绩应在 0-100 之间');
      }
      const student = db.prepare('SELECT id FROM students WHERE id = ? AND class_id = ?')
        .get(item.student_id, exam.class_id);
      if (!student) {
        throw new Error('学生不属于该班级');
      }
      insertStmt.run(item.score, item.student_id, examId);
    }
  });

  try {
    transaction(scores);
    res.json({ message: '成绩保存成功' });
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
};

exports.getStats = (req, res) => {
  const examId = req.params.examId;
  const exam = db.prepare(`
    SELECT e.* FROM exams e
    JOIN classes c ON e.class_id = c.id
    WHERE e.id = ? AND c.teacher_id = ?
  `).get(examId, req.teacherId);
  if (!exam) return res.status(404).json({ error: '考试不存在' });

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      ROUND(AVG(score), 1) as avg,
      MAX(score) as max,
      MIN(score) as min
    FROM scores WHERE exam_id = ?
  `).get(examId);

  const distribution = db.prepare(`
    SELECT
      SUM(CASE WHEN score >= 90 THEN 1 ELSE 0 END) as excellent,
      SUM(CASE WHEN score >= 80 AND score < 90 THEN 1 ELSE 0 END) as good,
      SUM(CASE WHEN score >= 70 AND score < 80 THEN 1 ELSE 0 END) as average,
      SUM(CASE WHEN score >= 60 AND score < 70 THEN 1 ELSE 0 END) as pass,
      SUM(CASE WHEN score < 60 THEN 1 ELSE 0 END) as fail
    FROM scores WHERE exam_id = ?
  `).get(examId);

  res.json({ exam, stats, distribution });
};
