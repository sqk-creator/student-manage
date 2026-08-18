/* ============================================================
 * ChartBase 通用图表容器基类
 * 折线图、雷达图、直方图共用同一套开发范式：
 *  - 统一入参：chartData、自定义 option、loading、空状态文案
 *  - 统一数据格式：{ xAxis: [], series: [{ name, data }] }
 *  - 自适应 resize、实例自动销毁、加载态 / 空状态
 *  - 统一配色 / tooltip / 图例 / 字体样式常量
 * ============================================================ */
(function (global) {
  var COLORS = {
    primary: '#14A89A',
    primaryDark: '#0B6D55',
    primaryLight: '#2BBFAF',
    grid: '#E8E8E8',
    gridLight: '#F2F3F5',
    fill: 'rgba(20,168,154,0.16)',
    text: '#1D2129',
    sub: '#86909C',
    tooltipBg: '#ffffff',
    warning: '#FF7D00'
  };

  var CHART_STYLE = {
    tooltip: {
      backgroundColor: COLORS.tooltipBg,
      borderColor: 'rgba(0,0,0,0.05)',
      borderWidth: 1,
      borderRadius: 10,
      padding: [10, 12],
      textStyle: { color: COLORS.text, fontSize: 12 },
      extraCssText: 'z-index:999;'
    },
    axisLabel: { color: COLORS.sub, fontSize: 12 },
    splitLine: { lineStyle: { color: COLORS.gridLight } }
  };

  // 统一柱状渐变：垂直线性渐变，上方亮色、下方深色（同色系，主色调变更只改 COLORS）
  function createBarGradient(topColor, bottomColor) {
    return new global.echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: topColor || COLORS.primaryLight },
      { offset: 1, color: bottomColor || COLORS.primary }
    ]);
  }
  // 统一柱状常态阴影：柔和同色系阴影，提升质感
  function barShadow(opts) {
    opts = opts || {};
    return { shadowBlur: opts.blur == null ? 8 : opts.blur, shadowColor: opts.color || 'rgba(20,168,154,0.28)' };
  }

  function isAllEmpty(chartData) {
    if (!chartData) return true;
    var s = chartData.series || [];
    if (!s.length) return true;
    return s.every(function (se) {
      var d = (se && se.data) || [];
      if (!d.length) return true;
      return d.every(function (v) { return v == null || isNaN(v) || v === 0; });
    });
  }

  var KEY_SEQ = 0;

  function ChartBase() {
    this._instances = {};
  }

  ChartBase.prototype = {
    render: function (container, chartData, opts) {
      opts = opts || {};
      if (!container) return null;
      var key = opts.key || container.id || ('chart_' + (KEY_SEQ++));
      this._destroy(key);
      if (!global.echarts) return null;

      var isEmpty = (this._isEmpty ? this._isEmpty(chartData) : isAllEmpty(chartData));
      if (isEmpty) {
        this._showEmpty(container, opts.emptyText || '暂无数据');
        var emptyInst = { chart: null, empty: true };
        this._instances[key] = emptyInst;
        return this._emptyApi(key, container, opts);
      }

      this._clearEmpty(container);
      var option = this._buildOption ? this._buildOption(chartData, opts) : {};
      var chart = global.echarts.init(container, null, { renderer: 'canvas' });
      if (option) chart.setOption(option);

      var inst = { chart: chart, key: key };
      var self = this;
      inst.handler = function () {
        try { if (inst.chart) inst.chart.resize(); } catch (e) {}
      };
      global.addEventListener('resize', inst.handler);
      this._instances[key] = inst;

      if (opts.loading) this._setLoading(chart, true);
      if (this._onReady) this._onReady(chart, container, chartData, opts, inst);

      return this._api(key);
    },

    _api: function (key) {
      var self = this;
      return {
        getChart: function () {
          var i = self._instances[key];
          return i ? i.chart : null;
        },
        resize: function () {
          var i = self._instances[key];
          if (i && i.chart) { try { i.chart.resize(); } catch (e) {} }
        },
        dispose: function () { self._destroy(key); },
        setLoading: function (b) {
          var i = self._instances[key];
          if (i && i.chart) self._setLoading(i.chart, b);
        },
        setEmpty: function (t) {
          var i = self._instances[key];
          if (i && i.chart) { try { i.chart.dispose(); } catch (e) {} }
          delete self._instances[key];
          var c = self._instances;
          var cont = null;
          for (var k in c) { if (c[k] === i) cont = k; }
          self._showEmpty(document.getElementById(key) || null, t || '暂无数据');
        }
      };
    },

    _emptyApi: function (key, container, opts) {
      var self = this;
      return {
        getChart: function () { return null; },
        resize: function () {},
        dispose: function () { self._destroy(key); },
        setLoading: function () {},
        setEmpty: function (t) { self._showEmpty(container, t || '暂无数据'); }
      };
    },

    _destroy: function (key) {
      var inst = this._instances[key];
      if (inst) {
        if (inst.chart) { try { inst.chart.dispose(); } catch (e) {} }
        if (inst.handler) { global.removeEventListener('resize', inst.handler); }
        delete this._instances[key];
      }
    },

    _setLoading: function (chart, b) {
      try {
        if (b) chart.showLoading('default', { text: '加载中...', textColor: COLORS.sub, maskColor: 'rgba(255,255,255,0.6)' });
        else chart.hideLoading();
      } catch (e) {}
    },

    _showEmpty: function (container, text) {
      if (!container) return;
      container.style.background = COLORS.tooltipBg;
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:120px;font-size:13px;color:' + COLORS.sub + ';">' + text + '</div>';
    },

    _clearEmpty: function (container) {
      if (!container) return;
      container.style.background = '';
    }
  };

  global.ChartBase = ChartBase;
  global.CHART_COLORS = COLORS;
  global.CHART_STYLE = CHART_STYLE;
  global.createBarGradient = createBarGradient;
  global.barShadow = barShadow;
})(window);
