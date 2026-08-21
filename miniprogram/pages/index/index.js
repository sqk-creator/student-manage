const { get } = require('../../utils/request');
const { BASE_URL, USER, BADGE } = require('../../config/index');

const QUICK_ACTIONS = [
  { key: 'student-query', icon: '/assets/icons/icon-search.png', label: '学生查询' },
  { key: 'attendance', icon: '/assets/icons/icon-attendance.png', label: '发起考勤' },
  { key: 'score', icon: '/assets/icons/icon-score.png', label: '发起评分' },
  { key: 'approval', icon: '/assets/icons/icon-approval.png', label: '我的审批', badge: BADGE.approval }
];

Page({
  data: {
    statusBarHeight: 20,
    capsuleSpace: 92,
    user: USER,
    bannerMode: 'none',
    banners: [],
    bannerCurrent: 0,
    cards: [],
    firstCard: null,
    rightCards: [],
    quickActions: QUICK_ACTIONS,
    classes: [],
    classesLoaded: false
  },

  onLoad() {
    this.initLayout();
    this.loadBanners();
    this.loadFeatureCards();
    this.loadClasses();
    wx.setTabBarBadge({ index: 1, text: String(BADGE.workbench) });
  },

  initLayout() {
    try {
      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const menu = wx.getMenuButtonBoundingClientRect();
      this.setData({
        statusBarHeight: win.statusBarHeight,
        capsuleSpace: win.windowWidth - menu.left + 8
      });
    } catch (e) {
      /* 默认值兜底 */
    }
  },

  toAbsolute(url) {
    if (!url) return '';
    if (/^https?:\/\//.test(url)) return url;
    return BASE_URL + url;
  },

  loadBanners() {
    get('/api/banners/enabled')
      .then((banners) => {
        const list = (banners || []).map((b) => ({
          id: b.id,
          title: b.title || '',
          fullUrl: this.toAbsolute(b.image_url)
        }));
        let mode = 'none';
        if (list.length === 1) mode = 'single';
        else if (list.length > 1) mode = 'multi';
        this.setData({ banners: list, bannerMode: mode });
      })
      .catch(() => {});
  },

  loadFeatureCards() {
    get('/api/feature-cards/enabled')
      .then((cards) => {
        const list = (cards || [])
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map((c) => {
            const fullUrl = this.toAbsolute(c.image_url);
            return {
              id: c.id,
              title: c.title || '',
              subtitle: c.subtitle || '',
              cardKey: c.card_key || '',
              bgStyle: fullUrl
                ? 'background-image:url(' + fullUrl + ');background-size:cover;background-position:center;'
                : ''
            };
          });
        this.setData({
          cards: list,
          firstCard: list[0] || null,
          rightCards: list.slice(1)
        });
      })
      .catch(() => {});
  },

  buildClassList(classes, summaryIndex) {
    return (classes || []).map((c) => {
      const s = summaryIndex[c.id] || {};
      const teach = s.has_teaching ? { value: String(s.teach_rate), unit: '%' } : { value: '暂无', unit: '' };
      const exer = s.has_exercise ? { value: String(s.exer_rate), unit: '%' } : { value: '暂无', unit: '' };
      return {
        id: c.id,
        name: c.name || '',
        type: c.type || '',
        studentCount: c.student_count || 0,
        teach,
        exer,
        leaveTotal: s.leave_total || 0
      };
    });
  },

  loadClasses() {
    get('/api/public/classes', { teacher_id: USER.teacherId })
      .then((classes) => {
        get('/api/public/attendance-summary')
          .then((summaries) => {
            const index = {};
            (summaries || []).forEach((s) => {
              index[s.class_id] = s;
            });
            this.setData({ classes: this.buildClassList(classes, index), classesLoaded: true });
          })
          .catch(() => {
            this.setData({ classes: this.buildClassList(classes, {}), classesLoaded: true });
          });
      })
      .catch(() => {
        this.setData({ classes: [], classesLoaded: true });
      });
  },

  onBannerChange(e) {
    this.setData({ bannerCurrent: e.detail.current });
  },

  onBannerDot(e) {
    this.setData({ bannerCurrent: e.currentTarget.dataset.index });
  },

  onQuickTap(e) {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  onCardTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'score_report') {
      wx.navigateTo({ url: '/pages/score-exam-list/index' });
      return;
    }
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  onClassTap() {
    wx.showToast({ title: '班级详情开发中', icon: 'none' });
  }
});
