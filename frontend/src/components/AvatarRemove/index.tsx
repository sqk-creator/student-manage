import React from 'react';
import { api } from '../../services/api';
import { message } from '../message';

interface AvatarRemoveProps {
  target: 'student' | 'teacher';
  id: number;
  onRemoved?: () => void;
}

export default function AvatarRemove({ target, id, onRemoved }: AvatarRemoveProps) {
  const handleRemove = async () => {
    if (!window.confirm('确定删除该照片？删除后不可恢复。')) return;
    try {
      await api.removePhoto(target, id);
      message.success('照片已删除');
      onRemoved?.();
    } catch (e: any) {
      message.error(e.message || '删除失败');
    }
  };

  return (
    <button type="button" className="btn btn-default btn-sm" onClick={handleRemove}>
      删除照片
    </button>
  );
}
