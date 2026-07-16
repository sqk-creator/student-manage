const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'student-management-secret-key';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录' });
  }

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.teacherId = payload.teacherId;
    next();
  } catch {
    return res.status(401).json({ error: '请先登录' });
  }
}

module.exports = { authMiddleware, JWT_SECRET };
