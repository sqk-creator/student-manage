/* ============================================================
 * 统一图表组件 TS 类型定义
 * 折线图 LineChart / 雷达图 RadarChart / 直方图 HistogramChart
 * 基于 ChartBase 统一范式
 * ============================================================ */

export type ChartSeries = {
  name?: string;
  data: number[];
};

/** 统一数据格式：折线图 / 直方图 */
export type ChartData = {
  xAxis: string[];
  series: ChartSeries[];
};

/** 雷达图数据项（原始分 + 科目满分，组件内自动换算标准分） */
export type RadarChartItem = {
  name: string;
  value: number;
  max: number;
};

/** 通用渲染参数 */
export type ChartOptions = {
  /** 实例唯一 key（默认取容器 id），用于实例复用与自动销毁 */
  key?: string;
  /** 自定义 option，深合并覆盖默认配置 */
  customOption?: Record<string, unknown>;
  /** 是否显示加载态 */
  loading?: boolean;
  /** 空状态文案（默认「暂无数据」） */
  emptyText?: string;
};

/** 直方图扩展参数 */
export type HistogramChartOptions = ChartOptions & {
  /** 是否显示顶部数值标签（默认 false） */
  showValueLabel?: boolean;
  /** X 轴刻度抽稀间隔（默认 0 全部显示） */
  interval?: number;
  /** X 轴刻度旋转角度（防重叠，默认 0） */
  rotate?: number;
};

/** 组件返回的统一实例 API */
export type ChartInstance = {
  getChart(): unknown | null;
  resize(): void;
  dispose(): void;
  setLoading(on: boolean): void;
  setEmpty(text?: string): void;
};

export type LineChartStatic = {
  render(container: HTMLElement | null, data: ChartData, opts?: ChartOptions): ChartInstance | null;
};

export type HistogramChartStatic = {
  render(container: HTMLElement | null, data: ChartData, opts?: HistogramChartOptions): ChartInstance | null;
};

export type RadarChartStatic = {
  render(container: HTMLElement | null, items: RadarChartItem[], opts?: ChartOptions): ChartInstance | null;
  normalize(score: number, full: number): number;
  analyze(standards: number[]): { max: number; min: number; range: number; avg: number; tags: string[] };
  SUBJECT_ORDER: string[];
};

declare global {
  const LineChart: LineChartStatic;
  const HistogramChart: HistogramChartStatic;
  const RadarChart: RadarChartStatic;
}
