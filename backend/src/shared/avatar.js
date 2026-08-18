const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const AVATAR_DIRS = {
  student: path.join(PUBLIC_DIR, 'avatar', 'student'),
  teacher: path.join(PUBLIC_DIR, 'avatar', 'teacher')
};

const AVATAR_SIZE = 400;

function ensureDirs() {
  Object.values(AVATAR_DIRS).forEach(dir => fs.mkdirSync(dir, { recursive: true }));
}

/**
 * 统一处理头像：读取原始图片 → 居中裁剪 → 缩放为标准尺寸 → 输出 webp
 * @param {string} inputPath 原始文件路径
 * @param {string} targetType 'student' | 'teacher'
 * @returns {Promise<string>} 可访问的相对 URL，如 /avatar/student/xxx.webp
 */
async function processAvatar(inputPath, targetType) {
  const dir = AVATAR_DIRS[targetType] || AVATAR_DIRS.student;
  ensureDirs();
  const filename = Date.now() + '-' + Math.round(Math.random() * 1e9) + '.webp';
  const outPath = path.join(dir, filename);
  await sharp(inputPath, { failOn: 'none' })
    .rotate()
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
    .webp({ quality: 82 })
    .toFile(outPath);
  return '/avatar/' + targetType + '/' + filename;
}

module.exports = { processAvatar, AVATAR_SIZE, AVATAR_DIRS, PUBLIC_DIR };
