import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../services/api';

interface ExamGroupRow {
  _type: 'group';
  id: number;
  name: string;
  class_name: string;
  grade_name: string;
  class_id: number;
  subject_info: string;
  subject_count: number;
  exam_time: string;
  total_score: number;
  created_at: string;
  semester: string;
  scope_type: string;
  grade_id: number | null;
  exam_type: string;
}

interface ExamRow {
  _type: 'exam';
  id: number;
  name: string;
  class_name: string;
  class_id: number;
  group_id: number | null;
  group_name: string;
  subject_info: string;
  exam_time: string;
  total_score: number;
  created_at: string;
}

type ExamItem = ExamGroupRow | ExamRow;

interface FormData {
  class_id: number;
  group_id: number | null;
  group_name: string;
  semester: string;
  exam_date: string;
  subject: string;
  subject_id: number | null;
  exam_name: string;
  exam_time: string;
  total_score: number;
  remark: string;
  scope_type: string;
  grade_id: number | null;
  exam_type: string;
}

const PAGE_SIZE = 10;

export default function ScoreExamList() {
  const [items, setItems] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  const [filterClass, setFilterClass] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [showExamForm, setShowExamForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editType, setEditType] = useState<'group' | 'exam'>('exam');

  const [form, setForm] = useState<FormData>({
    class_id: 0, group_id: null, group_name: '', semester: '',
    exam_date: '', subject: '', subject_id: null, exam_name: '', exam_time: '',
    total_score: 100, remark: '', scope_type: 'class', grade_id: null, exam_type: 'comprehensive'
  });

  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const [confirmDelete, setConfirmDelete] = useState<{ id: number; type: 'group' | 'exam'; name: string } | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [classesRes, groupsRes, examsRes, gradesRes, subjectsRes] = await Promise.all([
        api.getClasses(),
        api.getExamGroups(),
        api.getExamsByQuery(),
        api.getGrades(),
        api.getSubjects()
      ]);
      setClasses(classesRes);
      setGroups(groupsRes);
      setGrades(gradesRes);
      setSubjects(subjectsRes);

      const classMap: Record<number, string> = {};
      classesRes.forEach((c: any) => { classMap[c.id] = c.name; });

      const groupMap: Record<number, any> = {};
      groupsRes.forEach((g: any) => { groupMap[g.id] = g; });

      const merged: ExamItem[] = [];

      groupsRes.forEach((g: any) => {
        const subExams = (Array.isArray(examsRes) ? examsRes : []).filter((e: any) => e.group_id === g.id);
        merged.push({
          _type: 'group',
          id: g.id,
          name: g.group_name,
          class_name: g.scope_type === 'grade' ? ((g.grade_name || '') + '年级') : (g.class_name || classMap[g.class_id] || ''),
          grade_name: g.grade_name || '',
          class_id: g.class_id,
          subject_info: subExams.map((e: any) => e.subject).join('、'),
          subject_count: subExams.length,
          exam_time: g.exam_date,
          total_score: g.total_score,
          created_at: g.created_at,
          semester: g.semester
        });
      });

      (Array.isArray(examsRes) ? examsRes : []).forEach((e: any) => {
        if (!e.group_id) {
          merged.push({
            _type: 'exam',
            id: e.id,
            name: e.exam_name || e.name,
            class_name: classMap[e.class_id] || '',
            class_id: e.class_id,
            group_id: null,
            group_name: '',
            subject_info: e.subject,
            exam_time: e.exam_time || e.exam_date,
            total_score: e.total_score || 100,
            created_at: e.created_at
          });
        }
      });

      setItems(merged);
    } catch {} finally { setLoading(false); }
  };

  const semesters = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if ('semester' in i && i.semester) set.add(i.semester); });
    return Array.from(set).sort().reverse();
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (filterClass) {
      result = result.filter(i => String(i.class_id) === filterClass);
    }
    if (filterType) {
      result = result.filter(i => i._type === filterType);
    }
    if (filterSemester) {
      result = result.filter(i => '_type' in i && i._type === 'group' && (i as ExamGroupRow).semester === filterSemester);
    }
    if (filterKeyword) {
      const kw = filterKeyword.toLowerCase();
      result = result.filter(i =>
        i.name.toLowerCase().includes(kw) ||
        i.subject_info.toLowerCase().includes(kw) ||
        i.class_name.toLowerCase().includes(kw)
      );
    }
    if (filterDateFrom) {
      result = result.filter(i => i.exam_time >= filterDateFrom);
    }
    if (filterDateTo) {
      result = result.filter(i => i.exam_time <= filterDateTo);
    }
    if (sortKey) {
      result = [...result].sort((a: any, b: any) => {
        const va = a[sortKey] ?? '';
        const vb = b[sortKey] ?? '';
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }
    return result;
  }, [items, filterClass, filterType, filterSemester, filterKeyword, filterDateFrom, filterDateTo, sortKey, sortDir]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const toggleSelectAll = () => {
    if (selected.size === pagedItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pagedItems.map(i => String(i._type === 'group' ? 'g-' : 'e-') + i.id)));
    }
  };

  const toggleItem = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const resetForm = () => {
    setForm({ class_id: 0, group_id: null, group_name: '', semester: '', exam_date: '', subject: '', subject_id: null, exam_name: '', exam_time: '', total_score: 100, remark: '', scope_type: 'class', grade_id: null, exam_type: 'comprehensive' });
    setEditId(null);
  };

  const openCreateBatch = () => {
    resetForm();
    setShowCreateMenu(false);
    setShowBatchForm(true);
  };

  const openCreateExam = () => {
    resetForm();
    setShowCreateMenu(false);
    setShowExamForm(true);
  };

  const openEdit = (item: ExamItem) => {
    if (item._type === 'group') {
      const g = item as ExamGroupRow;
      setEditId(g.id); setEditType('group');
      setForm({
        class_id: g.class_id, group_id: null, group_name: g.name, semester: g.semester,
        exam_date: g.exam_time, subject: '', exam_name: '', exam_time: '',
        total_score: g.total_score, remark: '', scope_type: g.scope_type || 'class', grade_id: g.grade_id || null, exam_type: g.exam_type || 'comprehensive'
      });
      setShowBatchForm(true);
    } else {
      const e = item as ExamRow;
      setEditId(e.id); setEditType('exam');
      setForm({
        class_id: e.class_id, group_id: e.group_id, group_name: '', semester: '',
        exam_date: '', subject: e.subject_info, subject_id: e.subject_id || null, exam_name: e.name, exam_time: e.exam_time,
        total_score: e.total_score, remark: '', scope_type: 'class', grade_id: null
      });
      setShowExamForm(true);
    }
  };

  const handleSaveBatch = async () => {
    const data: any = {
      class_id: form.scope_type === 'class' ? (form.class_id || classes[0]?.id) : 0,
      scope_type: form.scope_type,
      grade_id: form.scope_type === 'grade' ? form.grade_id : null,
      group_name: form.group_name,
      semester: form.semester,
      exam_date: form.exam_date,
      total_score: form.total_score,
      remark: form.remark,
      exam_type: form.scope_type === 'grade' ? form.exam_type : 'comprehensive'
    };
    try {
      if (editId && editType === 'group') {
        await api.updateExamGroup(editId, data);
      } else {
        await api.createExamGroup(data);
      }
      setShowBatchForm(false);
      resetForm();
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleSaveExam = async () => {
    const data: any = {
      class_id: form.class_id || classes[0]?.id,
      group_id: form.group_id || null,
      subject: form.subject,
      subject_id: form.subject_id,
      exam_name: form.exam_name,
      exam_time: form.exam_time,
      total_score: form.total_score,
      remark: form.remark
    };
    try {
      if (editId && editType === 'exam') {
        await api.updateExam(editId, data);
      } else {
        await api.createExamByQuery(data);
      }
      setShowExamForm(false);
      resetForm();
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.type === 'group') {
        await api.deleteExamGroup(confirmDelete.id);
      } else {
        await api.deleteExam(confirmDelete.id);
      }
      setConfirmDelete(null);
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleBatchDelete = async () => {
    if (!window.confirm(`确定删除选中的 ${selected.size} 项吗？`)) return;
    const items = [...selected];
    for (const key of items) {
      const [type, idStr] = key.split('-');
      try {
        if (type === 'g') await api.deleteExamGroup(Number(idStr));
        else await api.deleteExam(Number(idStr));
      } catch {}
    }
    setSelected(new Set());
    loadData();
  };

  if (loading) return <div className="loading-state">加载中...</div>;

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: '#666' }}>共 {filteredItems.length} 条记录</div>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-primary" onClick={() => setShowCreateMenu(!showCreateMenu)}>
            + 创建
          </button>
          {showCreateMenu && (
            <div style={{
              position: 'absolute', right: 0, top: 40, zIndex: 100,
              background: '#fff', borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 160, padding: '4px 0'
            }}>
              <div style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 14 }}
                onClick={openCreateBatch}>创建考试批次</div>
              <div style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 14 }}
                onClick={openCreateExam}>创建单科考试</div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-select" style={{ width: 120 }} value={filterClass}
            onChange={e => { setFilterClass(e.target.value); setPage(1); }}>
            <option value="">全部班级</option>
            {classes.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select className="form-select" style={{ width: 140 }} value={filterSemester}
            onChange={e => { setFilterSemester(e.target.value); setPage(1); }}>
            <option value="">全部学期</option>
            {semesters.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="form-select" style={{ width: 100 }} value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(1); }}>
            <option value="">全部类型</option>
            <option value="group">批次</option>
            <option value="exam">单科</option>
          </select>
          <input className="form-input" style={{ width: 130 }} type="date" value={filterDateFrom}
            onChange={e => { setFilterDateFrom(e.target.value); setPage(1); }} placeholder="开始日期" />
          <span style={{ color: '#86909C' }}>—</span>
          <input className="form-input" style={{ width: 130 }} type="date" value={filterDateTo}
            onChange={e => { setFilterDateTo(e.target.value); setPage(1); }} placeholder="结束日期" />
          <input className="form-input" style={{ width: 180 }} placeholder="搜索考试名称/科目"
            value={filterKeyword} onChange={e => { setFilterKeyword(e.target.value); setPage(1); }} />
        </div>
      </div>

      {/* Batch actions */}
      {selected.size > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: '10px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: '#666' }}>已选 {selected.size} 项</span>
          <button className="btn btn-danger btn-sm" onClick={handleBatchDelete}>批量删除</button>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {filteredItems.length === 0 ? (
          <div className="empty-state">暂无考试记录，请创建</div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input type="checkbox" checked={selected.size === pagedItems.length && pagedItems.length > 0}
                      onChange={toggleSelectAll} />
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>
                    考试名称 {sortKey === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th>类型</th>
                  <th>所属班级</th>
                  <th>科目</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('exam_time')}>
                    考试时间 {sortKey === 'exam_time' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th>满分</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('created_at')}>
                    创建时间 {sortKey === 'created_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={{ width: 240 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map(item => {
                  const key = (item._type === 'group' ? 'g-' : 'e-') + item.id;
                  return (
                    <tr key={key}>
                      <td><input type="checkbox" checked={selected.has(key)} onChange={() => toggleItem(key)} /></td>
                      <td style={{ fontWeight: 500 }}>{item.name}</td>
                      <td>
                        <span className={`tag ${item._type === 'group' ? 'tag-blue' : 'tag-green'}`}>
                          {item._type === 'group' ? '批次' : '单科'}
                        </span>
                      </td>
                      <td>{item.class_name}</td>
                      <td>
                        {item._type === 'group'
                          ? <span className="tag tag-blue">{item.subject_count}科</span>
                          : item.subject_info}
                      </td>
                      <td>{item.exam_time || '-'}</td>
                      <td>{item.total_score || 0}</td>
                      <td>{item.created_at ? item.created_at.substring(0, 10) : '-'}</td>
                      <td style={{ display: 'flex', gap: 8 }}>
                        {item._type === 'group' ? (
                          <>
                            <button className="btn btn-default btn-sm"
                              onClick={() => window.location.href = `/admin/score-group-detail?groupId=${item.id}`}>
                              查看详情
                            </button>
                            <button className="btn btn-default btn-sm" onClick={() => openEdit(item)}>编辑</button>
                            <button className="btn btn-danger btn-sm"
                              onClick={() => setConfirmDelete({ id: item.id, type: 'group', name: item.name })}>删除</button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-default btn-sm"
                              onClick={() => window.location.href = `/admin/score-exam-detail?examId=${item.id}`}>
                              查看详情
                            </button>
                            <button className="btn btn-default btn-sm"
                              onClick={() => window.location.href = `/admin/score-entry?examId=${item.id}&examName=${encodeURIComponent(item.name)}&classId=${item.class_id}`}>
                              成绩管理
                            </button>
                            <button className="btn btn-default btn-sm" onClick={() => openEdit(item)}>编辑</button>
                            <button className="btn btn-danger btn-sm"
                              onClick={() => setConfirmDelete({ id: item.id, type: 'exam', name: item.name })}>删除</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid #F2F3F5' }}>
              <span style={{ fontSize: 13, color: '#86909C' }}>
                第 {page}/{totalPages} 页，共 {filteredItems.length} 条
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-default btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
                <button className="btn btn-default btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Batch Form Modal */}
      {showBatchForm && (
        <div className="modal-overlay" onClick={() => { setShowBatchForm(false); resetForm(); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-title">{editId ? '编辑考试批次' : '创建考试批次'}</div>
            <div className="form-group">
              <label className="form-label">范围类型</label>
              <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #e5e6eb' }}>
                <button type="button"
                  style={{ flex: 1, padding: '6px 12px', fontSize: 13, border: 'none', cursor: 'pointer',
                    background: form.scope_type === 'class' ? '#14A89A' : '#fff', color: form.scope_type === 'class' ? '#fff' : '#333' }}
                  onClick={() => setForm({ ...form, scope_type: 'class' })}>按班级</button>
                <button type="button"
                  style={{ flex: 1, padding: '6px 12px', fontSize: 13, border: 'none', cursor: 'pointer',
                    background: form.scope_type === 'grade' ? '#14A89A' : '#fff', color: form.scope_type === 'grade' ? '#fff' : '#333' }}
                  onClick={() => setForm({ ...form, scope_type: 'grade' })}>按年级</button>
              </div>
            </div>
            {form.scope_type === 'class' ? (
              <div className="form-group">
                <label className="form-label">班级 <span style={{ color: '#F53F3F' }}>*</span></label>
                <select className="form-select" value={form.class_id || ''} onChange={e => setForm({ ...form, class_id: Number(e.target.value) })}>
                  <option value="">请选择班级</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            ) : (
              <>
              <div className="form-group">
                <label className="form-label">年级 <span style={{ color: '#F53F3F' }}>*</span></label>
                <select className="form-select" value={form.grade_id ?? ''} onChange={e => setForm({ ...form, grade_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">请选择年级</option>
                  {grades.map((g: any) => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">考试类型 <span style={{ color: '#F53F3F' }}>*</span></label>
                <select className="form-select" value={form.exam_type} onChange={e => setForm({ ...form, exam_type: e.target.value })}>
                  <option value="comprehensive">综合</option>
                  <option value="liberal_arts">文科</option>
                  <option value="science">理科</option>
                </select>
              </div>
              </>
            )}
            <div className="form-group">
              <label className="form-label">批次名称 <span style={{ color: '#F53F3F' }}>*</span></label>
              <input className="form-input" value={form.group_name} onChange={e => setForm({ ...form, group_name: e.target.value })} placeholder="如：期中考试、期末考试" />
            </div>
            <div className="form-group">
              <label className="form-label">学期</label>
              <input className="form-input" value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })} placeholder="如：2025-2026春" />
            </div>
            <div className="form-group">
              <label className="form-label">考试日期</label>
              <input className="form-input" type="date" value={form.exam_date} onChange={e => setForm({ ...form, exam_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">总分</label>
              <input className="form-input" type="number" value={form.total_score} onChange={e => setForm({ ...form, total_score: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label className="form-label">备注</label>
              <input className="form-input" value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => { setShowBatchForm(false); resetForm(); }}>取消</button>
              <button className="btn btn-primary" onClick={handleSaveBatch}>确定</button>
            </div>
          </div>
        </div>
      )}

      {/* Exam Form Modal */}
      {showExamForm && (
        <div className="modal-overlay" onClick={() => { setShowExamForm(false); resetForm(); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-title">{editId ? '编辑单科考试' : '创建单科考试'}</div>
            <div className="form-group">
              <label className="form-label">班级 <span style={{ color: '#F53F3F' }}>*</span></label>
              <select className="form-select" value={form.class_id || ''} onChange={e => setForm({ ...form, class_id: Number(e.target.value) })}>
                <option value="">请选择班级</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">所属批次</label>
              <select className="form-select" value={form.group_id ?? ''} onChange={e => setForm({ ...form, group_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">无（独立小测）</option>
                {groups.map((g: any) => <option key={g.id} value={g.id}>{g.group_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">科目 <span style={{ color: '#F53F3F' }}>*</span></label>
              <select className="form-select" value={form.subject_id ?? ''} onChange={e => {
                const id = e.target.value ? Number(e.target.value) : null;
                const sub = subjects.find((s: any) => s.id === id);
                setForm({ ...form, subject_id: id, subject: sub ? sub.subject_name : '' });
              }}>
                <option value="">请选择科目</option>
                {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">考试名称 <span style={{ color: '#F53F3F' }}>*</span></label>
              <input className="form-input" value={form.exam_name} onChange={e => setForm({ ...form, exam_name: e.target.value })} placeholder="如：期中语文、期末数学" />
            </div>
            <div className="form-group">
              <label className="form-label">考试时间</label>
              <input className="form-input" type="datetime-local" value={form.exam_time} onChange={e => setForm({ ...form, exam_time: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">满分</label>
              <input className="form-input" type="number" value={form.total_score} onChange={e => setForm({ ...form, total_score: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label className="form-label">备注</label>
              <input className="form-input" value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => { setShowExamForm(false); resetForm(); }}>取消</button>
              <button className="btn btn-primary" onClick={handleSaveExam}>确定</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-title">确认删除</div>
            <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>
              确定要删除「{confirmDelete.name}」吗？{confirmDelete.type === 'group' ? '删除批次将同时删除关联的所有单科考试。' : ''}此操作不可撤销。
            </p>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => setConfirmDelete(null)}>取消</button>
              <button className="btn btn-danger" onClick={handleDelete}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
