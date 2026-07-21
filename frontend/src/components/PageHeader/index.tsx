import React from 'react';
import './index.scss';

export interface TabItem {
  label: string;
  key: string;
}

export interface PageHeaderProps {
  /**
   * 页面主标题文字，必填
   * @example "考勤管理"
   */
  title: string;
  /**
   * 是否显示左侧返回箭头
   * @default true
   */
  showBack?: boolean;
  /**
   * 点击返回的回调事件
   * @default 执行浏览器历史返回
   */
  onBack?: () => void;
  /**
   * 右侧自定义内容插槽，支持传入任意 React 元素
   * @example <button>退出登录</button>
   */
  rightSlot?: React.ReactNode;
  /**
   * Tab 选项数组，不传则不显示 Tab 栏
   * @example [{ label: '发起考勤', key: 'launch' }, { label: '考勤记录', key: 'record' }]
   */
  tabs?: TabItem[];
  /**
   * 当前选中 Tab 的 key 值
   */
  activeKey?: string;
  /**
   * Tab 切换时的回调函数
   */
  onTabChange?: (key: string) => void;
}

/**
 * PageHeader - 全局通用页面顶部导航栏组件
 *
 * 统一所有页面的头部样式与交互，具备可配置属性支持不同页面需求。
 *
 * ## 使用示例
 *
 * ### 基础用法（仅标题 + 默认返回按钮）
 * ```tsx
 * <PageHeader title="考勤管理" />
 * ```
 *
 * ### 带右侧操作区
 * ```tsx
 * <PageHeader
 *   title="考勤管理"
 *   rightSlot={<button className="btn-logout" onClick={handleLogout}>退出登录</button>}
 * />
 * ```
 *
 * ### 隐藏返回按钮
 * ```tsx
 * <PageHeader title="仪表盘" showBack={false} />
 * ```
 *
 * ### 带 Tab 切换
 * ```tsx
 * <PageHeader
 *   title="班级考勤"
 *   showBack={false}
 *   tabs={[
 *     { label: '发起考勤', key: 'launch' },
 *     { label: '考勤记录', key: 'record' }
 *   ]}
 *   activeKey={activeTab}
 *   onTabChange={setActiveTab}
 *   rightSlot={<button className="btn btn-sm btn-primary">新增考勤</button>}
 * />
 * ```
 *
 * ### 自定义返回事件
 * ```tsx
 * <PageHeader
 *   title="学生详情"
 *   onBack={() => navigateTo('/admin/student-mgmt')}
 *   rightSlot={<button className="btn btn-sm btn-primary" onClick={handleEdit}>编辑</button>}
 * />
 * ```
 */
export default function PageHeader({
  title,
  showBack = false,
  onBack,
  rightSlot,
  tabs,
  activeKey,
  onTabChange,
}: PageHeaderProps) {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  return (
    <header className="page-header">
      {/* 顶部导航主栏 */}
      <div className="page-header-top">
        <div className="page-header-left">
          {showBack && (
            <button className="page-header-back" onClick={handleBack} title="返回">
              <span className="page-header-back-icon">&#8249;</span>
              <span className="page-header-back-text">返回</span>
            </button>
          )}
          <h2 className="page-header-title">{title}</h2>
        </div>
        {rightSlot && (
          <div className="page-header-right">
            {rightSlot}
          </div>
        )}
      </div>

      {/* 底部 Tab 切换栏 */}
      {tabs && tabs.length > 0 && (
        <nav className="page-header-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`page-header-tab ${activeKey === tab.key ? 'active' : ''}`}
              onClick={() => onTabChange?.(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
