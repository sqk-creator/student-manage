const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ctrl = require('../controllers/featureCardController');

const router = Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'fc_' + Date.now() + '_' + Math.round(Math.random() * 10000) + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 JPG/PNG/GIF/WEBP 格式图片'));
    }
  }
});

router.post('/upload', upload.single('file'), ctrl.upload);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.put('/:id', ctrl.update);

router.use((err, req, res, _next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: '文件上传错误: ' + err.message });
  if (err.message) return res.status(400).json({ error: err.message });
  res.status(500).json({ error: '服务器异常' });
});

module.exports = router;
