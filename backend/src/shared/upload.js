const multer = require('multer');
const path = require('path');

const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads');

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
});

const photoUpload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
const excelUpload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.xlsx', '.xls'].includes(ext)) cb(null, true);
  else cb(new Error('仅支持 .xlsx 或 .xls 格式的 Excel 文件'));
}});
const batchUpload = multer({ storage, limits: { fileSize: 30 * 1024 * 1024, files: 200 }, fileFilter: (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.zip'].includes(ext)) cb(null, true);
  else cb(new Error('仅支持 jpg/jpeg/png/webp 图片或 zip 压缩包'));
}});

module.exports = { uploadDir, photoUpload, excelUpload, batchUpload };
