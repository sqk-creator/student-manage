const MAIN_COLOR = '#14A89A';
const GRID_COLOR = '#E5E6EB';
const AXIS_COLOR = '#909399';
const FONT_FAMILY = 'sans-serif';

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
        ctx.scale(dpr, dpr);
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
  for (let i = 0; i < totalTicks; i++) {
    const angle = startAngle - (i / (totalTicks - 1)) * arcSpan;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const innerR = r - tickLen;
    const x1 = cx + innerR * cos;
    const y1 = cy - innerR * sin;
    const x2 = cx + r * cos;
    const y2 = cy - r * sin;
    ctx.lineWidth = tickWidth;
    ctx.strokeStyle = i < activeTicks ? MAIN_COLOR : 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function animateGauge({ ctx, node, w, h, targetRate, onFrame }) {
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
    } else if (onFrame) {
      onFrame(targetRate);
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
  const xs = values.map((_, i) =>
    values.length > 1 ? padL + (i / (values.length - 1)) * chartW : padL + chartW / 2
  );
  const ys = values.map((v) => padT + (yMax - v) / (yMax - yMin) * chartH);

  return {
    w,
    h,
    padL,
    padR,
    padT,
    padB,
    chartW,
    chartH,
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

function drawTrendBase(ctx, w, h, g) {
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

  ctx.beginPath();
  xs.forEach((x, i) => (i === 0 ? ctx.moveTo(x, ys[i]) : ctx.lineTo(x, ys[i])));
  ctx.strokeStyle = MAIN_COLOR;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  xs.forEach((x, i) => {
    ctx.beginPath();
    ctx.arc(x, ys[i], 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = MAIN_COLOR;
    ctx.stroke();
  });
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

  ctx.font = 'bold 18px ' + FONT_FAMILY;
  const valW = textWidth(ctx, val.toFixed(1), 40);
  ctx.font = 'bold 18px ' + FONT_FAMILY;
  const rateW = textWidth(ctx, String(rate), 30);
  ctx.font = '14px ' + FONT_FAMILY;
  const slashW = textWidth(ctx, '/', 8);
  const maxW = maxV > 0 ? textWidth(ctx, String(maxV), 20) : 0;
  const percentW = textWidth(ctx, '%', 10);
  ctx.font = 'bold 13px ' + FONT_FAMILY;
  const nameW = textWidth(ctx, name, name.length * 13);

  const gap = 4;
  const valueLineW = valW + gap + slashW + gap + maxW + 10 + rateW + gap + percentW + 10;
  const boxW = Math.max(nameW + 4, valueLineW) + 36;
  const contentH = 26 + (g.yIsFlat ? 22 : 0);
  const boxH = contentH + 28;

  let bx = x + 18;
  if (bx + boxW > w - 10) bx = Math.max(10, x - 18 - boxW);
  const by = Math.max(10, Math.min(y - 10, h - boxH - 10));

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, bx, by, boxW, boxH, 12);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 1;
  roundRectPath(ctx, bx, by, boxW, boxH, 12);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#1A1A1A';
  ctx.font = 'bold 13px ' + FONT_FAMILY;
  ctx.fillText(name, bx + 18, by + 14);

  const lineY = by + 14 + 20;
  let curX = bx + 18;
  ctx.font = 'bold 18px ' + FONT_FAMILY;
  ctx.fillStyle = '#1A1A1A';
  ctx.fillText(val.toFixed(1), curX, lineY);
  curX += valW + gap;
  ctx.font = '14px ' + FONT_FAMILY;
  ctx.fillStyle = AXIS_COLOR;
  ctx.fillText('/', curX, lineY + 2);
  curX += slashW + gap;
  if (maxV > 0) {
    ctx.fillText(String(maxV), curX, lineY + 2);
    curX += maxW + 10;
  }
  ctx.font = 'bold 18px ' + FONT_FAMILY;
  ctx.fillStyle = MAIN_COLOR;
  ctx.fillText(String(rate), curX, lineY);
  curX += rateW + gap;
  ctx.font = '14px ' + FONT_FAMILY;
  ctx.fillStyle = AXIS_COLOR;
  ctx.fillText('%', curX, lineY + 2);

  if (g.yIsFlat) {
    const hy = by + boxH - 16;
    ctx.setLineDash([1, 0]);
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + 18, hy - 4);
    ctx.lineTo(bx + boxW - 18, hy - 4);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#FA8C16';
    ctx.font = '11px ' + FONT_FAMILY;
    ctx.fillText('各次考试平均分无明显差距', bx + 18, hy + 1);
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

function drawHistogram(ctx, w, h, data, opts) {
  ctx.clearRect(0, 0, w, h);
  const xAxis = (data && data.xAxis) || [];
  const series = (data && data.series) || [];
  if (!xAxis.length || !series.length) return;
  const stack = !!(opts && opts.stack);
  const padL = 34;
  const padR = 14;
  const padT = 26;
  const padB = 30;
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

  ctx.font = '11px ' + FONT_FAMILY;
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.fillStyle = '#909399';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 3; i++) {
    const gy = padT + i * (chartH / 3);
    const gv = yMax - i * (yMax / 3);
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
      series.forEach((s) => {
        const v = s.data[i] || 0;
        const bh = v / yMax * chartH;
        const by = accY - bh;
        ctx.fillStyle = s.color || MAIN_COLOR;
        roundRectPath(ctx, cx - barW / 2, by, barW, bh, 3);
        ctx.fill();
        if (v > 0) {
          ctx.fillStyle = '#909399';
          ctx.font = '10px ' + FONT_FAMILY;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(String(v), cx, by - 2);
          ctx.font = '11px ' + FONT_FAMILY;
        }
        accY = by;
      });
    } else {
      const v = (series[0].data[i] || 0);
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

    ctx.fillStyle = '#909399';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '10px ' + FONT_FAMILY;
    let label = xAxis[i] || '';
    if (label.length > 5) label = label.slice(0, 5);
    ctx.fillText(label, cx, h - padB + 6);
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
  drawTrendSelected,
  drawHistogram,
  drawSparkline,
  drawRadar,
  drawRadarSelected,
  radarIdxFromXY
};
