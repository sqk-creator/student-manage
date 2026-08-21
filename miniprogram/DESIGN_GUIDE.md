# 小程序前端设计规范（原生微信小程序 miniprogram）

> 适用场景：本项目 miniprogram 原生微信小程序
> 项目主色：#14A89A（全局唯一主色，禁止旧色 #0E9E86）
> 技术约束：严格原生小程序语法 wxml / wxss / js / json，禁止 H5、HTML、CSS、rem 单位
> 使用对象：个人查阅存档、MonkeyCode 全局强制开发指令

## 一、全局核心强制规则（最高优先级）

1. 单位规则：所有布局、字体、圆角、边距、宽高统一使用 rpx，禁止 px、禁止 rem、禁止百分比布局混乱。
2. 唯一例外：页面细分割线、极细边框允许使用 1px（解决 1rpx 在部分机型过淡、看不见的问题）。
3. 屏幕适配：小程序标准 750rpx = 整屏宽度，所有设计稿尺寸直接原值写 rpx，无需换算。
4. 安全区强制适配：所有页面底部必须兼容全面屏手势条，全局统一开启安全区，避免内容被遮挡。
5. 样式唯一来源：所有样式优先复用全局 class，禁止每个页面自定义一套配色、圆角、阴影、间距。
6. 禁止新增自定义色值：所有 UI 颜色必须从本规范色值列表选取。

## 二、完整色彩系统（定稿、全覆盖）

### 1. 主色系（项目品牌色）
- 主色：#14A89A（按钮、选中态、图表主色、头部卡片、核心强调）
- 主色按下加深：#0F8478（按钮 active 态、深色强调）
- 主色浅亮：#33B8AA（渐变辅助色）
- 主色浅底色：#E6F7F5（标签背景、卡片浅色底色）

### 2. 业务状态色（固定不变）
- 成功绿：#07C160
- 警告橙：#FF9500
- 危险红：#EE0A24
- 信息蓝（对比色）：#2979FF

### 3. 成绩等级专用配色（成绩单组件专用）
- 0-59 不及格：#E64340
- 60-74 一般：#FF9500
- 75-84 良好：#FBBC05
- 85-100 优秀：#14A89A（项目主色统一）

### 4. 文本层级色
- 一级标题/超大数字：#1A1A1A
- 二级标题/卡片标题：#333333
- 正文常规文字：#606266
- 辅助小字/占位/空状态：#909399

### 5. 背景、分割线、遮罩
- 页面背景：#F0F8F6
- 卡片白色背景：#FFFFFF
- 分割线：#E8EFED
- 弹窗蒙版：rgba(0,0,0,0.45)

## 三、字体规范（全部 rpx，固定层级）

- 页面大标题：40rpx、600
- 模块卡片标题：34rpx、600
- 列表/内容标题：30rpx、500
- 常规正文：28rpx、400
- 统计大数字（分数/占比/人数）：48~60rpx、700 加粗（强制放大）
- 标签、备注、空状态小字：24rpx、400

强制规则：统计数字必须加粗放大，配套小号灰色描述文字，保持页面层次感。

## 四、圆角、阴影、间距规范（全局统一）

### 1. 圆角 border-radius
- 大卡片 / Banner / 渐变统计卡片：24rpx
- 普通业务卡片 / 列表卡片：20rpx
- 按钮：16rpx
- Tag 标签、筛选标签：12rpx
- 输入框、搜索框：16rpx

### 2. 卡片阴影（唯一阴影）
`box-shadow: 0 4rpx 20rpx rgba(20, 168, 154, 0.08);`
渐变横幅卡片禁止加阴影。

### 3. 全局间距（固定不变）
- 页面左右安全边距：32rpx（所有页面统一，不贴边）
- 模块垂直间距：40rpx
- 卡片内部 padding：32rpx
- 卡片内部子元素间距：24rpx
- 标签与文字间距：12rpx

## 五、单位专项规范（rpx / px 最终权威说明）

