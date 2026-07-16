import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function ScoreEntry() {
  const params = new URLSearchParams(window.location.search);
  const examId = Number(params.get('examId'));
  const examName = decodeURIComponent(params.get('examName')||'');
  const classId = Number(params.get('classId'));

  const [students, setStudents] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<number,string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [stuList, examData] = await Promise.all([api.getStudents(classId), api.getExamScores(examId)]);
      setStudents(stuList);
      const sm: Record<number,string> = {};
      if (examData.scores) examData.scores.forEach((s:any) => { sm[s.student_id] = String(s.score); });
      setScores(sm);
    } catch {} finally { setLoading(false); }
  };

  const handleSave = async () => {
    const sl = Object.entries(scores).filter(([,v]) => v!=='').map(([sid,score]) => ({student_id:Number(sid), score:Number(score)}));
    if (!sl.length) return alert('请至少输入一个成绩');
    for (const s of sl) { if (s.score<0||s.score>100) return alert('成绩应在0-100之间'); }
    setSaving(true);
    try { await api.enterScores(examId, sl); alert('保存成功'); loadData(); }
    catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="loading-state">加载中...</div>;

  return (
    <div>
      <div className="card">
        <div className="card-title">{examName} - 成绩录入</div>
        {students.length === 0 ? <div className="empty-state">该班级暂无学生</div> : (
          <div>
            <table>
              <thead><tr><th>学号</th><th>姓名</th><th style={{textAlign:'center',width:200}}>成绩</th></tr></thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td>{s.student_no}</td>
                    <td>{s.name}</td>
                    <td style={{textAlign:'center'}}>
                      <input
                        type="text" placeholder="0-100"
                        value={scores[s.id]||''}
                        onChange={e => {
                          const v=e.target.value;
                          if(v===''||/^\d{0,3}(\.\d?)?$/.test(v)) setScores(prev=>({...prev,[s.id]:v}));
                        }}
                        style={{width:80,height:32,border:'1px solid #d9d9d9',borderRadius:4,textAlign:'center',fontSize:14}}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{marginTop:20}}>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存成绩'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
