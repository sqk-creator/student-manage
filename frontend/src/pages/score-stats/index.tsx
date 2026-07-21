import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function ScoreStats() {
  const params = new URLSearchParams(window.location.search);
  const examId = Number(params.get('examId'));
  const examName = decodeURIComponent(params.get('examName')||'');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try { setData(await api.getExamStats(examId)); }
    catch {} finally { setLoading(false); }
  };

  if (loading) return <div className="loading-state">加载中...</div>;
  if (!data?.stats) return <div className="loading-state">暂无数据</div>;

  const { stats, distribution, exam } = data;
  const maxBar = Math.max(distribution?.excellent||0, distribution?.good||0, distribution?.average||0, distribution?.pass||0, distribution?.fail||0, 1);

  const bars = [
    { label:'90-100 (优秀)', value:distribution?.excellent||0, color:'#52c41a' },
    { label:'80-89 (良好)', value:distribution?.good||0, color:'#1890ff' },
    { label:'70-79 (中等)', value:distribution?.average||0, color:'#faad14' },
    { label:'60-69 (及格)', value:distribution?.pass||0, color:'#fa8c16' },
    { label:'0-59 (不及格)', value:distribution?.fail||0, color:'#ff4d4f' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#86909C' }}>
        <a href="/admin/score-exam-list" style={{ color: '#14A89A', textDecoration: 'none' }}>考试管理</a>
        <span style={{ margin: '0 6px' }}>&gt;</span>
        <span style={{ color: '#1D2129' }}>成绩统计</span>
      </div>
      <div style={{marginBottom:20}}>
        <span style={{fontSize:20,fontWeight:700,color:'#262626'}}>{examName || exam?.name}</span>
        {exam?.subject && <span className="tag tag-blue" style={{marginLeft:12}}>{exam.subject}</span>}
      </div>

      <div className="stats-grid">
        <div className="stat-box"><span className="stat-num blue">{stats.avg || '-'}</span><span className="stat-txt">平均分</span></div>
        <div className="stat-box"><span className="stat-num green">{stats.max || '-'}</span><span className="stat-txt">最高分</span></div>
        <div className="stat-box"><span className="stat-num red">{stats.min || '-'}</span><span className="stat-txt">最低分</span></div>
        <div className="stat-box"><span className="stat-num">{stats.total}</span><span className="stat-txt">参考人数</span></div>
      </div>

      <div className="card">
        <div className="card-title">分数分布</div>
        {stats.total > 0 ? (
          <div>
            {bars.map(b => (
              <div key={b.label} style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                <span style={{width:140,fontSize:13,color:'#666',flexShrink:0}}>{b.label}</span>
                <div style={{flex:1}}>
                  <div className="bar-wrap">
                    <div className="bar-fill" style={{width:`${(b.value/maxBar)*100}%`,background:b.color}} />
                  </div>
                </div>
                <span style={{width:40,textAlign:'right',fontSize:13,color:'#666'}}>{b.value}人</span>
              </div>
            ))}
          </div>
        ) : <div className="empty-state">暂无成绩数据</div>}
      </div>
    </div>
  );
}
