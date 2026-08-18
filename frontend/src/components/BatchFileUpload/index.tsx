import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import './index.scss';

export interface UploadedFile {
  name: string;
  size: number;
  url: string;
  response: any;
}

export interface BatchFileUploadRef {
  reset: () => void;
  upload: () => void;
}

export interface BatchFileUploadProps {
  accept?: string;
  maxCount?: number;
  maxSize?: number;
  enableZip?: boolean;
  enableCompress?: boolean;
  uploadUrl?: string;
  fieldName?: string;
  showPreview?: boolean;
  allowRemove?: boolean;
  autoUpload?: boolean;
  className?: string;
  headers?: Record<string, string>;
  formData?: Record<string, string>;
  onSuccess?: (files: UploadedFile[]) => void;
  onProgress?: (percent: number, uploaded: number, total: number) => void;
  onError?: (error: Error, file?: File) => void;
}

interface Item {
  uid: string;
  file: File;
  name: string;
  size: number;
  ext: string;
  isImage: boolean;
  blob: Blob;
  previewUrl: string;
  status: 'ready' | 'uploading' | 'done' | 'error';
  percent: number;
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];

function extOf(name: string): string {
  const m = /\.([^.]+)$/.exec(name);
  return m ? m[1].toLowerCase() : '';
}

function isImageName(name: string): boolean {
  return IMAGE_EXTS.includes(extOf(name));
}

function compressImage(file: File, maxDim = 1600, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) { resolve(file); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => blob ? resolve(blob) : resolve(file), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片读取失败: ' + file.name)); };
    img.src = url;
  });
}

let uidSeq = 0;
const nextUid = () => 'bf-' + (++uidSeq);

