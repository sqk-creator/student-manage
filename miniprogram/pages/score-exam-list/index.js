const { get } = require('../../utils/request');

Page({
  data: {
    statusBarHeight: 20,
    capsuleSpace: 92,
    gradeOptions: [{ id: '', name: '全部年级' }],
    gradeIndex: 0,
    examSubTab: 'group',
    groups: [],
    singles: [],
    needGrade: false,
    loading: false
  },

  onLoad() {
    this.initLayout();
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

  loadGrades() {
    get('/api/public/grades')
      .then((grades) => {
        const options = [{ id: '', name: '全部年级' }].concat(
          (grades || []).map((g) => ({ id: String(g.id), name: g.grade_name }))
        );
        this.setData({ gradeOptions: options });
        this.loadExamData();
      })
      .catch(() => {
        this.loadExamData();
      });
  },

  onGradeChange(e) {
    this.setData({ gradeIndex: Number(e.detail.value) });
    this.loadExamData();
  },

  onMainTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === 'exam') return;
    if (tab === 'grade') {
      wx.navigateTo({ url: '/pages/score-grade-trend/index' });
      return;
    }
    if (tab === 'class') {
      const opt = this.data.gradeOptions[this.data.gradeIndex];
      const gid = opt && opt.id ? opt.id : '';
      wx.navigateTo({
        url: gid
          ? '/pages/score-class-trend/index?grade_id=' + gid
          : '/pages/score-class-trend/index'
      });
      return;
    }
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  onExamSubTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.examSubTab) return;
    this.setData({ examSubTab: tab });
    this.loadExamData();
  },

  examTypeLabel(t) {
    if (t === 'comprehensive') return '理科考试';
    if (t === 'liberal_arts') return '文科考试';
    if (t === 'general') return '综合考试';
    return t || '综合考试';
  },

  getGradeId() {
    const opt = this.data.gradeOptions[this.data.gradeIndex];
    return opt ? opt.id : '';
  },

  loadExamData() {
    const gid = this.getGradeId();
    if (this.data.examSubTab === 'group') {
      this.loadGroups(gid);
    } else {
      this.loadSingles(gid);
    }
  },

  loadGroups(gid) {
    this.setData({ loading: true });
    get('/api/public/exam-group-summaries', gid ? { grade_id: gid } : {})
      .then((groups) => {
        const list = (groups || []).map((g) => ({
          id: g.group_id,
          gradeId: g.grade_id,
          groupName: g.group_name,
          gradeName: g.grade_name,
          examType: this.examTypeLabel(g.exam_type),
          examDate: g.exam_date,
          totalScore: g.total_score,
          studentCount: g.student_count,
          avgTotal: g.avg_total,
          passRate: g.pass_rate,
          subjectCount: (g.subjects || []).length
        }));
        this.setData({ groups: list, loading: false });
      })
      .catch(() => {
        this.setData({ groups: [], loading: false });
      });
  },

  loadSingles(gid) {
    if (!gid) {
      this.setData({ singles: [], needGrade: true });
      return;
    }
    this.setData({ loading: true, needGrade: false });
    get('/api/public/exams/list', { class_id: gid })
      .then((singles) => {
        const list = (singles || []).map((e) => ({
          id: e.id,
          examName: e.exam_name,
          subject: e.subject,
          examDate: e.exam_date,
          totalScore: e.total_score
        }));
        this.setData({ singles: list, loading: false });
      })
      .catch(() => {
        this.setData({ singles: [], loading: false });
      });
  },

  onCompareTap(e) {
    const gid = e.currentTarget.dataset.gid;
    if (!gid) {
      wx.showToast({ title: '请选择年级', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/score-grade-trend/index?grade_id=' + gid
    });
  },

  onGroupDetail() {
    wx.showToast({ title: '本场详情开发中', icon: 'none' });
  },

  onSingleDetail() {
    wx.showToast({ title: '详情开发中', icon: 'none' });
  }
});
