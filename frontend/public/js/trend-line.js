/**
 * 等效预览端公共折线图组件（浏览器版 trend-line）
 * 以"看年级页"为样板，抽取全部样式与交互标准：
 *  - 几何：padL30/padR10/padT18/padB18/padIn26（首末点距画布缘 56/36，不贴边）
 *  - 动画：渐变区域先整块呈现，再折线自左向右渐进（600ms easeOutCubic，setTimeout 16ms 驱动）
 *  - 未点击数据点：白 r4 + 主色描边 2
 *  - 选中：淡绿竖条(0.1) + 虚线(6,4) + 外圈10/白7/描边4 + 悬浮卡片
 *  - 悬浮卡片：rpx 自适应，上方优先/下方翻转，水平钳制画布内
 * 多页面复用：style 统一写死在此，页面只调用 buildLineItems(按各自接口取数) 后再 setItems。
 * 如需完善，只改本文件一处，所有引用页面即刻同步。
 */
(function (global) {
  'use strict';

  var MAIN = '#14A89A';

  // ---- 画布获取/DPR ----
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

  // ---- 几何基准（含 padIn 内侧缩进，保证折线两端不贴画布左右缘） ----
  function lineTrendGeom(w, h, items) {
    var padL = 30, padR = 10, padT = 18, padB = 18;
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
    var padIn = 26, innerW = chartW - padIn * 2;
    var xs = values.map(function (_, i) {
      return values.length > 1 ? padL + padIn + i * (innerW / (values.length - 1)) : padL + chartW / 2;
    });
    var ys = values.map(function (v) { return padT + (yMax - v) / (yMax - yMin) * chartH; });
    return {
      w: w, h: h, padL: padL, padR: padR, padT: padT, padB: padB,
      chartW: chartW, chartH: chartH, innerW: innerW,
      values: values,
      names: (items || []).map(function (it) { return it.name || ''; }),
      maxs: (items || []).map(function (it) { return it.max || 0; }),
      yMin: yMin, yMax: yMax, step: step, yIsFlat: yIsFlat, xs: xs, ys: ys
    };
  }

  // ---- 单帧绘制：渐变区域整块先呈现，折线与数据点按 prog 渐进 ----
  function drawTrendLayer(ctx, w, h, g, prog) {
    ctx.clearRect(0, 0, w, h);
    if (!g || !g.xs || !g.xs.length) return;
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
    // 渐变蒙版：整块绘制（先于折线呈现）
    if (!g._grad) {
      g._grad = ctx.createLinearGradient(0, g.padT, 0, g.padT + g.chartH);
      g._grad.addColorStop(0, 'rgba(' + 20 + ',' + 168 + ',' + 154 + ',0.40)');
      g._grad.addColorStop(1, 'rgba(' + 20 + ',' + 168 + ',' + 154 + ',0)');
    }
    ctx.beginPath(); ctx.moveTo(g.xs[0], g.padT + g.chartH);
    g.xs.forEach(function (x, j) { ctx.lineTo(x, g.ys[j]); });
    ctx.lineTo(g.xs[g.xs.length - 1], g.padT + g.chartH); ctx.closePath();
    ctx.fillStyle = g._grad; ctx.fill();
    // 折线渐进
    var n = g.xs.length;
    var done = Math.max(0, Math.min(1, prog == null ? 1 : prog)) * (n - 1);
    var lastSeg = Math.floor(done);
    ctx.beginPath();
    for (i = 0; i <= lastSeg; i++) { i === 0 ? ctx.moveTo(g.xs[i], g.ys[i]) : ctx.lineTo(g.xs[i], g.ys[i]); }
    if (lastSeg < n - 1) {
      var frac = done - lastSeg;
      ctx.lineTo(g.xs[lastSeg] + (g.xs[lastSeg + 1] - g.xs[lastSeg]) * frac, g.ys[lastSeg] + (g.ys[lastSeg + 1] - g.ys[lastSeg]) * frac);
    }
    ctx.strokeStyle = MAIN; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    for (i = 0; i < n; i++) {
      if (i > done) break;
      ctx.beginPath(); ctx.arc(g.xs[i], g.ys[i], 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = MAIN; ctx.stroke();
    }
  }

  function drawTrendBase(ctx, w, h, g) { drawTrendLayer(ctx, w, h, g, 1); }

  // ---- 选中渲染 ----
  function drawTrendSelected(ctx, w, h, g, idx) {
    drawTrendBase(ctx, w, h, g);
    if (!g || idx == null || idx < 0 || idx >= g.xs.length) return;
    var x = g.xs[idx], y = g.ys[idx];
    var colW = g.xs.length > 1 ? g.chartW / (g.xs.length - 1) : g.chartW;
    var maskW = colW * 0.5;
    ctx.fillStyle = 'rgba(' + 20 + ',' + 168 + ',' + 154 + ',0.1)';
    ctx.fillRect(x - maskW / 2, g.padT, maskW, g.chartH);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = MAIN; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, g.padT); ctx.lineTo(x, g.padT + g.chartH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + 20 + ',' + 168 + ',' + 154 + ',0.25)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = MAIN; ctx.stroke();
    drawTrendTooltip(ctx, w, h, g, idx);
  }

  function textWidth(ctx, str, fb) { try { return ctx.measureText(str).width; } catch (e) { return fb || 0; } }

  // ---- 悬浮卡片（rpx 自适应，上方优先） ----
  function drawTrendTooltip(ctx, w, h, g, idx) {
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
    ctx.font = 'bold ' + valueFont + 'px sans-serif'; ctx.fillStyle = MAIN;
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

  // ---- 组件实例 ----
  function create(canvasEl) {
    var inst = {
      geom: null,
      currItems: [],
      bound: false,
      setItems: function (items) { return animateLineTrend(this, canvasEl, items); },
      renderSelection: function (idx) {
        var g = getCtx(canvasEl);
        if (!g) return;
        if (idx >= 0 && this.geom) drawTrendSelected(g.ctx, g.w, g.h, this.geom, idx);
        else this.geom = animateLineTrend(this, canvasEl, this.currItems);
      }
    };
    bindEvents(inst, canvasEl);
    return inst;
  }

  function animateLineTrend(inst, cvs, items) {
    var g = getCtx(cvs);
    if (!g) return inst.geom;
    inst.currItems = items;
    var geom = lineTrendGeom(g.w, g.h, items);
    inst.geom = geom;
    if (!geom) return geom;
    var duration = 600;
    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
    var start = null;
    function frame() {
      var progress = start == null ? 0 : Math.min((Date.now() - start) / duration, 1);
      if (start == null) start = Date.now();
      drawTrendLayer(getCtx(cvs).ctx, getCtx(cvs).w, getCtx(cvs).h, geom, easeOutCubic(progress));
      if (progress < 1) setTimeout(frame, 16);
      else drawTrendLayer(getCtx(cvs).ctx, getCtx(cvs).w, getCtx(cvs).h, geom, 1);
    }
    drawTrendLayer(getCtx(cvs).ctx, getCtx(cvs).w, getCtx(cvs).h, geom, 0);
    setTimeout(frame, 16);
    return geom;
  }

  function trendIdxFromXY(inst, x, y) {
    if (!inst.geom || !inst.geom.xs || !inst.geom.xs.length) return -1;
    if (x < inst.geom.padL - 30 || x > inst.geom.w - inst.geom.padR + 30) return -1;
    var best = 0, bd = Infinity;
    inst.geom.xs.forEach(function (v, i) { var d = Math.abs(v - x); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  function bindEvents(inst, cvs) {
    if (inst.bound || !cvs) return;
    inst.bound = true;
    function toIdx(e) {
      var rect = cvs.getBoundingClientRect();
      var t = e.touches ? e.touches[0] : e;
      return trendIdxFromXY(inst, t.clientX - rect.left, t.clientY - rect.top);
    }
    cvs.addEventListener('mousemove', function (e) { inst.renderSelection(toIdx(e)); });
    cvs.addEventListener('mouseleave', function () { inst.renderSelection(-1); });
    cvs.addEventListener('touchstart', function (e) { if (e.touches[0]) inst.renderSelection(toIdx(e)); });
    cvs.addEventListener('touchmove', function (e) { if (e.touches[0]) inst.renderSelection(toIdx(e)); });
    cvs.addEventListener('touchend', function () { inst.renderSelection(-1); });
    cvs.addEventListener('touchcancel', function () { inst.renderSelection(-1); });
  }

  global.TrendLine = { create: create };
})(window);