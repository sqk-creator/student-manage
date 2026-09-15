/**
 * 等效预览端公共折线图组件（浏览器版 trend-line，标准可导入组件）
 * 与微信小程序 miniprogram/components/trend-line 语义完全对齐（双端通用化标准）。
 *
 * 对外 props：
 *  - series:       Array<{name?,value,max?}> 标准化数据点
 *  - xAxisData:    string[]  X 轴刻度名（优先级高于 series[].name）
 *  - chartTitle:   string   图表标题（空则不显示）
 *  - primaryColor: string   主题色（折线/高亮/tooltip 强调色统一引用；未传兜底 #14A89A）
 *  - items:        Array<{name,value,max}>  旧版数据入参（兼容存量页面，与 series 互斥，series 优先）
 *
 * 底层布局约束（grid/boundaryGap/tooltip 偏移）全部收敛在本组件内，业务调用方不可覆盖。
 * 内存管理：监听 mousemove/touch 时创建实例，组件卸载时 unbind 事件、取消动画定时器、释放引用。
 */
import React, { useEffect, useRef } from 'react';
import './index.css';

const DEFAULT_COLOR = '#14A89A';

// #14A89A → '20,168,154'，供主色衍生半透明色（渐变/高亮蒙版等）使用。
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '20,168,154'; // 兜底主色 #14A89A
  const n = parseInt(m[1], 16);
  return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
}

// ---- 画布获取/DPR（每次宽高重置会重置变换，故 scale 不会累积） ----
function getCtx(cvs) {
  if (!cvs) return null;
  var dpr = window.devicePixelRatio || 1;
  var rect = cvs.getBoundingClientRect();
  cvs.width = rect.width * dpr;
  cvs.height = rect.height * dpr;
  var ctx = cvs.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx: ctx, w: rect.width, h: rect.height };
}

