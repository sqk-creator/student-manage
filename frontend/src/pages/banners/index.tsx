import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function Banners() {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: '', image_url: '', sort_order: 0, is_enabled: false });
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => { loadBanners(); }, []);

  const loadBanners = async () => {
    try {
      const data = await api.getBanners();
      setBanners(data);
    } catch {} finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', image_url: '', sort_order: 0, is_enabled: false });
    setPreviewUrl('');
    setShowModal(true);
  };

  const openEdit = (b: any) => {
    setEditing(b);
    setForm({ title: b.title, image_url: b.image_url, sort_order: b.sort_order, is_enabled: b.is_enabled });
    setPreviewUrl(b.image_url);
    setShowModal(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await api.uploadBanner(file);
      setForm(f => ({ ...f, image_url: data.url }));
      setPreviewUrl(data.url);
    } catch (err: any) {
      alert(err.message || '上传失败');
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.image_url) return alert('请上传Banner图片');
    try {
      if (editing) {
        await api.updateBanner(editing.id, form);
      } else {
        await api.createBanner(form);
      }
      setShowModal(false);
      loadBanners();
    } catch (err: any) {
      alert(err.message || '保存失败');
    }
  };

  const handleToggle = async (b: any) => {
    try {
      await api.updateBanner(b.id, { is_enabled: !b.is_enabled });
      loadBanners();
    } catch (err: any) {
      alert(err.message || '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除该Banner？')) return;
    try {
      await api.deleteBanner(id);
      loadBanners();
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  if (loading) return <div className="loading-state">加载中...</div>;

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="card-title" style={{ marginBottom: 0 }}>Banner图列表</h3>
          <button className="btn btn-primary" onClick={openCreate}>新增Banner</button>
        </div>

        {banners.length === 0 ? (
          <div className="empty-state">暂无Banner图，点击「新增Banner」添加</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 80 }}>预览</th>
                <th>标题</th>
                <th style={{ width: 80 }}>排序</th>
                <th style={{ width: 100 }}>状态</th>
                <th style={{ width: 180 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((b: any) => (
                <tr key={b.id}>
                  <td>
                    {b.image_url ? (
                      <img src={b.image_url} alt={b.title} style={{ width: 60, height: 34, objectFit: 'cover', borderRadius: 4 }} />
                    ) : <span style={{ color: '#ccc' }}>无</span>}
                  </td>
                  <td>{b.title || '-'}</td>
                  <td>{b.sort_order}</td>
                  <td>
                    <span className={`tag ${b.is_enabled ? 'tag-green' : 'tag-red'}`}>
                      {b.is_enabled ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-default btn-sm" style={{ marginRight: 8 }} onClick={() => handleToggle(b)}>
                      {b.is_enabled ? '禁用' : '启用'}
                    </button>
                    <button className="btn btn-default btn-sm" style={{ marginRight: 8 }} onClick={() => openEdit(b)}>编辑</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(b.id)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">{editing ? '编辑Banner' : '新增Banner'}</h3>

            <div className="form-group">
              <label className="form-label">标题</label>
              <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Banner标题" />
            </div>

            <div className="form-group">
              <label className="form-label">Banner图片 <span style={{ color: '#ff4d4f' }}>*</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{
                  display: 'inline-block', padding: '6px 16px', border: '1px solid #d9d9d9',
                  borderRadius: 4, cursor: 'pointer', fontSize: 13, color: '#333', background: '#fafafa'
                }}>
                  {uploading ? '上传中...' : '选择文件'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
                </label>
                <span style={{ fontSize: 12, color: '#86909C' }}>推荐尺寸 750x400px，支持 JPG/PNG/GIF/WEBP，最大 5MB</span>
              </div>
              {previewUrl && (
                <div style={{ marginTop: 8 }}>
                  <img src={previewUrl} alt="预览" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, border: '1px solid #f0f0f0' }} />
                </div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">排序 (数字越小越靠前)</label>
                <input className="form-input" type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label className="form-label">状态</label>
                <div style={{ paddingTop: 8 }}>
                  <label style={{ cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={form.is_enabled} onChange={e => setForm({ ...form, is_enabled: e.target.checked })}
                      style={{ marginRight: 6 }} />
                    启用 (启用后将在小程序首页展示)
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={uploading}>
                {editing ? '保存' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
