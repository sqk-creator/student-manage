# 用户指令记忆

本文件记录了用户的指令、偏好和教导，用于在未来的交互中提供参考。

## 格式

### 用户指令条目

\[用户指令摘要]

* Date: \[YYYY-MM-DD]

* Context: \[提及的场景或时间]

* Instructions:

  * \[用户教导或指示的内容，逐行描述]

### 项目知识条目

\[项目知识摘要]

* Date: \[YYYY-MM-DD]

* Context: Agent 在执行 \[具体任务描述] 时发现

* Category: \[运维部署|构建方法|测试方法|排错调试|工作流协作|环境配置]

* Instructions:

  * \[具体的知识点，逐行描述]

## 去重策略

* 添加新条目前，检查是否存在相似或相同的指令

* 若发现重复，跳过新条目或与已有条目合并

* 合并时，更新上下文或日期信息

* 这有助于避免冗余条目，保持记忆文件整洁

## 条目

\[前端浏览器实测环境与方法]

* Date: 2026-08-16

* Context: Agent 在执行照片批量绑定、圆环进度条平滑化等功能的浏览器实测时发现

* Category: 测试方法

* Instructions:

  * 浏览器实测统一用 headless 方式：puppeteer-core 装在 /tmp/opencode/echarts-test/node\_modules，executablePath=/usr/bin/chromium-headless-shell，headless:true + --no-sandbox --disable-dev-shm-usage

  * headless 截图 devicePixelRatio 恒为 1；viewport 加宽时页面容器居中，svg 的 getBoundingClientRect() 会整体平移（如 1260px 宽时 svg x=480），采样坐标必须先用 evaluate 取真实 rect

  * **headless 的 SVG clipPath 对 stroke 路径不可靠**：clipPath 内 line/path 的 stroke 宽度被当作无面积区域，内容会被整体裁掉；改用 <mask>（像素 alpha）才可靠，但 mask 中弧线 stroke 的 linecap 渲染也不稳定（butt 也等效圆头，会在起点外多画 6-8°）

  * 环形进度条最终可靠方案：180 段（每段 2°）完整绘制 + 每段 stroke-dasharray 控制可见长度 + butt 平头 + 段尾重叠 ov=0.2° 无缝衔接，渐变方向突变小到不可见（48 段/7.5° 仍可见"一段段"折痕）；路径需延长 tail=8° 以容纳端点 cap，dash 间隔基准用 g.L=g.lt+tail 弧长

  * **headless 弧线 round linecap 有位置 bug**：弧位于下半圆（起点 sin>0，约 45°\~225°）时两端 cap 都不渲染，sweep/大弧标志无法规避；dash 段终点 cap 在短 dash 时更不可靠。上半圆弧与直线 cap 正常

  * 末端圆头最终方案：`<circle class="ring-prog-cap">` 置于进度 g 内但**在进度段之前**（下层），圆心=带末端点 ringPointAt(RING\_MAIN,ang)，r=带宽/2，fill=progColor((ang+90)/360)；上半圆被带覆盖，仅露出凸出半圆=唯一圆头，颜色与带末端同色无缝；180° 弧半圆 fill（A..Z 弓形）在 headless 渲染有洞，不可用

  * 进度带同心剖面采样坐标（CSS 像素）：x=cx+rr·s·cos(ang)，y=cy+(121/110)·rr·s·sin(ang)，rr 为 SVG 剖面半径（中心线 110），s=300/336；曾用未乘 s 的 rr 采样导致采到弧带外误判出"白色缝隙"假象

  * 管理后台登录用 POST /api/auth/login body={code:'test'} 取 token，再注入 localStorage 后 reload 页面进入受保护路由

  * 后端/前端服务必须分别用 background terminal 启动（后端 cd /workspace/backend && node src/app.js 端口 3001；前端 cd /workspace/frontend && npx vite --host 0.0.0.0 端口 3000），改 vite.config.ts 后必须重启 vite 才生效

  * 系统测试数据：学生学号"001"（吴海峰）、教师王梅（id=6）可设工号用于照片匹配测试；生成测试图片可用后端 sharp 或 adm-zip

\[小程序端环境配置与调试]

* Date: 2026-08-18

* Context: Agent 将移动H5首页复刻为微信小程序（miniprogram/ 目录）时发现

* Category: 环境配置

* Instructions:

  * miniprogram/ 为微信原生小程序端，项目根为 miniprogram/（project.config.json 在此），导入微信开发者工具时选择该目录

  * API base URL 在 miniprogram/config/index.js 的 BASE\_URL（默认 <http://localhost:3001）；开发者工具需勾选"不校验合法域名"才能访问> http，真机预览需改为局域网 IP 或 HTTPS 域名

  * 无登录态：用户信息（陈小武）、teacher\_id=2、角标数量均硬编码在 miniprogram/config/index.js（USER/BADGE），后续接微信登录时替换

  * 首页依赖 4 个接口：/api/banners/enabled、/api/feature-cards/enabled、/api/public/classes?teacher\_id=2、/api/public/attendance-summary，返回字段与 index.js 解析字段一一对应

