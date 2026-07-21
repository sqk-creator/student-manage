import React, { useEffect, useState } from 'react';
import Icon from '../Icon';
import './index.scss';

interface AttendanceStats {
  should_attend: number;
  actual_attend: number;
  should_exercise: number;
  actual_exercise: number;
  leave_count: number;
  late_count: number;
  absence_count: number;
  attendance_rate: number;
  exercise_rate: number;
  today_status: string;
  month: string;
}

interface Props {
  studentId: number | string;
}

const monthLabels = ['本月', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const AttendanceStatsCard: React.FC<Props> = ({ studentId }) => {
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [month, setMonth] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchStats = async (m?: string) => {
    try {
      const url = `/api/public/students/${studentId}/attendance-stats${m ? `?month=${m}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setStats(data);
      if (!m) setMonth(data.month);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchStats();
  }, [studentId]);

  const handleMonthSelect = (m: string | null) => {
    setShowDropdown(false);
    const now = new Date();
    const year = now.getFullYear();
    const val = m || `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setMonth(val);
    fetchStats(val);
  };

  if (!stats) return <div className="attendance-stats-card attendance-stats-card--loading">加载中...</div>;

  const indicators = [
    { label: '应出勤', value: stats.should_attend, unit: '次' },
    { label: '实出勤', value: stats.actual_attend, unit: '次' },
    { label: '实出操', value: stats.actual_exercise, unit: '次' },
    { label: '请假', value: stats.leave_count, unit: '次' },
    { label: '迟到', value: stats.late_count, unit: '次' },
    { label: '缺勤', value: stats.absence_count, unit: '次' },
  ];

  const currentMonthLabel = month === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}` ? '本月' : month;

  return (
    <div className="attendance-stats-card">
      <div className="attendance-stats-card__header">
        <span className="attendance-stats-card__title">学生考勤情况</span>
        <div className="attendance-stats-card__month-dropdown" onClick={() => setShowDropdown(!showDropdown)}>
          <span className="attendance-stats-card__month-label">{currentMonthLabel}</span>
          <Icon name="chevron-down" size={12} color="#86909C" />
          {showDropdown && (
            <div className="attendance-stats-card__dropdown-menu">
              {monthLabels.map((label, i) => {
                const now = new Date();
                const val = i === 0 ? null : `${now.getFullYear()}-${String(i).padStart(2, '0')}`;
                return (
                  <div key={label} className="attendance-stats-card__dropdown-item" onClick={(e) => { e.stopPropagation(); handleMonthSelect(val); }}>
                    {label}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="attendance-stats-card__body">
        <div className="attendance-stats-card__stats-grid">
          {indicators.map((item) => (
            <div key={item.label} className="attendance-stats-card__stat-item">
              <div className="attendance-stats-card__stat-label">{item.label}</div>
              <div className="attendance-stats-card__stat-value">
                <span className="attendance-stats-card__stat-num">{item.value}</span>
                <span className="attendance-stats-card__stat-unit">{item.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="attendance-stats-card__divider-v" />

        <div className="attendance-stats-card__progress-group">
          <div className="attendance-stats-card__progress-item">
            <div className="attendance-stats-card__progress-bar">
              <div className="attendance-stats-card__progress-fill" style={{ height: `${stats.attendance_rate}%` }} />
            </div>
            <div className="attendance-stats-card__progress-label">出勤率</div>
            <div className="attendance-stats-card__progress-value">{stats.attendance_rate}%</div>
          </div>
          <div className="attendance-stats-card__progress-item">
            <div className="attendance-stats-card__progress-bar">
              <div className="attendance-stats-card__progress-fill" style={{ height: `${stats.exercise_rate}%` }} />
            </div>
            <div className="attendance-stats-card__progress-label">出操率</div>
            <div className="attendance-stats-card__progress-value">{stats.exercise_rate}%</div>
          </div>
        </div>
      </div>

      <div className="attendance-stats-card__footer">
        <div className="attendance-stats-card__footer-left">
          {stats.today_status === '今日已出勤' ? (
            <>
              <span className="attendance-stats-card__check-icon">
                <Icon name="check" size={12} color="#FFFFFF" />
              </span>
              <span className="attendance-stats-card__footer-status">{stats.today_status}</span>
            </>
          ) : (
            <span className={`attendance-stats-card__footer-status ${stats.today_status !== '今日暂未出勤' ? 'attendance-stats-card__footer-status--absent' : ''}`}>
              {stats.today_status}
            </span>
          )}
        </div>
        <div className="attendance-stats-card__footer-divider" />
        <div className="attendance-stats-card__footer-right">
          <span className="attendance-stats-card__footer-link">考勤详情</span>
          <span className="attendance-stats-card__arrow-btn">
            <Icon name="chevron-right" size={14} color="#1D2129" />
          </span>
        </div>
      </div>
    </div>
  );
};

export default AttendanceStatsCard;
