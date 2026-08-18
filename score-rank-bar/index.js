// score-rank-bar 等级划分条组件
// 入参 score：考试成绩（百分制 0-100）
// 分数区间：0-59 不及格 / 60-74 一般 / 75-84 良好 / 85-100 优秀
// 标签背景色与文字色沿用项目现有 score-level 配置

const LEVELS = [
  { min: 0,  max: 59,  label: '不及格', tagClass: 'level-fail' },
  { min: 60, max: 74,  label: '一般',   tagClass: 'level-pass' },
  { min: 75, max: 84,  label: '良好',   tagClass: 'level-good' },
  { min: 85, max: 100, label: '优秀',   tagClass: 'level-excellent' }
];

// 标签估算最大宽度(rpx)，用于贴左/贴右时收缩指示位置，避免标签溢出屏幕
const TAG_MAX_W = 140;

Component({
  properties: {
    score: { type: null, value: null }
  },
  data: {
    hidden: true,
    label: '',
    tagClass: '',
    leftPct: 0
  },
  observers: {
    score: function (val) {
      this.update(val);
    }
  },
  lifetimes: {
    attached: function () {
      this.update(this.data.score);
    }
  },
  methods: {
    update: function (val) {
      var valid = typeof val === 'number' && !isNaN(val);
      if (!valid) {
        this.setData({ hidden: true });
        return;
      }
      var clamped = Math.min(100, Math.max(0, val));
      var level;
      if (clamped < 60) {
        level = LEVELS[0];
      } else if (clamped < 75) {
        level = LEVELS[1];
      } else if (clamped < 85) {
        level = LEVELS[2];
      } else {
        level = LEVELS[3];
      }
      // offsetPercent = (score-0)/100*100%，贴边时收缩半个标签宽度保证标签完整可见
      var pctW = TAG_MAX_W / 750 * 100 / 2;
      var left = Math.min(Math.max(clamped, pctW), 100 - pctW);
      this.setData({
        hidden: false,
        label: level.label,
        tagClass: level.tagClass,
        leftPct: left
      });
    }
  }
});
