import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../services/api';

export default function ScoreExamDetail() {
  const params = new URLSearchParams(window.location.search);
  const examId = Number(params.get('examId'));

  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  const [infoForm, setInfoForm] = useState({
    subject: '', subject_id: null as number | null, exam_name: '', class_id: 0, group_id: null as number | null,
    exam_time: '', total_score: 100, remark: ''
  });
  const [savingInfo, setSavingInfo] = useState(false);

  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => { if (examId) loadAll(); }, [examId]);

  const loadAll = async () => {
    try {
      const [examData, scoresData, statsData, cls] = await Promise.all([
        api.getExamsByQuery().then((all: any[]) => all.find((e: any) => e.id === examId)).catch(() => null),
        api.getExamScores(examId).catch(() => ({ exam: null, scores: [] })),
        api.getExamStats(examId).catch(() => null),
        api.getClasses()
      ]);
      if (!examData) return;
      setExam(examData);
      setScores(scoresData.scores || []);
      setStats(statsData);
      setClasses(cls);

      const allGroups = await api.getExamGroups().catch(() => []);
      setGroups(allGroups);

      const stuList = await api.getStudents(examData.class_id).catch(() => []);
      setStudents(stuList);

      const subs = await api.getSubjects().catch(() => []);
      setSubjects(subs);

      setInfoForm({
        subject: examData.subject || '',
        subject_id: examData.subject_id || null,
        exam_name: examData.exam_name || examData.name || '',
        class_id: examData.class_id,
        group_id: examData.group_id || null,
        exam_time: examData.exam_time || '',
        total_score: examData.total_score || 100,
        remark: examData.remark || ''
      });
    } catch {} finally { setLoading(false); }
  };

  const handleSaveInfo = async () => {
    const subName = infoForm.subject_id ? (subjects.find((s: any) => s.id === infoForm.subject_id)?.subject_name || '') : infoForm.subject;
    if (!subName.trim() || !infoForm.exam_name.trim()) return alert('科目和考试名称不能为空');
    setSavingInfo(true);
    try { await api.updateExam(examId, { ...infoForm, subject: subName }); loadAll(); }
    catch (e: any) { alert(e.message); }
    finally { setSavingInfo(false); }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const scoreList = scores.map((s: any) => ({ student_id: s.student_id, score: s.score }));
      if (scoreList.length === 0) { alert('暂无成绩数据'); return; }
      await api.enterScores(examId, scoreList);
      alert('排名和等级已更新');
      loadAll();
    } catch (e: any) { alert(e.message); }
    finally { setRecalculating(false); }
  };

  const handleClearScores = async () => {
    try {
      for (const s of scores) {
        await request('DELETE', `/scores/${s.id}`);
      }
      setConfirmClear(false);
      loadAll();
    } catch (e: any) { alert(e.message); }
  };

  const handleDeleteExam = async () => {
    try { await api.deleteExam(examId); window.history.back(); }
    catch (e: any) { alert(e.message); }
  };

  const overview = useMemo(() => {
    const total = students.length;
    const enrolled = scores.length;
    const notEnrolled = total - enrolled;
    const completionRate = total > 0 ? Math.round((enrolled / total) * 100) : 0;
    return { total, enrolled, notEnrolled, completionRate };
  }, [students, scores]);

  if (loading) return <div className="loading-state">加载中...</div>;
  if (!exam) return <div className="empty-state">考试不存在</div>;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 16, fontSize: 13, color: '#86909C' }}>
        <a href="/admin/score-exam-list" style={{ color: '#14A89A', textDecoration: 'none' }}>考试管理</a>
        <span style={{ margin: '0 6px' }}>&gt;</span>
        <span style={{ color: '#1D2129' }}>{exam.exam_name || exam.name}</span>
      </div>

      {/* ① Basic Info */}
      <div className="card" style={{ marginBottom: 16, padding: 20 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>基础信息</div>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">科目 <span style={{ color: '#F53F3F' }}>*</span></label>
            <select className="form-select" value={infoForm.subject_id ?? ''} onChange={e => {
              const id = e.target.value ? Number(e.target.value) : null;
              const sub = subjects.find((s: any) => s.id === id);
              setInfoForm({ ...infoForm, subject_id: id, subject: sub ? sub.subject_name : '' });
            }}>
              <option value="">请选择科目</option>
              {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">考试名称 <span style={{ color: '#F53F3F' }}>*</span></label>
            <input className="form-input" value={infoForm.exam_name}
              onChange={e => setInfoForm({ ...infoForm, exam_name: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">所属班级</label>
            <select className="form-select" value={infoForm.class_id}
              onChange={e => setInfoForm({ ...infoForm, class_id: Number(e.target.value) })}>
              {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">所属批次</label>
            <select className="form-select" value={infoForm.group_id ?? ''}
              onChange={e => setInfoForm({ ...infoForm, group_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">无（独立考试）</option>
              {groups.map((g: any) => <option key={g.id} value={g.id}>{g.group_name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">考试时间</label>
            <input className="form-input" type="datetime-local" value={infoForm.exam_time}
              onChange={e => setInfoForm({ ...infoForm, exam_time: e.target.value })} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">满分</label>
            <input className="form-input" type="number" value={infoForm.total_score}
              onChange={e => setInfoForm({ ...infoForm, total_score: Number(e.target.value) })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">备注</label>
          <input className="form-input" value={infoForm.remark}
            onChange={e => setInfoForm({ ...infoForm, remark: e.target.value })} />
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={handleSaveInfo} disabled={savingInfo}>
            {savingInfo ? '保存中...' : '保存修改'}
          </button>
        </div>
      </div>

      {/* ② Score Status Overview */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-box">
          <div className="stat-num">{overview.enrolled}</div>
          <div className="stat-txt">已录人数</div>
        </div>
        <div className="stat-box">
          <div className="stat-num">{overview.notEnrolled}</div>
          <div className="stat-txt">未录人数</div>
        </div>
        {stats && (
          <div className="stat-box">
            <div className="stat-num">{stats.stats?.avg ?? '-'}</div>
            <div className="stat-txt">平均分</div>
          </div>
        )}
        <div className="stat-box">
          <div className="stat-num">{overview.completionRate}%</div>
          <div className="stat-txt">完成度</div>
          <div className="bar-wrap" style={{ marginTop: 8 }}>
            <div className="bar-fill" style={{ width: `${overview.completionRate}%` }}></div>
          </div>
        </div>
      </div>

      {/* ③ Core Actions */}
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>核心操作</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary"
            onClick={() => window.location.href = `/admin/score-entry?examId=${examId}&examName=${encodeURIComponent(exam.exam_name || exam.name)}&classId=${exam.class_id}`}>
            成绩管理
          </button>
          <button className="btn btn-default"
            onClick={() => window.location.href = `/admin/score-stats?examId=${examId}&examName=${encodeURIComponent(exam.exam_name || exam.name)}`}>
            统计报表
          </button>
          <button className="btn btn-default" onClick={handleRecalculate} disabled={recalculating}>
            {recalculating ? '计算中...' : '重算排名等级'}
          </button>
          {exam.group_id && (
            <button className="btn btn-default"
              onClick={() => window.location.href = `/admin/score-group-detail?groupId=${exam.group_id}`}>
              查看所属批次
            </button>
          )}
        </div>
      </div>

      {/* ④ Operation Log Table */}
      <div className="card" style={{ marginBottom: 16, padding: 20 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>成绩记录日志</div>
        {scores.length === 0 ? (
          <div className="empty-state">暂无成绩记录</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>学号</th>
                <th>姓名</th>
                <th>成绩</th>
                <th>等级</th>
                <th>排名</th>
                <th>最后更新</th>
              </tr>
            </thead>
            <tbody>
              {[...scores].sort((a: any, b: any) => (b.updated_at || '').localeCompare(a.updated_at || '')).slice(0, 20).map((s: any) => (
                <tr key={s.id}>
                  <td>{s.student_no || '-'}</td>
                  <td style={{ fontWeight: 500 }}>{s.student_name || '-'}</td>
                  <td><span className={`tag ${s.score >= (exam.total_score || 100) * 0.9 ? 'tag-green' : s.score < (exam.total_score || 100) * 0.6 ? 'tag-red' : ''}`}>{s.score}</span></td>
                  <td>{s.level || '-'}</td>
                  <td>{s.single_rank || '-'}</td>
                  <td style={{ color: '#86909C', fontSize: 12 }}>
                    {s.updated_at ? s.updated_at.substring(0, 16).replace('T', ' ') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ⑤ Danger Zone */}
      <div className="card" style={{ marginBottom: 16, padding: 20, border: '1px solid #FFCCC7' }}>
        <div className="card-title" style={{ marginBottom: 12, color: '#F53F3F' }}>风险操作区</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-danger" onClick={() => setConfirmClear(true)}>
            清空成绩
          </button>
          <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
            删除考试
          </button>
        </div>
      </div>

      {/* Confirm Clear Scores Modal */}
      {confirmClear && (
        <div className="modal-overlay" onClick={() => setConfirmClear(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-title">确认清空成绩</div>
            <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>
              确定要清空「{exam.exam_name || exam.name}」的全部 {scores.length} 条成绩记录吗？此操作不可撤销。
            </p>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => setConfirmClear(false)}>取消</button>
              <button className="btn btn-danger" onClick={handleClearScores}>确认清空</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Exam Modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-title">确认删除考试</div>
            <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>
              确定要删除「{exam.exam_name || exam.name}」吗？关联的所有成绩数据将被同步删除。此操作不可撤销。
            </p>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => setConfirmDelete(false)}>取消</button>
              <button className="btn btn-danger" onClick={handleDeleteExam}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function request(method: string, path: string, body?: any) {
  const BASE = '/api';
  const token = localStorage.getItem('token') || '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}
