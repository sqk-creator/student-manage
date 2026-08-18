/* ============================================================
 * RadarChart 科目均衡分析雷达图组件
 * 基于 ChartBase 统一范式；数据格式 items = [{name, value(原始分), max(满分)}]
 * 组件内部自动换算标准分（标准分 = 原始得分 / 科目满分 x 100）
 * 交互：自绘 tooltip、选中轴线变主色虚线、选中刻度文字放大主色发光
 *
 * 调用示例：
 *   RadarChart.render(container, [
 *     { name:'语文', value:100.4, max:150 },
 *     { name:'数学', value:97,    max:150 }
 *   ], { key:'classRadar', emptyText:'暂无雷达数据' });
 * ============================================================ */
(function (global) {
  var ChartBase = global.ChartBase;
  var COLORS = global.CHART_COLORS;
  if (!ChartBase) return;

  var SUBJECT_ORDER = ['语文', '数学', '英语', '政治', '历史', '地理'];

  function normalize(score, full) {
    if (full > 0 && score != null) {
      return Math.round(score / full * 100 * 10) / 10;
    }
    return 0;
  }

  function analyze(standards) {
    var valid = standards.filter(function (v) { return v != null && !isNaN(v); });
    var max = valid.length ? Math.max.apply(null, valid) : 0;
    var min = valid.length ? Math.min.apply(null, valid) : 0;
    var range = Math.round((max - min) * 10) / 10;
    var avg = valid.length ? Math.round(valid.reduce(function (a, b) { return a + b; }, 0) / valid.length * 10) / 10 : 0;
    var tags = [];
    if (range >= 22) {
      tags.push('偏科');
    } else {
      tags.push('全科均衡');
      if (avg >= 78 && valid.every(function (v) { return v >= 65; })) tags.push('文科优势');
      if (avg < 62) tags.push('文科短板');
    }
    return { max: max, min: min, range: range, avg: avg, tags: tags };
  }

  function buildOption(items) {
    var standards = items.map(function (it) { return normalize(it.value, it.max); });
    return {
      backgroundColor: COLORS.tooltipBg,
      radar: {
        indicator: items.map(function (it) { return { name: it.name, max: 100 }; }),
        shape: 'polygon',
        center: ['50%', '50%'],
        radius: '80%',
        splitNumber: 5,
        name: { textStyle: { color: COLORS.text, fontSize: 14 } },
        splitLine: { lineStyle: { color: COLORS.gridLight } },
        splitArea: {
          show: true,
          areaStyle: {
            color: ['#ffffff', COLORS.gridLight, '#ffffff', COLORS.gridLight, '#ffffff']
          }
        },
        axisLine: { lineStyle: { color: COLORS.gridLight } },
        axisLabel: { show: false }
      },
      series: [{
        type: 'radar',
        symbol: 'circle',
        symbolSize: 5,
        itemStyle: { color: COLORS.primary },
        lineStyle: { color: COLORS.primary, width: 2 },
        areaStyle: { color: COLORS.fill },
        data: [{ value: standards, name: '科目均衡' }]
      }]
    };
  }

  function RadarChart() { ChartBase.call(this); }
  RadarChart.prototype = Object.create(ChartBase.prototype);
  RadarChart.prototype.constructor = RadarChart;

  RadarChart.prototype._isEmpty = function (items) {
    return !items || !items.length || !items.some(function (it) { return it.max > 0; });
  };

  RadarChart.prototype._buildOption = function (items, opts) {
    return buildOption(items);
  };

  RadarChart.prototype._onReady = function (chart, container, items, opts, inst) {
    if (items && items.length) bindRadarTooltip(chart, container, items);
  };

  function bindRadarTooltip(chart, container, items) {
    var zr = chart.getZr();
    var lastIdx = -1;
    var countN = items.length;
    var standards = items.map(function (it) { return normalize(it.value, it.max); });
    var axesCache = null;
    var nameEls = [];

    function collectNames() {
      nameEls = [];
      var list = zr.storage.getDisplayList();
      list.forEach(function (el) {
        if (el.type !== 'tspan' || !el.style || !el.style.text) return;
        for (var i = 0; i < items.length; i++) {
          if (el.style.text === items[i].name) { nameEls[i] = el; break; }
        }
      });
    }
    function updateSelectName(idx) {
      collectNames();
      var changed = false;
      for (var i = 0; i < nameEls.length; i++) {
        var el = nameEls[i];
        if (!el) continue;
        var sel = i === idx;
        var st = el.style || {};
        var want = sel
          ? { fontSize: 18, fontWeight: 700, fill: COLORS.primary, textShadowColor: 'rgba(20,168,154,0.55)', textShadowBlur: 10, textShadowOffsetX: 0, textShadowOffsetY: 0 }
          : { fontSize: 14, fontWeight: 400, fill: COLORS.text, textShadowColor: 'rgba(0,0,0,0)', textShadowBlur: 0, textShadowOffsetX: 0, textShadowOffsetY: 0 };
        if (st.fontSize !== want.fontSize || st.fill !== want.fill || (!!st.textShadowBlur) !== (want.textShadowBlur > 0)) {
          el.attr('style', want);
          changed = true;
        }
      }
      if (changed) zr.refresh();
    }
    function resetNames() {
      collectNames();
      var changed = false;
      for (var i = 0; i < nameEls.length; i++) {
        var el = nameEls[i];
        if (!el) continue;
        var st = el.style || {};
        if (st.fontSize !== 14 || st.fill !== COLORS.text || st.textShadowBlur) {
          el.attr('style', { fontSize: 14, fontWeight: 400, fill: COLORS.text, textShadowColor: 'rgba(0,0,0,0)', textShadowBlur: 0, textShadowOffsetX: 0, textShadowOffsetY: 0 });
          changed = true;
        }
      }
      if (changed) zr.refresh();
    }

    function collectAxes() {
      axesCache = [];
      var model = chart.getModel().getComponent('radar');
      var rs = model && model.coordinateSystem;
      if (!rs || !rs.getIndicatorAxes || rs.r == null) return;
      var list = zr.storage.getDisplayList();
      list.forEach(function (el) {
        if (el.type !== 'line' || !el.style || !el.shape) return;
        var s = el.shape;
        var dx = s.x2 - s.x1, dy = s.y2 - s.y1;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len < rs.r * 0.98 || len > rs.r * 1.02) return;
        var ang = Math.atan2(-dy, dx);
        var deg = ((ang * 180 / Math.PI) % 360 + 360) % 360;
        axesCache.push({ el: el, deg: deg });
      });
    }

    function resetAxes() {
      if (!axesCache || !axesCache.length) return;
      var changed = false;
      axesCache.forEach(function (a) {
        var st = a.el.style || {};
        if (st.stroke !== COLORS.gridLight || st.lineWidth !== 1 || st.lineDash) {
          a.el.attr('style', { stroke: COLORS.gridLight, lineWidth: 1, lineCap: 'butt', lineDash: null });
          changed = true;
        }
      });
      if (changed) zr.refresh();
    }
    function updateSelectLine(idx) {
      collectAxes();
      if (!axesCache.length) return;
      var model = chart.getModel().getComponent('radar');
      var rs = model && model.coordinateSystem;
      if (!rs || !rs.getIndicatorAxes) return;
      var targetDeg = ((rs.getIndicatorAxes()[idx].angle * 180 / Math.PI) % 360 + 360) % 360;
      var best = null, bestDiff = 999;
      axesCache.forEach(function (a) {
        var d = Math.abs(a.deg - targetDeg);
        if (d > 180) d = 360 - d;
        if (d < bestDiff) { bestDiff = d; best = a; }
      });
      if (!best) return;
      axesCache.forEach(function (a) {
        var isSel = a === best;
        var st = a.el.style || {};
        if (st.stroke !== (isSel ? COLORS.primary : COLORS.gridLight) || st.lineWidth !== (isSel ? 3 : 1) || (!!st.lineDash) !== isSel) {
          a.el.attr('style', { stroke: isSel ? COLORS.primary : COLORS.gridLight, lineWidth: isSel ? 3 : 1, lineCap: isSel ? 'round' : 'butt', lineDash: isSel ? [6, 4] : null });
        }
      });
      zr.refresh();
      updateSelectName(idx);
    }
    function hideSelectLine() {
      resetAxes();
      resetNames();
    }

    var tipDiv = document.createElement('div');
    tipDiv.style.cssText = 'position:absolute;pointer-events:none;background:' + COLORS.tooltipBg
      + ';border:1px solid ' + COLORS.grid + ';border-radius:10px;padding:10px 12px;'
      + 'font-size:12px;color:' + COLORS.text + ';box-shadow:0 4px 12px rgba(0,0,0,.1);'
      + 'display:none;z-index:99;white-space:nowrap;line-height:1.6;';
    container.appendChild(tipDiv);
    container.style.position = 'relative';

    function hideTip() {
      tipDiv.style.display = 'none';
    }

    function segDist(px, py, x1, y1, x2, y2) {
      var dx = x2 - x1, dy = y2 - y1;
      var len2 = dx * dx + dy * dy;
      var t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      var qx = x1 + t * dx, qy = y1 + t * dy;
      return Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy));
    }

    function showTipAt(idx, x, y) {
      var it = items[idx] || {};
      var std = standards[idx] != null ? standards[idx] : 0;
      var orig = it.value != null ? Math.round(it.value * 10) / 10 : 0;
      tipDiv.innerHTML = '<div style="font-size:13px;font-weight:600;color:' + COLORS.text + ';margin-bottom:6px">' + it.name + '</div>'
        + '<div style="display:flex;justify-content:space-between;gap:14px;color:' + COLORS.sub + '"><span>原始分数</span><span style="font-weight:600;color:' + COLORS.text + '">' + orig + '分</span></div>'
        + '<div style="display:flex;justify-content:space-between;gap:14px;color:' + COLORS.sub + '"><span>标准分</span><span style="font-weight:600;color:' + COLORS.primary + '">' + std + '</span></div>';
      tipDiv.style.visibility = 'hidden';
      tipDiv.style.display = 'block';
      var cw = container.clientWidth || 300;
      var ch = container.clientHeight || 300;
      var tw = tipDiv.offsetWidth || 140;
      var th = tipDiv.offsetHeight || 70;
      var pad = 6;

      var model = chart.getModel().getComponent('radar');
      var rs = model && model.coordinateSystem;
      var cx = rs && rs.cx != null ? rs.cx : cw / 2;
      var cy = rs && rs.cy != null ? rs.cy : ch / 2;
      var r = rs && rs.r != null ? rs.r : Math.min(cw, ch) / 2 * 0.8;
      var axes = rs && rs.getIndicatorAxes ? rs.getIndicatorAxes() : [];
      var ang = axes[idx] ? axes[idx].angle : -Math.PI / 2;
      var linePts = [{ x: cx, y: cy }, { x: cx + Math.cos(ang) * r, y: cy - Math.sin(ang) * r }];
      var names = [];
      for (var i = 0; i < axes.length; i++) {
        var na = axes[i].angle;
        names.push({ x: cx + Math.cos(na) * (r + 22), y: cy - Math.sin(na) * (r + 22) });
      }

      function boxClear(tx, ty, checkLine) {
        if (tx < pad || ty < pad || tx + tw > cw - pad || ty + th > ch - pad) return false;
        var cxp = tx + tw / 2, cyp = ty + th / 2;
        if (checkLine && segDist(cxp, cyp, linePts[0].x, linePts[0].y, linePts[1].x, linePts[1].y) < (tw / 2 + 8)) return false;
        for (var k = 0; k < names.length; k++) {
          var nd = Math.sqrt((cxp - names[k].x) * (cxp - names[k].x) + (cyp - names[k].y) * (cyp - names[k].y));
          if (nd < 26) return false;
        }
        return true;
      }

      var cands = [
        { tx: x + 12, ty: y + 12 },
        { tx: x - tw - 12, ty: y + 12 },
        { tx: x + 12, ty: y - th - 12 },
        { tx: x - tw - 12, ty: y - th - 12 },
        { tx: x - tw / 2, ty: y + 12 },
        { tx: x - tw / 2, ty: y - th - 12 },
        { tx: x + 12, ty: y - th / 2 },
        { tx: x - tw - 12, ty: y - th / 2 }
      ];
      var chosen = null;
      for (var c = 0; c < cands.length; c++) {
        if (boxClear(cands[c].tx, cands[c].ty, true)) { chosen = cands[c]; break; }
      }
      if (!chosen) {
        for (var c2 = 0; c2 < cands.length; c2++) {
          if (boxClear(cands[c2].tx, cands[c2].ty, false)) { chosen = cands[c2]; break; }
        }
      }
      if (!chosen) {
        chosen = { tx: x + 12, ty: y + 12 };
        if (chosen.tx + tw > cw - pad) chosen.tx = cw - tw - pad;
        if (chosen.ty + th > ch - pad) chosen.ty = ch - th - pad;
        if (chosen.tx < pad) chosen.tx = pad;
        if (chosen.ty < pad) chosen.ty = pad;
      }
      tipDiv.style.left = chosen.tx + 'px';
      tipDiv.style.top = chosen.ty + 'px';
      tipDiv.style.visibility = '';
    }

    function nearest(x, y) {
      var model = chart.getModel().getComponent('radar');
      var rs = model && model.coordinateSystem ? model.coordinateSystem : null;
      var cx, cy, r;
      if (rs && rs.cx != null && rs.cy != null && rs.r != null) {
        cx = rs.cx; cy = rs.cy; r = rs.r;
      } else {
        var w = container.clientWidth || 300;
        var h = container.clientHeight || 250;
        cx = w / 2; cy = h / 2; r = Math.min(w, h) / 2 * 0.72;
      }
      var dx = x - cx, dy = y - cy;
      if (Math.sqrt(dx * dx + dy * dy) > r + 42) return -1;
      var ang = Math.atan2(dy, dx) * 180 / Math.PI;
      var deg = ang + 90;
      if (deg < 0) deg += 360;
      var step = 360 / countN;
      return (countN - Math.round(deg / step)) % countN;
    }
    function onMove(e) {
      var x = e.offsetX, y = e.offsetY;
      var idx = nearest(x, y);
      if (idx === lastIdx) return;
      lastIdx = idx;
      if (idx < 0) { hideTip(); hideSelectLine(); }
      else { showTipAt(idx, x, y); updateSelectLine(idx); }
    }
    function onOut() {
      lastIdx = -1;
      hideTip();
      hideSelectLine();
    }
    zr.on('mousemove', onMove);
    zr.on('touchmove', onMove);
    zr.on('globalout', onOut);
  }

  var radarChart = new RadarChart();

  global.RadarChart = radarChart;
  // 兼容旧调用 LiberalRadarChart.render(...)
  global.LiberalRadarChart = {
    COLORS: COLORS,
    SUBJECT_ORDER: SUBJECT_ORDER,
    normalize: normalize,
    analyze: analyze,
    buildOption: buildOption,
    render: function (container, items, opts) { return radarChart.render(container, items, opts); }
  };
})(window);
