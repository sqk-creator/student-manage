const MAIN_COLOR = '#14A89A';
const GRID_COLOR = '#E5E6EB';
const AXIS_COLOR = '#909399';
const FONT_FAMILY = 'sans-serif';
// rpx→px：750rpx = 屏幕宽度。工具提示卡片的所有间距/字号/圆角都按 rpx 规划，随设备宽度自适应。
const _winInfo = typeof wx !== 'undefined' ? (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()) : { windowWidth: 375 };
const RPX = _winInfo.windowWidth / 750;
function rx(v) {
  return v * RPX;
}

function getCanvas(page, id, retry) {
  retry = retry || 0;
  return new Promise((resolve) => {
    wx.createSelectorQuery()
      .in(page)
      .select('#' + id)
      .fields({ node: true, size: true })
      .exec((res) => {
        const node = res && res[0] && res[0].node;
        const w = node ? res[0].width : 0;
        const h = node ? res[0].height : 0;
        if (!node || !w || !h) {
          if (retry < 4) {
            setTimeout(() => resolve(getCanvas(page, id, retry + 1)), 120);
          } else {
            resolve(null);
          }
          return;
        }
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const dpr = info.pixelRatio || 2;
        node.width = w * dpr;
        node.height = h * dpr;
        const ctx = node.getContext('2d');
        // 用 setTransform 替代累积式 scale：同一 canvas 2d 节点多次 getCanvas 时，
        // scale() 会不断放大把图表推向画布外（折线图趋势canvas消失）。改为重置——每次按 dpr 完整重建变换。
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        resolve({ ctx, node, w, h });
      });
  });
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

let _gaugeGeomCache = null;
let _gaugeCacheW = 0;
let _gaugeCacheH = 0;

function drawGauge(ctx, w, h, rate) {
  const cx = w / 2;
  const cy = h - 75;
  const r = Math.min(cx - 24, 96);
  const totalTicks = 32;
  const activeTicks = Math.round((rate || 0) / 100 * totalTicks);
  const tickLen = 10;
  const tickWidth = 5;
  const startAngle = Math.PI + Math.PI / 6;
  const endAngle = -Math.PI / 6;
  const arcSpan = startAngle - endAngle;

  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = 'round';
  // 点阵几何（刻度端点）不随 rate 变化，只算一次并缓存，动画每帧仅重绘，省去三角函数与数组分配
  let geom;
  if (_gaugeGeomCache && _gaugeCacheW === w && _gaugeCacheH === h) {
    geom = _gaugeGeomCache;
  } else {
    geom = [];
    for (let i = 0; i < totalTicks; i++) {
      const angle = startAngle - (i / (totalTicks - 1)) * arcSpan;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const innerR = r - tickLen;
      geom.push([cx + innerR * cos, cy - innerR * sin, cx + r * cos, cy - r * sin]);
    }
    _gaugeGeomCache = geom;
    _gaugeCacheW = w;
    _gaugeCacheH = h;
  }
  for (let j = 0; j < totalTicks; j++) {
    const p = geom[j];
    ctx.lineWidth = tickWidth;
    ctx.strokeStyle = j < activeTicks ? MAIN_COLOR : 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(p[2], p[3]);
    ctx.stroke();
  }
}

function animateGauge({ ctx, node, w, h, targetRate, onFrame, onComplete }) {
  let start = null;
  const duration = 1200;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const frame = (ts) => {
    if (!start) start = ts;
    const elapsed = ts - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(progress);
    const tickRate = targetRate * eased;
    drawGauge(ctx, w, h, tickRate);
    if (onFrame) onFrame(Math.round(targetRate * eased));
    if (progress < 1) {
      node.requestAnimationFrame(frame);
    } else {
      if (onFrame) onFrame(targetRate);
      if (onComplete) onComplete();
    }
  };
  node.requestAnimationFrame(frame);
}

function lineTrendGeom(w, h, items) {
  const padL = 30;
  const padR = 10;
  const padT = 18;
  const padB = 18;
  const values = (items || []).map((it) => Math.round((it.value || 0) * 10) / 10);
  const names = (items || []).map((it) => it.name || '');
  const maxs = (items || []).map((it) => it.max || 0);
  if (!values.length) return null;

  const yMinOrig = Math.min.apply(null, values);
  const yMaxOrig = Math.max.apply(null, values);
  const span = yMaxOrig - yMinOrig;
  const yIsFlat = span === 0;
  let yMin;
  let yMax;
  if (span === 0) {
    yMin = Math.max(0, yMinOrig - 5);
    yMax = yMinOrig + 5;
  } else {
    const buffer = Math.ceil(span * 0.3);
    yMin = Math.max(0, Math.floor(yMinOrig - buffer));
    yMax = Math.ceil(yMaxOrig + buffer);
  }
  let step;
  const ySpan = yMax - yMin;
  if (ySpan < 10) step = 1;
  else if (ySpan < 30) step = 2;
  else if (ySpan < 60) step = 5;
  else step = 10;
  yMin = Math.floor(yMin / step) * step;
  yMax = Math.ceil(yMax / step) * step;

  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const padIn = 26;
  const innerW = chartW - padIn * 2;
  const xs = values.map((_, i) =>
    values.length > 1 ? padL + padIn + (i / (values.length - 1)) * innerW : padL + chartW / 2
  );
  const ys = values.map((v) => padT + (yMax - v) / (yMax - yMin) * chartH);

  return {
    w,
    h,
    padL,
    padR,
    padT,
    padB,
    padIn,
    chartW,
    chartH,
    innerW,
    values,
    names,
    maxs,
    yMin,
    yMax,
    step,
    yIsFlat,
    xs,
    ys
  };
}

function drawTrendLayer(ctx, w, h, g, prog) {
  ctx.clearRect(0, 0, w, h);
  if (!g || !g.xs || !g.xs.length) return;
  const { padL, padR, padT, chartH, yMax, yMin, xs, ys } = g;

  ctx.font = '11px ' + FONT_FAMILY;
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.fillStyle = AXIS_COLOR;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 3; i++) {
    const gy = padT + i * (chartH / 3);
    const gv = yMax - i * ((yMax - yMin) / 3);
    ctx.beginPath();
    ctx.moveTo(padL, gy);
    ctx.lineTo(w - padR, gy);
    ctx.stroke();
    ctx.fillText(Math.round(gv), padL - 6, gy);
  }

  const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  grad.addColorStop(0, 'rgba(20,168,154,0.40)');
  grad.addColorStop(1, 'rgba(20,168,154,0)');
  ctx.beginPath();
  ctx.moveTo(xs[0], padT + chartH);
  xs.forEach((x, i) => ctx.lineTo(x, ys[i]));
  ctx.lineTo(xs[xs.length - 1], padT + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // 折线按进度渐进绘制
  const n = xs.length;
  const done = Math.max(0, Math.min(1, prog == null ? 1 : prog)) * (n - 1);
  const lastSeg = Math.floor(done);
  ctx.beginPath();
  for (let i = 0; i <= lastSeg; i++) {
    if (i === 0) ctx.moveTo(xs[i], ys[i]);
    else ctx.lineTo(xs[i], ys[i]);
  }
  if (lastSeg < n - 1) {
    const frac = done - lastSeg;
    ctx.lineTo(
      xs[lastSeg] + (xs[lastSeg + 1] - xs[lastSeg]) * frac,
      ys[lastSeg] + (ys[lastSeg + 1] - ys[lastSeg]) * frac
    );
  }
  ctx.strokeStyle = MAIN_COLOR;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // 数据点：默认白色圆缩小
  for (let i = 0; i < n; i++) {
    if (i > done) break;
    ctx.beginPath();
    ctx.arc(xs[i], ys[i], 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = MAIN_COLOR;
    ctx.stroke();
  }
}

function drawTrendBase(ctx, w, h, g) {
  drawTrendLayer(ctx, w, h, g, 1);
}

function animateLineTrend(ctx, node, w, h, items, cb) {
  const g = lineTrendGeom(w, h, items);
  if (!g) {
    if (cb) cb(g);
    return g;
  }
  const duration = 600;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const start = Date.now();
  // 首帧同步绘制，保证页面加载时画布立即有内容（即使后续定时器被节流也能看到网格与起点）
  drawTrendLayer(ctx, w, h, g, 0);
  const tick = () => {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    drawTrendLayer(ctx, w, h, g, easeOutCubic(progress));
    if (progress < 1) {
      // 用 setTimeout 驱动动画：canvas 2d 节点的 requestAnimationFrame 在部分环境不可靠，
      // 会导致页面加载时折线图一直不显示、仅交互后才绘制。改用定时器保证动画必然走完。
      setTimeout(tick, 16);
    } else if (cb) {
      cb(g);
    }
  };
  setTimeout(tick, 16);
  return g;
}

function textWidth(ctx, str, fallback) {
  try {
    return ctx.measureText(str).width;
  } catch (e) {
    return fallback || 0;
  }
}

function drawLineTrend(ctx, w, h, items) {
  const g = lineTrendGeom(w, h, items);
  drawTrendBase(ctx, w, h, g);
  return g;
}

// 折线图命中索引：根据触摸坐标返回最近数据点下标（折线图统一交互命中判定）
function trendIdxFromXY(g, x, y) {
  if (!g || !g.xs || !g.xs.length) return -1;
  if (x < g.padL - 30 || x > g.w - g.padR + 30) return -1;
  let best = 0;
  let bd = Infinity;
  g.xs.forEach((v, i) => {
    const d = Math.abs(v - x);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

function drawTrendSelected(ctx, w, h, g, idx) {
  drawTrendBase(ctx, w, h, g);
  if (!g || idx == null || idx < 0 || idx >= g.xs.length) return;
  const x = g.xs[idx];
  const y = g.ys[idx];
  const colW = g.xs.length > 1 ? g.chartW / (g.xs.length - 1) : g.chartW;
  const maskW = colW * 0.5;

  ctx.fillStyle = 'rgba(20,168,154,0.1)';
  ctx.fillRect(x - maskW / 2, g.padT, maskW, g.chartH);

  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = MAIN_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, g.padT);
  ctx.lineTo(x, g.padT + g.chartH);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20,168,154,0.25)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = MAIN_COLOR;
  ctx.stroke();

  drawTrendTooltip(ctx, w, h, g, idx);
}

function drawTrendTooltip(ctx, w, h, g, idx) {
  const name = g.names[idx] || '';
  const val = g.values[idx];
  const maxV = g.maxs[idx] || 0;
  const rate = maxV > 0 ? Math.round(val / maxV * 100) : 0;
  const x = g.xs[idx];
  const y = g.ys[idx];

  // 全部尺寸改为 rpx（经 rx 换成 px），随设备宽度自适应
  const valueFont = rx(44); // 分数/得分率 大字号
  const pctFont = rx(24);   // "%" / "/" / 满分 小字号
  const nameFont = rx(24);  // 考试名
  ctx.font = 'bold ' + valueFont + 'px ' + FONT_FAMILY;
  const valW = textWidth(ctx, val.toFixed(1), rx(86));
  const rateW = textWidth(ctx, String(rate), rx(64));
  ctx.font = valueFont + 'px ' + FONT_FAMILY;
  const slashW = textWidth(ctx, '/', rx(20));
  const maxW = maxV > 0 ? textWidth(ctx, String(maxV), rx(46)) : 0;
  ctx.font = pctFont + 'px ' + FONT_FAMILY;
  const pctW = textWidth(ctx, '%', rx(18));
  ctx.font = 'bold ' + nameFont + 'px ' + FONT_FAMILY;
  const nameW = textWidth(ctx, name, name.length * rx(24));

  const padT = rx(26); // 卡片 padding-top
  const padB = rx(26); // 卡片 padding-bottom（与 padT 一致）
  const contentPad = rx(34);
  const symGap = rx(6); // "/" 与左右、以及 "%" 与左侧得分率 统一间距 (rpx)
  const rowGap = rx(8); // 第一行(考试名)与第二行(得分)间距，已缩小 (rpx)
  const radius = rx(24); // 卡片圆角 (rpx)
  const nameRowH = nameFont + rx(6);
  const valueRowH = valueFont + rx(6);
  const boxH = padT + nameRowH + rowGap + valueRowH + padB + (g.yIsFlat ? rx(46) : 0);

  const leftBlockW = valW + symGap + slashW + symGap + maxW;
  const rightBlockW = rateW + symGap + pctW;
  const valueLineW = leftBlockW + rightBlockW;
  const boxW = Math.max(nameW, valueLineW) + contentPad * 2;

  // 卡片位置：优先放上方，放不下则放下方，均与数据点保持间距，避免遮住数据点
  const gapP = rx(46);
  let by = y - boxH - gapP;
  if (by < rx(8)) by = Math.min(y + gapP, h - boxH - rx(8));
  const bx = Math.max(rx(8), Math.min(x - boxW / 2, w - boxW - rx(8)));

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = rx(40);
  ctx.shadowOffsetY = rx(8);
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, bx, by, boxW, boxH, radius);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 1;
  roundRectPath(ctx, bx, by, boxW, boxH, radius);
  ctx.stroke();

  // 第一行：考试名
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#1A1A1A';
  ctx.font = 'bold ' + nameFont + 'px ' + FONT_FAMILY;
  ctx.fillText(name, bx + contentPad, by + padT);

  // 第二行：分数 + /满分 + 得分率%（同行、底部对齐、组间间距与 "%" 一致）
  const valueTop = by + padT + nameRowH + rowGap;
  // 以分数大字的底部为公共基线，使小数号元素与各自左侧数值底部对齐
  const valueBase = valueTop + valueFont;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  // 左侧：分数（大字）
  ctx.font = 'bold ' + valueFont + 'px ' + FONT_FAMILY;
  ctx.fillStyle = '#1A1A1A';
  ctx.fillText(val.toFixed(1), bx + contentPad, valueBase);
  // "/满分取值"：与左侧分数、右侧满分之间均保留 symGap 间距
  let curX = bx + contentPad + valW + symGap;
  ctx.font = pctFont + 'px ' + FONT_FAMILY;
  ctx.fillStyle = AXIS_COLOR;
  ctx.fillText('/', curX, valueBase);
  curX += slashW + symGap;
  if (maxV > 0) {
    ctx.fillText(String(maxV), curX, valueBase);
  }
  // 右侧：得分率（大字，居右）+ "%"（小字，紧贴且与左侧得分率间距为 symGap）
  const rightX = bx + boxW - contentPad;
  ctx.textAlign = 'right';
  ctx.font = 'bold ' + valueFont + 'px ' + FONT_FAMILY;
  ctx.fillStyle = MAIN_COLOR;
  ctx.fillText(String(rate), rightX - symGap - pctW, valueBase);
  ctx.font = pctFont + 'px ' + FONT_FAMILY;
  ctx.fillStyle = AXIS_COLOR;
  ctx.fillText('%', rightX, valueBase);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  if (g.yIsFlat) {
    const hy = valueTop + valueRowH + rx(6);
    ctx.setLineDash([1, 0]);
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + contentPad, hy);
    ctx.lineTo(bx + boxW - contentPad, hy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#FA8C16';
    ctx.font = rx(22) + 'px ' + FONT_FAMILY;
    ctx.fillText('各次考试平均分无明显差距', bx + contentPad, hy + rx(6));
  }
}

function niceMax(v) {
  if (v <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const unit = v / pow;
  let n;
  if (unit <= 1) n = 1;
  else if (unit <= 2) n = 2;
  else if (unit <= 5) n = 5;
  else n = 10;
  return n * pow;
}

// 圆角路径：可单独控制四个角的圆角（corners: {tl,tr,br,bl} 布尔）
function roundRectCorners(ctx, x, y, w, h, r, c) {
  r = Math.min(r, w / 2, h / 2);
  const tl = c && c.tl ? r : 0;
  const tr = c && c.tr ? r : 0;
  const br = c && c.br ? r : 0;
  const bl = c && c.bl ? r : 0;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  if (tr > 0) {
    ctx.lineTo(x + w - tr, y);
    ctx.arcTo(x + w, y, x + w, y + tr, tr);
  } else {
    ctx.lineTo(x + w, y);
  }
  if (br > 0) {
    ctx.lineTo(x + w, y + h - br);
    ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  } else {
    ctx.lineTo(x + w, y + h);
  }
  if (bl > 0) {
    ctx.lineTo(x + bl, y + h);
    ctx.arcTo(x, y + h, x, y + h - bl, bl);
  } else {
    ctx.lineTo(x, y + h);
  }
  if (tl > 0) {
    ctx.lineTo(x, y + tl);
    ctx.arcTo(x, y, x + tl, y, tl);
  } else {
    ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawHistogram(ctx, w, h, data, opts) {
  ctx.clearRect(0, 0, w, h);
  const xAxis = (data && data.xAxis) || [];
  const series = (data && data.series) || [];
  if (!xAxis.length || !series.length) return;
  const stack = !!(opts && opts.stack);
  const padL = 30; // 与折线图 trend-canvas 的 padL 保持一致
  const padR = 14;
  const padT = 15; // 减小顶部留白
  const padB = 40; // 为斜向标签预留空间
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  let maxV = 0;
  xAxis.forEach((_, i) => {
    let sum = 0;
    series.forEach((s) => {
      const v = s.data[i] || 0;
      if (stack) sum += v;
      else if (v > maxV) maxV = v;
    });
    if (sum > maxV) maxV = sum;
  });
  const yMax = niceMax(maxV);

  // Y 轴网格：细分间距，压缩顶部空白；Y轴数值右对齐贴齐折线图同款间距（padL-6）
  const gridNum = 4;
  ctx.font = '11px ' + FONT_FAMILY;
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.fillStyle = '#909399';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= gridNum; i++) {
    const gy = padT + i * (chartH / gridNum);
    const gv = yMax - i * (yMax / gridNum);
    ctx.beginPath();
    ctx.moveTo(padL, gy);
    ctx.lineTo(w - padR, gy);
    ctx.stroke();
    ctx.fillText(Math.round(gv), padL - 6, gy);
  }

  const slotW = chartW / xAxis.length;
  const barW = Math.max(6, Math.min(slotW * 0.55, stack ? slotW * 0.5 : slotW * 0.4));

  xAxis.forEach((_, i) => {
    const cx = padL + slotW * i + slotW / 2;
    if (stack) {
      let accY = padT + chartH;
      const n = series.length;
      const visibleCount = series.reduce((c, s) => c + (((s.data[i] || 0) > 0) ? 1 : 0), 0);
      series.forEach((s, j) => {
        const v = s.data[i] || 0;
        if (!(v > 0)) return; // 无数据分段不绘制
        const bh = v / yMax * chartH;
        const by = accY - bh;
        ctx.fillStyle = s.color || MAIN_COLOR;
        if (n > 1 && visibleCount > 1) {
          // 双分柱平滑衔接：下柱上两角平、上柱下两角平，上柱上两角保持圆角
          const isTop = j === n - 1;
          const isBottom = j === 0;
          roundRectCorners(ctx, cx - barW / 2, by, barW, bh, 3, {
            tl: isTop,
            tr: isTop,
            br: isBottom,
            bl: isBottom
          });
          ctx.fill();
        } else {
          // 仅一根分柱（如只有良好）：柱子左上、右上保持圆角
          roundRectCorners(ctx, cx - barW / 2, by, barW, bh, 3, {
            tl: true,
            tr: true,
            br: false,
            bl: false
          });
          ctx.fill();
        }
        ctx.fillStyle = '#909399';
        ctx.font = '10px ' + FONT_FAMILY;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(v), cx, by - 2);
        ctx.font = '11px ' + FONT_FAMILY;
        accY = by;
      });
    } else {
      const v = series[0].data[i] || 0;
      const bh = v / yMax * chartH;
      const by = padT + chartH - bh;
      ctx.fillStyle = series[0].color || MAIN_COLOR;
      roundRectPath(ctx, cx - barW / 2, by, barW, bh, 3);
      ctx.fill();
      ctx.fillStyle = '#909399';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(v), cx, by - 2);
    }

    // X 轴标签：斜向展示，避免重叠
    let label = xAxis[i] || '';
    if (label.length > 3) label = label.slice(0, 3);
    ctx.save();
    ctx.translate(cx, h - padB + 10);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#909399';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = '10px ' + FONT_FAMILY;
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });
}

function drawSparkline(ctx, w, h, trend) {
  ctx.clearRect(0, 0, w, h);
  const data = trend || [];
  if (!data.length) return;
  const min = Math.min.apply(null, data);
  const max = Math.max.apply(null, data);
  const span = max - min || 1;
  const padX = 4;
  const padTop = 4;
  const padBottom = 14;
  const xs = data.map((_, i) =>
    data.length > 1 ? padX + i * (w - 2 * padX) / (data.length - 1) : w / 2
  );
  const ys = data.map((v) => padTop + (max - v) / span * (h - padTop - padBottom));

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(20,168,154,0.45)');
  grad.addColorStop(1, 'rgba(20,168,154,0)');
  ctx.beginPath();
  ctx.moveTo(xs[0], h);
  xs.forEach((x, i) => ctx.lineTo(x, ys[i]));
  ctx.lineTo(xs[xs.length - 1], h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  xs.forEach((x, i) => (i === 0 ? ctx.moveTo(x, ys[i]) : ctx.lineTo(x, ys[i])));
  ctx.strokeStyle = MAIN_COLOR;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function radarGeom(w, h, items) {
  const list = (items || []).filter((it) => it.max > 0);
  if (!list.length) return null;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2 - 36;
  const count = list.length;
  const standards = list.map((it) =>
    it.max > 0 && it.value != null
      ? Math.round(it.value / it.max * 100 * 10) / 10
      : 0
  );
  const step = (2 * Math.PI) / count;
  const angs = list.map((_, i) => -Math.PI / 2 + i * step);
  const axes = list.map((_, i) => ({
    ang: angs[i],
    x: cx + Math.cos(angs[i]) * r,
    y: cy - Math.sin(angs[i]) * r
  }));
  const namePts = list.map((_, i) => ({
    x: cx + Math.cos(angs[i]) * (r + 28),
    y: cy - Math.sin(angs[i]) * (r + 28)
  }));
  const dataPts = standards.map((s, i) => ({
    x: cx + Math.cos(angs[i]) * r * s / 100,
    y: cy - Math.sin(angs[i]) * r * s / 100
  }));
  return { cx, cy, r, count, standards, list, angs, axes, namePts, dataPts };
}

function drawRadarBase(ctx, w, h, g) {
  ctx.clearRect(0, 0, w, h);
  if (!g) return;
  const { cx, cy, r, count, angs, axes, standards, list, namePts, dataPts } = g;
  const split = 5;

  for (let k = split; k >= 1; k--) {
    const rr = r * k / split;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const x = cx + Math.cos(angs[i]) * rr;
      const y = cy - Math.sin(angs[i]) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = k % 2 === 1 ? '#ffffff' : '#F7F8FA';
    ctx.fill();
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  axes.forEach((a) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(a.x, a.y);
    ctx.stroke();
  });

  const grad = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  grad.addColorStop(0, 'rgba(20,168,154,0.40)');
  grad.addColorStop(1, 'rgba(20,168,154,0.05)');
  ctx.beginPath();
  dataPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  dataPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.strokeStyle = MAIN_COLOR;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  dataPts.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = MAIN_COLOR;
    ctx.stroke();
  });

  ctx.font = '14px ' + FONT_FAMILY;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1A1A1A';
  namePts.forEach((p, i) => {
    ctx.fillText(list[i].name, p.x, p.y);
  });
}

function drawRadar(ctx, w, h, items) {
  const g = radarGeom(w, h, items);
  drawRadarBase(ctx, w, h, g);
  return g;
}

function drawRadarSelected(ctx, w, h, g, idx) {
  drawRadarBase(ctx, w, h, g);
  if (!g || idx == null || idx < 0 || idx >= g.count) return;
  const a = g.axes[idx];
  const np = g.namePts[idx];

  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = MAIN_COLOR;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(g.cx, g.cy);
  ctx.lineTo(a.x, a.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.save();
  ctx.shadowColor = 'rgba(20,168,154,0.55)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = MAIN_COLOR;
  ctx.font = 'bold 18px ' + FONT_FAMILY;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(g.list[idx].name, np.x, np.y);
  ctx.restore();

  const it = g.list[idx];
  const std = g.standards[idx];
  const orig = Math.round((it.value || 0) * 10) / 10;
  ctx.font = 'bold 13px ' + FONT_FAMILY;
  const nameW = textWidth(ctx, it.name, it.name.length * 13);
  ctx.font = '13px ' + FONT_FAMILY;
  const w1 = textWidth(ctx, '原始分数 000.0分', 92);
  const w2 = textWidth(ctx, '标准分 000.0', 74);
  const rowW = Math.max(w1, w2);
  const boxW = Math.max(nameW + 4, rowW) + 36;
  const boxH = 76;
  let bx = a.x + 14;
  if (bx + boxW > w - 8) bx = Math.max(8, a.x - 14 - boxW);
  let by = a.y + 14;
  if (by + boxH > h - 8) by = Math.max(8, a.y - boxH - 14);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, bx, by, boxW, boxH, 12);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  roundRectPath(ctx, bx, by, boxW, boxH, 12);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#1A1A1A';
  ctx.font = 'bold 13px ' + FONT_FAMILY;
  ctx.fillText(it.name, bx + 18, by + 14);
  ctx.font = '13px ' + FONT_FAMILY;
  ctx.fillStyle = '#909399';
  ctx.fillText('原始分数', bx + 18, by + 44);
  ctx.fillText('标准分', bx + 18, by + 64);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#1A1A1A';
  ctx.fillText(orig + '分', bx + boxW - 18, by + 44);
  ctx.fillStyle = MAIN_COLOR;
  ctx.fillText(String(std), bx + boxW - 18, by + 64);
  ctx.textAlign = 'left';
}

function radarIdxFromXY(g, x, y) {
  if (!g) return -1;
  const dx = x - g.cx;
  const dy = y - g.cy;
  if (Math.sqrt(dx * dx + dy * dy) > g.r + 44) return -1;
  const step = 360 / g.count;
  const deg = ((Math.atan2(dy, dx) * 180 / Math.PI) + 90 + 360) % 360;
  return Math.round(deg / step) % g.count;
}

module.exports = {
  getCanvas,
  drawGauge,
  animateGauge,
  drawLineTrend,
  animateLineTrend,
  drawTrendSelected,
  trendIdxFromXY,
  drawHistogram,
  drawSparkline,
  drawRadar,
  drawRadarSelected,
  radarIdxFromXY
};