const BatchFileUpload = forwardRef<BatchFileUploadRef, BatchFileUploadProps>((props, ref) => {
  const {
    accept,
    maxCount = 20,
    maxSize = 5,
    enableZip = true,
    enableCompress = false,
    uploadUrl = '/api/photo-batch/upload',
    fieldName = 'files',
    showPreview = true,
    allowRemove = true,
    autoUpload = true,
    className = '',
    headers = {},
    formData = {},
    onSuccess,
    onProgress,
    onError
  } = props;

  const [items, setItems] = useState<Item[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;
  const propsRef = useRef<any>({});
  propsRef.current = { uploadUrl, fieldName, headers, formData };

  const patch = (uid: string, partial: Partial<Item>) => {
    setItems(prev => prev.map(it => it.uid === uid ? { ...it, ...partial } : it));
  };

  const buildAccept = () => {
    const base = accept || (enableZip ? '.jpg,.jpeg,.png,.webp,.zip' : 'image/*');
    return base;
  };

  const validateFiles = (fileList: FileList | File[]): { ok: Item[]; errors: string[] } => {
    const files = Array.from(fileList);
    const current = itemsRef.current;
    const ok: Item[] = [];
    const errors: string[] = [];
    let count = current.length;
    for (const f of files) {
      const ext = extOf(f.name);
      const isZip = ext === 'zip';
      if (isZip && !enableZip) { errors.push(`${f.name}: 不支持压缩包`); continue; }
      if (!isZip && !isImageName(f.name) && !(accept || '').includes(ext)) { errors.push(`${f.name}: 文件类型不支持`); continue; }
      if (f.size > maxSize * 1024 * 1024) { errors.push(`${f.name}: 超过 ${maxSize}MB 限制`); continue; }
      if (count >= maxCount) { errors.push(`${f.name}: 超出单次最大 ${maxCount} 个文件`); continue; }
      const isImage = isImageName(f.name);
      ok.push({
        uid: nextUid(),
        file: f,
        name: f.name,
        size: f.size,
        ext,
        isImage,
        blob: f,
        previewUrl: isImage && showPreview ? URL.createObjectURL(f) : '',
        status: 'ready',
        percent: 0
      });
      count += 1;
    }
    return { ok, errors };
  };

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const { ok, errors } = validateFiles(fileList);
    if (errors.length) setNotice(errors.join('；'));
    if (!ok.length) return;

    if (enableCompress) {
      const compressed = await Promise.all(ok.map(async it => {
        if (it.isImage) {
          const blob = await compressImage(it.file);
          return { ...it, blob };
        }
        return it;
      }));
      setItems(prev => [...prev, ...compressed]);
    } else {
      setItems(prev => [...prev, ...ok]);
    }
  }, [enableCompress, validateFiles]);

  const uploadItems = (readyItems: Item[]): Promise<UploadedFile[]> => {
    const { uploadUrl, fieldName, headers, formData } = propsRef.current;
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
          const pct = Math.round(e.loaded / e.total * 100);
          readyItems.forEach(it => patch(it.uid, { percent: pct }));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          let data: any = null;
          try { data = JSON.parse(xhr.responseText); } catch { /* noop */ }
          const url = data && (data.url || data.fileUrl) || '';
          const files: UploadedFile[] = readyItems.map(it => ({ name: it.name, size: it.size, url, response: data }));
          resolve(files);
        } else {
          let msg = '上传失败';
          try { const d = JSON.parse(xhr.responseText); if (d && d.error) msg = d.error; } catch { /* noop */ }
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => reject(new Error('网络异常'));
      const form = new FormData();
      readyItems.forEach(it => form.append(fieldName, it.blob, it.name));
      Object.entries(formData).forEach(([k, v]) => form.append(k, v));
      xhr.send(form);
    });
  };

  const doUpload = useCallback(async () => {
    const ready = itemsRef.current.filter(it => it.status === 'ready');
    if (!ready.length) { setNotice('没有可上传的文件'); return; }
    setUploading(true);
    setNotice('');
    const total = ready.length;
    ready.forEach(it => patch(it.uid, { status: 'uploading' }));
    onProgress?.(0, 0, total);
    try {
      const files = await uploadItems(ready);
      ready.forEach(it => patch(it.uid, { status: 'done', percent: 100 }));
      onProgress?.(100, total, total);
      if (files.length) onSuccess?.(files);
    } catch (e) {
      ready.forEach(it => patch(it.uid, { status: 'error' }));
      onError?.(e as Error, undefined);
    } finally {
      setUploading(false);
    }
  }, [onSuccess, onProgress, onError]);

  useEffect(() => {
    if (autoUpload && items.length && items.every(it => it.status === 'ready')) {
      doUpload();
    }
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeItem = (uid: string) => {
    if (uploading) return;
    setItems(prev => prev.filter(it => it.uid !== uid));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  useImperativeHandle(ref, () => ({
    reset: () => { setItems([]); setNotice(''); },
    upload: () => doUpload()
  }));

  const totalPercent = items.length
    ? Math.round(items.reduce((s, it) => s + it.percent, 0) / items.length)
    : 0;
  const hasUploading = items.some(it => it.status === 'uploading');
  const hasReady = items.some(it => it.status === 'ready');

  return (
    <div className={`bfu ${className}`}>
      <div
        className={`bfu-dropzone ${dragging ? 'bfu-dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="bfu-dropzone-icon">↑</div>
        <div className="bfu-dropzone-title">点击选择或拖拽文件到此处</div>
        <div className="bfu-dropzone-tip">
          支持 {enableZip ? '多选图片 / ZIP 压缩包' : '多选图片'}，单文件不超过 {maxSize}MB，最多 {maxCount} 个
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={buildAccept()}
          style={{ display: 'none' }}
          onChange={e => {
            if (e.target.files && e.target.files.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {notice && <div className="bfu-notice">{notice}</div>}

      {items.length > 0 && (
        <ul className="bfu-list">
          {items.map(it => (
            <li key={it.uid} className={`bfu-item bfu-item-${it.status}`}>
              {showPreview && it.isImage && it.previewUrl ? (
                <img className="bfu-thumb" src={it.previewUrl} alt="" />
              ) : (
                <div className="bfu-thumb bfu-thumb-zip">{it.ext === 'zip' ? 'ZIP' : it.ext.toUpperCase()}</div>
              )}
              <div className="bfu-item-info">
                <div className="bfu-item-name">{it.name}</div>
                <div className="bfu-item-meta">
                  {(it.size / 1024).toFixed(1)} KB · {it.status === 'done' ? '上传成功' : it.status === 'error' ? '上传失败' : it.status === 'uploading' ? `${it.percent}%` : '待上传'}
                </div>
              </div>
              {it.status === 'uploading' && (
                <div className="bfu-item-bar"><i style={{ width: it.percent + '%' }} /></div>
              )}
              {allowRemove && it.status !== 'uploading' && (
                <button className="bfu-remove" onClick={() => removeItem(it.uid)}>×</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <div className="bfu-footer">
          {!autoUpload && hasReady && !uploading && (
            <button type="button" className="bfu-btn bfu-btn-primary" onClick={doUpload}>开始上传</button>
          )}
          {uploading && (
            <div className="bfu-progress">
              <div className="bfu-progress-bar"><i style={{ width: totalPercent + '%' }} /></div>
              <span className="bfu-progress-text">{totalPercent}%</span>
            </div>
          )}
          {hasUploading && <span className="bfu-progress-hint">正在上传，请勿关闭窗口...</span>}
        </div>
      )}
    </div>
  );
});

BatchFileUpload.displayName = 'BatchFileUpload';

export default BatchFileUpload;
