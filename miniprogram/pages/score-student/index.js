const { get } = require('../../utils/request');
const charts = require('../../utils/charts');

const SUBJECT_ORDER = ['语文', '数学', '英语', '政治', '历史', '地理'];

const EVAL_IMG_MAP = {
  unbalance: '/assets/imgs/badge/badge-unbalance.png',
  liberal_good: '/assets/imgs/badge/badge-liberal-good.png',
  liberal_weak: '/assets/imgs/badge/badge-liberal-weak.png',
  balance: '/assets/imgs/badge/badge-balance.png'
};

Page({
  data: {
    statusBarHeight: 20,
    capsuleSpace: 92,
    loading: true,
    hasData: false,
    emptyMsg: '',
    showTypeSwitch: false,
    types: [],
    activeType: '',
    studentInfo: {
      name: '',
      photo: '',
      hasPhoto: false,
      letter: '',
      className: '',
      studentNo: '',
      classRole: ''
    },
    pickerVisible: false,
    pickerGroups: [],
    subjBtns: [{ key: 'total', label: '总分' }],
    activeSubj: 'total',
    summary: { scoreRate: 0, avgTotal: 0, maxTotal: 0, minTotal: 0 },
    hasRadar: false,
    radarTag: '',
    radarEvalImg: EVAL_IMG_MAP.balance,
    radarStats: { max: 0, min: 0, range: 0, avg: 0 },
    examCards: [],
    lineItems: []
  },

  onLoad(options) {
    this.initLayout();
    this.studentId = options.student_id || '';
    if (!this.studentId) {
      this.setData({ loading: false, hasData: false, emptyMsg: '缺少学生参数' });
      return;
    }
    this.loadStudentList();
    this.loadStudent();
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
    if (tab === 'student') return;
    if (tab === 'exam') {
      wx.navigateTo({ url: '/pages/score-exam-list/index' });
      return;
    }
    if (tab === 'grade') {
      wx.navigateTo({ url: '/pages/score-grade-trend/index' });
      return;
    }
    if (tab === 'class') {
      wx.navigateTo({ url: '/pages/score-class-trend/index' });
    }
  },

  examTypeShort(t) {
    if (t === 'comprehensive') return '理科';
    if (t === 'liberal_arts') return '文科';
    return t || '';
  },

  loadStudentList() {
    get('/api/public/students')
      .then((list) => {
        this.allStudents = list || [];
      })
      .catch(() => {
        this.allStudents = [];
      });
  },

  loadStudent() {
    this.setData({ loading: true });
    get('/api/public/student-history', { student_id: this.studentId })
      .then((d) => {
        if (!d || !d.student) {
          this.setData({ loading: false, hasData: false, emptyMsg: '学生数据不存在' });
          return;
        }
        this.rawData = d;
        const types = [];
        (d.groups || []).forEach((g) => {
          if (types.indexOf(g.exam_type) === -1) types.push(g.exam_type);
        });
        this.setData({
          types: types.map((t) => ({ key: t, label: this.examTypeShort(t) + '科' })),
          showTypeSwitch: types.length > 1,
          activeType: types[0] || '',
          activeSubj: 'total',
          hasData: true,
          loading: false,
          emptyMsg: ''
        });
        this.renderStudentCard(d.student);
        this.renderContent();
      })
      .catch(() => {
        this.setData({ loading: false, hasData: false, emptyMsg: '数据加载失败' });
      });
  },

  renderStudentCard(s) {
    this.setData({
      studentInfo: {
        name: s.name || '',
        photo: s.photo || '',
        hasPhoto: !!s.photo,
        letter: (s.name || '').slice(0, 1),
        className: s.class_name || '',
        studentNo: s.student_no || '',
        classRole: s.class_role || ''
      }
    });
  },

  filteredGroups() {
    return ((this.rawData && this.rawData.groups) || []).filter(
      (g) => g.exam_type === this.data.activeType
    );
  },

  onTypeTap(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.activeType) return;
    this.setData({ activeType: type, activeSubj: 'total' });
    this.renderContent();
  },

  renderContent() {
    const groups = this.filteredGroups();

    const srList = groups.map((g) =>
      g.total_score > 0 ? Math.round((g.student_total || 0) / g.total_score * 100) : 0
    );
    const scoreRate = srList.length
      ? Math.round(srList.reduce((a, b) => a + b, 0) / srList.length)
      : 0;
    const totals = groups.map((g) => g.student_total || 0);
    const avgTotal = totals.length
      ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length)
      : 0;
    const maxTotal = totals.length ? Math.max.apply(null, totals) : 0;
    const minTotal = totals.length ? Math.min.apply(null, totals) : 0;

    const subjSet = {};
    groups.forEach((g) => {
      (g.subjects || []).forEach((sub) => {
        if (sub.score !== null && sub.score !== undefined) subjSet[sub.subject] = true;
      });
    });
    const subjBtns = [{ key: 'total', label: '总分' }].concat(
      Object.keys(subjSet).map((k) => ({ key: k, label: k }))
    );

    const lineItems = groups.map((g) => ({
      name: g.group_name,
      value: g.student_total || 0,
      max: g.total_score || 0
    }));

    const subjMap = {};
    groups.forEach((g) => {
      (g.subjects || []).forEach((sj) => {
        if (sj.score === null || sj.score === undefined) return;
        if (!subjMap[sj.subject]) subjMap[sj.subject] = { scores: [], max: 0 };
        subjMap[sj.subject].scores.push(sj.score);
        if ((sj.max_score || 0) > subjMap[sj.subject].max) {
          subjMap[sj.subject].max = sj.max_score || 0;
        }
      });
    });

    let radarTag = '';
    let radarStats = { max: 0, min: 0, range: 0, avg: 0 };
    let radarEvalImg = EVAL_IMG_MAP.balance;
    const radarItems = SUBJECT_ORDER.map((name) => {
      const sj = subjMap[name];
      const avg = sj && sj.scores.length
        ? Math.round(sj.scores.reduce((a, b) => a + b, 0) / sj.scores.length * 10) / 10
        : 0;
      return { name, value: avg, max: sj ? sj.max : 0 };
    });
    this.radarItems = radarItems;
    if (radarItems.some((it) => it.max > 0)) {
      const standards = radarItems.map((it) =>
        it.max > 0 && it.value != null
          ? Math.round(it.value / it.max * 100 * 10) / 10
          : 0
      );
      const ana = this.radarAnalyze(standards);
      radarTag = ana.tags[0] || '';
      radarStats = { max: ana.max, min: ana.min, range: ana.range, avg: ana.avg };
      if (radarTag === '偏科') radarEvalImg = EVAL_IMG_MAP.unbalance;
      else if (radarTag === '文科优势') radarEvalImg = EVAL_IMG_MAP.liberal_good;
      else if (radarTag === '文科短板') radarEvalImg = EVAL_IMG_MAP.liberal_weak;
    }

    const examCards = groups.map((g) => ({
      group_id: g.group_id,
      name: g.group_name,
      date: g.exam_date || '',
      total: g.student_total || 0,
      classRank: g.class_rank || '-',
      classTotal: g.class_total || 0,
      gradeRank: g.grade_rank || '-',
      gradeTotal: g.grade_total || 0
    }));

    this.setData(
      {
        subjBtns,
        summary: { scoreRate, avgTotal, maxTotal, minTotal },
        hasRadar: radarItems.some((it) => it.max > 0),
        radarTag,
        radarEvalImg,
        radarStats,
        examCards,
        lineItems,
        activeSubj: 'total'
      },
      () => {
        setTimeout(() => this.drawCharts(), 120);
      }
    );
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

  drawCharts() {
    this.currentLineItems = this.data.lineItems;
    charts.getCanvas(this, 'trendCanvas').then((res) => {
      if (!res) return;
      this.trendGeom = charts.drawLineTrend(res.ctx, res.w, res.h, this.data.lineItems);
    });
    charts.getCanvas(this, 'radarCanvas').then((res) => {
      if (!res) return;
      this.radarGeom = charts.drawRadar(res.ctx, res.w, res.h, this.radarItems);
    });
  },

  drawLineChart() {
    const items = this.buildLineItems();
    this.currentLineItems = items;
    charts.getCanvas(this, 'trendCanvas').then((res) => {
      if (!res) return;
      this.trendGeom = charts.drawLineTrend(res.ctx, res.w, res.h, items);
    });
  },

  buildLineItems() {
    const subj = this.data.activeSubj;
    if (subj === 'total') return this.data.lineItems;
    const items = [];
    this.filteredGroups().forEach((g) => {
      const sj = (g.subjects || []).find((s) => s.subject === subj);
      if (sj) {
        items.push({
          name: g.group_name,
          value: sj.score != null ? sj.score : sj.avg_score || 0,
          max: sj.max_score || 0
        });
      }
    });
    return items;
  },

  openStudentPicker() {
    const list = this.allStudents || [];
    if (!list.length) {
      wx.showToast({ title: '暂无学生数据', icon: 'none' });
      return;
    }
    const byClass = {};
    list.forEach((s) => {
      const k = s.class_name || '未分班';
      (byClass[k] = byClass[k] || []).push(s);
    });
    const groups = Object.keys(byClass).sort().map((k) => ({
      className: k,
      count: byClass[k].length,
      students: byClass[k].map((s) => ({
        id: s.id,
        name: s.name || '',
        photo: s.photo || '',
        hasPhoto: !!s.photo,
        letter: (s.name || '').slice(0, 1),
        studentNo: s.student_no || '',
        classRole: s.class_role || ''
      }))
    }));
    this.setData({ pickerGroups: groups, pickerVisible: true });
  },

  closePicker() {
    this.setData({ pickerVisible: false });
  },

  onPickerStudentTap(e) {
    const id = e.currentTarget.dataset.id;
    const st = (this.allStudents || []).find((s) => String(s.id) === String(id));
    this.setData({ pickerVisible: false });
    if (!st) return;
    this.studentId = st.id;
    this.renderStudentCard(st);
    this.loadStudent();
  },

  onExamCardTap() {
    wx.showToast({ title: '单场成绩单功能开发中', icon: 'none' });
  }
});