1. 99% 场景全部使用 rpx：字体、宽高、边距、圆角、卡片、按钮、图标、布局。
2. 唯一允许 px 的场景：细线分割线 `border-bottom: 1px solid #E8EFED;`（1rpx 细线多数手机显示过淡，1px 为小程序标准细线方案）。
3. 绝对禁止：使用 rem、vw、vh、固定 px 布局、百分比乱布局。

## 六、安全区适配规范（env 最终规则）

所有原生小程序页面全局强制开启底部安全区，适配全面屏手势条，防止底部内容被遮挡。

```css
page {
  padding-bottom: env(safe-area-inset-bottom);
}
```

规则细分：
- 普通滚动页面：依靠全局 page 自动适配，无需重复加边距
- 底部 fixed 固定悬浮组件：组件自身单独加 safe-area 内边距
- 禁止写死 68rpx、34rpx 等固定底部边距（会导致异形屏错乱、老式手机留白过大）

## 七、全局通用样式 Class（可直接复用）

```css
page {
  background-color: #F0F8F6;
  padding: 0 32rpx;
  padding-bottom: env(safe-area-inset-bottom);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* 大卡片 */
.card-large {
  background: #ffffff;
  border-radius: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(20, 168, 154, 0.08);
  padding: 32rpx;
  margin-bottom: 40rpx;
}

/* 普通卡片 */
.card-normal {
  background: #ffffff;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(20, 168, 154, 0.08);
  padding: 32rpx;
  margin-bottom: 32rpx;
}

/* 主按钮 */
.btn-primary {
  background-color: #14A89A;
  color: #ffffff;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 500;
}
.btn-primary:active {
  background-color: #0F8478;
}

/* 绿色标签 */
.tag-green {
  background: #E6F7F5;
  color: #14A89A;
  font-size: 24rpx;
  border-radius: 12rpx;
  padding: 6rpx 16rpx;
  display: inline-block;
}
```

## 八、通用组件 & 布局规范

- 四宫格功能入口：grid 四列等分布局，icon 96rpx，文字 26rpx，整格可点击
- 双列卡片布局：grid 两列、gap 24rpx
- Tab 切换：选中态主色背景白色文字，未选中灰色文字，仅更新数据不重载页面
- ECharts 图表：外层套 card-large，高度 JS 动态赋值（禁止百分比），主色 #14A89A、对比色 #2979FF，空数据展示 Empty
- 跳转箭头 > 统一代表可进入详情页

## 九、交互规范（全局统一）

- 可点击热区最小 88rpx，禁止极小点击区域
- 提交按钮自动 loading + 置灰，防重复提交
- 列表统一：下拉刷新 onPullDownRefresh、上拉分页 onReachBottom
- 角标数字为 0 时自动隐藏
- 确认弹窗使用 modal、筛选浮层使用 popup
- 所有空数据页面统一 Empty 组件，禁止手写空白提示

## 十、成绩等级划分条组件专属规范（重点业务组件）

组件名称：score-rank-bar

- 分段规则：0-59 不及格 / 60-74 一般 / 75-84 良好 / 85-100 优秀
- 结构：顶部等级标签 → 居中倒三角指示器 → 四色分段进度条
- 定位公式：offsetPercent = (score - 0) / 100 * 100%
- 边界容错：超 0、超 100 自动吸附边缘，不溢出

## 十一、严格禁止项（MonkeyCode 强制不允许）

- 禁止输出 HTML / CSS / H5 页面代码（当前为原生小程序工程）
- 禁止使用旧主色 #0E9E86
- 禁止使用 rem / vw / 固定 px 布局
- 禁止直角卡片、直角按钮
- 禁止图表百分比高度
- 禁止手写自定义色值
- 禁止写死底部安全区高度
- 禁止统计数字小字体

## 十二、MonkeyCode 一句话全局指令前缀（后续所有生成必须带头）

> 当前为微信原生小程序 miniprogram 工程，输出原生 wxml/wxss/js/json 代码，禁止 H5/HTML 代码；严格遵循本项目完整 UI 规范：主色 #14A89A，全部布局使用 rpx，仅细线允许 1px；全局适配 safe-area 底部安全区；严格按规范色值、圆角、间距、字体层级开发；复用全局 class，组件规范、交互规范、空状态、边界容错全部遵守。