// ---- 圆角路径 ----
function roundRectPath(ctx, x, y, w, h, r) {
  var rr = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// 主色解析：写入 g.color/g.cRgb，供系列线条/高亮/tooltip 强调统一引用。
function resolveTrendColor(g, color) {
  var c = color || (g && g.color) || DEFAULT_COLOR;
  if (g) { g.color = c; g.cRgb = hexToRgb(c); }
  return c;
}

// ---- 几何基准（含 boundaryGap 数组留白，首末数据点距左右缘等距且不贴画布边界） ----
function lineTrendGeom(w, h, items, color) {
  // 坐标轴留白：padL/padR；首末数据点再缩进 boundaryGap[l]/boundaryGap[r]，对称相等、不贴解析放。
  var padL = 20, padR = 20, padT = 18, padB = 18;
  // boundaryGap 数组语义：boundaryGap[0]=左留白，boundaryGap[1]=右留白，默认相等（禁止布尔）。布局收敛在组件内。
  var boundaryGap = [26, 26];
  var padInL = boundaryGap[0], padInR = boundaryGap[1];
  var values = (items || []).map(function (it) { return Math.round((it.value || 0) * 10) / 10; });
  if (!values.length) return null;
  var yMinOrig = Math.min.apply(null, values), yMaxOrig = Math.max.apply(null, values);
  var span = yMaxOrig - yMinOrig;
  var yIsFlat = span === 0, yMin, yMax;
  if (span === 0) { yMin = Math.max(0, yMinOrig - 5); yMax = yMinOrig + 5; }
  else {
    var buffer = Math.ceil(span * 0.3);
    yMin = Math.max(0, Math.floor(yMinOrig - buffer));
    yMax = Math.ceil(yMaxOrig + buffer);
  }
  var step, ySpan = yMax - yMin;
  if (ySpan < 10) step = 1; else if (ySpan < 30) step = 2; else if (ySpan < 60) step = 5; else step = 10;
  yMin = Math.floor(yMin / step) * step;
  yMax = Math.ceil(yMax / step) * step;
  var chartW = w - padL - padR, chartH = h - padT - padB;
  var innerW = chartW - padInL - padInR;
  var xs = values.map(function (_, i) {
    return values.length > 1 ? padL + padInL + i * (innerW / (values.length - 1)) : padL + chartW / 2;
  });
  var ys = values.map(function (v) { return padT + (yMax - v) / (yMax - yMin) * chartH; });
  var g = {
    w: w, h: h, padL: padL, padR: padR, padT: padT, padB: padB,
    padInL: padInL, padInR: padInR, boundaryGap: boundaryGap,
    chartW: chartW, chartH: chartH, innerW: innerW,
    values: values,
    names: (items || []).map(function (it) { return it.name || ''; }),
    maxs: (items || []).map(function (it) { return it.max || 0; }),
    yMin: yMin, yMax: yMax, step: step, yIsFlat: yIsFlat, xs: xs, ys: ys
  };
  resolveTrendColor(g, color);
  return g;
}

// ---- 单帧绘制：渐变区域整块先呈现，折线按 prog 渐进 ----
function drawTrendLayer(ctx, w, h, g, prog, color) {
  ctx.clearRect(0, 0, w, h);
  if (!g || !g.xs || !g.xs.length) return;
  var c = resolveTrendColor(g, color), cRgb = g.cRgb;
  var i, gy, gv;
  ctx.font = '11px sans-serif';
  ctx.strokeStyle = '#E5E6EB'; ctx.lineWidth = 1;
  ctx.fillStyle = '#909399'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (i = 0; i <= 3; i++) {
    gy = g.padT + i * (g.chartH / 3);
    gv = g.yMax - i * ((g.yMax - g.yMin) / 3);
    ctx.beginPath(); ctx.moveTo(g.padL, gy); ctx.lineTo(w - g.padR, gy); ctx.stroke();
    ctx.fillText(Math.round(gv), g.padL - 6, gy);
  }
  var grad = ctx.createLinearGradient(0, g.padT, 0, g.padT + g.chartH);
  grad.addColorStop(0, 'rgba(' + cRgb + ',0.40)');
  grad.addColorStop(1, 'rgba(' + cRgb + ',0)');
  ctx.beginPath(); ctx.moveTo(g.xs[0], g.padT + g.chartH);
  g.xs.forEach(function (x, j) { ctx.lineTo(x, g.ys[j]); });
  ctx.lineTo(g.xs[g.xs.length - 1], g.padT + g.chartH); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  var n = g.xs.length;
  var done = Math.max(0, Math.min(1, prog == null ? 1 : prog)) * (n - 1);
  var lastSeg = Math.floor(done);
  ctx.beginPath();
  for (i = 0; i <= lastSeg; i++) { i === 0 ? ctx.moveTo(g.xs[i], g.ys[i]) : ctx.lineTo(g.xs[i], g.ys[i]); }
  if (lastSeg < n - 1) {
    var frac = done - lastSeg;
    ctx.lineTo(g.xs[lastSeg] + (g.xs[lastSeg + 1] - g.xs[lastSeg]) * frac, g.ys[lastSeg] + (g.ys[lastSeg + 1] - g.ys[lastSeg]) * frac);
  }
  ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
  for (i = 0; i < n; i++) {
    if (i > done) break;
    ctx.beginPath(); ctx.arc(g.xs[i], g.ys[i], 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = c; ctx.stroke();
  }
}

function drawTrendBase(ctx, w, h, g) { drawTrendLayer(ctx, w, h, g, 1); }

function drawTrendSelected(ctx, w, h, g, idx) {
  drawTrendBase(ctx, w, h, g);
  if (!g || idx == null || idx < 0 || idx >= g.xs.length) return;
  var c = resolveTrendColor(g, g.color), cRgb = g.cRgb;
  var x = g.xs[idx], y = g.ys[idx];
  var colW = g.xs.length > 1 ? g.chartW / (g.xs.length - 1) : g.chartW;
  var maskW = colW * 0.5;
  ctx.fillStyle = 'rgba(' + cRgb + ',0.1)';
  ctx.fillRect(x - maskW / 2, g.padT, maskW, g.chartH);
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = c; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, g.padT); ctx.lineTo(x, g.padT + g.chartH); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(' + cRgb + ',0.25)'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = c; ctx.stroke();
  drawTrendTooltip(ctx, w, h, g, idx, c);
}

function textWidth(ctx, str, fb) { try { return ctx.measureText(str).width; } catch (e) { return fb || 0; } }

// ---- 悬浮卡片（rpx 自适应，上方优先） ----
function drawTrendTooltip(ctx, w, h, g, idx, color) {
  var c = resolveTrendColor(g, color);
  var name = g.names[idx] || '', val = g.values[idx], maxV = g.maxs[idx] || 0;
  var rate = maxV > 0 ? Math.round(val / maxV * 100) : 0;
  var x = g.xs[idx];
  var y = g.ys[idx];
  var shell = document.querySelector('.shell');
  var K = (shell && shell.getBoundingClientRect().width) || 430;
  K = K / 750;
  function rz(v) { return v * K; }
  var valueFont = rz(44), pctFont = rz(24), nameFont = rz(24);
  ctx.font = 'bold ' + valueFont + 'px sans-serif';
  var valW = textWidth(ctx, val.toFixed(1), rz(86));
  var rateW = textWidth(ctx, String(rate), rz(64));
  ctx.font = valueFont + 'px sans-serif';
  var slashW = textWidth(ctx, '/', rz(20));
  var maxW = maxV > 0 ? textWidth(ctx, String(maxV), rz(46)) : 0;
  ctx.font = pctFont + 'px sans-serif';
  var pctW = textWidth(ctx, '%', rz(18));
  ctx.font = 'bold ' + nameFont + 'px sans-serif';
  var nameW = textWidth(ctx, name, name.length * rz(24));
  var padT = rz(26), padB = rz(26);
  var contentPad = rz(34);
  var symGap = rz(6);
  var rowGap = rz(8);
  var nameRowH = nameFont + rz(6);
  var valueRowH = valueFont + rz(6);
  var radius = rz(24);
  var boxH = padT + nameRowH + rowGap + valueRowH + padB + (g.yIsFlat ? rz(46) : 0);
  var leftBlockW = valW + symGap + slashW + symGap + maxW;
  var rightBlockW = rateW + symGap + pctW;
  var valueLineW = leftBlockW + rightBlockW;
  var boxW = Math.max(nameW, valueLineW) + contentPad * 2;
  var gapP = rz(46);
  var by = y - boxH - gapP;
  if (by < rz(8)) by = Math.min(y + gapP, h - boxH - rz(8));
  var bx = Math.max(rz(8), Math.min(x - boxW / 2, w - boxW - rz(8)));
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = rz(40); ctx.shadowOffsetY = rz(8);
  ctx.fillStyle = '#fff';
  roundRectPath(ctx, bx, by, boxW, boxH, radius); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.lineWidth = 1;
  roundRectPath(ctx, bx, by, boxW, boxH, radius); ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#1A1A1A'; ctx.font = 'bold ' + nameFont + 'px sans-serif';
  ctx.fillText(name, bx + contentPad, by + padT);
  var valueTop = by + padT + nameRowH + rowGap;
  var valueBase = valueTop + valueFont;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = 'bold ' + valueFont + 'px sans-serif'; ctx.fillStyle = '#1A1A1A';
  ctx.fillText(val.toFixed(1), bx + contentPad, valueBase);
  var curX = bx + contentPad + valW + symGap;
  ctx.font = pctFont + 'px sans-serif'; ctx.fillStyle = '#909399';
  ctx.fillText('/', curX, valueBase);
  curX += slashW + symGap;
  if (maxV > 0) { ctx.fillText(String(maxV), curX, valueBase); }
  var rightX = bx + boxW - contentPad;
  ctx.textAlign = 'right';
  ctx.font = 'bold ' + valueFont + 'px sans-serif'; ctx.fillStyle = c;
  ctx.fillText(String(rate), rightX - symGap - pctW, valueBase);
  ctx.font = pctFont + 'px sans-serif'; ctx.fillStyle = '#909399';
  ctx.fillText('%', rightX, valueBase);
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  if (g.yIsFlat) {
    var hy = valueTop + valueRowH + rz(6);
    ctx.strokeStyle = '#E5E6EB'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx + contentPad, hy); ctx.lineTo(bx + boxW - contentPad, hy); ctx.stroke();
    ctx.fillStyle = '#FA8C16'; ctx.font = rz(22) + 'px sans-serif';
    ctx.fillText('各次考试平均分无明显差距', bx + contentPad, hy + rz(6));
  }
}

