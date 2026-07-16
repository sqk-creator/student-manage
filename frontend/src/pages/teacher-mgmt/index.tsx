import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

const ALL_SUBJECTS = ['语文','数学','英语','物理','化学','生物','政治','历史','地理','体育'];

interface HonorItem { id?: number; name: string; date: string; photo: string; }

export default function TeacherMgmt() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number>(0);
  const [form, setForm] = useState({ name:'', phone:'', photo:'' });
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<Record<number,{subjects:string[],is_head:boolean}>>({});
  const [honors, setHonors] = useState<HonorItem[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [ts, cs] = await Promise.all([api.getTeacherProfiles(), api.getClasses()]);
      setTeachers(ts); setClasses(cs);
    } catch {} finally { setLoading(false); }
  };

  const openAdd = () => {
    setEditingId(0);
    setForm({ name:'', phone:'', photo:'' });
    setSelectedSubjects([]);
    setSelectedClasses({});
    setHonors([]);
    setShowModal(true);
  };

  const openEdit = (t: any) => {
    setEditingId(t.id);
    setForm({ name:t.name, phone:t.phone||'', photo:t.photo||'' });
    setSelectedSubjects(t.subjects ? t.subjects.split(',').filter(Boolean) : []);
    const sc: Record<number,{subjects:string[],is_head:boolean}> = {};
    (t.classes||[]).forEach((c: any) => {
      sc[c.class_id] = {
        subjects: c.subject ? c.subject.split(',').filter(Boolean) : [],
        is_head: c.role === '班主任'
      };
    });
    setSelectedClasses(sc);
    setHonors((t.honors||[]).map((h:any) => ({ ...h })));
    setShowModal(true);
  };

  const toggleSubject = (s: string) => {
    setSelectedSubjects(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev,s]);
  };

  const toggleClass = (classId: number) => {
    setSelectedClasses(prev => {
      const next = {...prev};
      if (next[classId]) { delete next[classId]; }
      else { next[classId] = { subjects: [], is_head: false }; }
      return next;
    });
  };

  const toggleClassSubject = (classId: number, subj: string) => {
    setSelectedClasses(prev => {
      const cr = prev[classId];
      if (!cr) return prev;
      const subjects = cr.subjects.includes(subj)
        ? cr.subjects.filter(s=>s!==subj)
        : [...cr.subjects, subj];
      return {...prev, [classId]: {...cr, subjects}};
    });
  };

  const updateClassHead = (classId: number, is_head: boolean) => {
    setSelectedClasses(prev => ({...prev, [classId]: {...prev[classId], is_head}}));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return alert('请输入教师姓名');
    const class_ids = Object.keys(selectedClasses).map(Number);
    const class_roles: Record<string,any> = {};
    for (const cid of class_ids) {
      const cr = selectedClasses[cid];
      class_roles[String(cid)] = {
        subject: cr.subjects.join(','),
        is_head: cr.is_head
      };
    }
    const data = {
      name: form.name.trim(),
      phone: form.phone,
      photo: form.photo,
      subjects: selectedSubjects.join(','),
      class_ids,
      class_roles
    };
    try {
      let teacherId = editingId;
      if (editingId) {
        await api.updateTeacherProfile(editingId, data);
        await api.clearTeacherHonors(editingId);
      } else {
        const created = await api.createTeacherProfile(data);
        teacherId = (created as any).id;
      }
      for (const h of honors) {
        if (h.name.trim()) {
          await api.createTeacherHonor(teacherId, { name: h.name.trim(), date: h.date, photo: h.photo });
        }
      }
      setShowModal(false); loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该教师？')) return;
    try { await api.deleteTeacherProfile(id); loadData(); } catch (e: any) { alert(e.message); }
  };

  // Honor management
  const addHonor = () => {
    setHonors(prev => [...prev, { name:'', date:'', photo:'' }]);
  };

  const updateHonor = (index: number, field: string, value: string) => {
    setHonors(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeHonor = (index: number) => {
    setHonors(prev => prev.filter((_, i) => i !== index));
  };

  const handleHonorPhoto = async (index: number, file: File) => {
    try {
      const r = await api.uploadPhoto(file);
      updateHonor(index, 'photo', r.url);
    } catch (e: any) { alert(e.message); }
  };

  if (loading) return <div className="loading-state">加载中...</div>;

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={{fontSize:14,color:'#666'}}>共 {teachers.length} 位教师</div>
        <button className="btn btn-primary" onClick={openAdd}>+ 新增教师</button>
      </div>

      {teachers.length === 0 ? (
        <div className="empty-state">暂无教师，请新增</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {teachers.map((t: any) => (
            <div className="card" key={t.id} style={{padding:20}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                {t.photo && (
                  <img src={t.photo} alt="" style={{width:64,height:80,borderRadius:8,objectFit:'cover',flexShrink:0}} />
                )}
                <div style={{flex:1}}>
                  <div style={{fontSize:16,fontWeight:700,color:'#262626',marginBottom:4}}>{t.name}</div>
                  <div style={{fontSize:13,color:'#86909C',marginBottom:8}}>
                    {t.phone && <span style={{marginRight:12}}>{t.phone}</span>}
                    {(t.subjects||t.subject) && (
                      <span>任课科目：{(t.subjects||t.subject).split(',').filter(Boolean).join('、')}</span>
                    )}
                    {!t.phone && !t.subjects && !t.subject && '暂无其他信息'}
                  </div>
                  {t.classes && t.classes.length > 0 ? (
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {t.classes.map((c: any) => {
                        const dispSubj = c.subject||'';
                        return (
                          <span key={c.class_id} className={`tag ${c.role==='班主任'?'tag-orange':'tag-blue'}`} style={{fontSize:12}}>
                            {c.class_name}{dispSubj ? ' · '+dispSubj.split(',').join('、') : ''} · {c.role}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{fontSize:12,color:'#ccc'}}>暂未关联班级</div>
                  )}
                  {t.honors && t.honors.length > 0 && (
                    <div style={{marginTop:8,display:'flex',flexWrap:'wrap',gap:6}}>
                      {t.honors.map((h: any) => (
                        <span key={h.id} className="tag" style={{fontSize:12,background:'#fff7e6',color:'#fa8c16'}}>
                          {h.name}{h.date ? ' · '+h.date : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{display:'flex',gap:8,flexShrink:0}}>
                  <button className="btn btn-default btn-sm" onClick={() => openEdit(t)}>编辑</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}>删除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxHeight:'90vh',overflowY:'auto',width:580}}>
            <div className="modal-title">{editingId ? '编辑教师' : '新增教师'}</div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">教师姓名 *</label>
                <input className="form-input" value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="请输入教师姓名" />
              </div>
              <div className="form-group">
                <label className="form-label">手机号</label>
                <input className="form-input" value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="请输入手机号" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">教师照片</label>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <input type="file" accept="image/*" style={{display:'none'}} id="teacherPhotoInput" onChange={async e=>{
                  const f=e.target.files?.[0];if(!f)return;
                  try{const r=await api.uploadPhoto(f);setForm({...form,photo:r.url});}catch(err:any){alert(err.message);}
                }}/>
                <button type="button" className="btn btn-default btn-sm" onClick={()=>document.getElementById('teacherPhotoInput')?.click()}>选择照片</button>
                {form.photo && <img src={form.photo} style={{width:48,height:60,borderRadius:8,objectFit:'cover'}} alt="" />}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">任课科目（可多选）</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:2}}>
                {ALL_SUBJECTS.map(s => (
                  <label key={s} style={{
                    padding:'5px 14px',borderRadius:6,border:`2px solid ${selectedSubjects.includes(s)?'#14A89A':'#E5E6EB'}`,
                    background:selectedSubjects.includes(s)?'rgba(20,168,154,0.06)':'#fff',
                    cursor:'pointer',fontSize:13,color:selectedSubjects.includes(s)?'#14A89A':'#4E5969',
                    transition:'all .2s',fontWeight:selectedSubjects.includes(s)?600:400
                  }} onClick={() => toggleSubject(s)}>
                    {s}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group" style={{marginTop:16}}>
              <label className="form-label">关联班级及任课情况</label>
              {classes.length === 0 ? (
                <div style={{fontSize:13,color:'#ccc',padding:'8px 0'}}>暂无班级，请先创建班级</div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:4}}>
                  {classes.map((c: any) => {
                    const cr = selectedClasses[c.id];
                    const isSelected = !!cr;
                    const teacherSubjects = selectedSubjects.length > 0 ? selectedSubjects : ALL_SUBJECTS;
                    return (
                      <div key={c.id} style={{
                        borderRadius:8,border:`2px solid ${isSelected?'#14A89A':'#E5E6EB'}`,
                        background:isSelected?'rgba(20,168,154,0.03)':'#fff',
                        transition:'all .2s',padding:'10px 14px'
                      }}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:isSelected?8:0}}>
                          <label style={{display:'flex',alignItems:'center',gap:6,flex:1,cursor:'pointer'}}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleClass(c.id)} />
                            <span style={{fontSize:14,fontWeight:500,color:'#262626',minWidth:80}}>{c.name}</span>
                          </label>
                          {isSelected && (
                            <label style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:13,color:'#4E5969',whiteSpace:'nowrap'}}>
                              <input type="checkbox" checked={cr.is_head} onChange={e => updateClassHead(c.id, e.target.checked)} />
                              班主任
                            </label>
                          )}
                        </div>
                        {isSelected && (
                          <div style={{display:'flex',flexWrap:'wrap',gap:4,paddingLeft:24}}>
                            {teacherSubjects.map(s => (
                              <label key={s} style={{
                                padding:'3px 10px',borderRadius:4,border:`1px solid ${cr.subjects.includes(s)?'#0F9487':'#E5E6EB'}`,
                                background:cr.subjects.includes(s)?'rgba(15,148,135,0.06)':'#fff',
                                cursor:'pointer',fontSize:12,color:cr.subjects.includes(s)?'#0F9487':'#86909C',
                                transition:'all .15s',fontWeight:cr.subjects.includes(s)?500:400
                              }} onClick={() => toggleClassSubject(c.id, s)}>
                                {s}
                              </label>
                            ))}
                            {cr.subjects.length === 0 && <span style={{fontSize:12,color:'#ccc'}}>请选择该班级的任课科目</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="form-group" style={{marginTop:16}}>
              <label className="form-label">荣誉称号（选填）</label>
              {honors.map((h, i) => (
                <div key={i} style={{border:'1px solid #E5E6EB',borderRadius:8,padding:10,marginTop:8,position:'relative'}}>
                  <div style={{display:'flex',justifyContent:'flex-end',marginBottom:6}}>
                    <button className="btn btn-danger btn-sm" onClick={() => removeHonor(i)} style={{padding:'2px 8px',fontSize:12}}>移除</button>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">荣誉名称</label>
                      <input className="form-input" value={h.name} onChange={e => updateHonor(i, 'name', e.target.value)} placeholder="如: 优秀教师" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">获得时间</label>
                      <input className="form-input" type="date" value={h.date} onChange={e => updateHonor(i, 'date', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group" style={{marginTop:6}}>
                    <label className="form-label">荣誉照片</label>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <input type="file" accept="image/*" style={{display:'none'}} id={`honorPhotoInput${i}`} onChange={e=>{
                        const f=e.target.files?.[0];if(!f)return;
                        handleHonorPhoto(i, f);
                      }}/>
                      <button type="button" className="btn btn-default btn-sm" onClick={()=>document.getElementById(`honorPhotoInput${i}`)?.click()}>选择照片</button>
                      {h.photo && <img src={h.photo} style={{width:40,height:40,borderRadius:6,objectFit:'cover'}} alt="" />}
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-default btn-sm" onClick={addHonor} style={{marginTop:8}}>+ 添加荣誉称号</button>
            </div>

            <div className="modal-actions" style={{marginTop:20}}>
              <button className="btn btn-default" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSubmit}>{editingId ? '保存' : '确定'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
