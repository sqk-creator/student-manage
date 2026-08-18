# 统一图表组件调用示例

折线图、雷达图、直方图共用同一套开发范式（ChartBase 基类）：
统一入参 `chartData` / 自定义 `option` / `loading` / 空状态文案；统一数据格式 `{ xAxis: [], series: [{ name, data }] }`；自适应 resize、实例自动销毁。

## 引入顺序

```html
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
<script src="chart-base.js"></script>
<script src="line-chart.js"></script>
<script src="radar-chart.js"></script>
<script src="histogram-chart.js"></script>
```

## 折线图 LineChart

```js
var inst = LineChart.render(container, {
  xAxis: ['一模', '二模', '三模'],
  series: [{ name: '平均分', data: [85, 88, 90] }]
}, {
  key: 'line',              // 实例 key，复用/销毁用
  loading: true,            // 显示加载态
  emptyText: '暂无趋势数据', // 空状态文案
  customOption: {           // 自定义 option，全量覆盖默认样式
    tooltip: { trigger: 'axis' }
  }
});
inst.getChart();   // 获取 echarts 实例（做自定义交互）
inst.resize();
inst.setLoading(false);
inst.dispose();
```

## 雷达图 RadarChart

```js
var inst = RadarChart.render(container, [
  { name: '语文', value: 100.4, max: 150 },
  { name: '数学', value: 97,    max: 150 },
  { name: '英语', value: 103.3, max: 150 },
  { name: '政治', value: 73.6,  max: 100 },
  { name: '历史', value: 71,    max: 100 },
  { name: '地理', value: 70.2,  max: 100 }
], { key: 'radar', emptyText: '暂无雷达数据' });

RadarChart.normalize(100.4, 150); // => 66.9（标准分）
RadarChart.analyze([66.9, 64.7, 68.9, 73.6, 71, 70.2]);
// => { max, min, range, avg, tags: ['全科均衡'] }
```

## 直方图 HistogramChart

```js
var inst = HistogramChart.render(container, {
  xAxis: ['<60', '60-70', '70-80', '80-90', '90-100'],
  series: [{ name: '学生人数', data: [3, 28, 14, 5, 0] }]
}, {
  key: 'dist',
  showValueLabel: true,   // 顶部数值标签
  interval: 0,            // X 轴刻度抽稀
  rotate: 0,              // X 轴刻度旋转（防重叠）
  emptyText: '暂无分布数据'
});

// 多系列对比
HistogramChart.render(container, {
  xAxis: ['A', 'B', 'C'],
  series: [
    { name: '男生', data: [5, 8, 3] },
    { name: '女生', data: [4, 7, 2] }
  ]
}, { showValueLabel: true });
```

## 统一 TS 类型

`src/types/charts.d.ts` 提供 `ChartData` / `ChartSeries` / `RadarChartItem` /
`ChartOptions` / `HistogramChartOptions` / `ChartInstance` 等类型定义。
