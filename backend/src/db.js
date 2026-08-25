const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data.db');
const backupDir = path.join(__dirname, '..', '..', '.monkeycode', 'db-backup');
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');

// 持久化：确保备份目录存在
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}
const backupPath = path.join(backupDir, 'data.db.bak');
const backupMetaPath = path.join(backupDir, 'backup-meta.json');

// 持久化：目录同步（source -> target，增量复制、清理多余文件）
function syncDirUp(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) return;
  fs.mkdirSync(targetDir, { recursive: true });
  try {
    const sourceFiles = fs.readdirSync(sourceDir).filter(f => {
      try { return fs.statSync(path.join(sourceDir, f)).isFile(); } catch (_) { return false; }
    });
    const targetFiles = fs.existsSync(targetDir) ? fs.readdirSync(targetDir) : [];
    // 删除目标中已不存在的文件
    targetFiles.forEach(f => {
      if (!sourceFiles.includes(f)) {
        try { fs.unlinkSync(path.join(targetDir, f)); } catch (_) {}
      }
    });
    // 复制源文件（存在且大小一致则跳过）
    sourceFiles.forEach(f => {
      const sp = path.join(sourceDir, f);
      const tp = path.join(targetDir, f);
      let needCopy = true;
      try {
        if (fs.existsSync(tp) && fs.statSync(sp).size === fs.statSync(tp).size) needCopy = false;
      } catch (_) {}
      if (needCopy) fs.copyFileSync(sp, tp);
    });
  } catch (err) {
    console.error('[DB Persistence] 目录同步失败:', sourceDir, err.message);
  }
}

// 持久化：检查并恢复数据（数据库 + 图片文件）
if (fs.existsSync(backupPath)) {
  // 如果备份存在且当前数据库为空，则从备份恢复
  try {
    const tempDb = new Database(dbPath);
    const classesCount = tempDb.prepare('SELECT COUNT(*) as cnt FROM classes').get().cnt;
    const studentsCount = tempDb.prepare('SELECT COUNT(*) as cnt FROM students').get().cnt;
    tempDb.close();

    if (classesCount === 0 && studentsCount === 0) {
      console.log('[DB Persistence] 检测到空数据库，正在从备份恢复...');
      fs.copyFileSync(backupPath, dbPath);
      console.log('[DB Persistence] 数据恢复成功');
    }
  } catch (e) {
    // 如果数据库文件损坏或无法打开，从备份恢复
    console.log('[DB Persistence] 数据库异常，正在从备份恢复...');
    fs.copyFileSync(backupPath, dbPath);
    console.log('[DB Persistence] 数据恢复成功');
  }
  // 恢复上传的图片文件
  const uploadsBackup = path.join(backupDir, 'uploads');
  if (fs.existsSync(uploadsBackup)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    syncDirUp(uploadsBackup, uploadsDir);
    console.log('[DB Persistence] 图片文件恢复成功');
  }
}

// 持久化：确保上传目录存在
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 创建数据库连接
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 持久化：获取变更检测签名（数据库修改时间 + 上传文件清单），用于判断是否有必要备份
function getChangeSignature() {
  const sig = { dbMtime: 0, uploadFiles: [] };
  try { sig.dbMtime = fs.statSync(dbPath).mtimeMs; } catch (_) {}
  try {
    sig.uploadFiles = fs.existsSync(uploadsDir)
      ? fs.readdirSync(uploadsDir).map(f => {
          try { return { f, m: fs.statSync(path.join(uploadsDir, f)).mtimeMs, s: fs.statSync(path.join(uploadsDir, f)).size }; }
          catch (_) { return null; }
        }).filter(Boolean)
      : [];
  } catch (_) { sig.uploadFiles = []; }
  return sig;
}

// 持久化方法
function saveBackup() {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(dbPath, backupPath);
    // 同步上传的图片文件到备份目录
    syncDirUp(uploadsDir, path.join(backupDir, 'uploads'));
    const meta = {
      savedAt: new Date().toISOString(),
      tables: {}
    };
    ['classes', 'students', 'exams', 'banners', 'exam_groups', 'scores'].forEach(t => {
      try {
        meta.tables[t] = db.prepare(`SELECT COUNT(*) as cnt FROM ${t}`).get().cnt;
      } catch (_) { meta.tables[t] = 0; }
    });
    fs.writeFileSync(backupMetaPath, JSON.stringify(meta, null, 2));
    console.log('[DB Persistence] 备份保存成功:', meta.tables);
    return true;
  } catch (err) {
    console.error('[DB Persistence] 备份保存失败:', err.message);
    return false;
  }
}

