import React from 'react';

export default function EntryPage() {
  return (
    <div style={{
      display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',
      background:'#EFFAF8',color:'#111111',
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif"
    }}>
      <style>{`
        .ep-container{text-align:center;padding:40px 24px;max-width:700px;width:100%}
        .ep-title{font-size:32px;font-weight:800;letter-spacing:1px;margin-bottom:8px;background:linear-gradient(135deg,#0F9487,#35B9AA,#14A89A);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .ep-sub{font-size:14px;color:#A9A9A9;margin-bottom:48px;letter-spacing:2px}
        .ep-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
        @media(max-width:560px){.ep-grid{grid-template-columns:1fr}}
        .ep-card{background:#FFFFFF;border:1px solid #E9EEED;border-radius:20px;padding:40px 28px;cursor:pointer;text-decoration:none;color:inherit;position:relative;overflow:hidden;transition:all .3s;display:flex;flex-direction:column;align-items:center;gap:16px;box-shadow:0 4px 16px rgba(0,0,0,0.04)}
        .ep-card:hover{border-color:#14A89A;box-shadow:0 4px 24px rgba(20,168,154,0.1);transform:translateY(-2px)}
        .ep-icon{width:72px;height:72px;border-radius:20px;display:flex;align-items:center;justify-content:center;position:relative;z-index:1}
        .ep-icon.miniapp{background:linear-gradient(135deg,#C9F4EA,#74D8C8);border:1.5px solid rgba(20,168,154,0.15)}
        .ep-icon.admin{background:linear-gradient(135deg,#FFF3E0,#FFCC80);border:1.5px solid rgba(255,106,26,0.15)}
        .ep-icon svg{width:34px;height:34px}
        .ep-label{font-size:20px;font-weight:700;position:relative;z-index:1;letter-spacing:.5px;color:#111111}
        .ep-desc{font-size:13px;color:#7A7A7A;line-height:1.6;max-width:220px}
        .ep-badge{position:absolute;top:16px;right:16px;font-size:10px;padding:3px 10px;border-radius:10px;z-index:2;letter-spacing:.5px}
        .ep-badge.miniapp{background:rgba(20,168,154,0.1);color:#14A89A;border:1px solid rgba(20,168,154,0.15)}
        .ep-badge.admin{background:rgba(255,106,26,0.1);color:#E65100;border:1px solid rgba(255,106,26,0.15)}
      `}</style>
      <div className="ep-container" style={{position:'relative',zIndex:1}}>
        <h1 className="ep-title">学生管理系统</h1>
        <p className="ep-sub">STUDENT MANAGEMENT SYSTEM</p>
        <div className="ep-grid">
          <a className="ep-card" href="/班级组织首页.html">
            <span className="ep-badge miniapp">移动端</span>
            <div className="ep-icon miniapp">
              <svg viewBox="0 0 24 24" fill="none" stroke="#14A89A" strokeWidth="1.5">
                <rect x="5" y="2" width="14" height="20" rx="3"/><line x1="12" y1="18" x2="12" y2="18.01"/>
              </svg>
            </div>
            <span className="ep-label">小程序端</span>
            <span className="ep-desc">移动端班级组织首页，快捷查看班级信息、考勤、公告等</span>
          </a>
          <a className="ep-card" href="#" onClick={e=>{e.preventDefault();window.history.pushState(null,'','/admin/');window.dispatchEvent(new PopStateEvent('popstate'))}}>
            <span className="ep-badge admin">PC 端</span>
            <div className="ep-icon admin">
              <svg viewBox="0 0 24 24" fill="none" stroke="#E65100" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <span className="ep-label">管理后台</span>
            <span className="ep-desc">PC 端管理控制台，班级/学生/考试/成绩全功能管理</span>
          </a>
        </div>
      </div>
    </div>
  );
}
