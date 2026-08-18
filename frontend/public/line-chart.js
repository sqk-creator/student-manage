/* ============================================================
 * LineChart 折线图组件
 * 基于 ChartBase 统一范式，数据格式 { xAxis: [], series: [{name, data}] }
 * 沿用主色 / tooltip / 图例 / 字体样式；支持 customOption 全量覆盖
 *
 * 调用示例：
 *   LineChart.render(container, {
 *     xAxis: ['一模','二模','三模'],
 *     series: [{ name:'平均分', data:[85, 88, 90] }]
 *   }, { key:'classTrend', loading:true, emptyText:'暂无数据' });
 *   // 自定义 option 覆盖：
 *   LineChart.render(container, chartData, { key:'x', customOption: { tooltip:{ trigger:'axis' } } });
 * ============================================================ */
(function (global) {
  var ChartBase = global.ChartBase;
  var COLORS = global.CHART_COLORS;
  if (!ChartBase) return;

  function LineChart() { ChartBase.call(this); }
  LineChart.prototype = Object.create(ChartBase.prototype);
  LineChart.prototype.constructor = LineChart;

  LineChart.prototype._buildOption = function (chartData, opts) {
    opts = opts || {};
    if (opts.customOption) return opts.customOption;

    var series = (chartData.series || []).map(function (s) {
      return {
        name: s.name || '',
        type: 'line',
        data: s.data || [],
        smooth: false,
        clip: false,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: COLORS.primary, width: 3 },
        itemStyle: { color: COLORS.primary, borderWidth: 2, borderColor: '#fff' },
        areaStyle: {
          color: new global.echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(20,168,154,0.25)' },
            { offset: 1, color: 'rgba(20,168,154,0)' }
          ])
        }
      };
    });

    return {
      backgroundColor: COLORS.tooltipBg,
      grid: { left: 44, right: 16, top: 30, bottom: 28 },
      xAxis: {
        type: 'category',
        boundaryGap: true,
        data: chartData.xAxis || [],
        axisLine: { lineStyle: { color: COLORS.grid } },
        axisTick: { show: false },
        axisLabel: { color: COLORS.sub, fontSize: 12, interval: 0 }
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
        backgroundColor: COLORS.tooltipBg,
        borderColor: 'rgba(0,0,0,0.05)',
        borderWidth: 1,
        borderRadius: 10,
        padding: [10, 12],
        textStyle: { color: COLORS.text, fontSize: 12 },
        extraCssText: 'z-index:999;'
      },
      legend: (chartData.series || []).length > 1 ? {
        top: 4, textStyle: { color: COLORS.text, fontSize: 12 }, itemWidth: 14, itemHeight: 10
      } : { show: false },
      series: series
    };
  };

  global.LineChart = new LineChart();
})(window);