const persistence = {
  saveBackup,
  getChangeSignature,
  getBackupInfo: () => {
    if (!fs.existsSync(backupMetaPath)) return null;
    return JSON.parse(fs.readFileSync(backupMetaPath, 'utf8'));
  }
};

db.exec(`
  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    openid VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL DEFAULT '',
    avatar VARCHAR(255) NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    grade VARCHAR(50) NOT NULL DEFAULT '',
    type VARCHAR(50) NOT NULL DEFAULT '',
    teacher_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grade_name VARCHAR(50) NOT NULL UNIQUE,
    sort INTEGER NOT NULL DEFAULT 0,
    status INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_name VARCHAR(50) NOT NULL UNIQUE,
    sort INTEGER NOT NULL DEFAULT 0,
    status INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS class_teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    name VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT '任课教师',
    teacher_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teacher_profiles(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS teacher_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL DEFAULT '',
    subject VARCHAR(50) NOT NULL DEFAULT '',
    subjects VARCHAR(200) NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS class_teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    name VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT '任课教师',
    subject VARCHAR(50) NOT NULL DEFAULT '',
    teacher_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teacher_profiles(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL,
    student_no VARCHAR(30) NOT NULL,
    gender VARCHAR(5) NOT NULL DEFAULT '',
    phone VARCHAR(20) NOT NULL DEFAULT '',
    birth_date VARCHAR(20) NOT NULL DEFAULT '',
    hometown VARCHAR(100) NOT NULL DEFAULT '',
    photo VARCHAR(500) NOT NULL DEFAULT '',
    class_role VARCHAR(50) NOT NULL DEFAULT '',
    class_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    UNIQUE(class_id, student_no)
  );

  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(50) NOT NULL DEFAULT '',
    exam_date DATE NOT NULL DEFAULT (date('now')),
    class_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    score REAL NOT NULL,
    student_id INTEGER NOT NULL,
    exam_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    UNIQUE(student_id, exam_id)
  );

  CREATE TABLE IF NOT EXISTS exam_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL DEFAULT 0,
    group_name VARCHAR(100) NOT NULL DEFAULT '',
    semester VARCHAR(20) NOT NULL DEFAULT '',
    exam_date VARCHAR(20) NOT NULL DEFAULT '',
    total_score REAL NOT NULL DEFAULT 0,
    remark VARCHAR(200) NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS banners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(100) NOT NULL DEFAULT '',
    image_url VARCHAR(500) NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_enabled INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS teacher_honors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    name VARCHAR(200) NOT NULL,
    date VARCHAR(50) NOT NULL DEFAULT '',
    photo VARCHAR(500) NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teacher_profiles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS class_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT '荣誉',
    name VARCHAR(200) NOT NULL,
    date VARCHAR(50) NOT NULL DEFAULT '',
    photo VARCHAR(500) NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attendances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT '教学考勤',
    date VARCHAR(20) NOT NULL DEFAULT '',
    role VARCHAR(50) NOT NULL DEFAULT '老师',
    total INTEGER NOT NULL DEFAULT 0,
    should_attend INTEGER NOT NULL DEFAULT 0,
    actual_attend INTEGER NOT NULL DEFAULT 0,
    leave_count INTEGER NOT NULL DEFAULT 0,
    late_count INTEGER NOT NULL DEFAULT 0,
    absence_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attendance_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT '缺勤',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attendance_id) REFERENCES attendances(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE(attendance_id, student_id)
  );
`);

