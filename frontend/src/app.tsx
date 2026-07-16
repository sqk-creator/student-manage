import React, { useState, useEffect } from 'react';
import EntryPage from './pages/entry/index';
import Login from './pages/login/index';
import Dashboard from './pages/dashboard/index';
import Classes from './pages/classes/index';
import ClassDetail from './pages/class-detail/index';
import StudentDetail from './pages/student-detail/index';
import ScoreEntry from './pages/score-entry/index';
import ScoreStats from './pages/score-stats/index';
import Banners from './pages/banners/index';
import StudentMgmt from './pages/student-mgmt/index';
import TeacherMgmt from './pages/teacher-mgmt/index';
import AttendanceMgmt from './pages/attendance-mgmt/index';
import './app.scss';

const adminRoutes: Record<string, { component: React.FC; title: string }> = {
  '/admin/': { component: Dashboard, title: '仪表盘' },
  '/admin/dashboard': { component: Dashboard, title: '仪表盘' },
  '/admin/classes': { component: Classes, title: '班级管理' },
  '/admin/class-detail': { component: ClassDetail, title: '班级详情' },
  '/admin/student-detail': { component: StudentDetail, title: '学生详情' },
  '/admin/student-mgmt': { component: StudentMgmt, title: '学生管理' },
  '/admin/teacher-mgmt': { component: TeacherMgmt, title: '教师管理' },
  '/admin/attendance-mgmt': { component: AttendanceMgmt, title: '考勤管理' },
  '/admin/score-entry': { component: ScoreEntry, title: '成绩录入' },
  '/admin/score-stats': { component: ScoreStats, title: '成绩统计' },
  '/admin/banners': { component: Banners, title: 'Banner图管理' },
};

function Sidebar({ current, onNav }: { current: string; onNav: (path: string) => void }) {
  const items = [
    { path: '/admin/dashboard', label: '仪表盘', icon: '◇' },
    { path: '/admin/classes', label: '班级管理', icon: '☰' },
    { path: '/admin/student-mgmt', label: '学生管理', icon: '◎' },
    { path: '/admin/teacher-mgmt', label: '教师管理', icon: '◆' },
    { path: '/admin/attendance-mgmt', label: '考勤管理', icon: '◉' },
  ];
  const operationItems = [
    { path: '/admin/banners', label: 'Banner图管理', icon: '▣' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon">◆</span>
        <span className="logo-text">学生管理系统</span>
      </div>
      <nav className="sidebar-nav">
        {items.map(item => (
          <a
            key={item.path}
            className={`nav-item ${current === item.path || (current === '/admin/' && item.path === '/admin/dashboard') ? 'active' : ''}`}
            onClick={e => { e.preventDefault(); onNav(item.path); }}
            href={item.path}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </a>
        ))}
        <div className="nav-group-title">运营管理</div>
        {operationItems.map(item => (
          <a
            key={item.path}
            className={`nav-item ${current === item.path ? 'active' : ''}`}
            onClick={e => { e.preventDefault(); onNav(item.path); }}
            href={item.path}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </a>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="version">v1.0.0</span>
      </div>
    </aside>
  );
}

export function getAdminPath(): string {
  const p = window.location.pathname;
  if (p === '/admin' || p === '/admin/') return '/admin/';
  if (p.startsWith('/admin/')) return p;
  return '';
}

export default function App() {
  const [token, setToken] = useState<string>(() => {
    try {
      const cached = localStorage.getItem('token') || '';
      if (!cached) return '';
      const payload = JSON.parse(atob(cached.split('.')[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        return '';
      }
      return cached;
    } catch { localStorage.removeItem('token'); return ''; }
  });

  const [adminPath, setAdminPath] = useState(() => getAdminPath());

  useEffect(() => {
    const handlePop = () => {
      const ap = getAdminPath();
      if (!ap) {
        setAdminPath('');
        return;
      }
      setAdminPath(ap);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const isAdmin = !!adminPath;

  if (!isAdmin) {
    return <EntryPage />;
  }

  if (!token) {
    return <Login onLogin={(t: string) => { setToken(t); }} />;
  }

  const navigate = (p: string) => {
    setAdminPath(p);
    window.history.pushState(null, '', p);
  };

  const route = adminRoutes[adminPath] || adminRoutes['/admin/'];
  const Page = route.component;

  return (
    <div className="admin-layout">
      <Sidebar current={adminPath} onNav={navigate} />
      <main className="main-content">
        <header className="top-header">
          <h2 className="header-title">{route.title}</h2>
          <button className="btn-logout" onClick={() => { localStorage.removeItem('token'); setToken(''); }}>
            退出登录
          </button>
        </header>
        <div className="content-area">
          <Page />
        </div>
      </main>
    </div>
  );
}
