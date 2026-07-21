const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
    teacher_id INTEGER NOT NULL,
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

// 迁移：为 exam_groups 表添加双范围字段
try { db.exec('ALTER TABLE exam_groups ADD COLUMN scope_type VARCHAR(10) NOT NULL DEFAULT \'class\''); } catch (_) {}
try { db.exec('ALTER TABLE exam_groups ADD COLUMN grade_id INTEGER REFERENCES grades(id) ON DELETE SET NULL'); } catch (_) {}

// 初始化预置年级
(function seedGrades() {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM grades').get();
  if (existing.cnt === 0) {
    db.prepare('INSERT INTO grades (grade_name, sort) VALUES (?, ?)').run('高一年级', 1);
    db.prepare('INSERT INTO grades (grade_name, sort) VALUES (?, ?)').run('高二年级', 2);
    db.prepare('INSERT INTO grades (grade_name, sort) VALUES (?, ?)').run('高三年级', 3);
  }
})();

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

module.exports = db;