\[小程序等效预览入口标注（强制约定）]

* Date: 2026-08-18

* Context: 用户发布"小程序迭代1.2.4"，要求点击访问小程序端的预览入口必须明确标注"小程序等效预览"

* Category: 行为指令

* Instructions:

  * 预览环境（frontend/src/pages/entry/index.tsx）的小程序端入口卡片必须明确标注"小程序等效预览"，说明其为浏览器环境用 HTML 模拟原生小程序 UI，验证原生小程序需在微信开发者工具导入 miniprogram/ 目录

  * 此标注不得影响移动端H5页面的正常预览入口（移动H5端卡片保持不变）

  * 浏览器无法运行 WXML 原生小程序，所有小程序页面的在线预览一律采用等效 HTML 副本（frontend/public/\*-preview\.html），并明确标注，禁止让用户误以为在线预览就是原生小程序运行结果

\[预览拉起规则（强制约定）]

* Date: 2026-09-01

* Context: 用户发布"0.3.6-预览规则定义"，强化并替换 0.3.5 的预览拉起规则，要求每次严格执行并保持一致性

* Category: 行为指令

* Instructions:

  * 每次"拉起预览"，必须提供整个系统的完整预览入口，而不是单个页面的预览；必须严格保持每次一致，禁止变更端口或入口

  * 端口固定：前端一律走 3000（frontend 开发服务器，cd /workspace/frontend && npx vite --host 0.0.0.0），后端一律走 3001（cd /workspace/backend && node src/app.js）

  * 每次拉起预览必须**同时启动后端服务**：后端不在运行时，/api 请求经 vite 代理到 3001 会返回 500 空 body，管理后台报 "Failed to execute 'json' on 'Response': Unexpected end of JSON input"。拉起预览前必须先确认 3001 已运行

  * 预览入口统一从系统入口页开始：前端根路径 <http://localhost:3000/> → frontend/src/pages/entry/index.tsx（EntryPage，小程序端 + 管理后台入口），从该入口页点击进入移动H5端 / 小程序端（等效预览）/ 管理后台等各端卡片

  * 仅在用户明确指定单个页面时才单独拉起该页面；未指定时一律拉系统入口页

\[小程序折线图统一标准与通用组件（强制开发指令）]

* Date: 2026-09-02

* Context: 用户发布"1.2.6/1.2.7/1.2.8-看年级页折线图标准整理及输出"，要求把看年级页折线图（含悬浮卡片）的样式与交互整理成一套统一标准，落成规则，并做成通用组件，后续所有用到折线图的小程序页面一律复用

* Category: 行为指令

* Instructions:

  * **统一复用组件**：所有小程序页面的折线图一律复用 miniprogram/components/trend-line/（通用组件），用法 `<trend-line items="{{[{name,value,max}]}}" />`；禁止各页用 charts.js 自绘折线图或各自实现一套

  * **标准高度**：`.trend-canvas` 宽 100%、高 400rpx、display block；与上下模块的间距由使用方页面控制（如 .trend-canvas margin-top 20rpx）

  * **绘图规范**（charts.js 统一实现）：主色 #14A89A、网格 #E5E6EB、轴文字 #909399、字体 sans-serif；内边距 padL30/padR10/padT18/padB18/padIn26；Y轴缓冲 buffer=ceil(span\*0.3)，yMin/yMax 钳到 [0,∞)；step 按 ySpan(<10→1,<30→2,<60→5,否则10) 并对齐到 step 整数倍；平坦时 (min,max)=(max(0,v-5),v+5)；网格 4 档（0~3）、Y值右对齐 padL-6；面积渐变蒙版 rgba(20,168,154,0.40)→0；折线 lineWidth4 round 连接；数据点白 r4 + 主色描边 2

  * **加载动效**：首次绘制与科目切换均走 charts.animateLineTrend（600ms easeOutCubic）。首帧同步绘制进度0避免空白；用 setTimeout(16ms)（canvas2d 节点的 rAF 部分环境不可靠）保证动效必然走完；折线自左向右渐进绘制、数据点随进度逐点出现

  * **触摸交互**：canvas 绑定 touchstart/move/end/cancel；命中判定 charts.trendIdxFromXY（x 在 [padL-30, w-padR+30] 有效，取最近 xs 下标）；命中调 drawTrendSelected，松手调 drawLineTrend(currentItems) 复位

  * **选中渲染**（drawTrendSelected）：淡绿竖条 rgba(20,168,154,0.1) 柱宽 colW\*0.5 + 主色虚线(6,4)线宽1.5 + 高亮点（外圈 rgba(20,168,154,0.25) r10/白 r7/主色描边线宽4）+ 悬浮卡片

  * **悬浮卡片标准**（drawTrendTooltip，全 rpx 自适应）：两行——第一行考试名；第二行左侧「分数 1 位小数 + / + 满分」、右侧「得分率整数% + %」左右分栏。字号：分数/得分率 44rpx bold、/与%与满分 24rpx、考试名 24rpx bold；颜色：考试名与分数 #1A1A1A、/满分% #909399、得分率数字 #14A89A。容器：白底、圆角 24rpx、投影 rgba(0,0,0,0.15) 模糊40rpx 偏移8rpx、描边 rgba(0,0,0,0.05) 1、内边距 上下26rpx 左右34rpx；考试名与数据行间距 8rpx、组内符号间距 6rpx；位置优先数据点上方留 46rpx，上方放不下(by<8rpx)落下方，水平钳制 [8rpx,w-8rpx]。平坦(yIsFlat)时增高 46rpx，下方加 #E5E6EB 分隔线并输出橙色 #FA8C16 22rpx 文案「各次考试平均分无明显差距」

