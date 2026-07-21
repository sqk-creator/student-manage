import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../services/api';

const LEVEL_COLOR: Record<string, string> = { A: '#52c41a', B: '#1890ff', C: '#fa8c16', D: '#f5222d' };
const RADAR_COLORS = ['#14A89A', '#1890ff', '#faad14', '#fa8c16', '#52c41a', '#722ed1', '#eb2f96', '#13c2c2'];

export default function ScoreStudentArchive() {
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  const [searchClassId, setSearchClassId] = useState<number>(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchStudentId, setSearchStudentId] = useState('');

  const [selectedStudentId, setSelectedStudentId] = useState<number>(0);
  const [student, setStudent] = useState<any>(null);
  const [allScores, setAllScores] = useState<any[]>([]);
  const [examGroups, setExamGroups] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);

  const [commentText, setCommentText] = useState('');
  const [commentSemester, setCommentSemester] = useState('');
  const [teacherName, setTeacherName] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadClasses(); }, []);

  const loadClasses = async () => {
    try {
      const cls = await api.getClasses();
      setClasses(cls);
      if (cls.length) setSearchClassId(cls[0].id);
    } catch {} finally { setLoading(false); }
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim() && !searchStudentId.trim()) {
      if (searchClassId) { const stus = await api.getStudents(searchClassId).catch(() => []); setStudents(stus); }
      return;
    }
    const keyword = searchStudentId || searchKeyword;
    const results = await api.searchStudents(keyword, String(searchClassId || '')).catch(() => []);
    setStudents(Array.isArray(results) ? results : []);
  };

  useEffect(() => { handleSearch(); }, [searchClassId]);

  const selectStudent = async (stuId: number) => {
    setSelectedStudentId(stuId);
    try {
      const [stu, scores, comments] = await Promise.all([
        api.getStudent(stuId),
        api.getScores({ student_id: stuId }).catch(() => []),
        api.getStudentComments(stuId).catch(() => [])
      ]);
      setStudent(stu);
      const scoreList = Array.isArray(scores) ? scores : scores?.scores || [];
      setAllScores(scoreList);
      setComments(Array.isArray(comments) ? comments : []);
      if (stu.class_id) {
        const groups = await api.getExamGroups({ class_id: stu.class_id }).catch(() => []);
        setExamGroups(groups);
        setCommentSemester(groups[0]?.semester || '');
      }
    } catch {}
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedStudentId) return;
    setSaving(true);
    try {
      await api.createStudentComment(selectedStudentId, {
        teacher_name: teacherName, comment: commentText.trim(), semester: commentSemester
      });
      setCommentText('');
      const updated = await api.getStudentComments(selectedStudentId).catch(() => []);
      setComments(Array.isArray(updated) ? updated : []);
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleDeleteComment = async (id: number) => {
    if (!selectedStudentId) return;
    await api.deleteStudentComment(selectedStudentId, id);
    setComments(prev => prev.filter(c => c.id !== id));
  };

  /* ---- Semester overview ---- */
  const semesterScores = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const s of allScores) {
      const sem = s.semester || getSemester(s.exam_time || s.exam_date || '');
      if (!map[sem]) map[sem] = [];
      map[sem].push(s);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [allScores]);

  /* ---- Trend chart ---- */
  const trendPoints = useMemo(() => {
    const sorted = [...allScores].sort((a: any, b: any) =>
      (a.exam_time || a.exam_date || '').localeCompare(b.exam_time || b.exam_date || ''));
    return sorted.map((s, i) => ({
      label: (s.exam_name || s.name || '').substring(0, 6),
      score: s.score,
      total: s.total_score || 100,
      examTime: s.exam_time || s.exam_date || '',
      x: 0, y: 0
    }));
  }, [allScores]);

  const trendSVG = useMemo(() => {
    if (trendPoints.length === 0) return { points: '', pts: [] as any[], maxVal: 100, viewBox: '0 0 560 240' };
    const maxVal = Math.max(...trendPoints.map(p => p.total), 100);
    const pad = { top: 30, right: 30, bottom: 40, left: 50 };
    const w = 560, h = 240;
    const pw = w - pad.left - pad.right, ph = h - pad.top - pad.bottom;
    const pts = trendPoints.map((p, i) => ({
      ...p,
      x: pad.left + (trendPoints.length > 1 ? (i / (trendPoints.length - 1)) * pw : pw / 2),
      y: pad.top + ph - (p.score / maxVal) * ph,
    }));
    return { points: pts.map(p => `${p.x},${p.y}`).join(' '), pts, maxVal, viewBox: `0 0 ${w} ${h}` };
  }, [trendPoints]);

  /* ---- Radar chart ---- */
  const radarData = useMemo(() => {
    const subjectMap: Record<string, { total: number; count: number; totalScore: number }> = {};
    for (const s of allScores) {
      const subj = s.subject || '未知';
      if (!subjectMap[subj]) subjectMap[subj] = { total: 0, count: 0, totalScore: 0 };
      subjectMap[subj].total += s.score;
      subjectMap[subj].count += 1;
      subjectMap[subj].totalScore = s.total_score || 100;
    }
    return Object.entries(subjectMap).map(([name, d]) => ({
      name,
      avg: Math.round(d.total / d.count),
      rate: Math.round((d.total / d.count) / (d.totalScore || 100) * 100),
    }));
  }, [allScores]);

  const radarSVG = useMemo(() => {
    const data = radarData;
    if (data.length < 3) return null;
    const cx = 150, cy = 150, r = 120;
    const n = data.length;
    const angleStep = (2 * Math.PI) / n;
    const getXY = (i: number, radius: number) => ({
      x: cx + radius * Math.cos(angleStep * i - Math.PI / 2),
      y: cy + radius * Math.sin(angleStep * i - Math.PI / 2),
    });

    const gridLevels = [0.25, 0.5, 0.75, 1];
    const gridPolygons = gridLevels.map(level => {
      const pts = data.map((_, i) => {
        const { x, y } = getXY(i, r * level);
        return `${x},${y}`;
      }).join(' ');
      return pts;
    });

    const valuePoints = data.map((d, i) => {
      const { x, y } = getXY(i, r * (d.rate / 100));
      return `${x},${y}`;
    }).join(' ');

    const labels = data.map((d, i) => {
      const { x, y } = getXY(i, r + 20);
      return { x, y, name: d.name, rate: d.rate };
    });

    return { cx, cy, r, gridPolygons, valuePoints, labels };
  }, [radarData]);

  if (loading) return <div className="loading-state">加载中...</div>;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 16, fontSize: 13, color: '#86909C' }}>
        <a href="/admin/score-exam-list" style={{ color: '#14A89A', textDecoration: 'none' }}>考试管理</a>
        <span style={{ margin: '0 6px' }}>&gt;</span>
        <span style={{ color: '#1D2129' }}>学生成绩档案</span>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
            <label className="form-label">班级</label>
            <select className="form-select" value={searchClassId} onChange={e => setSearchClassId(Number(e.target.value))}>
              <option value={0}>全部班级</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">学号</label>
            <input className="form-input" style={{ width: 120 }} placeholder="输入学号"
              value={searchStudentId} onChange={e => setSearchStudentId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">姓名</label>
            <input className="form-input" style={{ width: 120 }} placeholder="输入姓名"
              value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          </div>
          <button className="btn btn-primary" onClick={handleSearch}>搜索</button>
        </div>

        {students.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {students.map((s: any) => (
              <button key={s.id}
                className={`btn ${s.id === selectedStudentId ? 'btn-primary' : 'btn-default'} btn-sm`}
                onClick={() => selectStudent(s.id)}>
                {s.student_no} {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {!student ? (
        <div className="empty-state">请搜索并选择一名学生</div>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Left Sidebar */}
          <div style={{ width: 240, flexShrink: 0 }}>
            <div className="card" style={{ padding: 20, textAlign: 'center', marginBottom: 16 }}>
              {student.photo ? (
                <img src={student.photo} alt="" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: 12 }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#e5e6eb', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#86909C' }}>
                  {(student.name || '?')[0]}
                </div>
              )}
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1D2129', marginBottom: 4 }}>{student.name}</div>
              <div style={{ fontSize: 13, color: '#86909C', marginBottom: 2 }}>{student.student_no}</div>
              <div style={{ fontSize: 13, color: '#86909C', marginBottom: 12 }}>{student.class_name || ''}</div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>学期</label>
                <select className="form-select" style={{ fontSize: 13 }} value={commentSemester}
                  onChange={e => setCommentSemester(e.target.value)}>
                  <option value="">全部学期</option>
                  {examGroups.map(g => <option key={g.id} value={g.semester}>{g.semester}</option>)}
                </select>
              </div>
            </div>

            {/* Teacher Comments */}
            <div className="card" style={{ padding: 16 }}>
              <div className="card-title" style={{ marginBottom: 12, fontSize: 14 }}>教师评语</div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label" style={{ fontSize: 12 }}>教师姓名</label>
                <input className="form-input" style={{ fontSize: 13 }} placeholder="可选"
                  value={teacherName} onChange={e => setTeacherName(e.target.value)} />
              </div>
              <textarea className="form-input" style={{ width: '100%', height: 80, fontSize: 13, resize: 'vertical', marginBottom: 8 }}
                placeholder="输入评语..." value={commentText} onChange={e => setCommentText(e.target.value)} />
              <button className="btn btn-primary btn-sm" style={{ width: '100%' }}
                onClick={handleAddComment} disabled={saving}>
                {saving ? '保存中...' : '添加评语'}
              </button>
              {comments.length > 0 && (
                <div style={{ marginTop: 12, maxHeight: 200, overflowY: 'auto' }}>
                  {comments.map((c: any) => (
                    <div key={c.id} style={{
                      padding: '8px 10px', marginBottom: 6, borderRadius: 6, background: '#f7f8fa',
                      fontSize: 12, lineHeight: 1.5, position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: '#86909C' }}>
                          {c.teacher_name || '教师'} {c.semester ? `· ${c.semester}` : ''}
                        </span>
                        <span style={{ color: '#c9cdd4', fontSize: 11 }}>
                          {c.created_at ? c.created_at.substring(0, 10) : ''}
                        </span>
                      </div>
                      <div style={{ color: '#1D2129' }}>{c.comment}</div>
                      <button onClick={() => handleDeleteComment(c.id)}
                        style={{
                          position: 'absolute', top: 4, right: 6, border: 'none', background: 'none',
                          color: '#c9cdd4', cursor: 'pointer', fontSize: 14, lineHeight: 1
                        }}>x</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* ① Semester Score Overview */}
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>学期成绩总览</div>
              {semesterScores.length > 0 ? semesterScores.map(([sem, scores]) => (
                <div key={sem} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#14A89A', marginBottom: 8 }}>
                    {sem || '未分学期'}
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>考试名称</th>
                        <th>科目</th>
                        <th>考试时间</th>
                        <th>成绩</th>
                        <th>满分</th>
                        <th>得分率</th>
                        <th>排名</th>
                        <th>等级</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scores.map((s: any) => {
                        const rate = s.total_score ? Math.round((s.score / s.total_score) * 100) : 0;
                        return (
                          <tr key={s.id}>
                            <td style={{ fontWeight: 500 }}>{s.exam_name || s.name || '-'}</td>
                            <td>{s.subject || '-'}</td>
                            <td style={{ fontSize: 12, color: '#86909C' }}>{s.exam_time || s.exam_date || '-'}</td>
                            <td style={{ fontWeight: 600 }}>{s.score}</td>
                            <td>{s.total_score || '-'}</td>
                            <td>
                              <span style={{ color: rate >= 90 ? '#52c41a' : rate >= 60 ? '#1890ff' : '#f5222d', fontWeight: 600 }}>
                                {rate}%
                              </span>
                            </td>
                            <td>{s.single_rank || '-'}</td>
                            <td>
                              <span className="tag" style={{ background: LEVEL_COLOR[s.level] || '#ccc', color: '#fff', fontSize: 11 }}>
                                {s.level || '-'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )) : <div className="empty-state">暂无成绩数据</div>}
            </div>

            {/* ② Score Trend Chart */}
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>成绩趋势分析</div>
              {trendPoints.length > 1 ? (
                <div style={{ overflowX: 'auto' }}>
                  <svg viewBox={trendSVG.viewBox} style={{ width: '100%', maxHeight: 260 }}>
                    {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                      const h = 240, ph = h - 30 - 40, pad0 = 50;
                      const y = 30 + ph - ratio * ph;
                      return (
                        <g key={ratio}>
                          <line x1={pad0} y1={y} x2={530} y2={y} stroke="#f0f0f0" strokeWidth={1} />
                          <text x={pad0 - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#999">
                            {Math.round(trendSVG.maxVal * ratio)}
                          </text>
                        </g>
                      );
                    })}
                    <polyline points={trendSVG.points} fill="none" stroke="#14A89A" strokeWidth={2.5} />
                    {trendSVG.pts.map((p: any, i: number) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r={5} fill="#14A89A" stroke="#fff" strokeWidth={2} />
                        <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize={12} fontWeight={600} fill="#333">{p.score}</text>
                        <text x={p.x} y={p.y + 22} textAnchor="middle" fontSize={10} fill="#999">{p.label}</text>
                      </g>
                    ))}
                  </svg>
                </div>
              ) : <div className="empty-state">需要至少2次考试成绩才能生成趋势图</div>}
            </div>

            {/* ③ Subject Bias Radar Chart */}
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>偏科深度分析</div>
              {radarSVG ? (
                <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                  <svg viewBox="0 0 300 300" style={{ width: 300, height: 300, flexShrink: 0 }}>
                    {radarSVG.gridPolygons.map((pts, i) => (
                      <polygon key={i} points={pts} fill="none" stroke={i === 3 ? '#d0d0d0' : '#f0f0f0'} strokeWidth={i === 3 ? 1.5 : 1} />
                    ))}
                    {radarData.map((d, i) => {
                      const angle = (2 * Math.PI) / radarData.length;
                      const x = 150 + 150 * Math.cos(angle * i - Math.PI / 2);
                      const y = 150 + 150 * Math.sin(angle * i - Math.PI / 2);
                      return (
                        <line key={i} x1={150} y1={150} x2={x} y2={y} stroke="#e8e8e8" strokeWidth={1} />
                      );
                    })}
                    <polygon points={radarSVG.valuePoints} fill="rgba(20,168,154,0.2)" stroke="#14A89A" strokeWidth={2} />
                    {radarData.map((d, i) => {
                      const angle = (2 * Math.PI) / radarData.length;
                      const dr = 120 * (d.rate / 100);
                      const x = 150 + dr * Math.cos(angle * i - Math.PI / 2);
                      const y = 150 + dr * Math.sin(angle * i - Math.PI / 2);
                      return (
                        <circle key={i} cx={x} cy={y} r={4} fill="#14A89A" stroke="#fff" strokeWidth={2} />
                      );
                    })}
                    {radarSVG.labels.map((l: any, i: number) => (
                      <text key={i} x={l.x} y={l.y} textAnchor="middle" fontSize={12} fill="#333" fontWeight={500}>
                        {l.name} ({l.rate}%)
                      </text>
                    ))}
                  </svg>
                  <div>
                    <table style={{ minWidth: 200 }}>
                      <thead>
                        <tr><th>科目</th><th>均分</th><th>得分率</th><th>评价</th></tr>
                      </thead>
                      <tbody>
                        {radarData.sort((a, b) => b.rate - a.rate).map((d, i) => {
                          const tag = d.rate >= 90 ? '优势' : d.rate >= 70 ? '正常' : d.rate >= 50 ? '偏弱' : '弱项';
                          const tc = d.rate >= 90 ? '#52c41a' : d.rate >= 70 ? '#1890ff' : d.rate >= 50 ? '#fa8c16' : '#f5222d';
                          return (
                            <tr key={i}>
                              <td style={{ fontWeight: 500 }}>{d.name}</td>
                              <td>{d.avg}</td>
                              <td style={{ fontWeight: 600, color: tc }}>{d.rate}%</td>
                              <td><span className="tag" style={{ background: tc, color: '#fff', fontSize: 11 }}>{tag}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : <div className="empty-state">需要至少3科成绩才能生成雷达图</div>}
            </div>

            {/* ④ Report Card Generation */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>成绩单生成</div>
              {examGroups.length > 0 ? (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <select className="form-select" style={{ width: 240 }} id="report-group"
                      onChange={e => {
                        const gid = Number(e.target.value);
                        if (!gid) return;
                        const g = examGroups.find(x => x.id === gid);
                        if (g) {
                          const semScores = allScores.filter((s: any) => {
                            const sem = s.semester || getSemester(s.exam_time || s.exam_date || '');
                            return sem === g.semester;
                          });
                          generateReportCard(student, g, semScores);
                        }
                      }}>
                      <option value={0}>选择考试批次</option>
                      {examGroups.map(g => <option key={g.id} value={g.id}>{g.group_name} ({g.semester})</option>)}
                    </select>
                  </div>
                </div>
              ) : <div className="empty-state">暂无考试批次数据</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getSemester(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split(/[-T ]/);
  if (parts.length < 2) return '';
  const year = parseInt(parts[0]), month = parseInt(parts[1]);
  if (month >= 9) return `${year}-${year + 1}学年第一学期`;
  if (month >= 2) return `${year - 1}-${year}学年第二学期`;
  return `${year - 1}-${year}学年第一学期`;
}

function generateReportCard(student: any, group: any, semScores: any[]) {
  const w = window.open('', '_blank', 'width=800,height=600');
  if (!w) return;
  const total = semScores.reduce((s: number, sc: any) => s + sc.score, 0);
  const rows = semScores.map((s: any) => {
    const rate = s.total_score ? Math.round((s.score / s.total_score) * 100) : 0;
    const lvl = s.level || (rate >= 90 ? 'A' : rate >= 80 ? 'B' : rate >= 60 ? 'C' : 'D');
    return `<tr>
      <td>${s.subject || '-'}</td><td>${s.exam_name || s.name || '-'}</td>
      <td>${s.score}</td><td>${s.total_score || '-'}</td>
      <td>${lvl}</td><td>${s.single_rank || '-'}</td>
    </tr>`;
  }).join('');

  w.document.write(`
    <html><head><meta charset="utf-8"><title>成绩单</title>
    <style>
      body{font-family:'Microsoft YaHei',sans-serif;padding:40px;color:#333}
      h1{text-align:center;font-size:22px;margin-bottom:4px}
      .sub{text-align:center;color:#666;font-size:13px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border:1px solid #e5e6eb;padding:10px 12px;text-align:center;font-size:13px}
      th{background:#f7f8fa;font-weight:600}
      .summary{margin-top:20px;display:flex;gap:24px;justify-content:center}
      .summary-item{text-align:center}
      .summary-item .val{font-size:24px;font-weight:700;color:#14A89A}
      .summary-item .lbl{font-size:12px;color:#86909C}
    </style></head><body>
      <h1>学生成绩单</h1>
      <div class="sub">${group.group_name} · ${group.semester || ''}</div>
      <p><strong>姓名：</strong>${student.name} &nbsp;&nbsp; <strong>学号：</strong>${student.student_no || '-'} &nbsp;&nbsp; <strong>班级：</strong>${student.class_name || '-'}</p>
      <table><thead><tr><th>科目</th><th>考试名称</th><th>成绩</th><th>满分</th><th>等级</th><th>排名</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="summary">
        <div class="summary-item"><div class="val">${total}</div><div class="lbl">总分</div></div>
        <div class="summary-item"><div class="val">${semScores.length ? Math.round(total / semScores.length) : 0}</div><div class="lbl">平均分</div></div>
        <div class="summary-item"><div class="val">${semScores.length}</div><div class="lbl">科目数</div></div>
      </div>
    </body></html>
  `);
  w.document.close();
}
