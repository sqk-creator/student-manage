import React, { useCallback, useEffect, useRef, useState } from 'react';
import BatchFileUpload, { BatchFileUploadRef, UploadedFile } from '../BatchFileUpload';
import { api } from '../../services/api';
import { message } from '../message';
import './index.scss';

interface PhotoBatchBindProps {
  targetType: 'student' | 'teacher';
  visible: boolean;
  onClose: () => void;
  onBound?: (count: number) => void;
}

interface TaskState {
  taskId: string;
  status: string;
  targetType?: string;
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  unmatched: { filename: string; reason?: string }[];
  errors: { filename: string; reason?: string }[];
  message?: string;
}

const TYPE_TEXT = {
  student: { title: '学生照片批量绑定', key: '学号', example: '202601001.jpg' },
  teacher: { title: '教师照片批量绑定', key: '工号', example: 'T2026001.jpg' }
};

export default function PhotoBatchBind({ targetType, visible, onClose, onBound }: PhotoBatchBindProps) {
  const [phase, setPhase] = useState<'form' | 'running' | 'result'>('form');
  const [overwrite, setOverwrite] = useState(false);
  const [task, setTask] = useState<TaskState | null>(null);
  const uploadRef = useRef<BatchFileUploadRef>(null);
  const timerRef = useRef<number | null>(null);
  const onBoundRef = useRef(onBound);
  onBoundRef.current = onBound;

  const stopPoll = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setPhase('form');
      setTask(null);
      setOverwrite(false);
    } else {
      stopPoll();
    }
    return stopPoll;
  }, [visible, stopPoll]);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const startPoll = useCallback((taskId: string) => {
    setPhase('running');
    stopPoll();
    timerRef.current = window.setInterval(async () => {
      try {
        const t = await api.photoBatchTask(taskId);
        setTask(t);
        if (t.status === 'done' || t.status === 'error') {
          stopPoll();
          setPhase('result');
          if (t.status === 'done' && t.success > 0 && onBoundRef.current) {
            onBoundRef.current(t.success);
          }
        }
      } catch (e: any) {
        stopPoll();
        setPhase('result');
        message.error('任务查询失败: ' + (e.message || ''));
      }
    }, 1500);
  }, [stopPoll]);

  const handleSuccess = useCallback((files: UploadedFile[]) => {
    const resp = files[0]?.response;
    const taskId = resp && (resp.taskId || (Array.isArray(resp) && resp[0]?.taskId));
    if (!taskId) {
      setPhase('result');
      setTask(null);
      message.error('上传响应异常，未获取到任务ID');
      return;
    }
    startPoll(taskId);
  }, [startPoll]);

  const handleError = useCallback((err: Error) => {
    message.error(err.message || '部分文件上传失败');
  }, []);

  const reset = () => {
    uploadRef.current?.reset();
    setPhase('form');
    setTask(null);
    setOverwrite(false);
  };

  const exportUnmatched = () => {
    if (!task || !task.unmatched.length) return;
    const lines = task.unmatched.map(u => u.filename);
    const blob = new Blob(['未匹配文件清单\n' + lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '未匹配清单_' + task.taskId + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  if (!visible) return null;

  const text = TYPE_TEXT[targetType];
  const token = localStorage.getItem('token') || '';
  const tokenHeader = token ? { Authorization: 'Bearer ' + token } : {};
  const progress = task && task.total > 0 ? Math.round(task.processed / task.total * 100) : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal pbb-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{text.title}</div>

        {phase === 'form' && (
          <>
            <div className="pbb-guide">
              <div className="pbb-guide-title">操作说明</div>
              <ul className="pbb-guide-list">
                <li>照片文件名需与{text.key}一致（jpg / jpeg / png / webp），兼容大小写，如 <code>{text.example}</code></li>
                <li>支持多选图片或上传 ZIP 压缩包，系统将按文件名自动匹配档案并绑定</li>
                <li>无法匹配{text.key}的文件将列入「未匹配清单」，可导出核对</li>
              </ul>
            </div>
            <label className="pbb-overwrite">
              <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />
              覆盖已有头像（关闭时，已设置过头像的人员将被跳过）
            </label>
            <BatchFileUpload
              ref={uploadRef}
              enableZip
              enableCompress={false}
              maxCount={200}
              maxSize={30}
              uploadUrl="/api/photo-batch/upload"
              headers={tokenHeader}
              formData={{ target_type: targetType, overwrite: overwrite ? 'true' : 'false' }}
              onSuccess={handleSuccess}
              onError={handleError}
            />
            <div className="modal-actions">
              <button className="btn btn-default" onClick={onClose}>关闭</button>
            </div>
          </>
        )}

        {phase === 'running' && (
          <div className="pbb-running">
            <div className="pbb-running-title">正在上传并匹配绑定，请稍候...</div>
            <div className="bfu-progress">
              <div className="bfu-progress-bar"><i style={{ width: progress + '%' }} /></div>
              <span className="bfu-progress-text">{task ? `${task.processed}/${task.total}` : '准备中'}</span>
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={onClose}>后台处理（可关闭弹窗）</button>
            </div>
          </div>
        )}

        {phase === 'result' && (
          <div className="pbb-result">
            {task && task.status === 'error' ? (
              <div className="pbb-result-msg">任务执行异常：{task.message || '未知错误'}</div>
            ) : (
              <>
                <div className="pbb-stats">
                  <div className="pbb-stat pbb-stat-ok"><b>{task?.success ?? 0}</b><span>成功绑定</span></div>
                  <div className="pbb-stat pbb-stat-skip"><b>{task?.skipped ?? 0}</b><span>跳过(已有头像)</span></div>
                  <div className="pbb-stat pbb-stat-fail"><b>{task?.failed ?? 0}</b><span>处理失败</span></div>
                  <div className="pbb-stat pbb-stat-unmatch"><b>{task?.unmatched.length ?? 0}</b><span>未匹配</span></div>
                </div>
                {(task?.unmatched?.length ?? 0) > 0 && (
                  <div className="pbb-unmatched">
                    <div className="pbb-unmatched-head">
                      <span>未匹配清单（共 {task.unmatched.length} 个文件）</span>
                      <button className="btn btn-default btn-sm" onClick={exportUnmatched}>导出未匹配清单</button>
                    </div>
                    <ul className="pbb-unmatched-list">
                      {task.unmatched.map((u, i) => (
                        <li key={i}><span className="pbb-unmatched-name">{u.filename}</span><span className="pbb-unmatched-reason">{u.reason || '未找到对应档案'}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {(task?.errors?.length ?? 0) > 0 && (
                  <div className="pbb-errors">
                    <div className="pbb-errors-title">异常明细（前 {Math.min(task.errors.length, 5)} 条）</div>
                    {task.errors.slice(0, 5).map((e, i) => (
                      <div key={i} className="pbb-error-item">{e.filename}：{e.reason || '处理失败'}</div>
                    ))}
                  </div>
                )}
                <div className="modal-actions">
                  <button className="btn btn-default" onClick={reset}>再次上传</button>
                  <button className="btn btn-primary" onClick={onClose}>完成</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
