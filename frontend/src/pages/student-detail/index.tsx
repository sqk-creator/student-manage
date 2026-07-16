import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function StudentDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get('id'));
  const [student, setStudent] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name:'',student_no:'',gender:'',phone:'' });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStudent(); }, []);

  const loadStudent = async () => {
    try {
      const data = await api.getStudent(id);
      setStudent(data);
      setForm({name:data.name,student_no:data.student_no,gender:data.gender,phone:data.phone});
    } catch {} finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()||!form.student_no.trim()) return alert('姓名和学号为必填');
    try { await api.updateStudent(id, form); setEditing(false); loadStudent(); }
    catch (e: any) { alert(e.message); }
  };

  if (loading) return <div className="loading-state">加载中...</div>;
  if (!student) return <div className="loading-state">学生不存在</div>;

  return (
    <div>
      <div className="card">
        <div className="card-title">学生信息 {!editing && <button className="btn btn-default btn-sm" style={{marginLeft:12}} onClick={()=>setEditing(true)}>编辑</button>}</div>
        {editing ? (
          <div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">姓名</label><input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
              <div className="form-group"><label className="form-label">学号</label><input className="form-input" value={form.student_no} onChange={e=>setForm({...form,student_no:e.target.value})}/></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">性别</label><select className="form-select" value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}><option value="">请选择</option><option value="男">男</option><option value="女">女</option></select></div>
              <div className="form-group"><label className="form-label">联系电话</label><input className="form-input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-default" onClick={()=>setEditing(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSave}>保存</button>
            </div>
          </div>
        ) : (
          <table>
            <tbody>
              <tr><td style={{color:'#999',width:80}}>姓名</td><td style={{fontWeight:500}}>{student.name}</td></tr>
              <tr><td style={{color:'#999'}}>学号</td><td>{student.student_no}</td></tr>
              <tr><td style={{color:'#999'}}>性别</td><td>{student.gender||'-'}</td></tr>
              <tr><td style={{color:'#999'}}>班级</td><td>{student.class_name||'-'}</td></tr>
              <tr><td style={{color:'#999'}}>电话</td><td>{student.phone||'-'}</td></tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-title">成绩记录</div>
        {!student.scores?.length ? <div className="empty-state">暂无成绩记录</div> : (
          <table>
            <thead><tr><th>考试名称</th><th>科目</th><th>日期</th><th>分数</th></tr></thead>
            <tbody>
              {student.scores.map((s:any,i:number) => (
                <tr key={i}>
                  <td>{s.exam_name}</td>
                  <td>{s.subject}</td>
                  <td>{s.exam_date}</td>
                  <td><span className={`tag ${s.score>=60?'tag-green':'tag-red'}`}>{s.score}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