// ---- 组件实例（含一次性初始化 + 销毁清理） ----
function create(canvasEl, primaryColor) {
  var handlers = {};
  var inst = {
    geom: null,
    currItems: [],
    color: primaryColor || DEFAULT_COLOR,
    bound: false,
    _disposed: false,
    _timer: 0,
    _animGen: 0,
    setColor: function (color) {
      this.color = color || DEFAULT_COLOR;
      if (this.geom) { this.geom.color = this.color; this.geom.cRgb = hexToRgb(this.color); }
      if (this.currItems.length) { this.setItems(this.currItems); }
    },
    setItems: function (items) { return animateLineTrend(this, canvasEl, items); },
    renderSelection: function (idx) {
      var g = getCtx(canvasEl);
      if (!g) return;
      if (idx >= 0 && this.geom) drawTrendSelected(g.ctx, g.w, g.h, this.geom, idx);
      else this.redrawBase();
    },
    redrawBase: function () {
      var g = getCtx(canvasEl);
      if (!g || !this.geom) return;
      drawTrendLayer(g.ctx, g.w, g.h, this.geom, 1);
    },
    resize: function () {
      if (!this.currItems.length || this._disposed) return;
      this.setItems(this.currItems);
    },
    /* 内存泄漏防护：解除事件监听、取消动画定时器、释放画布引用 */
    dispose: function () {
      this._disposed = true;
      this._animGen += 1;
      if (this._timer) { clearTimeout(this._timer); this._timer = 0; }
      if (canvasEl) {
        canvasEl.removeEventListener('mousemove', handlers.mousemove);
        canvasEl.removeEventListener('mouseleave', handlers.mouseleave);
        canvasEl.removeEventListener('touchstart', handlers.touchstart);
        canvasEl.removeEventListener('touchmove', handlers.touchmove);
        canvasEl.removeEventListener('touchend', handlers.touchend);
        canvasEl.removeEventListener('touchcancel', handlers.touchcancel);
      }
      handlers = {};
      this.geom = null;
    }
  };
  bindEvents(inst, canvasEl, handlers);
  return inst;
}

