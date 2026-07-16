import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

const ROLE_OPTIONS = ['班长','副班长','学习委员','纪律委员','劳动委员','体育委员','文艺委员','生活委员','课代表','组长'];

export default function StudentMgmt() {
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [showEdit, setShowEdit] = useState(false);
  const [editStudent, setEditStudent] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name:'', student_no:'', gender:'', phone:'', birth_date:'', hometown:'', photo:'', class_role:'', class_id:0 });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [s, c] = await Promise.all([
        api.searchStudents(keyword, classFilter),
        api.getClasses()
      ]);
      setStudents(s); setClasses(c);
    } catch {} finally { setLoading(false); }
  };

  const handleSearch = () => { setLoading(true); loadData(); };

  const openEdit = (s: any) => {
    setEditStudent(s);
    setEditForm({ name:s.name, student_no:s.student_no, gender:s.gender||'', phone:s.phone||'',
      birth_date:s.birth_date||'', hometown:s.hometown||'', photo:s.photo||'',
      class_role:s.class_role||'', class_id:s.class_id });
    setShowEdit(true);
  };

  const handleSave = async () => {
    if (!editForm.name.trim() || !editForm.student_no.trim()) return alert('姓名和学号为必填');
    try { await api.updateStudent(editStudent.id, editForm); setShowEdit(false); loadData(); }
    catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该学生？')) return;
    try { await api.deleteStudent(id); loadData(); } catch (e: any) { alert(e.message); }
  };

  const getClassName = (classId: number) => {
    const c = classes.find((x: any) => x.id === classId);
    return c ? c.name : '-';
  };

  if (loading) return <div className="loading-state">加载中...</div>;

  return (
    <div>
      <div className="card" style={{marginBottom:16,padding:16}}>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <input className="form-input" style={{flex:1,maxWidth:240}} placeholder="搜索姓名或学号" value={keyword}
            onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key==='Enter' && handleSearch()} />
          <select className="form-select" style={{width:140}} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
            <option value="all">全部班级</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={handleSearch}>搜索</button>
        </div>
      </div>

      <div className="card" style={{padding:0}}>
        {students.length === 0 ? <div className="empty-state">暂无学生</div> : (
          <table>
            <thead><tr><th>照片</th><th>学号</th><th>姓名</th><th>性别</th><th>班级</th><th>职务</th><th>电话</th><th>操作</th></tr></thead>
            <tbody>{students.map(s => (
              <tr key={s.id}>
                <td>
                  {s.photo
                    ? <img src={s.photo} style={{width:32,height:32,borderRadius:'50%',objectFit:'cover'}} alt="" />
                    : <div style={{width:32,height:32,borderRadius:'50%',background:'#f0f0f0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'#999'}}>{s.name?.charAt(0)}</div>
                  }
                </td>
                <td>{s.student_no}</td>
                <td style={{fontWeight:500,cursor:'pointer',color:'#1890ff'}}
                  onClick={() => { window.location.href = '/admin/student-detail?id=' + s.id; }}>{s.name}</td>
                <td>{s.gender || '-'}</td>
                <td><span className="tag tag-blue">{s.class_name || getClassName(s.class_id)}</span></td>
                <td>{s.class_role ? <span className="tag tag-green">{s.class_role}</span> : '-'}</td>
                <td>{s.phone || '-'}</td>
                <td style={{display:'flex',gap:8}}>
                  <button className="btn btn-default btn-sm" onClick={() => openEdit(s)}>编辑/调班</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>删除</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxHeight:'80vh',overflowY:'auto',width:520}}>
            <div className="modal-title">编辑学生 / 调动班级</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">姓名 *</label><input className="form-input" value={editForm.name} onChange={e => setEditForm({...editForm,name:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">学号 *</label><input className="form-input" value={editForm.student_no} onChange={e => setEditForm({...editForm,student_no:e.target.value})} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">性别</label><select className="form-select" value={editForm.gender} onChange={e => setEditForm({...editForm,gender:e.target.value})}><option value="">请选择</option><option value="男">男</option><option value="女">女</option></select></div>
              <div className="form-group"><label className="form-label">出生年月</label><input className="form-input" type="date" value={editForm.birth_date} onChange={e=>setEditForm({...editForm,birth_date:e.target.value})} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">籍贯</label><input className="form-input" value={editForm.hometown} onChange={e=>setEditForm({...editForm,hometown:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">班级职务</label><select className="form-select" value={editForm.class_role} onChange={e=>setEditForm({...editForm,class_role:e.target.value})}>
                <option value="">请选择</option>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">联系电话</label><input className="form-input" value={editForm.phone} onChange={e => setEditForm({...editForm,phone:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">照片</label>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <input type="file" accept="image/*" style={{display:'none'}} id="mgmtEditPhotoInput" onChange={async e=>{
                    const f=e.target.files?.[0];if(!f)return;
                    try{const r=await api.uploadStudentPhoto(f);setEditForm({...editForm,photo:r.url});}catch(e:any){alert(e.message);}
                  }}/>
                  <button type="button" className="btn btn-default btn-sm" onClick={()=>document.getElementById('mgmtEditPhotoInput')?.click()}>选择照片</button>
                  {editForm.photo && <img src={editForm.photo} style={{width:40,height:40,borderRadius:8,objectFit:'cover'}} alt="" />}
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">所属班级 (修改可调班)</label>
              <select className="form-select" value={editForm.class_id} onChange={e => setEditForm({...editForm,class_id:Number(e.target.value)})}>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => setShowEdit(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSave}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
