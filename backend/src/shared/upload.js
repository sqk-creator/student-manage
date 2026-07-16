const multer = require('multer');
const path = require('path');

const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads');

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
});

const photoUpload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

module.exports = { uploadDir, photoUpload };