function animateLineTrend(inst, cvs, items) {
  var g = getCtx(cvs);
  if (!g) return inst.geom;
  inst.currItems = items;
  inst._animGen += 1;
  var gen = inst._animGen;
  if (inst._timer) { clearTimeout(inst._timer); inst._timer = 0; }
  var geom = lineTrendGeom(g.w, g.h, items, inst.color);
  inst.geom = geom;
  if (!geom) return geom;
  drawTrendLayer(g.ctx, g.w, g.h, geom, 0, inst.color);
  var duration = 600;
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  var start = null;
  function frame() {
    if (gen !== inst._animGen || inst._disposed) return;
    var c = getCtx(cvs);
    if (gen !== inst._animGen || inst._disposed) return;
    var progress = start == null ? 0 : Math.min((Date.now() - start) / duration, 1);
    if (start == null) start = Date.now();
    drawTrendLayer(c.ctx, c.w, c.h, geom, easeOutCubic(progress), inst.color);
    if (progress < 1) {
      inst._timer = setTimeout(frame, 16);
    } else if (!inst._disposed) {
      drawTrendLayer(c.ctx, c.w, c.h, geom, 1, inst.color);
    }
  }
  inst._timer = setTimeout(frame, 16);
  return geom;
}

function trendIdxFromXY(inst, x, y) {
  if (!inst.geom || !inst.geom.xs || !inst.geom.xs.length) return -1;
  if (x < inst.geom.padL - 30 || x > inst.geom.w - inst.geom.padR + 30) return -1;
  var best = 0, bd = Infinity;
  inst.geom.xs.forEach(function (v, i) { var d = Math.abs(v - x); if (d < bd) { bd = d; best = i; } });
  return best;
}