// 迁移：为已存在的表添加缺失列
try { db.exec('ALTER TABLE classes ADD COLUMN grade VARCHAR(50) NOT NULL DEFAULT \'\''); } catch (_) {}
try { db.exec('ALTER TABLE classes ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT \'\''); } catch (_) {}
try { db.exec('ALTER TABLE class_teachers ADD COLUMN teacher_id INTEGER REFERENCES teacher_profiles(id) ON DELETE SET NULL'); } catch (_) {}
try { db.exec('ALTER TABLE class_teachers ADD COLUMN subject VARCHAR(50) NOT NULL DEFAULT \'\''); } catch (_) {}
try { db.exec('ALTER TABLE teacher_profiles ADD COLUMN subjects VARCHAR(200) NOT NULL DEFAULT \'\''); } catch (_) {}
try { db.exec('ALTER TABLE students ADD COLUMN birth_date VARCHAR(20) NOT NULL DEFAULT \'\''); } catch (_) {}
try { db.exec('ALTER TABLE students ADD COLUMN hometown VARCHAR(100) NOT NULL DEFAULT \'\''); } catch (_) {}
try { db.exec('ALTER TABLE students ADD COLUMN photo VARCHAR(500) NOT NULL DEFAULT \'\''); } catch (_) {}
try { db.exec('ALTER TABLE students ADD COLUMN class_role VARCHAR(50) NOT NULL DEFAULT \'\''); } catch (_) {}
try { db.exec('ALTER TABLE teacher_profiles ADD COLUMN photo VARCHAR(500) NOT NULL DEFAULT \'\''); } catch (_) {}
try { db.exec('CREATE TABLE IF NOT EXISTS teacher_honors (id INTEGER PRIMARY KEY AUTOINCREMENT, teacher_id INTEGER NOT NULL, name VARCHAR(200) NOT NULL, date VARCHAR(50) NOT NULL DEFAULT \'\', photo VARCHAR(500) NOT NULL DEFAULT \'\', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (teacher_id) REFERENCES teacher_profiles(id) ON DELETE CASCADE)'); } catch (_) {}
try { db.exec('CREATE TABLE IF NOT EXISTS class_events (id INTEGER PRIMARY KEY AUTOINCREMENT, class_id INTEGER NOT NULL, type VARCHAR(20) NOT NULL DEFAULT \'荣誉\', name VARCHAR(200) NOT NULL, date VARCHAR(50) NOT NULL DEFAULT \'\', photo VARCHAR(500) NOT NULL DEFAULT \'\', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE)'); } catch (_) {}
try { db.exec('CREATE TABLE IF NOT EXISTS attendances (id INTEGER PRIMARY KEY AUTOINCREMENT, class_id INTEGER NOT NULL, type VARCHAR(20) NOT NULL DEFAULT \'教学考勤\', date VARCHAR(20) NOT NULL DEFAULT \'\', role VARCHAR(50) NOT NULL DEFAULT \'老师\', total INTEGER NOT NULL DEFAULT 0, should_attend INTEGER NOT NULL DEFAULT 0, actual_attend INTEGER NOT NULL DEFAULT 0, leave_count INTEGER NOT NULL DEFAULT 0, late_count INTEGER NOT NULL DEFAULT 0, absence_count INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE)'); } catch (_) {}
try { db.exec('CREATE TABLE IF NOT EXISTS attendance_records (id INTEGER PRIMARY KEY AUTOINCREMENT, attendance_id INTEGER NOT NULL, student_id INTEGER NOT NULL, status VARCHAR(10) NOT NULL DEFAULT \'缺勤\', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (attendance_id) REFERENCES attendances(id) ON DELETE CASCADE, FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE, UNIQUE(attendance_id, student_id))'); } catch (_) {}

// 迁移：为 classes 表添加 grade_id
try { db.exec('ALTER TABLE classes ADD COLUMN grade_id INTEGER REFERENCES grades(id) ON DELETE SET NULL'); } catch (_) {}

// 迁移：放宽 classes.teacher_id 的 NOT NULL 约束（允许 NULL，兼容无权限校验的导入场景）
try {
  const hasNotNull = db.prepare("SELECT NOT nullable FROM pragma_table_info('classes') WHERE name='teacher_id'").get();
  if (hasNotNull && hasNotNull.notnull === 1) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(`
      CREATE TABLE classes_tmp (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) NOT NULL,
        grade VARCHAR(50) NOT NULL DEFAULT '',
        type VARCHAR(50) NOT NULL DEFAULT '',
        teacher_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
      );
      INSERT INTO classes_tmp (id, name, grade, type, teacher_id, created_at)
        SELECT id, name, grade, type, teacher_id, created_at FROM classes;
      DROP TABLE classes;
      ALTER TABLE classes_tmp RENAME TO classes;
    `);
    db.exec('PRAGMA foreign_keys = ON');
  }
} catch (_) {}

// 迁移：为 exam_groups 表添加双范围字段
try { db.exec('ALTER TABLE exam_groups ADD COLUMN scope_type VARCHAR(10) NOT NULL DEFAULT \'class\''); } catch (_) {}
try { db.exec('ALTER TABLE exam_groups ADD COLUMN grade_id INTEGER REFERENCES grades(id) ON DELETE SET NULL'); } catch (_) {}
try { db.exec('ALTER TABLE exam_groups ADD COLUMN exam_type VARCHAR(20) NOT NULL DEFAULT \'comprehensive\''); } catch (_) {}

// 初始化预置年级
(function seedGrades() {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM grades').get();
  if (existing.cnt === 0) {
    db.prepare('INSERT INTO grades (grade_name, sort) VALUES (?, ?)').run('高一年级', 1);
    db.prepare('INSERT INTO grades (grade_name, sort) VALUES (?, ?)').run('高二年级', 2);
    db.prepare('INSERT INTO grades (grade_name, sort) VALUES (?, ?)').run('高三年级', 3);
  }
})();

