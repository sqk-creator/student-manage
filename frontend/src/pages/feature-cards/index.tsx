import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';

interface CardItem {
  id: number;
  card_key: string;
  title: string;
  subtitle: string;
  image_url: string;
  link_url: string;
  is_enabled: number;
  sort_order: number;
}

const CARD_LABELS: Record<string, string> = {
  student_analysis: '学生智能分析',
  score_report: '成绩报告',
  notice_board: '通知公告'
};

export default function FeatureCards() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: '', subtitle: '', image_url: '', link_url: '', is_enabled: 1, sort_order: 0 });
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadCards(); }, []);

  const loadCards = async () => {
    try { setCards(await api.getFeatureCards()); } catch {} finally { setLoading(false); }
  };

  const openEdit = (c: CardItem) => {
    setEditingId(c.id);
    setForm({ title: c.title, subtitle: c.subtitle, image_url: c.image_url, link_url: c.link_url, is_enabled: c.is_enabled, sort_order: c.sort_order });
    setPreviewUrl(c.image_url);
  };

  const closeEdit = () => {
    setEditingId(null);
    setPreviewUrl('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await api.uploadFeatureCard(file);
      setForm(f => ({ ...f, image_url: data.url }));
      setPreviewUrl(data.url);
    } catch (err: any) { alert(err.message || '上传失败'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.title.trim()) return alert('标题不能为空');
    try {
      await api.updateFeatureCard(editingId!, form);
      closeEdit();
      loadCards();
    } catch (e: any) { alert(e.message); }
  };

  if (loading) return <div className="loading-state">加载中...</div>;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>运营卡片管理</h2>
        <p style={{ margin: '4px 0 0', color: '#86909C', fontSize: 13 }}>配置小程序首页功能卡片的标题、副标题、背景图片及跳转链接</p>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 60 }}>ID</th>
              <th style={{ width: 120 }}>卡片名称</th>
              <th>标题</th>
              <th>副标题</th>
              <th>跳转链接</th>
              <th style={{ width: 80 }}>状态</th>
              <th style={{ width: 80 }}>排序</th>
              <th style={{ width: 80 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {cards.map(c => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td style={{ fontWeight: 500 }}>{CARD_LABELS[c.card_key] || c.card_key}</td>
                <td>{c.title}</td>
                <td style={{ color: '#86909C' }}>{c.subtitle || '-'}</td>
                <td style={{ color: '#86909C', fontSize: 12 }}>{c.link_url || '-'}</td>
                <td>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 12,
                    background: c.is_enabled ? 'rgba(20,168,154,0.08)' : '#f5f5f5',
                    color: c.is_enabled ? '#14A89A' : '#86909C'
                  }}>{c.is_enabled ? '启用' : '禁用'}</span>
                </td>
                <td>{c.sort_order}</td>
                <td>
                  <button className="btn btn-default btn-sm" onClick={() => openEdit(c)}>编辑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId !== null && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-title">
              编辑卡片 - {CARD_LABELS[cards.find(c => c.id === editingId)?.card_key || ''] || ''}
            </div>
            <div className="form-group">
              <label className="form-label">背景图片</label>
              <div style={{ marginTop: 4 }}>
                <label style={{
                  display: 'inline-block', padding: '6px 16px', border: '1px solid #d9d9d9',
                  borderRadius: 4, cursor: 'pointer', fontSize: 13, color: '#333', background: '#fafafa'
                }}>
                  {uploading ? '上传中...' : '选择文件'}
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={handleUpload} disabled={uploading} />
                </label>
                {previewUrl && (
                  <div style={{ marginTop: 8 }}>
                    <img src={previewUrl} alt="预览"
                      style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, border: '1px solid #f0f0f0' }} />
                  </div>
                )}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">标题</label>
              <input className="form-input" value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">副标题</label>
              <input className="form-input" value={form.subtitle}
                onChange={e => setForm({ ...form, subtitle: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">跳转链接</label>
              <input className="form-input" value={form.link_url}
                onChange={e => setForm({ ...form, link_url: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">状态</label>
                <select className="form-select" value={form.is_enabled}
                  onChange={e => setForm({ ...form, is_enabled: Number(e.target.value) })}>
                  <option value={1}>启用</option>
                  <option value={0}>禁用</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">排序</label>
                <input className="form-input" type="number" value={form.sort_order}
                  onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={closeEdit}>取消</button>
              <button className="btn btn-primary" onClick={handleSave}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
