/**
 * 通用折线图组件（折线图统一标准，全页面复用）
 * 封装：容器样式、600ms 渐进加载动效、触摸命中与悬浮卡片、松手复位、销毁清理、空数据兜底。
 * 所有小程序页面折线图一律复用本组件，禁止各页自绘。
 *
 * 对外 props（与 H5 端 trend-line/index.js 语义完全对齐）：
 *  - items:        Array<{name,value,max}>  旧版数据入参（兼容存量页面，二期迭代用 series）
 *  - series:       Array<{name?,value,max?}> 标准化数据点（与 items 互斥，优先）
 *  - xAxisData:    string[]  X 轴刻度名（优先级高于 series[].name / items[].name）
 *  - chartTitle:   string   图表标题（顶部显示，空则不显示）
 *  - primaryColor: string   主题色（折线/高亮/tooltip 强调色统一引用；兜底 #14A89A）
 *
 * 注意：底层布局（grid/boundaryGap/tooltip 偏移）均收敛在 utils/charts.js，
 * 业务调用方不能覆盖；这里只做数据到几何的归一 + 生命周期管理。
 */
const charts = require('../../utils/charts.js');

Component({
  properties: {
    // ---- 旧版数据兼容入参 ----
    items: { type: Array, value: [] },
    // ---- 标准化入参（与 H5 对齐） ----
    series: { type: Array, value: [] },
    xAxisData: { type: Array, value: [] },
    chartTitle: { type: String, value: '' },
    primaryColor: { type: String, value: '' }
  },
  data: {
    showTitle: false,
    isEmpty: false
  },
  lifetimes: {
    ready() {
      this._inited = true;
      this.draw();
    },
    detached() {
      // 内存泄漏防护：清动画定时器、断交互实例、释放 canvas 引用，防止定时器在后台空跑累积内存。
      this._inited = false;
      this._ctx = null;
      this._geom = null;
      this._currentItems = null;
      charts.clearTrendTimers();
    }
  },
  observers: {
    'items,series,xAxisData,chartTitle,primaryColor': function () {
      if (this._inited) this.draw();
    }
  },
  methods: {
    // 归一化输入：series 优先（兼容 xAxisData），否则回退 items；结果 {name,value,max}[]。
    normalizeItems() {
      const series = (this.data.series || []).filter(Boolean);
      const items = (this.data.items || []).filter(Boolean);
      const xAxis = this.data.xAxisData || [];
      if (series.length) {
        return series.map((s, i) => ({
          name: (xAxis[i] != null ? xAxis[i] : s.name) || '',
          value: s.value != null ? s.value : 0,
          max: s.max != null ? s.max : 0
        }));
      }
      if (items.length) {
        return items.map((it, i) => ({
          name: (xAxis[i] != null ? xAxis[i] : it.name) || '',
          value: it.value != null ? it.value : 0,
          max: it.max != null ? it.max : 0
        }));
      }
      return [];
    },

    /* 首绘与数据变更共用：走 animateLineTrend，自带 600ms 渐进加载动效（科目切换同理） */
    draw() {
      const items = this.normalizeItems();
      const color = this.data.primaryColor || '';
      this.setData({ isEmpty: items.length === 0 });

      const self = this;
      charts.getCanvas(this, 'trendCanvas').then((res) => {
        if (!res) return;
        const { ctx, node, w, h } = res;
        self._ctx = ctx;
        self._w = w;
        self._h = h;
        if (!items.length) return; // 空数据：不绘制，展示空状态
        self._geom = charts.animateLineTrend(ctx, node, w, h, items, (g) => {
          self._geom = g;
        }, color);
        self._currentItems = items;
      });
    },

    onTouchStart(e) { this.handleTrendTouch(e); },
    onTouchMove(e) { this.handleTrendTouch(e); },
    onTouchEnd() { this.renderTrendSelection(-1); },
    onTouchCancel() { this.renderTrendSelection(-1); },

    handleTrendTouch(e) {
      const t = e.touches && e.touches[0];
      if (!t) return;
      const idx = charts.trendIdxFromXY(this._geom, t.x, t.y);
      if (idx >= 0) this.renderTrendSelection(idx);
    },

    renderTrendSelection(idx) {
      if (!this._ctx) return;
      const color = this.data.primaryColor || '';
      if (idx >= 0 && this._geom) {
        charts.drawTrendSelected(this._ctx, this._w, this._h, this._geom, idx);
      } else if (this._currentItems && this._currentItems.length) {
        this._geom = charts.drawLineTrend(this._ctx, this._w, this._h, this._currentItems, color);
      }
    }
  }
});