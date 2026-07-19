const db = require('../db');

exports.list = (req, res) => {
  const { student_id, exam_id, group_id } = req.query;
  if (!student_id && !exam_id && !group_id) return res.json([]);

  if (group_id) {
    const scores = db.prepare(`
      SELECT sc.*, e.subject, e.exam_name, e.total_score as exam_total, s.name as student_name, s.student_no
      FROM scores sc
      JOIN exams e ON sc.exam_id = e.id
      JOIN students s ON sc.student_id = s.id
      WHERE e.group_id = ?
      ORDER BY s.student_no, e.subject
    `).all(group_id);
    return res.json(scores);
  }

  if (student_id) {
    const scores = db.prepare(`
      SELECT sc.*, e.subject, e.exam_name, e.total_score as exam_total, s.name as student_name, s.student_no
      FROM scores sc
      JOIN exams e ON sc.exam_id = e.id
      JOIN students s ON sc.student_id = s.id
      WHERE sc.student_id = ?
      ORDER BY e.exam_time DESC, e.exam_date DESC
    `).all(student_id);
    return res.json(scores);
  }

  if (exam_id) {
    const scores = db.prepare(`
      SELECT sc.*, e.subject, e.exam_name, e.total_score as exam_total, s.name as student_name, s.student_no
      FROM scores sc
      JOIN exams e ON sc.exam_id = e.id
      JOIN students s ON sc.student_id = s.id
      WHERE sc.exam_id = ?
      ORDER BY sc.score DESC, s.student_no
    `).all(exam_id);
    return res.json(scores);
  }

  res.json([]);
};

exports.create = (req, res) => {
  const { exam_id, student_id, score } = req.body;
  if (!exam_id || !student_id) return res.status(422).json({ error: '考试ID和学生ID为必填项' });
  if (score === undefined || score < 0) return res.status(422).json({ error: '成绩不能为空或负数' });

  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(exam_id);
  if (!exam) return res.status(404).json({ error: '考试不存在' });
  const totalScore = exam.total_score || 100;

  db.prepare(`
    INSERT INTO scores (score, student_id, exam_id, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(student_id, exam_id) DO UPDATE SET score = excluded.score, updated_at = datetime('now')
  `).run(score, student_id, exam_id);

  const allScores = db.prepare('SELECT id, score FROM scores WHERE exam_id = ? ORDER BY score DESC').all(exam_id);
  const updateRank = db.prepare('UPDATE scores SET single_rank = ?, level = ?, updated_at = datetime(\'now\') WHERE id = ?');
  let rank = 1;
  for (let i = 0; i < allScores.length; i++) {
    if (i > 0 && allScores[i].score < allScores[i - 1].score) rank = i + 1;
    const level = (() => {
      const pct = (allScores[i].score / totalScore) * 100;
      if (pct >= 90) return 'A';
      if (pct >= 80) return 'B';
      if (pct >= 60) return 'C';
      return 'D';
    })();
    updateRank.run(rank, level, allScores[i].id);
  }

  const updated = db.prepare(`
    SELECT sc.*, s.name as student_name, s.student_no
    FROM scores sc JOIN students s ON sc.student_id = s.id
    WHERE sc.exam_id = ? AND sc.student_id = ?
  `).get(exam_id, student_id);
  res.status(201).json(updated);
};

