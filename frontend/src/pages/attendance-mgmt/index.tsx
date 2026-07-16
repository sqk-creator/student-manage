import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

const TYPE_OPTIONS = ['全部', '教学考勤', '出操考勤'];

export default function AttendanceMgmt() {
  const [attendances, setAttendances] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('全部');
  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => { loadInit(); }, []);

  const loadInit = async () => {
    try {
      const [atts, cs] = await Promise.all([
        api.getAttendances(),
        api.getAllClasses()
      ]);
      setAttendances(atts);
      setClasses(cs);
    } catch {} finally { setLoading(false); }
  };

  const doSearch = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (classId) params.class_id = Number(classId);
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      setAttendances(await api.getAttendances(params));
    } catch {} finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该考勤记录？')) return;
    try { await api.deleteAttendance(id); doSearch(); } catch (e: any) { alert(e.message); }
  };

  const openDetail = async (id: number) => {
    try {
      const d = await api.getAttendance(id);
      setDetail(d);
      setShowDetail(true);
    } catch (e: any) { alert(e.message); }
  };

  const resetFilters = () => {
    setClassId('');
    setStartDate('');
    setEndDate('');
    setTypeFilter('全部');
    loadInit();
  };

  const filtered = typeFilter === '全部'
    ? attendances
    : attendances.filter(a => a.type === typeFilter);

  const getClassName = (cid: number) => {
    const c = classes.find(x => x.id === cid);
    return c ? c.name : '未知班级';
  };

  const getRate = (a: any) => {
    if (!a.should_attend || a.should_attend === 0) return '-';
    return Math.round(a.actual_attend / a.should_attend * 100) + '%';
  };

  const getRateColor = (rate: string) => {
    const v = parseInt(rate);
    if (isNaN(v)) return '#999';
    if (v >= 90) return '#52c41a';
    if (v >= 70) return '#faad14';
    return '#ff4d4f';
  };

  const statusLabel: Record<string, string> = {
    '出勤': '出勤',
    '缺勤': '缺勤',
    '请假': '请假',
    '迟到': '迟到'
  };

  const statusClass: Record<string, string> = {
    '出勤': 'tag-green',
    '缺勤': 'tag-red',
    '请假': 'tag-orange',
    '迟到': 'tag-blue'
  };

  if (loading && attendances.length === 0) return <div className="loading-state">加载中...</div>;

  return (
    <div>
      <div className="card">
        <div className="card-title" style={{marginBottom:12}}>筛选条件</div>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div className="form-group" style={{marginBottom:0,minWidth:160}}>
            <label className="form-label">班级</label>
            <select className="form-select" value={classId} onChange={e => setClassId(e.target.value)}>
              <option value="">全部班级</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{marginBottom:0,minWidth:140}}>
            <label className="form-label">开始日期</label>
            <input className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="form-group" style={{marginBottom:0,minWidth:140}}>
            <label className="form-label">结束日期</label>
            <input className="form-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="form-group" style={{marginBottom:0,minWidth:120}}>
            <label className="form-label">考勤类型</label>
            <select className="form-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{display:'flex',gap:8,paddingBottom:1}}>
            <button className="btn btn-primary" onClick={doSearch}>查询</button>
            <button className="btn btn-default" onClick={resetFilters}>重置</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div style={{fontSize:14,color:'#666'}}>共 {filtered.length} 条记录</div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">暂无考勤记录</div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table>
              <thead>
                <tr>
                  <th>班级</th>
                  <th>日期</th>
                  <th>类型</th>
                  <th>人数</th>
                  <th>应到</th>
                  <th>实到</th>
                  <th>请假</th>
                  <th>迟到</th>
                  <th>缺勤</th>
                  <th>出勤率</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const rate = getRate(a);
                  return (
                    <tr key={a.id}>
                      <td>{getClassName(a.class_id)}</td>
                      <td>{a.date}</td>
                      <td><span className={`tag ${a.type === '教学考勤' ? 'tag-blue' : 'tag-green'}`}>{a.type}</span></td>
                      <td>{a.total}</td>
                      <td>{a.should_attend}</td>
                      <td>{a.actual_attend}</td>
                      <td>{a.leave_count}</td>
                      <td>{a.late_count}</td>
                      <td>{a.absence_count}</td>
                      <td><span style={{fontWeight:600,color:getRateColor(rate)}}>{rate}</span></td>
                      <td>
                        <button className="btn btn-sm btn-primary" style={{marginRight:6}} onClick={() => openDetail(a.id)}>详情</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(a.id)}>删除</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDetail && detail && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{width:640,maxHeight:'80vh',overflow:'auto'}}>
            <div className="modal-title">考勤详情</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 24px',marginBottom:20,fontSize:13,color:'#666'}}>
              <div>班级：<span style={{color:'#333'}}>{detail.class_name}</span></div>
              <div>日期：<span style={{color:'#333'}}>{detail.date}</span></div>
              <div>类型：<span style={{color:'#333'}}>{detail.type}</span></div>
              <div>登记人：<span style={{color:'#333'}}>{detail.role}</span></div>
              <div>总人数：<span style={{color:'#333'}}>{detail.total}</span></div>
              <div>出勤率：<span style={{color:getRateColor(getRate(detail)),fontWeight:600}}>{getRate(detail)}</span></div>
            </div>
            <div style={{marginBottom:8,fontWeight:600,fontSize:14}}>学生明细</div>
            {(detail.records || []).length === 0 ? (
              <div className="empty-state" style={{padding:20}}>无学生记录</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>姓名</th>
                    <th>学号</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.records || []).map((r: any) => (
                    <tr key={r.id}>
                      <td>{r.student_name}</td>
                      <td>{r.student_no || '-'}</td>
                      <td><span className={`tag ${statusClass[r.status] || 'tag-red'}`}>{statusLabel[r.status] || r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => setShowDetail(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
