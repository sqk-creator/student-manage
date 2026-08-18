const path = require('path');
const fs = require('fs');
const os = require('os');
const AdmZip = require('adm-zip');
const db = require('../db');
const { processAvatar } = require('../shared/avatar');

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const tasks = new Map();
let taskSeq = 0;

function genTaskId() {
  taskSeq += 1;
  return 'pb-' + Date.now().toString(36) + '-' + taskSeq;
}

function makeTask(opts) {
  return {
    id: opts.id,
    targetType: opts.targetType,
    overwrite: !!opts.overwrite,
    status: 'pending',
    total: 0,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    unmatched: [],
    errors: [],
    message: '',
    operatorId: opts.operatorId,
    operatorName: opts.operatorName || '',
    createdAt: Date.now()
  };
}

function collectImageFiles(files, taskId) {
  const out = [];
  const pending = [];
  for (const f of files) {
    const ext = path.extname(f.originalname || '').toLowerCase();
    if (ext === '.zip') pending.push(f);
    else if (IMAGE_EXTS.includes(ext)) out.push({ originalname: f.originalname, path: f.path });
    else { /* 过滤掉其他类型 */ }
  }
  for (const z of pending) {
    let zip;
    try { zip = new AdmZip(z.path); } catch (e) { continue; }
    const entries = zip.getEntries();
    if (entries.length > 500) {
      for (const e of entries) if (IMAGE_EXTS.includes(path.extname(e.entryName).toLowerCase())) out.push({ originalname: path.basename(e.entryName), path: e.entryName, zipEntry: e });
      continue;
    }
    for (const e of entries) {
      if (e.isDirectory) continue;
      if (!IMAGE_EXTS.includes(path.extname(e.entryName).toLowerCase())) continue;
      if (e.header.size > 30 * 1024 * 1024) continue;
      out.push({ originalname: path.basename(e.entryName), path: e.entryName, zipEntry: e });
    }
  }
  return out;
}

function extractFileBytes(item) {
  if (item.zipEntry) return item.zipEntry.getData();
  return fs.readFileSync(item.path);
}

function normalizeKey(filename) {
  return path.basename(filename).replace(/\.[^.]+$/, '').trim().toLowerCase();
}

async function runTask(task, files) {
  try {
    task.status = 'processing';
    const images = collectImageFiles(files, task.id);
    task.total = images.length;
    if (!task.total) {
      task.status = 'done';
      task.message = '未发现有效图片文件';
      return;
    }

    const findStudent = db.prepare('SELECT id, name, student_no, photo FROM students WHERE student_no = ? COLLATE NOCASE');
    const findTeacher = db.prepare('SELECT id, name, employee_no, photo FROM teacher_profiles WHERE employee_no = ? COLLATE NOCASE');

    for (const item of images) {
      task.processed += 1;
      const key = normalizeKey(item.originalname);
      const record = { filename: item.originalname, reason: '' };
      if (!key) {
        task.failed += 1;
        record.reason = '文件名无效';
        task.errors.push(record);
        continue;
      }

      let row = null;
      let duplicate = false;
      if (task.targetType === 'teacher') {
        const rows = findTeacher.all(key);
        if (rows.length > 1) { duplicate = true; }
        else row = rows[0] || null;
      } else {
        const rows = findStudent.all(key);
        if (rows.length > 1) { duplicate = true; }
        else row = rows[0] || null;
      }

      if (duplicate) {
        task.failed += 1;
        record.reason = '工号/学号在档案中重复';
        task.errors.push(record);
        continue;
      }
      if (!row) {
        task.unmatched.push(record);
        continue;
      }
      if (!task.overwrite && row.photo) {
        task.skipped += 1;
        record.reason = '已有头像，未覆盖';
        task.errors.push(record);
        continue;
      }

      try {
        const tmpFile = path.join(os.tmpdir(), task.id + '-' + task.processed + path.extname(item.originalname).toLowerCase());
        fs.writeFileSync(tmpFile, extractFileBytes(item));
        const url = await processAvatar(tmpFile, task.targetType);
        fs.unlinkSync(tmpFile);
        const table = task.targetType === 'teacher' ? 'teacher_profiles' : 'students';
        db.prepare('UPDATE ' + table + ' SET photo = ? WHERE id = ?').run(url, row.id);
        task.success += 1;
      } catch (e) {
        task.failed += 1;
        record.reason = '图片处理失败: ' + e.message;
        task.errors.push(record);
      }
    }

    try {
      db.prepare('INSERT INTO photo_batch_logs (task_id, target_type, operator_id, operator_name, total, success, failed, skipped, unmatched) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(task.id, task.targetType, task.operatorId, task.operatorName, task.total, task.success, task.failed, task.skipped, task.unmatched.length);
    } catch (_) {}

    task.status = 'done';
    task.message = '处理完成';
  } catch (e) {
    task.status = 'error';
    task.message = e.message;
  }
}

exports.upload = (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ error: '请选择需要上传的文件' });
  const targetType = req.body.target_type === 'teacher' ? 'teacher' : 'student';
  const overwrite = req.body.overwrite === '1' || req.body.overwrite === 'true';

  const teacher = db.prepare('SELECT name FROM teachers WHERE id = ?').get(req.teacherId);
  const id = genTaskId();
  const task = makeTask({ id, targetType, overwrite, operatorId: req.teacherId, operatorName: teacher ? teacher.name : '' });
  tasks.set(id, task);

  process.nextTick(() => {
    runTask(task, req.files).finally(() => {
      req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (_) {} });
    });
  });

  res.status(201).json({ taskId: id, status: task.status });
};

exports.getTask = (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) return res.status(404).json({ error: '任务不存在或已过期' });
  res.json({
    taskId: task.id,
    status: task.status,
    targetType: task.targetType,
    overwrite: task.overwrite,
    total: task.total,
    processed: task.processed,
    success: task.success,
    failed: task.failed,
    skipped: task.skipped,
    unmatched: task.unmatched,
    errors: task.errors.slice(0, 50),
    message: task.message
  });
};
