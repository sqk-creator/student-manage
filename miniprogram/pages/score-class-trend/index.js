const { get } = require('../../utils/request');
const charts = require('../../utils/charts');

const SUBJECT_ORDER = ['语文', '数学', '英语', '政治', '历史', '地理'];

Page({
  data: {
    statusBarHeight: 20,
    capsuleSpace: 92,
    gradeOptions: [],
    gradeIndex: 0,
    classOptions: [],
    classIndex: 0,
    showTypeSwitch: false,
    types: [],
    activeType: '',
    subjBtns: [{ key: 'total', label: '总分' }],
    activeSubj: 'total',
    classInfo: { name: '', type: '', studentCount: 0, avatars: [] },
    summary: {
      scoreRate: 0,
      totalAvg: 0,
      maxAvg: 0,
      minAvg: 0,
      avgPassAll: 0,
      excRate: 0,
      goodRate: 0,
      passRate: 0,
      failRate: 0
    },
    distData: { xAxis: [], series: [] },
    evalText: '',
    evalColor: '#14A89A',
    evalNote: '',
    radarTag: '',
    radarStats: { max: 0, min: 0, range: 0, avg: 0 },
    studentList: [],
    lineItems: [],
    groups: [],
    loading: false,
    emptyMsg: '',
    hasData: false,
    stickyTop: 0
  },

  onReady() {
    setTimeout(() => this.measureHeader(), 300);
  },

  measureHeader() {
    wx.createSelectorQuery()
      .in(this)
      .select('.page-header')
      .boundingClientRect((rect) => {
        if (rect && rect.height) {
          this.setData({ stickyTop: rect.height });
        }
      })
      .exec();
  },

  onLoad(options) {
    this.initLayout();
    this.preGradeId = options.grade_id || '';
    this.preClassId = options.class_id || '';
    this.preClassName = options.class_name || '';
    this.loadGrades();
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
    if (tab === 'class') return;
    if (tab === 'exam') {
      wx.navigateTo({ url: '/pages/score-exam-list/index' });
      return;
    }
    if (tab === 'grade') {
      const gid = this.getGradeId();
      wx.navigateTo({
        url: gid ? '/pages/score-grade-trend/index?grade_id=' + gid : '/pages/score-grade-trend/index'
      });
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

  getGradeId() {
    const opt = this.data.gradeOptions[this.data.gradeIndex];
    return opt ? opt.id : '';
  },

  getClassId() {
    const opt = this.data.classOptions[this.data.classIndex];
    return opt ? opt.id : '';
  },

  loadGrades() {
    get('/api/public/grades')
      .then((grades) => {
        const list = (grades || []).map((g) => ({
          id: String(g.id),
          name: g.grade_name
        }));
        let idx = 0;
        if (this.preGradeId) {
          const found = list.findIndex((g) => g.id === String(this.preGradeId));
          if (found >= 0) idx = found;
        }
        this.setData({ gradeOptions: list, gradeIndex: idx });
        this.loadClasses();
      })
      .catch(() => {
        this.setData({ hasData: false, emptyMsg: '年级数据加载失败' });
      });
  },

  loadClasses() {
    const gid = this.getGradeId();
    if (!gid) {
      this.setData({ hasData: false, emptyMsg: '请选择年级后查看班级数据' });
      return;
    }
    get('/api/public/classes')
      .then((all) => {
        const list = (all || [])
          .filter((c) => String(c.grade_id) === String(gid))
          .map((c) => ({ id: String(c.id), name: c.name }));
        let idx = 0;
        if (this.preClassId) {
          const found = list.findIndex((c) => c.id === String(this.preClassId));
          if (found >= 0) idx = found;
        }
        this.setData({ classOptions: list, classIndex: idx });
        if (!list.length) {
          this.setData({ hasData: false, emptyMsg: '该年级暂无班级' });
          return;
        }
        this.loadTrend();
      })
      .catch(() => {
        this.setData({ hasData: false, emptyMsg: '班级数据加载失败' });
      });
  },

  onGradeChange(e) {
    this.setData({
      gradeIndex: Number(e.detail.value),
      classIndex: 0,
      activeType: '',
      activeSubj: 'total'
    });
    this.loadClasses();
  },

  onClassChange(e) {
    this.setData({
      classIndex: Number(e.detail.value),
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
    this.setData({ activeSubj: subj });
    this.drawLineChart();
  },

  onTrendTouchStart(e) {
    const t = e.touches && e.touches[0];
    if (!t) return;
    const idx = this.trendIdxFromXY(t.x, t.y);
    if (idx >= 0) this.renderTrendSelection(idx);
  },

  onTrendTouchMove(e) {
    const t = e.touches && e.touches[0];
    if (!t) return;
    const idx = this.trendIdxFromXY(t.x, t.y);
    if (idx >= 0) this.renderTrendSelection(idx);
  },

  onTrendTouchEnd() {
    this.renderTrendSelection(-1);
  },

  trendIdxFromXY(x, y) {
    const g = this.trendGeom;
    if (!g || !g.xs || !g.xs.length) return -1;
    if (x < g.padL - 30 || x > g.w - g.padR + 30) return -1;
    let best = 0;
    let bd = Infinity;
    g.xs.forEach((v, i) => {
      const d = Math.abs(v - x);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  },

  renderTrendSelection(idx) {
    charts.getCanvas(this, 'trendCanvas').then((res) => {
      if (!res) return;
      if (idx >= 0 && this.trendGeom) {
        charts.drawTrendSelected(res.ctx, res.w, res.h, this.trendGeom, idx);
      } else if (this.currentLineItems) {
        this.trendGeom = charts.drawLineTrend(
          res.ctx,
          res.w,
          res.h,
          this.currentLineItems
        );
      }
    });
  },

  onRadarTouchStart(e) {
    const t = e.touches && e.touches[0];
    if (!t) return;
    const idx = charts.radarIdxFromXY(this.radarGeom, t.x, t.y);
    if (idx >= 0) this.renderRadarSelection(idx);
  },

  onRadarTouchMove(e) {
    const t = e.touches && e.touches[0];
    if (!t) return;
    const idx = charts.radarIdxFromXY(this.radarGeom, t.x, t.y);
    if (idx >= 0) this.renderRadarSelection(idx);
  },

  onRadarTouchEnd() {
    this.renderRadarSelection(-1);
  },

  renderRadarSelection(idx) {
    charts.getCanvas(this, 'radarCanvas').then((res) => {
      if (!res) return;
      if (idx >= 0 && this.radarGeom) {
        this.radarGeom = charts.drawRadarSelected(
          res.ctx,
          res.w,
          res.h,
          this.radarGeom,
          idx
        );
      } else if (this.radarItems) {
        this.radarGeom = charts.drawRadar(res.ctx, res.w, res.h, this.radarItems);
      }
    });
  },

  loadTrend(etype) {
    const gid = this.getGradeId();
    const cid = this.getClassId();
    if (!gid || !cid) {
      this.setData({ hasData: false, emptyMsg: '请选择年级和班级后查看数据' });
      return;
    }
    this.setData({ loading: true });
    get('/api/public/class-trend', { class_id: cid })
      .then((d) => {
        if (!d || !d.groups || !d.groups.length) {
          this.setData({
            hasData: false,
            loading: false,
            emptyMsg: '暂无统考数据'
          });
          return;
        }
        this.renderTrend(d, etype);
      })
      .catch(() => {
        this.setData({ hasData: false, loading: false, emptyMsg: '数据加载失败' });
      });
  },

  renderTrend(d, etype) {
    const s = d.summary || {};
    const allTypes = [];
    d.groups.forEach((g) => {
      if (allTypes.indexOf(g.exam_type) === -1) allTypes.push(g.exam_type);
    });
    const type = etype || this.data.activeType || allTypes[0] || '';
    let groups = d.groups.filter((g) => g.exam_type === type);
    if (!groups.length) groups = d.groups;
    const activeType = type || groups[0].exam_type || '';

    const srList = groups.map((g) =>
      g.total_score > 0 ? Math.round(g.avg_total / g.total_score * 100) : 0
    );
    const scoreRate = srList.length
      ? Math.round(srList.reduce((a, b) => a + b, 0) / srList.length)
      : 0;
    const avgs = groups.map((g) => g.avg_total || 0);
    const totalAvg = s.avg_total || 0;
    const maxAvg = avgs.length ? Math.max.apply(null, avgs) : 0;
    const minAvg = avgs.length ? Math.min.apply(null, avgs) : 0;

    const subjSet = {};
    groups.forEach((g) => {
      (g.subjects || []).forEach((sub) => {
        subjSet[sub.subject] = true;
      });
    });
    const subjBtns = [{ key: 'total', label: '总分' }].concat(
      Object.keys(subjSet).map((k) => ({ key: k, label: k }))
    );

    const lineItems = groups.map((g) => ({
      name: g.group_name,
      value: g.avg_total || 0,
      max: g.total_score || 0
    }));

    const distBkts = [
      { range: '<60', min: 0, max: 60 },
      { range: '60-70', min: 60, max: 70 },
      { range: '70-80', min: 70, max: 80 },
      { range: '80-90', min: 80, max: 90 },
      { range: '90-100', min: 90, max: 101 }
    ];
    const lastGrp = groups[groups.length - 1];
    const distTotalScore = (lastGrp && lastGrp.total_score) || 0;
    const distCounts = [0, 0, 0, 0, 0];
    (d.students || []).forEach((st) => {
      const m = distTotalScore > 0 ? (st.avg_total || 0) / distTotalScore * 100 : 0;
      for (let b = 0; b < distBkts.length; b++) {
        if (m >= distBkts[b].min && m < distBkts[b].max) {
          distCounts[b]++;
          break;
        }
      }
    });
    const distData = {
      xAxis: distBkts.map((b) => b.range),
      series: [{ name: '学生人数', data: distCounts, color: '#14A89A' }]
    };

    const rateAvg = {};
    ['excellent_rate', 'good_rate', 'pass_rate', 'fail_rate'].forEach((k) => {
      const list = groups.map((g) => g[k] || 0).filter((v) => !isNaN(v));
      rateAvg[k] = list.length
        ? Math.round(list.reduce((a, b) => a + b, 0) / list.length)
        : 0;
    });
    const passAllList = groups
      .map((g) => (g.excellent_rate || 0) + (g.good_rate || 0) + (g.pass_rate || 0))
      .filter((v) => !isNaN(v));
    const avgPassAll = passAllList.length
      ? Math.round(passAllList.reduce((a, b) => a + b, 0) / passAllList.length)
      : 0;

    const evalObj = this.evalDistText(distCounts);
    const evalTotal = distCounts.reduce((a, b) => a + b, 0);
    const evalNote = evalTotal < 15 ? '样本数量较少，分布仅供参考。' : '';
    const evalText = evalObj.text;
    const evalColor = evalObj.color;

    let radarItems = [];
    let radarTag = '';
    let radarStats = { max: 0, min: 0, range: 0, avg: 0 };
    if (lastGrp && lastGrp.subjects) {
      const items = SUBJECT_ORDER.map((name) => {
        const sj = (lastGrp.subjects || []).find((s) => s.subject === name);
        return { name, value: sj ? sj.avg_score : 0, max: sj ? sj.max_score : 0 };
      });
      if (items.some((it) => it.max > 0)) {
        const standards = items.map((it) =>
          it.max > 0 ? Math.round(it.value / it.max * 100 * 10) / 10 : 0
        );
        const ana = this.radarAnalyze(standards);
        radarItems = items;
        radarTag = ana.tags[0] || '';
        radarStats = { max: ana.max, min: ana.min, range: ana.range, avg: ana.avg };
      }
    }
    this.radarItems = radarItems;

    const students = d.students || [];
    const sortedStudents = students.slice().sort((a, b) => (b.avg_total || 0) - (a.avg_total || 0));
    const studentList = sortedStudents.map((st, i) => {
      const rank = i + 1;
      const change = st.recent_change || 0;
      const cc = change > 0 ? 'up' : change < 0 ? 'down' : 'zero';
      const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '';
      const sign = change >= 0 ? '+' : '';
      return {
        rank: rank < 10 ? '0' + rank : String(rank),
        student_id: st.student_id,
        name: st.student_name,
        avatar: st.photo ? st.photo : (st.student_name || '').slice(0, 1),
        hasPhoto: !!st.photo,
        avg: st.avg_total,
        changeText: sign + change,
        changeClass: cc,
        arrow,
        trend: (st.trends || []).map((t) => t.total || 0)
      };
    });

    const classInfo = {
      name: d.class_name || '',
      type: d.class_type || '',
      studentCount: students.length,
      avatars: students.slice(0, 3).map((st) => ({
        src: st.photo,
        letter: (st.student_name || '').slice(0, 1)
      }))
    };

    const types = allTypes.map((t) => ({ key: t, label: this.examTypeShort(t) }));

    this.setData(
      {
        hasData: true,
        loading: false,
        emptyMsg: '',
        showTypeSwitch: types.length > 1,
        types,
        activeType,
        groups,
        subjBtns,
        activeSubj: this.data.activeSubj,
        summary: {
          scoreRate,
          totalAvg,
          maxAvg,
          minAvg,
          avgPassAll,
          excRate: rateAvg.excellent_rate,
          goodRate: rateAvg.good_rate,
          passRate: rateAvg.pass_rate,
          failRate: rateAvg.fail_rate
        },
        distData,
        evalText,
        evalColor,
        evalNote,
        radarTag,
        radarStats,
        studentList,
        classInfo,
        lineItems
      },
      () => {
        setTimeout(() => this.drawCharts(), 120);
      }
    );
  },

  evalDistText(c) {
    const total = c.reduce((a, b) => a + b, 0);
    if (!total) return { text: '暂无分布数据', color: '#909399' };
    const maxV = Math.max.apply(null, c);
    const peaks = [];
    c.forEach((v, i) => {
      if (v === maxV) peaks.push(i);
    });
    const first = peaks[0];
    const last = peaks[peaks.length - 1];
    let hasGap = false;
    for (let i = 1; i < c.length - 1; i++) {
      if (c[i] <= 0) hasGap = true;
    }
    let maxDrop = 0;
    for (let i = 1; i < c.length; i++) {
      const dd = c[i] - c[i - 1];
      if (dd > maxDrop) maxDrop = dd;
    }
    if (hasGap && maxDrop >= Math.max(3, Math.round(maxV * 0.5))) {
      return { text: '区间断层，稍显分化', color: '#e4814c' };
    }
    if (peaks.indexOf(0) >= 0 && peaks.indexOf(c.length - 1) >= 0 && c.length >= 3) {
      const midMin = Math.min.apply(null, c.slice(1, c.length - 1));
      if (midMin < maxV * 0.5) return { text: '两极分化，分层明显', color: '#eb7555' };
    }
    const minVal = Math.min.apply(null, c);
    const span = maxV - minVal;
    if (span <= Math.max(2, Math.round(maxV * 0.25))) {
      return { text: '分布均匀，水平分散', color: '#8097b2' };
    }
    if (first === 0) return { text: '低分居多，基础偏弱', color: '#f2994a' };
    if (last === c.length - 1) return { text: '高分居多，学情向好', color: '#27ae60' };
    if (first > 0 && last < c.length - 1) {
      return { text: '中等居多，梯队均衡', color: '#14A89A' };
    }
    if (first <= 1) return { text: '低分居多，基础偏弱', color: '#f2994a' };
    if (last >= c.length - 2) return { text: '高分居多，学情向好', color: '#27ae60' };
    return { text: '中等居多，梯队均衡', color: '#14A89A' };
  },

  radarAnalyze(standards) {
    const valid = standards.filter((v) => v != null && !isNaN(v));
    const max = valid.length ? Math.max.apply(null, valid) : 0;
    const min = valid.length ? Math.min.apply(null, valid) : 0;
    const range = Math.round((max - min) * 10) / 10;
    const avg = valid.length
      ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length * 10) / 10
      : 0;
    const tags = [];
    if (range >= 22) {
      tags.push('偏科');
    } else {
      tags.push('全科均衡');
      if (avg >= 78 && valid.every((v) => v >= 65)) tags.push('文科优势');
      if (avg < 62) tags.push('文科短板');
    }
    return { max, min, range, avg, tags };
  },

  drawCharts() {
    const { lineItems, distData, studentList } = this.data;

    charts.getCanvas(this, 'trendCanvas').then((res) => {
      if (!res) return;
      this.currentLineItems = lineItems;
      this.trendGeom = charts.drawLineTrend(res.ctx, res.w, res.h, lineItems);
    });

    charts.getCanvas(this, 'distCanvas').then((res) => {
      if (!res) return;
      charts.drawHistogram(res.ctx, res.w, res.h, distData, { stack: false });
    });

    charts.getCanvas(this, 'radarCanvas').then((res) => {
      if (!res) return;
      this.radarGeom = charts.drawRadar(res.ctx, res.w, res.h, this.radarItems);
    });

    studentList.forEach((st, i) => {
      charts.getCanvas(this, 'spark' + i).then((res) => {
        if (!res) return;
        charts.drawSparkline(res.ctx, res.w, res.h, st.trend);
      });
    });
  },

  drawLineChart() {
    const groups = this.buildLineItems();
    this.currentLineItems = groups;
    charts.getCanvas(this, 'trendCanvas').then((res) => {
      if (!res) return;
      this.trendGeom = charts.drawLineTrend(res.ctx, res.w, res.h, groups);
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

  onStudentTap(e) {
    const item = this.data.studentList[e.currentTarget.dataset.index];
    if (!item || !item.student_id) return;
    wx.navigateTo({
      url: '/pages/score-student/index?student_id=' + item.student_id
    });
  }
});
