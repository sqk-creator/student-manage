import React, { useEffect, useState, useRef, useMemo } from 'react';
import { api } from '../../services/api';

interface ExamItem {
  id: number;
  subject: string;
  exam_name: string;
  exam_time: string;
  total_score: number;
  remark: string;
}

export default function ScoreGroupDetail() {
  const params = new URLSearchParams(window.location.search);
  const groupId = Number(params.get('groupId'));

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<any>(null);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  const [infoForm, setInfoForm] = useState({ group_name: '', class_id: 0, semester: '', exam_date: '', total_score: 0, remark: '' });
  const [savingInfo, setSavingInfo] = useState(false);

  const [showAddExam, setShowAddExam] = useState(false);
  const [examForm, setExamForm] = useState({ subject: '', exam_name: '', exam_time: '', total_score: 100, remark: '' });
  const [editExamId, setEditExamId] = useState<number | null>(null);

  const batchTotalRef = useRef<HTMLInputElement>(null);

  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => { if (groupId) loadAll(); }, [groupId]);

  const loadAll = async () => {
    try {
      const [grp, cls, st] = await Promise.all([
        api.getExamGroup(groupId),
        api.getClasses(),
        api.getExamGroupStats(groupId).catch(() => null)
      ]);
      const examList = await api.getExamsByQuery({ group_id: groupId });
      setGroup(grp);
      setExams(examList || []);
      setClasses(cls);
      setStats(st);
      setInfoForm({
        group_name: grp.group_name,
        class_id: grp.class_id,
        semester: grp.semester || '',
        exam_date: grp.exam_date || '',
        total_score: grp.total_score || 0,
        remark: grp.remark || ''
      });
    } catch {} finally { setLoading(false); }
  };

  const handleSaveInfo = async () => {
    if (!infoForm.group_name.trim()) return alert('批次名称不能为空');
    setSavingInfo(true);
    try {
      await api.updateExamGroup(groupId, infoForm);
      loadAll();
    } catch (e: any) { alert(e.message); }
    finally { setSavingInfo(false); }
  };

  const handleAddExam = async () => {
    if (!examForm.subject.trim() || !examForm.exam_name.trim()) return alert('科目和考试名称为必填');
    try {
      if (editExamId) {
        await api.updateExam(editExamId, examForm);
      } else {
        await api.createExamByQuery({ ...examForm, class_id: group.class_id, group_id: groupId });
      }
      setShowAddExam(false);
      setEditExamId(null);
      setExamForm({ subject: '', exam_name: '', exam_time: '', total_score: 100, remark: '' });
      loadAll();
    } catch (e: any) { alert(e.message); }
  };

  const openEditExam = (exam: ExamItem) => {
    setEditExamId(exam.id);
    setExamForm({
      subject: exam.subject, exam_name: exam.exam_name,
      exam_time: exam.exam_time || '', total_score: exam.total_score || 100,
      remark: exam.remark || ''
    });
    setShowAddExam(true);
  };

  const handleDeleteExam = async (examId: number, name: string) => {
    if (!window.confirm(`确定删除「${name}」吗？关联的成绩将被同步删除。`)) return;
    try { await api.deleteExam(examId); loadAll(); } catch (e: any) { alert(e.message); }
  };

  const handleBatchTotalScore = () => {
    const val = batchTotalRef.current?.value;
    if (!val) return;
    const score = Number(val);
    if (isNaN(score) || score <= 0) return alert('请输入有效的满分值');
    (async () => {
      try {
        await Promise.all(exams.map(e => api.updateExam(e.id, { total_score: score })));
        loadAll();
      } catch (e: any) { alert(e.message); }
    })();
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const list = [...exams];
    const [item] = list.splice(dragIdx, 1);
    list.splice(idx, 0, item);
    setExams(list);
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  const computedStats = useMemo(() => {
    if (!stats || !stats.student_stats) return { enrolled: 0, avgTotal: 0, passRate: 0, completionRate: 0 };
    const students = stats.student_stats;
    const enrolled = students.length;
    if (enrolled === 0) return { enrolled: 0, avgTotal: 0, passRate: 0, completionRate: 0 };
    const sumTotal = students.reduce((s: number, st: any) => s + st.total_score, 0);
    const avgTotal = Math.round(sumTotal / enrolled);
    const groupTotal = group?.total_score || 1;
    const passCount = students.filter((st: any) => (st.total_score / groupTotal) >= 0.6).length;
    const passRate = Math.round((passCount / enrolled) * 100);
    const allSubjects = exams.length;
    const completionRate = allSubjects > 0 ? Math.round((students.reduce((s: number, st: any) => s + st.subject_count, 0) / (enrolled * allSubjects)) * 100) : 0;
    return { enrolled, avgTotal, passRate, completionRate };
  }, [stats, group, exams]);

  const handleDeleteGroup = async () => {
    if (!window.confirm(`确定删除批次「${group?.group_name}」吗？`)) return;
    try {
      await api.deleteExamGroup(groupId);
      window.history.back();
    } catch (e: any) { alert(e.message); }
  };

  if (loading) return <div className="loading-state">加载中...</div>;
  if (!group) return <div className="empty-state">批次不存在</div>;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 16, fontSize: 13, color: '#86909C' }}>
        <a href="/admin/score-exam-list" style={{ color: '#14A89A', textDecoration: 'none' }}>考试管理</a>
        <span style={{ margin: '0 6px' }}>&gt;</span>
        <span style={{ color: '#1D2129' }}>{group.group_name}</span>
      </div>

      {/* ① Basic Info */}
      <div className="card" style={{ marginBottom: 16, padding: 20 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>基础信息</div>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">批次名称</label>
            <input className="form-input" value={infoForm.group_name}
              onChange={e => setInfoForm({ ...infoForm, group_name: e.target.value })} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">所属班级</label>
            <select className="form-select" value={infoForm.class_id}
              onChange={e => setInfoForm({ ...infoForm, class_id: Number(e.target.value) })}>
              {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">学期</label>
            <input className="form-input" value={infoForm.semester}
              onChange={e => setInfoForm({ ...infoForm, semester: e.target.value })} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">考试日期</label>
            <input className="form-input" type="date" value={infoForm.exam_date}
              onChange={e => setInfoForm({ ...infoForm, exam_date: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">总分</label>
            <input className="form-input" type="number" value={infoForm.total_score}
              onChange={e => setInfoForm({ ...infoForm, total_score: Number(e.target.value) })} />
          </div>
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label">备注</label>
            <input className="form-input" value={infoForm.remark}
              onChange={e => setInfoForm({ ...infoForm, remark: e.target.value })} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={handleSaveInfo} disabled={savingInfo}>
            {savingInfo ? '保存中...' : '保存修改'}
          </button>
        </div>
      </div>

      {/* ② Subjects Table */}
      <div className="card" style={{ marginBottom: 16, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span className="card-title" style={{ margin: 0 }}>科目管理</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={batchTotalRef} className="form-input" style={{ width: 100 }} type="number" placeholder="统一满分" />
            <button className="btn btn-default btn-sm" onClick={handleBatchTotalScore}>批量设置</button>
            <button className="btn btn-primary btn-sm" onClick={() => { setEditExamId(null); setExamForm({ subject: '', exam_name: '', exam_time: '', total_score: 100, remark: '' }); setShowAddExam(true); }}>
              + 新增科目
            </button>
          </div>
        </div>

        {exams.length === 0 ? (
          <div className="empty-state">暂无科目，请新增</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th style={{ width: 30 }}>#</th>
                <th>科目</th>
                <th>考试名称</th>
                <th>考试时间</th>
                <th>满分</th>
                <th>备注</th>
                <th style={{ width: 120 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam, idx) => (
                <tr key={exam.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  style={{ cursor: 'grab', background: dragIdx === idx ? '#F1F8F7' : undefined }}>
                  <td>
                    <span style={{ color: '#C9CDD4', cursor: 'grab', fontSize: 14 }}>⠿</span>
                  </td>
                  <td style={{ color: '#86909C' }}>{idx + 1}</td>
                  <td style={{ fontWeight: 500 }}>{exam.subject}</td>
                  <td>{exam.exam_name}</td>
                  <td>{exam.exam_time ? exam.exam_time.substring(0, 16).replace('T', ' ') : '-'}</td>
                  <td>{exam.total_score || 100}</td>
                  <td style={{ color: '#86909C', fontSize: 12 }}>{exam.remark || '-'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-default btn-sm"
                      onClick={() => window.location.href = `/admin/score-entry?examId=${exam.id}&examName=${encodeURIComponent(exam.exam_name)}&classId=${group.class_id}`}>
                      成绩
                    </button>
                    <button className="btn btn-default btn-sm" onClick={() => openEditExam(exam)}>编辑</button>
                    <button className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteExam(exam.id, exam.exam_name)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ③ Data Overview */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-box">
          <div className="stat-num">{computedStats.enrolled}</div>
          <div className="stat-txt">已录入人数</div>
        </div>
        <div className="stat-box">
          <div className="stat-num">{computedStats.avgTotal}</div>
          <div className="stat-txt">平均总分</div>
        </div>
        <div className="stat-box">
          <div className="stat-num">{computedStats.passRate}%</div>
          <div className="stat-txt">及格率</div>
        </div>
        <div className="stat-box">
          <div className="stat-num">{computedStats.completionRate}%</div>
          <div className="stat-txt">成绩完整度</div>
        </div>
      </div>

      {/* ④ Action Buttons */}
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary"
            onClick={() => window.location.href = `/admin/score-stats?groupId=${groupId}`}>
            统计报表
          </button>
          <button className="btn btn-default"
            onClick={() => window.location.href = `/admin/score-exam-list`}>
            返回列表
          </button>
          <button className="btn btn-danger" style={{ marginLeft: 'auto' }}
            onClick={handleDeleteGroup}>
            删除此批次
          </button>
        </div>
      </div>

      {/* Add/Edit Exam Modal */}
      {showAddExam && (
        <div className="modal-overlay" onClick={() => { setShowAddExam(false); setEditExamId(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-title">{editExamId ? '编辑科目' : '新增科目'}</div>
            <div className="form-group">
              <label className="form-label">科目 <span style={{ color: '#F53F3F' }}>*</span></label>
              <input className="form-input" value={examForm.subject}
                onChange={e => setExamForm({ ...examForm, subject: e.target.value })}
                placeholder="如：语文、数学、英语" />
            </div>
            <div className="form-group">
              <label className="form-label">考试名称 <span style={{ color: '#F53F3F' }}>*</span></label>
              <input className="form-input" value={examForm.exam_name}
                onChange={e => setExamForm({ ...examForm, exam_name: e.target.value })}
                placeholder="如：期中语文" />
            </div>
            <div className="form-group">
              <label className="form-label">考试时间</label>
              <input className="form-input" type="datetime-local" value={examForm.exam_time}
                onChange={e => setExamForm({ ...examForm, exam_time: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">满分</label>
              <input className="form-input" type="number" value={examForm.total_score}
                onChange={e => setExamForm({ ...examForm, total_score: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label className="form-label">备注</label>
              <input className="form-input" value={examForm.remark}
                onChange={e => setExamForm({ ...examForm, remark: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => { setShowAddExam(false); setEditExamId(null); }}>取消</button>
              <button className="btn btn-primary" onClick={handleAddExam}>确定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
