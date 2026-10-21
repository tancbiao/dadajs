/* 10 分钟切片：现代都市 · 18–40 岁 · 8 系统 · 5 判定维
 * 目标：一局 ≈ 10 分钟，每年 1 个决策，每个数字都能影响判定。
 */
window.LS = window.LS || {};

LS.SLICE = {
  id: 'modern10',
  name: '十分钟人生',
  world: 'modern',
  from: 18,
  to: 40,                 // 40 岁收束，共 23 年
  systems: [              // 8 个系统，覆盖 8 种机制
    'attr_panel',         // levelUp
    'rich_rebate',        // wealth
    'daily_checkin',      // signin
    'gacha',              // gacha
    'stream',             // fame
    'dataeye',            // analysis
    'quest_sys',          // quest
    'simulator'           // sim
  ],
  dims: ['战', '智', '体', '社', '财'],   // 只有这五维参与显示与判定
  apMax: 2,
  eventCap: 1,
  /* 经济汇（sink）：让钱有必须去的地方
   * 所有系数均为 [PLACEHOLDER]，依据是"高收入者支出占比不降反升"，
   * 实际数值待 playtest 校准。
   */
  sinks: {
    identity: 0.30,   // 身份成本：收入越高，维持体面的成本越高
    risk: 0.02,      // 风险成本：资产越多，税、保险、被盯上的成本越高
    relation: 0.25    // 关系成本：人脉要养，越厚越贵
  }
};