\[小程序 UI 设计规范（强制开发指令）]

* Date: 2026-08-18

* Context: 用户发布"小程序迭代1.0 前端设计规范约定"，要求后续所有 miniprogram 页面遵守

* Category: 行为指令

* Instructions:

  * 完整规范存档于 miniprogram/DESIGN\_GUIDE.md，所有小程序页面开发前必须读取并遵守；规范十二节的"一句话全局指令前缀"必须作为生成代码的前置约束

  * 全局唯一主色 #14A89A，禁止旧色 #0E9E86 及历史页面的 #1D2129/#86909C/#F1F8F7/#FF6A1A 等自定义色值；背景改 #F0F8F6

  * 全部布局/字体/圆角/间距用 rpx（750rpx=整屏），仅细分割线可用 1px，禁止 px/rem/vw 布局

  * 页面左右边距统一 32rpx，模块间距 40rpx，卡片内 padding 32rpx，子元素间距 24rpx

  * 圆角：大卡/Banner 24rpx、普通卡 20rpx、按钮/输入框 16rpx、标签 12rpx；唯一阴影 0 4rpx 20rpx rgba(20,168,154,0.08)，渐变横幅卡禁阴影

  * 字体层级：大标题 40rpx/600、卡片标题 34rpx/600、列表标题 30rpx/500、正文 28rpx/400、统计数字 48-60rpx/700、标签小字 24rpx/400

  * 全局 page 启用 padding-bottom: env(safe-area-inset-bottom)，禁止写死底部安全区高度

  * 全局通用 class（app.wxss）：card-large/card-normal/btn-primary/tag-green，优先复用

  * 交互：热区最小 88rpx、角标为 0 自动隐藏、空态用 Empty、四宫格 icon 96rpx 文字 26rpx

\[原生小程序改动同步等效预览页（强制开发指令）]

* Date: 2026-09-02

* Context: 用户发布"0.3.8-原生小程序页面改动同步等效预览页"，明确原生小程序与等效预览页的层级关系。用户无法直接查看原生小程序页面效果，只能通过浏览器等效预览页（frontend/public/\*-preview\.html）验证

* Category: 行为指令

* Instructions:

  * **核心开发产物是微信原生小程序**（miniprogram/ 目录，project.config.json 所在根），等效预览页仅用于给用户在浏览器里预览验证效果，不是最终交付物；一切开发以「先完善原生小程序页面」为第一优先级

  * **改动顺序强制规则**：每次对原生小程序页面的内容或样式改动，必须先改好 miniprogram/ 下的原生文件（wxml/wxss/js/json），再同步到对应的小程序等效预览页（frontend/public/\*-preview\.html），且两处必须保持一致；禁止只改预览页而不改原生小程序，也禁止先改预览页再回填原生

  * **同步范围**：所有对原生小程序页面内容（wxml 结构、文案、交互逻辑）或样式（wxss）的改动，都要逐条同步到对应的等效预览页，包括但不限于：status-bar 背景色、page-title 字号/字重、main-tab 字号、卡片边距/边框/圆角、弹窗交互等样式参数

  * 用户需求来自对原生小程序界面效果的预期，等效预览页的渲染效果用于验证原生小程序是否符合预期；若两者不一致，以原生小程序为准修正预览页，而不是反过来

  * 浏览器无法运行 WXML 原生小程序，等效预览页只能是 HTML 副本，不能作为原生小程序运行的替代；交付与验收一律面向 miniprogram/ 原生代码

