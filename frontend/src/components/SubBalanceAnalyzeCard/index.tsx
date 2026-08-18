import React from 'react';
import './index.scss';

interface SubBalanceAnalyzeCardProps {
  /** 顶部背景图 URL，默认使用 sub-balance-analyze-bg.png */
  bgUrl?: string;
  /** 背景图宽高比，用于让背景图容器与渐变遮罩自适应图片原始比例 */
  bgRatio?: string;
  className?: string;
  children?: React.ReactNode;
}

const DEFAULT_BG = '/imgs/bg/sub-balance-analyze-bg.png';
const DEFAULT_RATIO = '2048 / 1152';

/**
 * 科目均衡分析卡片
 *
 * 层级结构（由下至上）：
 * 1. 底层：卡片白色底色
 * 2. 背景图容器：宽 100%，高度按 bgRatio 自适应原图比例，cover / top center
 * 3. 渐变遮罩：与背景图容器严格等高，从自身 75% 处向下过渡到白色，
 *    让图片底端平滑融入卡片白色底色
 * 4. 内容容器：zIndex 最高，铺满整张卡片，任意位置可放置文字/图表
 */
const SubBalanceAnalyzeCard: React.FC<SubBalanceAnalyzeCardProps> = ({
  bgUrl = DEFAULT_BG,
  bgRatio = DEFAULT_RATIO,
  className = '',
  children,
}) => {
  const ratio = bgRatio.trim().replace(/\s+/g, ' / ');
  return (
    <div className={`sub-balance-card ${className}`}>
      <div
        className="sub-balance-card__bg"
        style={{ backgroundImage: `url(${bgUrl})`, aspectRatio: ratio }}
      />
      <div className="sub-balance-card__bg-mask" style={{ aspectRatio: ratio }} />
      <div className="sub-balance-card__body">{children}</div>
    </div>
  );
};

export default SubBalanceAnalyzeCard;
