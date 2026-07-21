import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../services/api';

type Mode = 'single' | 'batch';

const levelColor: Record<string, string> = { A: '#52c41a', B: '#1890ff', C: '#fa8c16', D: '#f5222d' };
const distColors = ['#52c41a', '#1890ff', '#faad14', '#fa8c16', '#f5222d'];
const subjColors = ['#14A89A', '#1890ff', '#faad14', '#fa8c16', '#52c41a', '#722ed1', '#eb2f96', '#13c2c2'];

export default function ScoreReport() {
  const [mode, setMode] = useState<Mode>('single');

  const [classes, setClasses] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);

  const [classId, setClassId] = useState<number>(0);
  const [examId, setExamId] = useState<number>(0);
  const [groupId, setGroupId] = useState<number>(0);

  const [examStats, setExamStats] = useState<any>(null);
  const [groupStats, setGroupStats] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);

  const [multiClassIds, setMultiClassIds] = useState<number[]>([]);
  const [multiClassData, setMultiClassData] = useState<any[]>([]);

  const [trendData, setTrendData] = useState<any[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => { loadInit(); }, []);

  const loadInit = async () => {
    try {
      const [cls, allExams, allGroups] = await Promise.all([
        api.getClasses(), api.getExamsByQuery(), api.getExamGroups()
      ]);
      setClasses(cls); setExams(allExams); setGroups(allGroups);
      if (cls.length) { const cid = cls[0].id; setClassId(cid); }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    if (!classId) return;
    (async () => {
      try {
        const [e, g] = await Promise.all([
          api.getExamsByQuery({ class_id: classId }),
          api.getExamGroups({ class_id: classId })
        ]);
        setExams(e); setGroups(g);
        if (e.length) setExamId(e[0].id); else setExamId(0);
        if (g.length) setGroupId(g[0].id); else setGroupId(0);
      } catch {}
    })();
  }, [classId]);

  useEffect(() => {
    if (mode === 'single' && examId) loadSingleStats();
    else if (mode === 'batch' && groupId) loadBatchStats();
  }, [mode, examId, groupId]);

  useEffect(() => {
    if (examId && examStats) {
      api.getExamScores(examId).then((d: any) => setScores(d.scores || [])).catch(() => setScores([]));
    }
  }, [examId, examStats]);

  const loadSingleStats = async () => {
    try { setExamStats(await api.getExamStats(examId)); setGroupStats(null); }
    catch { setExamStats(null); }
  };
  const loadBatchStats = async () => {
    try { setGroupStats(await api.getExamGroupStats(groupId)); setExamStats(null); }
    catch { setGroupStats(null); }
  };

  const loadMultiClass = async () => {
    if (multiClassIds.length === 0) { setMultiClassData([]); return; }
    const results: any[] = [];
    for (const cid of multiClassIds) {
      const cls = classes.find(c => c.id === cid);
      if (!cls) continue;
      try {
        if (mode === 'single' && examId) {
          const ex = (await api.getExamsByQuery({ class_id: cid })).find((e: any) =>
            e.subject === (examStats?.exam?.subject) && e.exam_name === (examStats?.exam?.exam_name));
          if (ex) {
            const st = await api.getExamStats(ex.id);
            results.push({ className: cls.name, ...st.stats });
          }
        } else if (mode === 'batch' && groupId) {
          const grp = (await api.getExamGroups({ class_id: cid })).find((g: any) =>
            g.group_name === (groupStats?.group?.group_name));
          if (grp) {
            const st = await api.getExamGroupStats(grp.id);
            const totalAvg = st.student_stats?.length
              ? Math.round(st.student_stats.reduce((s: number, r: any) => s + r.total_score, 0) / st.student_stats.length)
              : 0;
            results.push({ className: cls.name, avg: totalAvg, total: st.student_stats?.length });
          }
        }
      } catch {}
    }
    setMultiClassData(results);
  };

  const loadTrend = async () => {
    setTrendLoading(true);
    const pts: any[] = [];
    try {
      if (mode === 'single') {
        const allExams = await api.getExamsByQuery({ class_id: classId });
        const subj = examStats?.exam?.subject || '';
        const filtered = allExams.filter((e: any) => e.subject === subj).sort((a: any, b: any) =>
          (a.exam_time || '').localeCompare(b.exam_time || ''));
        for (const ex of filtered) {
          if (ex.id === examId) { pts.push({ label: ex.exam_name, avg: examStats?.stats?.avg || 0 }); continue; }
          try { const st = await api.getExamStats(ex.id); pts.push({ label: ex.exam_name, avg: st.stats?.avg || 0 }); }
          catch { pts.push({ label: ex.exam_name, avg: 0 }); }
        }
      } else {
        const allGroups = await api.getExamGroups({ class_id: classId });
        const sorted = allGroups.sort((a: any, b: any) => (a.exam_date || '').localeCompare(b.exam_date || ''));
        for (const g of sorted) {
          if (g.id === groupId) {
            const avg = groupStats?.student_stats?.length
              ? Math.round(groupStats.student_stats.reduce((s: number, r: any) => s + r.total_score, 0) / groupStats.student_stats.length)
              : 0;
            pts.push({ label: g.group_name, avg }); continue;
          }
          try {
            const st = await api.getExamGroupStats(g.id);
            const avg = st.student_stats?.length
              ? Math.round(st.student_stats.reduce((s: number, r: any) => s + r.total_score, 0) / st.student_stats.length)
              : 0;
            pts.push({ label: g.group_name, avg });
          } catch { pts.push({ label: g.group_name, avg: 0 }); }
        }
      }
    } catch {} finally { setTrendData(pts); setTrendLoading(false); }
  };

  /* ---- KPI ---- */
  const kpi = useMemo(() => {
    const empty = { avg: 0, max: 0, min: 0, total: 0, passRate: 0, excellentRate: 0, lowRate: 0 };
    if (mode === 'single' && examStats?.stats) {
      const s = examStats.stats;
      const d = examStats.distribution || {};
      const total = s.total || 0;
      const excellent = d.excellent || 0;
      const fail = d.fail || 0;
      const pass = total - fail;
      return {
        avg: Math.round(s.avg || 0), max: s.max || 0, min: s.min || 0, total,
        passRate: total ? Math.round((pass / total) * 100) : 0,
        excellentRate: total ? Math.round((excellent / total) * 100) : 0,
        lowRate: total ? Math.round((fail / total) * 100) : 0,
      };
    }
    if (mode === 'batch' && groupStats?.student_stats) {
      const ss = groupStats.student_stats;
      const total = ss.length;
      if (!total) return empty;
      const avgs = ss.map((r: any) => r.total_score);
      const max = Math.max(...avgs);
      const min = Math.min(...avgs);
      const avg = Math.round(avgs.reduce((a: number, b: number) => a + b, 0) / total);
      const passCount = ss.filter((r: any) => {
        const cnt = r.subject_count || groupStats.exams?.length || 1;
        const maxPossible = cnt * (groupStats.group?.total_score || 100);
        return maxPossible > 0 && (r.total_score / maxPossible) >= 0.6;
      }).length;
      const excCount = ss.filter((r: any) => {
        const cnt = r.subject_count || groupStats.exams?.length || 1;
        const maxPossible = cnt * (groupStats.group?.total_score || 100);
        return maxPossible > 0 && (r.total_score / maxPossible) >= 0.9;
      }).length;
      const lowCount = ss.filter((r: any) => {
        const cnt = r.subject_count || groupStats.exams?.length || 1;
        const maxPossible = cnt * (groupStats.group?.total_score || 100);
        return maxPossible > 0 && (r.total_score / maxPossible) < 0.6;
      }).length;
      return {
        avg, max, min, total,
        passRate: Math.round((passCount / total) * 100),
        excellentRate: Math.round((excCount / total) * 100),
        lowRate: Math.round((lowCount / total) * 100),
      };
    }
    return empty;
  }, [mode, examStats, groupStats]);

  /* ---- Distribution ---- */
  const distribution = useMemo(() => {
    const empty = [
      { label: '90-100 (优秀)', value: 0, color: distColors[0] },
      { label: '80-89 (良好)', value: 0, color: distColors[1] },
      { label: '70-79 (中等)', value: 0, color: distColors[2] },
      { label: '60-69 (及格)', value: 0, color: distColors[3] },
      { label: '0-59 (不及格)', value: 0, color: distColors[4] },
    ];
    if (mode === 'single' && examStats?.distribution) {
      const d = examStats.distribution;
      return [
        { label: '90-100 (优秀)', value: d.excellent || 0, color: distColors[0] },
        { label: '80-89 (良好)', value: d.good || 0, color: distColors[1] },
        { label: '60-79 (中等)', value: d.average || 0, color: distColors[2] },
        { label: '0-59 (不及格)', value: d.fail || 0, color: distColors[4] },
      ];
    }
    if (mode === 'batch' && groupStats?.student_stats) {
      const bins = [0, 0, 0, 0];
      for (const r of groupStats.student_stats) {
        const cnt = r.subject_count || groupStats.exams?.length || 1;
        const maxPossible = cnt * (groupStats.group?.total_score || 100);
        const pct = maxPossible > 0 ? (r.total_score / maxPossible) * 100 : 0;
        if (pct >= 90) bins[0]++;
        else if (pct >= 80) bins[1]++;
        else if (pct >= 60) bins[2]++;
        else bins[3]++;
      }
      return [
        { label: '90-100 (优秀)', value: bins[0], color: distColors[0] },
        { label: '80-89 (良好)', value: bins[1], color: distColors[1] },
        { label: '60-79 (中等)', value: bins[2], color: distColors[2] },
        { label: '0-59 (不及格)', value: bins[3], color: distColors[4] },
      ];
    }
    return empty;
  }, [mode, examStats, groupStats]);

  const distMax = Math.max(...distribution.map(d => d.value), 1);

  /* ---- Subject Averages ---- */
  const subjectAvgs = useMemo(() => {
    if (mode === 'batch' && groupStats?.exams) {
      return groupStats.exams.map((e: any, i: number) => ({
        name: e.exam_name || e.subject || '未知',
        avg: Math.round(e.stats?.avg || 0),
        color: subjColors[i % subjColors.length],
      }));
    }
    return [];
  }, [mode, groupStats]);

  const subjMax = Math.max(...subjectAvgs.map((s: any) => s.avg), 1);

  /* ---- Trend SVG params ---- */
  const trendSVG = useMemo(() => {
    if (!trendData.length) return { points: '', viewBox: '0 0 600 200', maxVal: 0, pts: [] as any[] };
    const vals = trendData.map((d: any) => d.avg);
    const maxVal = Math.max(...vals, 1);
    const pad = { top: 20, right: 40, bottom: 40, left: 50 };
    const w = 560; const h = 260;
    const pw = w - pad.left - pad.right;
    const ph = h - pad.top - pad.bottom;
    const pts = trendData.map((d: any, i: number) => {
      const x = pad.left + (trendData.length > 1 ? (i / (trendData.length - 1)) * pw : pw / 2);
      const y = pad.top + ph - (d.avg / maxVal) * ph;
      return { ...d, x, y };
    });
    const points = pts.map((p: any) => `${p.x},${p.y}`).join(' ');
    return { points, viewBox: `0 0 ${w} ${h}`, maxVal, pts };
  }, [trendData]);

  if (loading) return <div className="loading-state">加载中...</div>;

  const selectedClassName = classes.find(c => c.id === classId)?.name || '';

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 16, fontSize: 13, color: '#86909C' }}>
        <a href="/admin/score-exam-list" style={{ color: '#14A89A', textDecoration: 'none' }}>考试管理</a>
        <span style={{ margin: '0 6px' }}>&gt;</span>
        <span style={{ color: '#1D2129' }}>成绩统计报表</span>
      </div>

      {/* ---- Filters ---- */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #e5e6eb' }}>
            <button style={toggleStyle(mode === 'single')} onClick={() => setMode('single')}>单科统计</button>
            <button style={toggleStyle(mode === 'batch')} onClick={() => setMode('batch')}>多科批次统计</button>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
            <label className="form-label">班级</label>
            <select className="form-select" value={classId} onChange={e => setClassId(Number(e.target.value))}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {mode === 'single' ? (
            <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
              <label className="form-label">考试</label>
              <select className="form-select" value={examId}
                onChange={e => setExamId(Number(e.target.value))}>
                {exams.map(e => <option key={e.id} value={e.id}>{e.exam_name || e.name} ({e.subject})</option>)}
              </select>
            </div>
          ) : (
            <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
              <label className="form-label">考试批次</label>
              <select className="form-select" value={groupId}
                onChange={e => setGroupId(Number(e.target.value))}>
                {groups.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ---- KPI Cards ---- */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <KPICard label="平均分" value={kpi.avg} unit="分" color="#14A89A" />
        <KPICard label="最高分" value={kpi.max} unit="分" color="#52c41a" />
        <KPICard label="最低分" value={kpi.min} unit="分" color="#f5222d" />
        <KPICard label="及格率" value={kpi.passRate} unit="%" color="#1890ff" />
        <KPICard label="优秀率" value={kpi.excellentRate} unit="%" color="#722ed1" />
        <KPICard label="低分率" value={kpi.lowRate} unit="%" color="#fa8c16" />
      </div>

      {/* ---- Charts ---- */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ flex: 1, padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>
            {mode === 'single' ? '分数段分布' : '总分段分布'}
          </div>
          {kpi.total > 0 ? (
            <div>
              {distribution.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ width: 130, fontSize: 12, color: '#666', flexShrink: 0, textAlign: 'right' }}>{d.label}</span>
                  <div style={{ flex: 1 }}>
                    <div className="bar-wrap">
                      <div className="bar-fill" style={{ width: `${(d.value / distMax) * 100}%`, background: d.color }} />
                    </div>
                  </div>
                  <span style={{ width: 36, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{d.value}</span>
                </div>
              ))}
            </div>
          ) : <div className="empty-state">暂无数据</div>}
        </div>

        <div className="card" style={{ flex: 1, padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>各科平均分对比</div>
          {subjectAvgs.length > 0 ? (
            <div>
              {subjectAvgs.map((s: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ width: 80, fontSize: 12, color: '#666', flexShrink: 0, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={s.name}>{s.name}</span>
                  <div style={{ flex: 1 }}>
                    <div className="bar-wrap">
                      <div className="bar-fill" style={{ width: `${(s.avg / subjMax) * 100}%`, background: s.color }} />
                    </div>
                  </div>
                  <span style={{ width: 40, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{s.avg}</span>
                </div>
              ))}
            </div>
          ) : <div className="empty-state">{mode === 'single' ? '单科模式下请切换到"多科批次统计"' : '暂无多科数据'}</div>}
        </div>
      </div>

      {/* ---- Multi-class Comparison ---- */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>多班级对比</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          {classes.map(c => (
            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={multiClassIds.includes(c.id)}
                onChange={() => setMultiClassIds(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])} />
              {c.name}
            </label>
          ))}
        </div>
        <button className="btn btn-default" onClick={loadMultiClass}>开始对比</button>
        {multiClassData.length > 0 && (
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>班级</th>
                <th>平均分</th>
                <th>参考人数</th>
              </tr>
            </thead>
            <tbody>
              {multiClassData.map((d, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{d.className}</td>
                  <td>{d.avg ?? '-'}</td>
                  <td>{d.total ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---- Ranking Table ---- */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>排名明细</div>
        {mode === 'single' && scores.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>排名</th>
                <th>学号</th>
                <th>姓名</th>
                <th>成绩</th>
                <th>等级</th>
              </tr>
            </thead>
            <tbody>
              {[...scores].sort((a: any, b: any) => (a.single_rank || 999) - (b.single_rank || 999)).map(s => (
                <tr key={s.id}>
                  <td>{s.single_rank || '-'}</td>
                  <td>{s.student_no || '-'}</td>
                  <td style={{ fontWeight: 500 }}>{s.student_name || '-'}</td>
                  <td>{s.score}</td>
                  <td><span className="tag" style={{ background: levelColor[s.level] || '#ccc', color: '#fff' }}>{s.level || '-'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : mode === 'batch' && groupStats?.student_stats?.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>排名</th>
                <th>学号</th>
                <th>姓名</th>
                {groupStats.exams?.map((e: any) => <th key={e.exam_id}>{e.exam_name || e.subject}</th>)}
                <th>总分</th>
                <th>等级</th>
              </tr>
            </thead>
            <tbody>
              {[...groupStats.student_stats].sort((a: any, b: any) => (a.total_rank || 999) - (b.total_rank || 999)).map((s: any) => (
                <tr key={s.student_id}>
                  <td>{s.total_rank || '-'}</td>
                  <td>{s.student_no || '-'}</td>
                  <td style={{ fontWeight: 500 }}>{s.student_name || '-'}</td>
                  {groupStats.exams?.map((e: any) => {
                    const subjectData = s.subjects?.[e.subject || e.exam_name];
                    return <td key={e.exam_id}>{subjectData?.score ?? '-'}</td>;
                  })}
                  <td style={{ fontWeight: 700 }}>{s.total_score}</td>
                  <td>
                    {(() => {
                      const cnt = s.subject_count || groupStats.exams?.length || 1;
                      const maxPossible = cnt * (groupStats.group?.total_score || 100);
                      const pct = maxPossible > 0 ? (s.total_score / maxPossible) * 100 : 0;
                      const lvl = pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 60 ? 'C' : 'D';
                      return <span className="tag" style={{ background: levelColor[lvl] || '#ccc', color: '#fff' }}>{lvl}</span>;
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">暂无成绩数据</div>
        )}
      </div>

      {/* ---- Trend Analysis ---- */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>趋势分析</div>
        <button className="btn btn-default" onClick={loadTrend} disabled={trendLoading}>
          {trendLoading ? '加载中...' : '加载趋势数据'}
        </button>
        {trendData.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <svg viewBox={trendSVG.viewBox} style={{ width: '100%', maxHeight: 280 }}>
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const h = 240, ph = h - 20 - 40, pad0 = 50;
                const y = 20 + ph - ratio * ph;
                return (
                  <g key={ratio}>
                    <line x1={pad0} y1={y} x2={520} y2={y} stroke="#f0f0f0" strokeWidth={1} />
                    <text x={pad0 - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#999">
                      {Math.round(trendSVG.maxVal * ratio)}
                    </text>
                  </g>
                );
              })}
              {/* Line */}
              <polyline points={trendSVG.points} fill="none" stroke="#14A89A" strokeWidth={2.5} />
              {/* Dots */}
              {trendSVG.pts.map((p: any, i: number) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={5} fill="#14A89A" stroke="#fff" strokeWidth={2} />
                  <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize={13} fontWeight={600} fill="#333">{p.avg}</text>
                  <text x={p.x} y={258} textAnchor="middle" fontSize={11} fill="#999"
                    style={{ textAnchor: 'middle' }}>{p.label}</text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

function KPICard({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="stat-box">
      <span className="stat-num" style={{ color }}>{value}<span style={{ fontSize: 14, marginLeft: 2 }}>{unit}</span></span>
      <span className="stat-txt">{label}</span>
    </div>
  );
}

function toggleStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 16px', fontSize: 13, border: 'none', cursor: 'pointer',
    background: active ? '#14A89A' : '#fff', color: active ? '#fff' : '#333',
    fontWeight: active ? 600 : 400, transition: 'all 0.2s',
  };
}
