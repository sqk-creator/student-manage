# 用户指令记忆

本文件记录了用户的指令、偏好和教导，用于在未来的交互中提供参考。

## 格式

### 用户指令条目
[用户指令摘要]
- Date: [YYYY-MM-DD]
- Context: [提及的场景或时间]
- Instructions:
  - [用户教导或指示的内容，逐行描述]

### 项目知识条目
[项目知识摘要]
- Date: [YYYY-MM-DD]
- Context: Agent 在执行 [具体任务描述] 时发现
- Category: [运维部署|构建方法|测试方法|排错调试|工作流协作|环境配置]
- Instructions:
  - [具体的知识点，逐行描述]

## 去重策略
- 添加新条目前，检查是否存在相似或相同的指令
- 若发现重复，跳过新条目或与已有条目合并
- 合并时，更新上下文或日期信息
- 这有助于避免冗余条目，保持记忆文件整洁

## 条目

[前端浏览器实测环境与方法]
- Date: 2026-08-16
- Context: Agent 在执行照片批量绑定、圆环进度条平滑化等功能的浏览器实测时发现
- Category: 测试方法
- Instructions:
  - 浏览器实测统一用 headless 方式：puppeteer-core 装在 /tmp/opencode/echarts-test/node_modules，executablePath=/usr/bin/chromium-headless-shell，headless:true + --no-sandbox --disable-dev-shm-usage
  - headless 截图 devicePixelRatio 恒为 1；viewport 加宽时页面容器居中，svg 的 getBoundingClientRect() 会整体平移（如 1260px 宽时 svg x=480），采样坐标必须先用 evaluate 取真实 rect
  - **headless 的 SVG clipPath 对 stroke 路径不可靠**：clipPath 内 line/path 的 stroke 宽度被当作无面积区域，内容会被整体裁掉；改用 <mask>（像素 alpha）才可靠，但 mask 中弧线 stroke 的 linecap 渲染也不稳定（butt 也等效圆头，会在起点外多画 6-8°）
  - 环形进度条最终可靠方案：180 段（每段 2°）完整绘制 + 每段 stroke-dasharray 控制可见长度 + butt 平头 + 段尾重叠 ov=0.2° 无缝衔接，渐变方向突变小到不可见（48 段/7.5° 仍可见"一段段"折痕）；路径需延长 tail=8° 以容纳端点 cap，dash 间隔基准用 g.L=g.lt+tail 弧长
  - **headless 弧线 round linecap 有位置 bug**：弧位于下半圆（起点 sin>0，约 45°~225°）时两端 cap 都不渲染，sweep/大弧标志无法规避；dash 段终点 cap 在短 dash 时更不可靠。上半圆弧与直线 cap 正常
  - 末端圆头最终方案：`<circle class="ring-prog-cap">` 置于进度 g 内但**在进度段之前**（下层），圆心=带末端点 ringPointAt(RING_MAIN,ang)，r=带宽/2，fill=progColor((ang+90)/360)；上半圆被带覆盖，仅露出凸出半圆=唯一圆头，颜色与带末端同色无缝；180° 弧半圆 fill（A..Z 弓形）在 headless 渲染有洞，不可用
  - 进度带同心剖面采样坐标（CSS 像素）：x=cx+rr·s·cos(ang)，y=cy+(121/110)·rr·s·sin(ang)，rr 为 SVG 剖面半径（中心线 110），s=300/336；曾用未乘 s 的 rr 采样导致采到弧带外误判出"白色缝隙"假象
  - 管理后台登录用 POST /api/auth/login body={code:'test'} 取 token，再注入 localStorage 后 reload 页面进入受保护路由
  - 后端/前端服务必须分别用 background terminal 启动（后端 cd /workspace/backend && node src/app.js 端口 3001；前端 cd /workspace/frontend && npx vite --host 0.0.0.0 端口 3000），改 vite.config.ts 后必须重启 vite 才生效
  - 系统测试数据：学生学号"001"（吴海峰）、教师王梅（id=6）可设工号用于照片匹配测试；生成测试图片可用后端 sharp 或 adm-zip

[小程序端环境配置与调试]
- Date: 2026-08-18
- Context: Agent 将移动H5首页复刻为微信小程序（miniprogram/ 目录）时发现
- Category: 环境配置
- Instructions:
  - miniprogram/ 为微信原生小程序端，项目根为 miniprogram/（project.config.json 在此），导入微信开发者工具时选择该目录
  - API base URL 在 miniprogram/config/index.js 的 BASE_URL（默认 http://localhost:3001）；开发者工具需勾选"不校验合法域名"才能访问 http，真机预览需改为局域网 IP 或 HTTPS 域名
  - 无登录态：用户信息（陈小武）、teacher_id=2、角标数量均硬编码在 miniprogram/config/index.js（USER/BADGE），后续接微信登录时替换
  - 首页依赖 4 个接口：/api/banners/enabled、/api/feature-cards/enabled、/api/public/classes?teacher_id=2、/api/public/attendance-summary，返回字段与 index.js 解析字段一一对应

[小程序等效预览入口标注（强制约定）]
- Date: 2026-08-18
- Context: 用户发布"小程序迭代1.2.4"，要求点击访问小程序端的预览入口必须明确标注"小程序等效预览"
- Category: 行为指令
- Instructions:
  - 预览环境（frontend/src/pages/entry/index.tsx）的小程序端入口卡片必须明确标注"小程序等效预览"，说明其为浏览器环境用 HTML 模拟原生小程序 UI，验证原生小程序需在微信开发者工具导入 miniprogram/ 目录
  - 此标注不得影响移动端H5页面的正常预览入口（移动H5端卡片保持不变）
  - 浏览器无法运行 WXML 原生小程序，所有小程序页面的在线预览一律采用等效 HTML 副本（frontend/public/*-preview.html），并明确标注，禁止让用户误以为在线预览就是原生小程序运行结果

[小程序 UI 设计规范（强制开发指令）]
- Date: 2026-08-18
- Context: 用户发布"小程序迭代1.0 前端设计规范约定"，要求后续所有 miniprogram 页面遵守
- Category: 行为指令
- Instructions:
  - 完整规范存档于 miniprogram/DESIGN_GUIDE.md，所有小程序页面开发前必须读取并遵守；规范十二节的"一句话全局指令前缀"必须作为生成代码的前置约束
  - 全局唯一主色 #14A89A，禁止旧色 #0E9E86 及历史页面的 #1D2129/#86909C/#F1F8F7/#FF6A1A 等自定义色值；背景改 #F0F8F6
  - 全部布局/字体/圆角/间距用 rpx（750rpx=整屏），仅细分割线可用 1px，禁止 px/rem/vw 布局
  - 页面左右边距统一 32rpx，模块间距 40rpx，卡片内 padding 32rpx，子元素间距 24rpx
  - 圆角：大卡/Banner 24rpx、普通卡 20rpx、按钮/输入框 16rpx、标签 12rpx；唯一阴影 0 4rpx 20rpx rgba(20,168,154,0.08)，渐变横幅卡禁阴影
  - 字体层级：大标题 40rpx/600、卡片标题 34rpx/600、列表标题 30rpx/500、正文 28rpx/400、统计数字 48-60rpx/700、标签小字 24rpx/400
  - 全局 page 启用 padding-bottom: env(safe-area-inset-bottom)，禁止写死底部安全区高度
  - 全局通用 class（app.wxss）：card-large/card-normal/btn-primary/tag-green，优先复用
  - 交互：热区最小 88rpx、角标为 0 自动隐藏、空态用 Empty、四宫格 icon 96rpx 文字 26rpx
