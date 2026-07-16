const db = require('../db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

exports.login = (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(422).json({ error: '缺少登录凭证' });
  }

  const mockOpenid = 'wx_' + code.substring(0, 28);
  let teacher = db.prepare('SELECT * FROM teachers WHERE openid = ?').get(mockOpenid);

  if (!teacher) {
    const result = db.prepare('INSERT INTO teachers (openid) VALUES (?)').run(mockOpenid);
    teacher = { id: result.lastInsertRowid, openid: mockOpenid, name: '', avatar: '' };
  }

  const token = jwt.sign({ teacherId: teacher.id }, JWT_SECRET, { expiresIn: '7d' });

  res.json({
    token,
    teacher: {
      id: teacher.id,
      name: teacher.name,
      avatar: teacher.avatar
    }
  });
};
