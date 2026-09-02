/**
 * 通用折线图组件（折线图统一标准，全页面复用）
 * 封装：容器样式、600ms 渐进加载动效、触摸命中与悬浮卡片、松手复位。
 * 所有小程序页面折线图一律复用本组件，禁止各页自绘。
 * 数据：items = [{ name, value, max }]
 *   name   X 轴标签（考试/单元名）
 *   value  Y 轴数值
 *   max    满分（用于悬浮卡片得分率 = value/max*100）
 * 复用 charts.js：animateLineTrend / drawTrendSelected / drawLineTrend / trendIdxFromXY
 */
const charts = require('../../utils/charts.js');

Component({
  properties: {
    items: { type: Array, value: [] }
  },
  data: {},
  lifetimes: {
    ready() {
      this._inited = true;
      this.draw();
    },
    detached() {
      this._inited = false;
      this._ctx = null;
      this._geom = null;
      this._currentItems = null;
    }
  },
  observers: {
    'items': function () {
      if (this._inited) this.draw();
    }
  },
  methods: {
    /* 首绘与数据变更共用：走 animateLineTrend，自带 600ms 渐进加载动效（科目切换同理） */
    draw() {
      const items = (this.data.items || []).filter(Boolean);
      const self = this;
      charts.getCanvas(this, 'trendCanvas').then((res) => {
        if (!res) return;
        const { ctx, node, w, h } = res;
        self._ctx = ctx;
        self._w = w;
        self._h = h;
        self._geom = charts.animateLineTrend(ctx, node, w, h, items, (g) => {
          self._geom = g;
        });
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
      if (idx >= 0 && this._geom) {
        charts.drawTrendSelected(this._ctx, this._w, this._h, this._geom, idx);
      } else if (this._currentItems && this._currentItems.length) {
        this._geom = charts.drawLineTrend(this._ctx, this._w, this._h, this._currentItems);
      }
    }
  }
});