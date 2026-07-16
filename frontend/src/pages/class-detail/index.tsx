import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function ClassDetail() {
  const params = new URLSearchParams(window.location.search);
  const classId = Number(params.get('classId'));
  const className = decodeURIComponent(params.get('className') || '');

  const [students, setStudents] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [classInfo, setClassInfo] = useState<any>(null);
  const [tab, setTab] = useState<'students'|'teachers'|'exams'|'events'>('students');
  const [showAdd, setShowAdd] = useState(false);
  const [showExam, setShowExam] = useState(false);
  const [showTeacher, setShowTeacher] = useState(false);
  const [showEvent, setShowEvent] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editStudent, setEditStudent] = useState<any>(null);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [form, setForm] = useState({ name:'', student_no:'', gender:'', phone:'', birth_date:'', hometown:'', photo:'', class_role:'' });
  const [editForm, setEditForm] = useState({ name:'', student_no:'', gender:'', phone:'', birth_date:'', hometown:'', photo:'', class_role:'', class_id:0 });
  const [examForm, setExamForm] = useState({ name:'', subject:'' });
  const [teacherForm, setTeacherForm] = useState({ name:'', role:'班主任' });
  const [eventForm, setEventForm] = useState({ type:'荣誉', name:'', date:'', photo:'' });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (tab === 'events' && classId) loadEvents(); }, [tab]);

  const loadData = async () => {
    try {
      const [s, e, c, ac] = await Promise.all([
        api.getStudents(classId),
        api.getExams(classId),
        api.getClass(classId).catch(() => null),
        api.getClasses()
      ]);
      setStudents(s);
      setExams(e);
      setAllClasses(ac);
      if (c) {
        setClassInfo(c);
        setTeachers(c.teachers || []);
      }
    } catch {} finally { setLoading(false); }
  };

  const handleAddStudent = async () => {
    if (!form.name.trim() || !form.student_no.trim()) return alert('姓名和学号为必填');
    try { await api.createStudent(classId, form); setShowAdd(false); setForm({name:'',student_no:'',gender:'',phone:'',birth_date:'',hometown:'',photo:'',class_role:''}); loadData(); }
    catch (e: any) { alert(e.message); }
  };

  const handleEditStudent = async () => {
    if (!editForm.name.trim() || !editForm.student_no.trim()) return alert('姓名和学号为必填');
    try { await api.updateStudent(editStudent.id, editForm); setShowEdit(false); loadData(); }
    catch (e: any) { alert(e.message); }
  };

  const openEdit = (s: any) => {
    setEditStudent(s);
    setEditForm({ name: s.name, student_no: s.student_no, gender: s.gender || '', phone: s.phone || '', birth_date: s.birth_date || '', hometown: s.hometown || '', photo: s.photo || '', class_role: s.class_role || '', class_id: s.class_id });
    setShowEdit(true);
  };

  const handleDeleteStudent = async (id: number) => {
    if (!confirm('确定删除？')) return;
    try { await api.deleteStudent(id); loadData(); } catch (e: any) { alert(e.message); }
  };

  const handleAddTeacher = async () => {
    if (!teacherForm.name.trim()) return alert('请输入教师姓名');
    try { await api.addClassTeacher(classId, teacherForm); setShowTeacher(false); setTeacherForm({name:'',role:'班主任'}); loadData(); }
    catch (e: any) { alert(e.message); }
  };

  const handleDeleteTeacher = async (teacherId: number) => {
    if (!confirm('确定移除该教师？')) return;
    try { await api.removeClassTeacher(classId, teacherId); loadData(); } catch (e: any) { alert(e.message); }
  };

  const handleAddExam = async () => {
    if (!examForm.name.trim()) return alert('请输入考试名称');
    try { await api.createExam(classId, examForm); setShowExam(false); setExamForm({name:'',subject:''}); loadData(); }
    catch (e: any) { alert(e.message); }
  };

  const loadEvents = async () => {
    try { const evts = await api.getClassEvents(classId); setEvents(evts); } catch {}
  };

  const handleAddEvent = async () => {
    if (!eventForm.name.trim()) return alert('请输入事件名称');
    try { await api.createClassEvent(classId, eventForm); setShowEvent(false); setEventForm({type:'荣誉',name:'',date:'',photo:''}); loadEvents(); }
    catch (e: any) { alert(e.message); }
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm('确定删除？')) return;
    try { await api.deleteClassEvent(classId, eventId); loadEvents(); } catch (e: any) { alert(e.message); }
  };

  if (loading) return <div className="loading-state">加载中...</div>;

  return (
    <div>
      <div style={{marginBottom:16}}>
        <span style={{fontSize:20,fontWeight:700,color:'#262626'}}>{className}</span>
        {classInfo && <>
          <span className="tag tag-blue" style={{marginLeft:12}}>ID: {classId}</span>
          {classInfo.grade && <span className="tag tag-green" style={{marginLeft:8}}>{classInfo.grade}</span>}
          {classInfo.type && <span className="tag" style={{marginLeft:8,background:'#fff7e6',color:'#fa8c16'}}>{classInfo.type}</span>}
        </>}
      </div>

      <div style={{display:'flex',gap:0,marginBottom:20,borderBottom:'2px solid #f0f0f0'}}>
        {[
          {key:'students',label:`学生列表 (${students.length})`},
          {key:'teachers',label:`班级教师 (${teachers.length})`},
          {key:'exams',label:`考试记录 (${exams.length})`},
          {key:'events',label:`班级奖惩 (${events.length})`},
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{padding:'10px 20px',border:'none',background:'transparent',fontSize:14,cursor:'pointer',
              color:tab===t.key?'#1890ff':'#999',borderBottom:tab===t.key?'2px solid #1890ff':'2px solid transparent',marginBottom:-2}}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'students' && (
        <div>
          <div style={{marginBottom:16}}>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ 添加学生</button>
          </div>
          <div className="card" style={{padding:0}}>
            {students.length === 0 ? <div className="empty-state">暂无学生</div> : (
              <table>
                <thead><tr><th>照片</th><th>学号</th><th>姓名</th><th>性别</th><th>职务</th><th>电话</th><th>操作</th></tr></thead>
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
                      onClick={() => { window.location.href = '/admin/student-detail?id=' + s.id; }}>
                      {s.name}
                    </td>
                    <td>{s.gender || '-'}</td>
                    <td>{s.class_role ? <span className="tag tag-green">{s.class_role}</span> : '-'}</td>
                    <td>{s.phone || '-'}</td>
                    <td style={{display:'flex',gap:8}}>
                      <button className="btn btn-default btn-sm" onClick={() => openEdit(s)}>编辑/调班</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteStudent(s.id)}>删除</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'teachers' && (
        <div>
          <div style={{marginBottom:16}}>
            <button className="btn btn-primary" onClick={() => setShowTeacher(true)}>+ 添加教师</button>
          </div>
          <div className="card" style={{padding:0}}>
            {teachers.length === 0 ? <div className="empty-state">暂未关联教师</div> : (
              <table>
                <thead><tr><th>姓名</th><th>职务</th><th>操作</th></tr></thead>
                <tbody>{teachers.map((t: any) => (
                  <tr key={t.id}>
                    <td style={{fontWeight:500}}>{t.name}</td>
                    <td><span className="tag tag-green">{t.role}</span></td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => handleDeleteTeacher(t.id)}>移除</button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'exams' && (
        <div>
          <div style={{marginBottom:16}}>
            <button className="btn btn-primary" onClick={() => setShowExam(true)}>+ 创建考试</button>
          </div>
          <div className="card" style={{padding:0}}>
            {exams.length === 0 ? <div className="empty-state">暂无考试</div> : (
              <table>
                <thead><tr><th>考试名称</th><th>科目</th><th>日期</th><th>操作</th></tr></thead>
                <tbody>{exams.map((e: any) => (
                  <tr key={e.id}>
                    <td style={{fontWeight:500}}>{e.name}</td>
                    <td>{e.subject || '-'}</td>
                    <td>{e.exam_date}</td>
                    <td style={{display:'flex',gap:8}}>
                      <button className="btn btn-default btn-sm"
                        onClick={() => { window.location.href = `/admin/score-entry?examId=${e.id}&examName=${encodeURIComponent(e.name)}&classId=${classId}&className=${encodeURIComponent(className)}`; }}>
                        录入成绩
                      </button>
                      <button className="btn btn-default btn-sm"
                        onClick={() => { window.location.href = `/admin/score-stats?examId=${e.id}&examName=${encodeURIComponent(e.name)}`; }}>
                        统计
                      </button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'events' && (
        <div>
          <div style={{marginBottom:16}}>
            <button className="btn btn-primary" onClick={() => setShowEvent(true)}>+ 添加记录</button>
          </div>
          <div className="card" style={{padding:0}}>
            {events.length === 0 ? <div className="empty-state">暂无奖惩记录</div> : (
              <table>
                <thead><tr><th>类型</th><th>名称</th><th>日期</th><th>照片</th><th>操作</th></tr></thead>
                <tbody>{events.map((e: any) => (
                  <tr key={e.id}>
                    <td><span className={`tag ${e.type==='处罚'?'tag-orange':'tag-green'}`}>{e.type}</span></td>
                    <td style={{fontWeight:500}}>{e.name}</td>
                    <td>{e.date || '-'}</td>
                    <td>{e.photo ? <img src={e.photo} style={{width:32,height:32,borderRadius:4,objectFit:'cover'}} alt="" /> : '-'}</td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => handleDeleteEvent(e.id)}>删除</button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {showEvent && (
        <div className="modal-overlay" onClick={() => setShowEvent(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">添加班级奖惩记录</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">类型</label>
                <select className="form-select" value={eventForm.type} onChange={e=>setEventForm({...eventForm,type:e.target.value})}>
                  <option value="荣誉">荣誉</option>
                  <option value="处罚">处罚</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">日期</label>
                <input className="form-input" type="date" value={eventForm.date} onChange={e=>setEventForm({...eventForm,date:e.target.value})} />
              </div>
            </div>
            <div className="form-group"><label className="form-label">名称 *</label><input className="form-input" value={eventForm.name} onChange={e=>setEventForm({...eventForm,name:e.target.value})} placeholder="如: 文明班级、通报批评" /></div>
            <div className="form-group">
              <label className="form-label">图片</label>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <input type="file" accept="image/*" style={{display:'none'}} id="eventPhotoInput" onChange={async e=>{
                  const f=e.target.files?.[0];if(!f)return;
                  try{const r=await api.uploadPhoto(f);setEventForm({...eventForm,photo:r.url});}catch(err:any){alert(err.message);}
                }}/>
                <button type="button" className="btn btn-default btn-sm" onClick={()=>document.getElementById('eventPhotoInput')?.click()}>选择图片</button>
                {eventForm.photo && <img src={eventForm.photo} style={{width:40,height:40,borderRadius:8,objectFit:'cover'}} alt="" />}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => { setShowEvent(false); setEventForm({type:'荣誉',name:'',date:'',photo:''}); }}>取消</button>
              <button className="btn btn-primary" onClick={handleAddEvent}>保存</button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxHeight:'80vh',overflowY:'auto',width:520}}>
            <div className="modal-title">添加学生</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">姓名 *</label><input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">学号 *</label><input className="form-input" value={form.student_no} onChange={e=>setForm({...form,student_no:e.target.value})} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">性别</label><select className="form-select" value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}><option value="">请选择</option><option value="男">男</option><option value="女">女</option></select></div>
              <div className="form-group"><label className="form-label">出生年月</label><input className="form-input" type="date" value={form.birth_date} onChange={e=>setForm({...form,birth_date:e.target.value})} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">籍贯</label><input className="form-input" value={form.hometown} onChange={e=>setForm({...form,hometown:e.target.value})} placeholder="如: 北京市" /></div>
              <div className="form-group"><label className="form-label">班级职务</label><select className="form-select" value={form.class_role} onChange={e=>setForm({...form,class_role:e.target.value})}>
                <option value="">请选择</option><option value="班长">班长</option><option value="副班长">副班长</option>
                <option value="学习委员">学习委员</option><option value="纪律委员">纪律委员</option>
                <option value="劳动委员">劳动委员</option><option value="体育委员">体育委员</option>
                <option value="文艺委员">文艺委员</option><option value="生活委员">生活委员</option>
                <option value="课代表">课代表</option><option value="组长">组长</option>
              </select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">联系电话</label><input className="form-input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">照片</label>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <input type="file" accept="image/*" style={{display:'none'}} id="addPhotoInput" onChange={async e=>{
                    const f=e.target.files?.[0];if(!f)return;
                    try{const r=await api.uploadStudentPhoto(f);setForm({...form,photo:r.url});}catch(e:any){alert(e.message);}
                  }}/>
                  <button type="button" className="btn btn-default btn-sm" onClick={()=>document.getElementById('addPhotoInput')?.click()}>选择照片</button>
                  {form.photo && <img src={form.photo} style={{width:40,height:40,borderRadius:8,objectFit:'cover'}} alt="" />}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => { setShowAdd(false); setForm({name:'',student_no:'',gender:'',phone:'',birth_date:'',hometown:'',photo:'',class_role:''}); }}>取消</button>
              <button className="btn btn-primary" onClick={handleAddStudent}>保存</button>
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxHeight:'80vh',overflowY:'auto',width:520}}>
            <div className="modal-title">编辑学生 / 调动班级</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">姓名 *</label><input className="form-input" value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">学号 *</label><input className="form-input" value={editForm.student_no} onChange={e=>setEditForm({...editForm,student_no:e.target.value})} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">性别</label><select className="form-select" value={editForm.gender} onChange={e=>setEditForm({...editForm,gender:e.target.value})}><option value="">请选择</option><option value="男">男</option><option value="女">女</option></select></div>
              <div className="form-group"><label className="form-label">出生年月</label><input className="form-input" type="date" value={editForm.birth_date} onChange={e=>setEditForm({...editForm,birth_date:e.target.value})} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">籍贯</label><input className="form-input" value={editForm.hometown} onChange={e=>setEditForm({...editForm,hometown:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">班级职务</label><select className="form-select" value={editForm.class_role} onChange={e=>setEditForm({...editForm,class_role:e.target.value})}>
                <option value="">请选择</option><option value="班长">班长</option><option value="副班长">副班长</option>
                <option value="学习委员">学习委员</option><option value="纪律委员">纪律委员</option>
                <option value="劳动委员">劳动委员</option><option value="体育委员">体育委员</option>
                <option value="文艺委员">文艺委员</option><option value="生活委员">生活委员</option>
                <option value="课代表">课代表</option><option value="组长">组长</option>
              </select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">联系电话</label><input className="form-input" value={editForm.phone} onChange={e=>setEditForm({...editForm,phone:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">照片</label>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <input type="file" accept="image/*" style={{display:'none'}} id="editPhotoInput" onChange={async e=>{
                    const f=e.target.files?.[0];if(!f)return;
                    try{const r=await api.uploadStudentPhoto(f);setEditForm({...editForm,photo:r.url});}catch(e:any){alert(e.message);}
                  }}/>
                  <button type="button" className="btn btn-default btn-sm" onClick={()=>document.getElementById('editPhotoInput')?.click()}>选择照片</button>
                  {editForm.photo && <img src={editForm.photo} style={{width:40,height:40,borderRadius:8,objectFit:'cover'}} alt="" />}
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">所属班级 (修改可调班)</label>
              <select className="form-select" value={editForm.class_id} onChange={e=>setEditForm({...editForm,class_id:Number(e.target.value)})}>
                {allClasses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => setShowEdit(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleEditStudent}>保存</button>
            </div>
          </div>
        </div>
      )}

      {showTeacher && (
        <div className="modal-overlay" onClick={() => setShowTeacher(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">添加班级教师</div>
            <div className="form-group"><label className="form-label">教师姓名 *</label><input className="form-input" value={teacherForm.name} onChange={e=>setTeacherForm({...teacherForm,name:e.target.value})} placeholder="请输入教师姓名" /></div>
            <div className="form-group">
              <label className="form-label">职务</label>
              <select className="form-select" value={teacherForm.role} onChange={e=>setTeacherForm({...teacherForm,role:e.target.value})}>
                <option value="班主任">班主任</option>
                <option value="语文老师">语文老师</option>
                <option value="数学老师">数学老师</option>
                <option value="英语老师">英语老师</option>
                <option value="物理老师">物理老师</option>
                <option value="化学老师">化学老师</option>
                <option value="生物老师">生物老师</option>
                <option value="政治老师">政治老师</option>
                <option value="历史老师">历史老师</option>
                <option value="地理老师">地理老师</option>
                <option value="体育老师">体育老师</option>
                <option value="任课教师">任课教师</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => { setShowTeacher(false); setTeacherForm({name:'',role:'班主任'}); }}>取消</button>
              <button className="btn btn-primary" onClick={handleAddTeacher}>确定</button>
            </div>
          </div>
        </div>
      )}

      {showExam && (
        <div className="modal-overlay" onClick={() => setShowExam(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">创建考试</div>
            <div className="form-group"><label className="form-label">考试名称 *</label><input className="form-input" value={examForm.name} onChange={e=>setExamForm({...examForm,name:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">科目</label><input className="form-input" value={examForm.subject} onChange={e=>setExamForm({...examForm,subject:e.target.value})} /></div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => { setShowExam(false); setExamForm({name:'',subject:''}); }}>取消</button>
              <button className="btn btn-primary" onClick={handleAddExam}>确定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
