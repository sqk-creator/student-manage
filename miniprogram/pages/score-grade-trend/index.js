const { get } = require('../../utils/request');
const charts = require('../../utils/charts');

Page({
  data: {
    statusBarHeight: 20,
    capsuleSpace: 92,
    gradeOptions: [],
    gradeIndex: 0,
    gradeName: '',
    showTypeSwitch: false,
    types: [],
    activeType: '',
    subjBtns: [{ key: 'total', label: '总分' }],
    activeSubj: 'total',
    summary: {
      scoreRate: 0,
      totalExams: 0,
      totalAvg: 0,
      maxAvg: 0,
      minAvg: 0,
      excRate: 0,
      goodRate: 0,
      passRate: 0
    },
    rateDistData: { xAxis: [], series: [] },
    passDistData: { xAxis: [], series: [] },
    rateDistWidth: 0,
    passDistWidth: 0,
    classList: [],
    lineItems: [],
    trendItems: [],
    groups: [],
    loading: false,
    emptyMsg: '',
    hasData: false
  },

  onLoad(options) {
    this.initLayout();
    this.loadGrades(options.grade_id || '');
  },

  initLayout() {
    try {
      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const menu = wx.getMenuButtonBoundingClientRect();
      this.setData({
        statusBarHeight: win.statusBarHeight,
        capsuleSpace: win.windowWidth - menu.left + 8
      });
    } catch (e) {}
  },

  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  onMainTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === 'grade') return;
    if (tab === 'exam') {
      wx.navigateTo({ url: '/pages/score-exam-list/index' });
      return;
    }
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  examTypeShort(t) {
    if (t === 'comprehensive') return '理科';
    if (t === 'liberal_arts') return '文科';
    if (t === 'general') return '综合';
    return t || '';
  },

  loadGrades(preGid) {
    get('/api/public/grades')
      .then((grades) => {
        const list = (grades || []).map((g) => ({
          id: String(g.id),
          name: g.grade_name
        }));
        let idx = 0;
        if (preGid) {
          const found = list.findIndex((g) => g.id === String(preGid));
          if (found >= 0) idx = found;
        }
        this.setData({ gradeOptions: list, gradeIndex: idx });
        this.loadTrend();
      })
      .catch(() => {
        this.setData({ hasData: false, emptyMsg: '年级数据加载失败' });
      });
  },

  onGradeChange(e) {
    const idx = Number(e.detail.value);
    this.setData({
      gradeIndex: idx,
      activeType: '',
      activeSubj: 'total'
    });
    this.loadTrend();
  },

  onTypeTap(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.activeType) return;
    this.setData({ activeType: type });
    this.loadTrend(type);
  },

  onSubjTap(e) {
    const subj = e.currentTarget.dataset.subj;
    if (subj === this.data.activeSubj) return;
    this.setData({
      activeSubj: subj,
      // 切换科目：构造该科分组数据交由 trend-line 组件重绘（复用折线图加载动效）
      trendItems: this.buildLineItems()
    });
  },

  getGradeId() {
    const opt = this.data.gradeOptions[this.data.gradeIndex];
    return opt ? opt.id : '';
  },

  loadTrend(etype) {
    const gid = this.getGradeId();
    if (!gid) {
      this.setData({ hasData: false, emptyMsg: '请选择年级后查看趋势数据' });
      return;
    }
    this.setData({ loading: true });
    const params = { grade_id: gid };
    if (etype) params.exam_type = etype;
    get('/api/public/grade-trend', params)
      .then((d) => {
        if (!d || !d.groups || !d.groups.length) {
          this.setData({
            hasData: false,
            loading: false,
            emptyMsg: '暂无' + this.examTypeShort(d ? d.exam_type : etype) + '统考数据'
          });
          return;
        }
        this.renderTrend(d);
      })
      .catch(() => {
        this.setData({ hasData: false, loading: false, emptyMsg: '数据加载失败' });
      });
  },

  renderTrend(d) {
    const s = d.summary || {};
    const groups = d.groups || [];
    const classes = d.classes || [];
    const totals = groups.map((g) => g.avg_total || 0);
    const totalAvg = totals.length
      ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length)
      : 0;
    const maxAvg = totals.length ? Math.max.apply(null, totals) : 0;
    const minAvg = totals.length ? Math.min.apply(null, totals) : 0;

    const subjSet = {};
    groups.forEach((g) => {
      (g.subjects || []).forEach((sub) => {
        subjSet[sub.subject] = true;
      });
    });
    const subjBtns = [{ key: 'total', label: '总分' }].concat(
      Object.keys(subjSet).map((k) => ({ key: k, label: k }))
    );

    const distNames = [];
    const distGoods = [];
    const distExcs = [];
    classes.forEach((cls) => {
      let gc = 0;
      let ec = 0;
      let gcN = 0;
      let ecN = 0;
      (cls.trends || []).forEach((t) => {
        if (t.good_count != null) {
          gc += t.good_count;
          gcN++;
        }
        if (t.excellent_count != null) {
          ec += t.excellent_count;
          ecN++;
        }
      });
      distNames.push(cls.class_name);
      distGoods.push(gcN ? Math.round(gc / gcN) : 0);
      distExcs.push(ecN ? Math.round(ec / ecN) : 0);
    });
    const rateDistData = {
      xAxis: distNames,
      series: [
        { name: '良好', data: distGoods, color: '#2979FF' },
        { name: '优秀', data: distExcs, color: '#14A89A' }
      ]
    };

    const passAvg =
      (s.avg_excellent_rate || 0) + (s.avg_good_rate || 0) + (s.avg_pass_rate || 0);
    const passNames = [];
    const passData = [];
    classes.forEach((cls) => {
      let pc = 0;
      let cn = 0;
      (cls.trends || []).forEach((t) => {
        if (t.pass_count != null) {
          pc += t.pass_count + (t.good_count || 0) + (t.excellent_count || 0);
          cn++;
        }
      });
      passNames.push(cls.class_name);
      passData.push(cn ? Math.round(pc / cn) : 0);
    });
    const passDistData = {
      xAxis: passNames,
      series: [{ name: '及格人数', data: passData, color: '#2979FF' }]
    };

    const sortedClasses = classes
      .slice()
      .sort((a, b) => (b.avg_total || 0) - (a.avg_total || 0));
    const classList = sortedClasses.map((cls, i) => {
      const rank = i + 1;
      const change = cls.recent_change || 0;
      const cc = change > 0 ? 'up' : change < 0 ? 'down' : 'zero';
      const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '';
      const sign = change >= 0 ? '+' : '';
      return {
        rank: rank < 10 ? '0' + rank : String(rank),
        class_id: cls.class_id,
        name: cls.class_name,
        avg: cls.avg_total,
        changeText: sign + change,
        changeClass: cc,
        arrow,
        trend: (cls.trends || []).map((t) => t.avg_total || 0)
      };
    });

    const lineItems = groups.map((g) => ({
      name: g.group_name,
      value: g.avg_total || 0,
      max: g.total_score || 0
    }));

    const types = (d.available_types || []).map((t) => ({
      key: t,
      label: this.examTypeShort(t)
    }));
    const type = d.exam_type || (types.length ? types[0].key : '');
    const activeSubj = this.data.activeSubj;

    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const winW = info.windowWidth || 375;
    const rpx = winW / 750;
    const cardInnerW = Math.max(120, winW - 136 * rpx);
    const minSlot = 44 * rpx;
    const rateDistWidth = Math.max(cardInnerW, distNames.length * minSlot);
    const passDistWidth = Math.max(cardInnerW, passNames.length * minSlot);

    this.setData(
      {
        hasData: true,
        loading: false,
        emptyMsg: '',
        gradeName: d.grade_name || '',
        showTypeSwitch: types.length > 1,
        types,
        activeType: type,
        subjBtns,
        activeSubj: activeSubj === 'total' ? 'total' : activeSubj,
        groups: d.groups || [],
        rateDistWidth,
        passDistWidth,
        summary: {
          scoreRate: s.avg_score_rate || 0,
          totalExams: s.total_exams || 0,
          totalAvg,
          maxAvg,
          minAvg,
          excRate: s.avg_excellent_rate || 0,
          goodRate: s.avg_good_rate || 0,
          passRate: passAvg
        },
        rateDistData,
        passDistData,
        classList,
        lineItems,
        trendItems: activeSubj === 'total' ? lineItems : this.buildLineItems()
      },
      () => {
        setTimeout(() => this.drawCharts(), 120);
      }
    );
  },

  drawCharts() {
    const { lineItems, rateDistData, passDistData, classList, summary } = this.data;
    const gaugeRate = summary.scoreRate || 0;

    charts.getCanvas(this, 'gaugeCanvas').then((res) => {
      if (!res) return;
      this._gv = -1;
      this._gaugeT = 0;
      charts.animateGauge({
        ctx: res.ctx,
        node: res.node,
        w: res.w,
        h: res.h,
        targetRate: gaugeRate,
        onFrame: (val) => {
          // 节流 setData（主因卡顿）：画布本身由 charts.drawGauge 每帧 rAF 绘制，
          // 这里仅需同步顶部数值文本。既要求取整值变化，又限制约 30fps（33ms）才触发，
          // 避免每帧 setData 触发视图层重渲染导致仪表盘与折线图动画掉帧卡顿。
          const now = Date.now();
          if (this._gv !== val && now - this._gaugeT >= 33) {
            this._gv = val;
            this._gaugeT = now;
            this.setData({ 'summary.scoreRate': val });
          }
        },
        // 关键修复：仪表盘动画期间 onFrame 会持续 setData 触发页面重渲染，
        // 并行绘制的折线图 / 直方图 / 火花图画布会被清掉（只有点击后才重绘成功）。
        // 改到仪表盘动画完全结束、setData 风暴停止后再绘制其余图表，保证页面加载即显示。
        onComplete: () => {
          this.drawDistAndSparks(rateDistData, passDistData, classList);
        }
      });
    });
  },

  drawDistAndSparks(rateDistData, passDistData, classList) {
    charts.getCanvas(this, 'rateDistCanvas').then((res) => {
      if (!res) return;
      charts.drawHistogram(res.ctx, res.w, res.h, rateDistData, { stack: true });
    });

    charts.getCanvas(this, 'passDistCanvas').then((res) => {
      if (!res) return;
      charts.drawHistogram(res.ctx, res.w, res.h, passDistData, { stack: false });
    });

    classList.forEach((cls, i) => {
      charts.getCanvas(this, 'spark' + i).then((res) => {
        if (!res) return;
        charts.drawSparkline(res.ctx, res.w, res.h, cls.trend);
      });
    });
  },

  buildLineItems() {
    const subj = this.data.activeSubj;
    if (subj === 'total') return this.data.lineItems;
    const items = [];
    this.data.groups.forEach((g) => {
      const sj = (g.subjects || []).find((s) => s.subject === subj);
      if (sj) {
        items.push({
          name: g.group_name,
          value: sj.avg_score || 0,
          max: sj.max_score || 0
        });
      }
    });
    return items;
  },

  onClassTap(e) {
    const idx = e.currentTarget.dataset.index;
    const item = this.data.classList[idx];
    if (!item || !item.class_id) return;
    wx.navigateTo({
      url:
        '/pages/score-class-trend/index?grade_id=' +
        this.getGradeId() +
        '&class_id=' +
        item.class_id +
        '&class_name=' +
        encodeURIComponent(item.name)
    });
  }
});