function bindEvents(inst, cvs, handlers) {
  if (inst.bound || !cvs) return;
  inst.bound = true;
  function toIdx(e) {
    var rect = cvs.getBoundingClientRect();
    var t = e.touches ? e.touches[0] : e;
    return trendIdxFromXY(inst, t.clientX - rect.left, t.clientY - rect.top);
  }
  handlers.mousemove = function (e) { if (!inst._disposed) inst.renderSelection(toIdx(e)); };
  handlers.mouseleave = function () { if (!inst._disposed) inst.renderSelection(-1); };
  handlers.touchstart = function (e) { if (e.touches[0]) inst.renderSelection(toIdx(e)); };
  handlers.touchmove = function (e) { if (e.touches[0]) inst.renderSelection(toIdx(e)); };
  handlers.touchend = function () { if (!inst._disposed) inst.renderSelection(-1); };
  handlers.touchcancel = function () { if (!inst._disposed) inst.renderSelection(-1); };
  cvs.addEventListener('mousemove', handlers.mousemove);
  cvs.addEventListener('mouseleave', handlers.mouseleave);
  cvs.addEventListener('touchstart', handlers.touchstart);
  cvs.addEventListener('touchmove', handlers.touchmove);
  cvs.addEventListener('touchend', handlers.touchend);
  cvs.addEventListener('touchcancel', handlers.touchcancel);
}

/**
 * 标准 React 组件。
 * 对外暴露 props：series / xAxisData / chartTitle / primaryColor / items。
 */
function TrendLine({ series = [], xAxisData = [], chartTitle = '', primaryColor = DEFAULT_COLOR, items = [] }) {
  const canvasRef = useRef(null);
  const bodyRef = useRef(null);
  const instRef = useRef(null);

  // 挂载时建立实例，卸载时销毁（dispose：解绑事件 + 取消动画 + 释放引用）
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const inst = create(cvs, primaryColor);
    instRef.current = inst;
    return () => inst.dispose();
    // 仅挂载/卸载各执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 数据变化：归一化后 setOption（此处为 setItems 重绘），不重复初始化实例
  useEffect(() => {
    const inst = instRef.current;
    if (!inst) return;
    const src = series.length ? series : items;
    const out = src.map((s, i) => ({
      name: (xAxisData && xAxisData[i]) || s.name || '',
      value: s.value != null ? s.value : 0,
      max: s.max != null ? s.max : 0
    }));
    inst.setItems(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, xAxisData, items]);

  // 主题色变化：仅更新线/高亮/tooltip 色，无需重建实例
  useEffect(() => {
    const inst = instRef.current;
    if (inst) inst.setColor(primaryColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryColor]);

  // 容器尺寸变化自适应：ResizeObserver 触发重绘
  useEffect(() => {
    const body = bodyRef.current;
    const inst = instRef.current;
    if (!body || !inst || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => inst.resize());
    ro.observe(body);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasData = Boolean(series.length || items.length);

  return (
    <div className="trend-line-chart">
      {chartTitle ? <div className="trend-line-chart__title">{chartTitle}</div> : null}
      <div className="trend-line-chart__body" ref={bodyRef}>
        <canvas ref={canvasRef} className="trend-line-chart__canvas" aria-label={chartTitle || '折线趋势图'} />
        {hasData ? null : <div className="trend-line-chart__empty">暂无数据</div>}
      </div>
    </div>
  );
}

export default TrendLine;