// 初始化预置科目
(function seedSubjects() {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM subjects').get();
  if (existing.cnt === 0) {
    const list = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '体育'];
    list.forEach((name, i) => {
      db.prepare('INSERT INTO subjects (subject_name, sort) VALUES (?, ?)').run(name, i + 1);
    });
  }
})();

// 迁移：为 exams 表添加 subject_id
try { db.exec('ALTER TABLE exams ADD COLUMN subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL'); } catch (_) {}

// 迁移：为 exams 表添加新字段
try { db.exec('ALTER TABLE exams ADD COLUMN group_id INTEGER REFERENCES exam_groups(id) ON DELETE SET NULL'); } catch (_) {}
try { db.exec('ALTER TABLE exams ADD COLUMN exam_name VARCHAR(100) NOT NULL DEFAULT \'\''); } catch (_) {}
try { db.exec('ALTER TABLE exams ADD COLUMN exam_time VARCHAR(20) NOT NULL DEFAULT \'\''); } catch (_) {}
try { db.exec('ALTER TABLE exams ADD COLUMN total_score REAL NOT NULL DEFAULT 0'); } catch (_) {}
try { db.exec('ALTER TABLE exams ADD COLUMN remark VARCHAR(200) NOT NULL DEFAULT \'\''); } catch (_) {}

// 迁移：为 scores 表添加新字段
try { db.exec('ALTER TABLE scores ADD COLUMN level VARCHAR(10) NOT NULL DEFAULT \'\''); } catch (_) {}
try { db.exec('ALTER TABLE scores ADD COLUMN single_rank INTEGER NOT NULL DEFAULT 0'); } catch (_) {}
try { db.exec('ALTER TABLE scores ADD COLUMN remark VARCHAR(200) NOT NULL DEFAULT \'\''); } catch (_) {}
try { db.exec('ALTER TABLE scores ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP'); } catch (_) {}

// 学生档案评语表
try { db.exec('CREATE TABLE IF NOT EXISTS student_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, teacher_name VARCHAR(50) NOT NULL DEFAULT \'\', comment TEXT NOT NULL DEFAULT \'\', semester VARCHAR(20) NOT NULL DEFAULT \'\', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE)'); } catch (_) {}

// 运营卡片配置表
try { db.exec('CREATE TABLE IF NOT EXISTS feature_cards (id INTEGER PRIMARY KEY AUTOINCREMENT, card_key VARCHAR(30) NOT NULL UNIQUE, title VARCHAR(50) NOT NULL DEFAULT \'\', subtitle VARCHAR(100) NOT NULL DEFAULT \'\', image_url VARCHAR(500) NOT NULL DEFAULT \'\', link_url VARCHAR(200) NOT NULL DEFAULT \'\', is_enabled INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'); } catch (_) {}

(function seedFeatureCards() {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM feature_cards').get();
  if (existing.cnt === 0) {
    db.prepare("INSERT INTO feature_cards (card_key, title, subtitle, link_url, sort_order) VALUES ('student_analysis', '学生智能分析', 'AI赋能构建学生管家', 'm-student-analysis.html', 1)").run();
    db.prepare("INSERT INTO feature_cards (card_key, title, subtitle, link_url, sort_order) VALUES ('score_report', '成绩报告', '班级及年级成绩统计', 'm-score-report.html', 2)").run();
    db.prepare("INSERT INTO feature_cards (card_key, title, subtitle, link_url, sort_order) VALUES ('notice_board', '通知公告', '学校通知动态一览', 'm-notices.html', 3)").run();
  }
})();

// 迁移：teacher_profiles 添加工号
try { db.exec('ALTER TABLE teacher_profiles ADD COLUMN employee_no VARCHAR(30) NOT NULL DEFAULT \'\''); } catch (_) {}

// 照片批量绑定操作日志表
try { db.exec('CREATE TABLE IF NOT EXISTS photo_batch_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id VARCHAR(64) NOT NULL DEFAULT \'\', target_type VARCHAR(10) NOT NULL DEFAULT \'student\', operator_id INTEGER NOT NULL DEFAULT 0, operator_name VARCHAR(50) NOT NULL DEFAULT \'\', total INTEGER NOT NULL DEFAULT 0, success INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0, skipped INTEGER NOT NULL DEFAULT 0, unmatched INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'); } catch (_) {}

// 导出数据库实例和持久化方法
db.persistence = persistence;
module.exports = db;
