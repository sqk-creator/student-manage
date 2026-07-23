import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function Subjects() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [sort, setSort] = useState(0);
  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState(0);
  const [editName, setEditName] = useState('');
  const [editSort, setEditSort] = useState(0);
  const [editStatus, setEditStatus] = useState(1);

  useEffect(() => { loadSubjects(); }, []);

  const loadSubjects = async () => {
    try { setSubjects(await api.getSubjects()); } catch {} finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!name.trim()) return alert('请输入科目名称');
    try { await api.createSubject({ subject_name: name.trim(), sort }); setName(''); setSort(0); setShowAdd(false); loadSubjects(); }
    catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该科目？')) return;
    try { await api.deleteSubject(id); loadSubjects(); } catch (e: any) { alert(e.message); }
  };

  const openEdit = (s: any) => {
    setEditId(s.id); setEditName(s.subject_name); setEditSort(s.sort); setEditStatus(s.status); setShowEdit(true);
  };

  const handleUpdate = async () => {
    if (!editName.trim()) return alert('请输入科目名称');
    try { await api.updateSubject(editId, { subject_name: editName.trim(), sort: editSort, status: editStatus }); setShowEdit(false); loadSubjects(); }
    catch (e: any) { alert(e.message); }
  };

  if (loading) return <div className="loading-state">加载中...</div>;

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={{fontSize:14,color:'#666'}}>共 {subjects.length} 个科目</div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ 创建科目</button>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">创建科目</div>
            <div className="form-group">
              <label className="form-label">科目名称</label>
              <input className="form-input" placeholder="请输入科目名称" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">排序</label>
              <input className="form-input" type="number" value={sort} onChange={e => setSort(Number(e.target.value))} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => { setShowAdd(false); setName(''); setSort(0); }}>取消</button>
              <button className="btn btn-primary" onClick={handleCreate}>确定</button>
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">编辑科目</div>
            <div className="form-group">
              <label className="form-label">科目名称</label>
              <input className="form-input" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">排序</label>
                <input className="form-input" type="number" value={editSort} onChange={e => setEditSort(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">状态</label>
                <select className="form-select" value={editStatus} onChange={e => setEditStatus(Number(e.target.value))}>
                  <option value={1}>启用</option>
                  <option value={0}>禁用</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => setShowEdit(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleUpdate}>保存</button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{padding:0}}>
        {subjects.length === 0 ? (
          <div className="empty-state">暂无科目，请创建</div>
        ) : (
          <table>
            <thead><tr><th>ID</th><th>科目名称</th><th>排序</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
            <tbody>
              {subjects.map(s => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td style={{fontWeight:500}}>{s.subject_name}</td>
                  <td>{s.sort}</td>
                  <td><span className={`tag ${s.status === 1 ? 'tag-green' : 'tag-red'}`}>{s.status === 1 ? '启用' : '禁用'}</span></td>
                  <td>{s.created_at?.split(' ')[0] || '-'}</td>
                  <td style={{display:'flex',gap:8}}>
                    <button className="btn btn-default btn-sm" onClick={() => openEdit(s)}>编辑</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
