import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function ScoreEntry() {
  const params = new URLSearchParams(window.location.search);
  const examId = Number(params.get('examId'));
  const examName = decodeURIComponent(params.get('examName')||'');
  const initialClassId = Number(params.get('classId'));

  const [students, setStudents] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<number,string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [gradeClasses, setGradeClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [examInfo, setExamInfo] = useState<any>(null);
  const [needClassSelect, setNeedClassSelect] = useState(false);
  const [maxScore, setMaxScore] = useState(100);

  useEffect(() => { initPage(); }, []);

  const initPage = async () => {
    try {
      const exam = await api.getExamsByQuery().then((all: any[]) => all.find((e: any) => e.id === examId));
      if (!exam) return setLoading(false);
      setExamInfo(exam);
      setMaxScore(exam.total_score || 100);
      if (initialClassId > 0) {
        await loadScores(initialClassId);
        return;
      }
      if (exam.group_id) {
        const group = await api.getExamGroup(exam.group_id).catch(() => null);
        if (group && group.scope_type === 'grade' && group.grade_id) {
          const typeFilter = group.exam_type === 'liberal_arts' ? '文科班' : group.exam_type === 'science' ? '理科班' : undefined;
          const cls = await api.getClasses({ grade_id: group.grade_id, type: typeFilter });
          setGradeClasses(cls);
          setNeedClassSelect(true);
          setLoading(false);
          return;
        }
      }
      setLoading(false);
    } catch {} finally { setLoading(false); }
  };

  const loadScores = async (clsId: number) => {
    setLoading(true);
    try {
      const [stuList, examData] = await Promise.all([api.getStudents(clsId), api.getExamScores(examId)]);
      setStudents(stuList);
      const sm: Record<number,string> = {};
      if (examData.scores) examData.scores.forEach((s:any) => { sm[s.student_id] = String(s.score); });
      setScores(sm);
    } catch {} finally { setLoading(false); }
  };

  const handleClassChange = (clsId: number) => {
    setSelectedClassId(clsId);
    if (clsId > 0) loadScores(clsId);
  };

  const handleSave = async () => {
    const sl = Object.entries(scores).filter(([,v]) => v!=='').map(([sid,score]) => ({student_id:Number(sid), score:Number(score)}));
    if (!sl.length) return alert('请至少输入一个成绩');
    for (const s of sl) { if (s.score<0||s.score>maxScore) return alert(`成绩应在0-${maxScore}之间`); }
    setSaving(true);
    try { await api.enterScores(examId, sl); alert('保存成功'); loadScores(selectedClassId); }
    catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="loading-state">加载中...</div>;

  if (needClassSelect) {
    return (
      <div>
        <div style={{ marginBottom: 16, fontSize: 13, color: '#86909C' }}>
          <a href="/admin/score-exam-list" style={{ color: '#14A89A', textDecoration: 'none' }}>考试管理</a>
          <span style={{ margin: '0 6px' }}>&gt;</span>
          <span style={{ color: '#1D2129' }}>成绩录入</span>
        </div>
        <div className="card">
          <div className="card-title">{examName} - 成绩录入</div>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">选择班级</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {gradeClasses.map((c: any) => (
                <button key={c.id} className="btn btn-default"
                  style={{ background: selectedClassId === c.id ? '#14A89A' : '#fff', color: selectedClassId === c.id ? '#fff' : '#333' }}
                  onClick={() => handleClassChange(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          {selectedClassId ? (
            <ScoreTable students={students} scores={scores} setScores={setScores} saving={saving} onSave={handleSave} maxScore={maxScore} />
          ) : (
            <div className="empty-state">请选择一个班级开始录入成绩</div>
          )}
        </div>
      </div>
    );
  }

  if (!initialClassId) return <div className="empty-state">无法确定考试所属班级</div>;

  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#86909C' }}>
        <a href="/admin/score-exam-list" style={{ color: '#14A89A', textDecoration: 'none' }}>考试管理</a>
        <span style={{ margin: '0 6px' }}>&gt;</span>
        <span style={{ color: '#1D2129' }}>成绩录入</span>
      </div>
      <div className="card">
        <div className="card-title">{examName} - 成绩录入</div>
        <ScoreTable students={students} scores={scores} setScores={setScores} saving={saving} onSave={handleSave} maxScore={maxScore} />
      </div>
    </div>
  );
}

function ScoreTable({ students, scores, setScores, saving, onSave, maxScore }: {
  students: any[]; scores: Record<number,string>; setScores: (v: any) => void; saving: boolean; onSave: () => void; maxScore: number;
}) {
  if (students.length === 0) return <div className="empty-state">该班级暂无学生</div>;
  return (
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
                  type="text"                   placeholder={`0-${maxScore}`}
                  value={scores[s.id]||''}
                  onChange={e => {
                    const v=e.target.value;
                    if(v===''||/^\d{0,3}(\.\d?)?$/.test(v)) setScores((prev: any)=>({...prev,[s.id]:v}));
                  }}
                  style={{width:80,height:32,border:'1px solid #d9d9d9',borderRadius:4,textAlign:'center',fontSize:14}}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{marginTop:20}}>
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>
          {saving ? '保存中...' : '保存成绩'}
        </button>
      </div>
    </div>
  );
}
