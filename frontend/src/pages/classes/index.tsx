import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function Classes() {
  const [classes, setClasses] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [type, setType] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState(0);
  const [editName, setEditName] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editType, setEditType] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadClasses(); }, []);

  const loadClasses = async () => {
    try { setClasses(await api.getClasses()); } catch {} finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!name.trim()) return alert('请输入班级名称');
    try { await api.createClass(name.trim(), grade || undefined, type || undefined); setName(''); setGrade(''); setType(''); setShowAdd(false); loadClasses(); }
    catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该班级？')) return;
    try { await api.deleteClass(id); loadClasses(); } catch (e: any) { alert(e.message); }
  };

  const openEdit = (c: any) => {
    setEditId(c.id); setEditName(c.name); setEditGrade(c.grade || ''); setEditType(c.type || ''); setShowEdit(true);
  };

  const handleUpdate = async () => {
    if (!editName.trim()) return alert('请输入班级名称');
    try { await api.updateClass(editId, { name: editName.trim(), grade: editGrade, type: editType }); setShowEdit(false); loadClasses(); }
    catch (e: any) { alert(e.message); }
  };

  const navigate = (classId: number, className: string) => {
    window.location.href = `/admin/class-detail?classId=${classId}&className=${encodeURIComponent(className)}`;
  };

  if (loading) return <div className="loading-state">加载中...</div>;

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={{fontSize:14,color:'#666'}}>共 {classes.length} 个班级</div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ 创建班级</button>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">创建班级</div>
            <div className="form-group">
              <label className="form-label">班级名称</label>
              <input className="form-input" placeholder="请输入班级名称" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">年级</label>
                <select className="form-select" value={grade} onChange={e => setGrade(e.target.value)}>
                  <option value="">请选择</option>
                  <option value="高一">高一</option>
                  <option value="高二">高二</option>
                  <option value="高三">高三</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">类型</label>
                <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                  <option value="">请选择</option>
                  <option value="文科班">文科班</option>
                  <option value="理科班">理科班</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => { setShowAdd(false); setName(''); setGrade(''); setType(''); }}>取消</button>
              <button className="btn btn-primary" onClick={handleCreate}>确定</button>
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">编辑班级</div>
            <div className="form-group">
              <label className="form-label">班级名称</label>
              <input className="form-input" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">年级</label>
                <select className="form-select" value={editGrade} onChange={e => setEditGrade(e.target.value)}>
                  <option value="">请选择</option>
                  <option value="高一">高一</option>
                  <option value="高二">高二</option>
                  <option value="高三">高三</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">类型</label>
                <select className="form-select" value={editType} onChange={e => setEditType(e.target.value)}>
                  <option value="">请选择</option>
                  <option value="文科班">文科班</option>
                  <option value="理科班">理科班</option>
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
        {classes.length === 0 ? (
          <div className="empty-state">暂无班级，请创建</div>
        ) : (
          <table>
            <thead><tr><th>ID</th><th>班级名称</th><th>年级</th><th>类型</th><th>学生数</th><th>创建时间</th><th>操作</th></tr></thead>
            <tbody>
              {classes.map(c => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td style={{fontWeight:500}}>{c.name}</td>
                  <td>{c.grade || '-'}</td>
                  <td>{c.type || '-'}</td>
                  <td><span className="tag tag-blue">{c.student_count || 0}</span></td>
                  <td>{c.created_at?.split(' ')[0] || '-'}</td>
                   <td style={{display:'flex',gap:8}}>
                     <button className="btn btn-default btn-sm" onClick={() => navigate(c.id, c.name)}>详情</button>
                     <button className="btn btn-default btn-sm" onClick={() => openEdit(c)}>编辑</button>
                     <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>删除</button>
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
