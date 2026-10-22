/* 马斯洛需求 + 人格驱动的"不由你选"事件
 * 18 岁后，有些事不是你选的，是处境替你选的。
 */
window.LS = window.LS || {};

LS.NEEDS = [
  { k:'physio', n:'生理', d:'吃饭、睡觉、钱' },
  { k:'safety', n:'安全', d:'身体、住处、不被伤害' },
  { k:'belong', n:'归属', d:'有人惦记你' },
  { k:'esteem', n:'尊重', d:'被当回事' },
  { k:'self',   n:'自我实现', d:'做成一件只有你能做的事' }
];

/* 每种人格"憋不住"的方向 */
LS.AUTO_EVENTS = [
  {
    id:'n_money', need:'physio', test:function(st){ return st.econ && st.econ.cash < 1.5 && st.econ.graduated; },
    t:'这个月的账',
    x:'你把账单摊在桌上，算了两遍，数字还是不够。\n\n你关掉了一个会员，又关掉一个。最后剩下的那个，你舍不得。'
  },
  {
    id:'n_body', need:'safety', test:function(st){ return st.hp < st.maxHp * 0.45; },
    t:'你开始害怕体检',
    x:'报告单上的箭头比去年多。你把纸折起来塞进抽屉，没告诉任何人。\n\n夜里你摸着自己的心跳，数到一百二十下才睡着。'
  },
  {
    id:'n_lonely', need:'belong', test:function(st){ return st.age >= 30 && (st.tags || []).indexOf('有名字了') < 0; },
    t:'很久没人给你打电话',
    x:'手机屏幕亮起来，是外卖平台的推送。\n\n你翻了翻通讯录，从上滑到下，没有按下任何一个。'
  },
  {
    id:'n_esteem', need:'esteem', test:function(st){ return st.brain.cortisol > 60; },
    t:'饭桌上你没说话',
    x:'他们在聊各自的事，声音很大。你插了一句，没人接。\n\n你低下头，把碗里的饭吃完，起身去洗碗。'
  },
  {
    id:'n_change', need:'self', test:function(st){ return /^(ENTP|ENFP|ENTJ|INFJ)/.test((st.mbti||{}).code || ''); },
    t:'你憋不住了',
    x:'你看着这个世界，越看越觉得不对劲。\n\n不是抱怨，是一种必须动手的冲动——你想改点什么，哪怕只改一点点。'
  },
  {
    id:'n_quiet', need:'self', test:function(st){ return st.brain.iq >= 125 && st.age >= 35; },
    t:'你想明白了一件没用的事',
    x:'半夜你忽然想通了一个问题，坐起来记在纸上。\n\n第二天早上看，字迹潦草，但你记得那种清楚的感觉。'
  }
];

LS.pickAutoEvent = function(st, rnd){
  const pool = LS.AUTO_EVENTS.filter(function(e){ try { return e.test(st); } catch(err){ return false; } });
  if (!pool.length) return null;
  return pool[Math.floor(rnd() * pool.length)];
};