exports.update = (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM scores WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '成绩记录不存在' });
  const { score } = req.body;
  if (score === undefined || score < 0) return res.status(422).json({ error: '成绩不能为空或负数' });

  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(existing.exam_id);
  const totalScore = exam ? (exam.total_score || 100) : 100;

  db.prepare('UPDATE scores SET score = ?, updated_at = datetime(\'now\') WHERE id = ?').run(score, id);

  const allScores = db.prepare('SELECT id, score FROM scores WHERE exam_id = ? ORDER BY score DESC').all(existing.exam_id);
  const updateRank = db.prepare('UPDATE scores SET single_rank = ?, level = ?, updated_at = datetime(\'now\') WHERE id = ?');
  let rank = 1;
  for (let i = 0; i < allScores.length; i++) {
    if (i > 0 && allScores[i].score < allScores[i - 1].score) rank = i + 1;
    const level = (() => {
      const pct = (allScores[i].score / totalScore) * 100;
      if (pct >= 90) return 'A';
      if (pct >= 80) return 'B';
      if (pct >= 60) return 'C';
      return 'D';
    })();
    updateRank.run(rank, level, allScores[i].id);
  }

  res.json(db.prepare(`
    SELECT sc.*, s.name as student_name, s.student_no
    FROM scores sc JOIN students s ON sc.student_id = s.id
    WHERE sc.id = ?
  `).get(id));
};

exports.remove = (req, res) => {
  const existing = db.prepare('SELECT * FROM scores WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '成绩记录不存在' });
  const examId = existing.exam_id;
  db.prepare('DELETE FROM scores WHERE id = ?').run(req.params.id);

  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
  if (exam) {
    const allScores = db.prepare('SELECT id, score FROM scores WHERE exam_id = ? ORDER BY score DESC').all(examId);
    const updateRank = db.prepare('UPDATE scores SET single_rank = ?, level = ?, updated_at = datetime(\'now\') WHERE id = ?');
    const totalScore = exam.total_score || 100;
    let rank = 1;
    for (let i = 0; i < allScores.length; i++) {
      if (i > 0 && allScores[i].score < allScores[i - 1].score) rank = i + 1;
      const level = (() => {
        const pct = (allScores[i].score / totalScore) * 100;
        if (pct >= 90) return 'A';
        if (pct >= 80) return 'B';
        if (pct >= 60) return 'C';
        return 'D';
      })();
      updateRank.run(rank, level, allScores[i].id);
    }
  }

  res.json({ message: '成绩已删除' });
};

exports.batchSave = (req, res) => {
  const { exam_id, scores } = req.body;
  if (!exam_id) return res.status(422).json({ error: '考试ID为必填项' });
  if (!Array.isArray(scores)) return res.status(422).json({ error: '成绩数据格式错误' });

  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(exam_id);
  if (!exam) return res.status(404).json({ error: '考试不存在' });
  const totalScore = exam.total_score || 100;

  const upsertScore = db.prepare(`
    INSERT INTO scores (score, student_id, exam_id, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(student_id, exam_id) DO UPDATE SET score = excluded.score, updated_at = datetime('now')
  `);

  function calcLevel(s) {
    const pct = (s / totalScore) * 100;
    if (pct >= 90) return 'A';
    if (pct >= 80) return 'B';
    if (pct >= 60) return 'C';
    return 'D';
  }

  const transaction = db.transaction((items) => {
    for (const item of items) {
      if (item.score === undefined || item.score < 0) throw new Error('成绩不能为空或负数');
      upsertScore.run(item.score, item.student_id, exam_id);
    }

    const allScores = db.prepare('SELECT id, score FROM scores WHERE exam_id = ? ORDER BY score DESC').all(exam_id);
    const updateRank = db.prepare('UPDATE scores SET single_rank = ?, level = ?, updated_at = datetime(\'now\') WHERE id = ?');
    let rank = 1;
    for (let i = 0; i < allScores.length; i++) {
      if (i > 0 && allScores[i].score < allScores[i - 1].score) rank = i + 1;
      updateRank.run(rank, calcLevel(allScores[i].score), allScores[i].id);
    }
  });

  try {
    transaction(scores);
    const updated = db.prepare(`
      SELECT sc.*, s.name as student_name, s.student_no
      FROM scores sc JOIN students s ON sc.student_id = s.id
      WHERE sc.exam_id = ? ORDER BY sc.score DESC, s.student_no
    `).all(exam_id);
    res.json({ message: '成绩保存成功', scores: updated });
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
};
