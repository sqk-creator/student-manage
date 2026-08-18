/* ============================================================
 * HistogramChart 直方图组件（bar 类型）
 * 基于 ChartBase 统一范式，数据格式 { xAxis: [], series: [{name, data}] }
 *  - 柱子圆角、hover 高亮
 *  - 支持单系列 / 多系列对比（多系列时自动显示图例）
 *  - 支持每系列自定义色 s.color（生成同色系阴影/悬浮高亮）
 *  - 支持堆叠 opts.stacked（多系列上下叠加，series 顺序即自下而上；
 *    下方柱顶直角与上方柱底完全贴合；数值标签仅显示于柱形整体顶部，取各段之和，且不加粗）
 *  - 可选顶部数值标签（showValueLabel: true）
 *  - 多系列时图例置于绘图区域右上角（图标 4px 圆角），与绘图区域保持 10px 间距
 *  - 柱宽上限可配 opts.barMaxWidth
 *  - 横向平移查看 opts.dataZoom（inside，鼠标拖拽/触屏拖动，Y 轴与图例固定）
 *  - 坐标轴防重叠：label 旋转 rotate / 抽稀 interval / 柱宽上限 barMaxWidth
 *
 * 调用示例：
 *   HistogramChart.render(container, {
 *     xAxis: ['<60','60-70','70-80','80-90','90-100'],
 *     series: [{ name:'学生人数', data:[2, 8, 20, 15, 5] }]
 *   }, { key:'dist', showValueLabel:true, emptyText:'暂无分布数据' });
 *   // 多系列 + 自定义 option：
 *   HistogramChart.render(container, { xAxis:[...], series:[{name:'A',data:[...]},{name:'B',data:[...]}] },
 *     { showValueLabel:true, rotate:30, customOption:{ yAxis:{ max:30 } } });
 * ============================================================ */
(function (global) {
  var ChartBase = global.ChartBase;
  var COLORS = global.CHART_COLORS;
  if (!ChartBase) return;

  function HistogramChart() { ChartBase.call(this); }
  HistogramChart.prototype = Object.create(ChartBase.prototype);
  HistogramChart.prototype.constructor = HistogramChart;

  function hexToRgba(hex, alpha) {
    var h = String(hex || '').replace('#', '');
    if (h.length !== 6) return 'rgba(20,168,154,' + alpha + ')';
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  HistogramChart.prototype._buildOption = function (chartData, opts) {
    opts = opts || {};
    if (opts.customOption) return opts.customOption;

    var multi = (chartData.series || []).length > 1;
    var stacked = !!opts.stacked;
    var seriesList = chartData.series || [];
    var lastIdx = seriesList.length - 1;
    var totals = null;
    if (stacked) {
      var maxLen = 0;
      seriesList.forEach(function (s) { if ((s.data || []).length > maxLen) maxLen = s.data.length; });
      totals = [];
      for (var j = 0; j < maxLen; j++) {
        var t = 0;
        seriesList.forEach(function (s) { t += (Number(s.data[j]) || 0); });
        totals.push(t);
      }
    }
    var series = seriesList.map(function (s, i) {
      var customColor = s.color || null;
      var radius = stacked ? (i === lastIdx ? [6, 6, 0, 0] : [0, 0, 0, 0]) : [6, 6, 0, 0];
      var label;
      if (opts.showValueLabel) {
        if (stacked) {
          label = (i === lastIdx)
            ? { show: true, position: 'top', color: COLORS.text, fontSize: 12, fontWeight: 400,
                formatter: function (params) { return totals != null && totals[params.dataIndex] != null ? totals[params.dataIndex] : ''; } }
            : { show: false };
        } else {
          label = { show: true, position: 'top', color: COLORS.text, fontSize: 12, fontWeight: 600 };
        }
      } else {
        label = { show: false };
      }
      var data = s.data || [];
      if (stacked && i < lastIdx) {
        var topSeries = seriesList[lastIdx];
        data = data.map(function (v, j) {
          var topVal = Number((topSeries.data || [])[j]) || 0;
          return topVal > 0 ? v : { value: v, itemStyle: { borderRadius: [6, 6, 0, 0] } };
        });
      }
      var ser = {
        name: s.name || (multi ? '系列' + (i + 1) : '人数'),
        type: 'bar',
        data: data,
        barMaxWidth: opts.barMaxWidth === undefined ? 30 : opts.barMaxWidth,
        barMinWidth: 10,
        itemStyle: {
          color: customColor || global.createBarGradient(),
          borderRadius: radius,
          shadowBlur: global.barShadow().shadowBlur,
          shadowColor: customColor ? hexToRgba(customColor, 0.28) : global.barShadow().shadowColor
        },
        emphasis: {
          itemStyle: {
            color: customColor || COLORS.primaryDark,
            shadowBlur: 10,
            shadowColor: customColor ? hexToRgba(customColor, 0.5) : 'rgba(20,168,154,0.5)',
            borderWidth: 1,
            borderColor: customColor || COLORS.primaryDark
          }
        },
        label: label,
        barGap: '20%',
        barCategoryGap: '30%'
      };
      if (stacked) { ser.stack = 'total'; }
      return ser;
    });

    // 图例置顶右（右上角）；其底部到直方图区域（含顶部数值标签）保持 10px 间距
    var gridTop;
    if (multi) gridTop = opts.showValueLabel ? 50 : 26;
    else gridTop = opts.showValueLabel ? 36 : 24;

    var option = {
      backgroundColor: COLORS.tooltipBg,
      grid: {
        left: opts.gridLeft === undefined ? 44 : opts.gridLeft,
        right: opts.gridRight === undefined ? 16 : opts.gridRight,
        top: gridTop,
        bottom: opts.rotate ? 44 : 28,
        containLabel: false
      },
      xAxis: {
        type: 'category',
        data: chartData.xAxis || [],
        axisLine: { lineStyle: { color: COLORS.grid } },
        axisTick: { show: false },
        axisLabel: {
          color: COLORS.sub,
          fontSize: 12,
          interval: opts.interval === undefined ? 0 : opts.interval,
          rotate: opts.rotate === undefined ? 0 : opts.rotate
        }
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: COLORS.gridLight } },
        axisLabel: { color: COLORS.sub, fontSize: 12 },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: COLORS.tooltipBg,
        borderColor: 'rgba(0,0,0,0.05)',
        borderWidth: 1,
        borderRadius: 10,
        padding: [10, 12],
        textStyle: { color: COLORS.text, fontSize: 12 },
        extraCssText: 'z-index:999;'
      },
      legend: multi ? {
        top: 0, right: 12, icon: 'roundRect', itemWidth: 14, itemHeight: 8,
        textStyle: { color: COLORS.text, fontSize: 12 }
      } : { show: false },
      dataZoom: opts.dataZoom ? (Array.isArray(opts.dataZoom) ? opts.dataZoom : [opts.dataZoom]).map(function (c) {
        return Object.assign({
          type: 'inside', xAxisIndex: 0, start: 0, end: 100,
          zoomOnMouseWheel: false, moveOnMouseWheel: false, moveOnMouseMove: true
        }, c || {});
      }) : undefined,
      series: series
    };

    if (opts.customOption) return opts.customOption;
    return option;
  };

  global.HistogramChart = new HistogramChart();
})(window);
