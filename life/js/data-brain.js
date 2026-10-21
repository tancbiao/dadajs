/* 出生面板 · 神经发育 · 智力 · 经济
 * 这一层是"看不见的手"：1-9 岁玩家没有选择权，18 岁才看到报告。
 *
 * 参考：中国儿童全量表 IQ 均值 103.8（金坛队列 n=798, SD 11.88）；
 *      Lynn 数据集给 105。本作取 106 / SD 12 作为基线。
 */
window.LS = window.LS || {};

LS.BRAIN = (function(){
  const IQ_BASE = 106;
  const IQ_SD = 12;

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function gauss(rnd){
    // Box-Muller
    let u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ---------- 父母类型（决定基因、引导、压力、安抚） ---------- */
  const PARENTS = [
    { id:'intellectual', name:'知识分子型', w:12,
      gene:7, guide:6, pressure:0.22, calm:0.8, care:0.9, money:1.3,
      desc:'家里书比家具多。你说"为什么"的时候，他们真的会停下来想。' },
    { id:'anxious', name:'焦虑虎妈型', w:22,
      gene:2, guide:3, pressure:0.88, calm:0.18, care:0.72, money:1.05,
      desc:'钢琴、奥数、英语、书法。你的周末比上学还满，考第二名要写检讨。' },
    { id:'permissive', name:'放养型', w:16,
      gene:0, guide:-2, pressure:0.18, calm:0.62, care:0.5, money:0.9,
      desc:'饭在锅里，钥匙在门口。他们很爱你，但没空管你在外面玩到几点。' },
    { id:'absent', name:'缺席型', w:14,
      gene:-3, guide:-5, pressure:0.42, calm:0.3, care:0.32, money:0.7,
      desc:'一个在很远的城市打工，一个在电话里说"听爷爷奶奶的话"。' },
    { id:'pragmatic', name:'市井务实型', w:28,
      gene:0, guide:0, pressure:0.5, calm:0.4, care:0.7, money:1.0,
      desc:'妈妈说"别人家孩子都学"，爸爸说"听老师的没错"。他们爱你，只是没主意。' },
    { id:'strict', name:'严控型', w:8,
      gene:1, guide:1, pressure:0.96, calm:0.08, care:0.6, money:1.0,
      desc:'考砸了要跪，顶嘴要打。你学会了两件事：看脸色，和不说真话。' }
  ];

  /* ---------- 学校类型（6 岁分配，家长安排，玩家无权选） ---------- */
  const SCHOOLS = [
    { id:'public_plain', name:'公办普通小学', w:38, recess:0.5, teach:1.0, pressure:1.0, cost:0,
      desc:'操场不大，但课间十分钟真的是你自己的。' },
    { id:'public_key', name:'公办重点小学', w:24, recess:0.15, teach:1.18, pressure:1.4, cost:0.2,
      desc:'进来要考试。课间除了上厕所，最好坐着。' },
    { id:'private_cheap', name:'普通私立小学', w:20, recess:0.4, teach:0.68, pressure:0.95, cost:1.2,
      desc:'学费不便宜。三年级还在背乘法口诀，老师说"我们不搞应试那一套"。' },
    { id:'private_elite', name:'贵的私立小学', w:18, recess:0.3, teach:1.12, pressure:1.15, cost:3.2,
      desc:'外教、马术、STEAM 教室。同学的名字后面通常跟着一个公司。' }
  ];

  /* ---------- 出生 ---------- */
  function init(rnd){
    // 父母加权随机
    const pPool = [];
    PARENTS.forEach(function(p){ for (let i=0;i<p.w;i++) pPool.push(p); });
    const parent = pPool[Math.floor(rnd()*pPool.length)];

    // 学校：家庭阶层 + 随机（6 岁才定，但出生时先决定）
    const sPool = [];
    SCHOOLS.forEach(function(s){
      let w = s.w;
      if (parent.id === 'absent' && s.cost > 1) w = 1;          // 留守儿童上不起私立
      else if (s.cost > 2 && parent.money < 1) w = Math.round(w * 0.3);
      if (s.cost > 1 && parent.money >= 1.2) w = Math.round(w * 1.6);
      for (let i=0;i<Math.max(1,w);i++) sPool.push(s);
    });
    const school = Object.assign({}, sPool[Math.floor(rnd()*sPool.length)]);   // 克隆，避免改到全局常量

    const geneIQ = IQ_BASE + gauss(rnd) * 9;
    const birthIQ = geneIQ + parent.gene * 0.6 + gauss(rnd) * 3;

    const ndi = clamp(38 + (birthIQ - IQ_BASE) * 0.55 + parent.care * 10 + gauss(rnd) * 5, 18, 74);
    const cortisol = clamp(16 + parent.pressure * 26 + gauss(rnd) * 7, 5, 72);
    const focus = clamp(36 + parent.calm * 12 + gauss(rnd) * 7, 12, 70);
    const mirror = clamp(40 + (parent.id === 'permissive' ? 6 : 0) + gauss(rnd) * 8, 15, 70);
    const phy = clamp(48 + parent.care * 4 + gauss(rnd) * 9, 22, 76);
    const res = clamp(34 + (ndi - 45) * 0.3 - (cortisol - 30) * 0.25 + gauss(rnd) * 5, 8, 74);

    return {
      parent: parent, school: school,
      geneIQ: Math.round(birthIQ),      // 出生智力（隐藏）
      iq: 0,                            // 18 岁结算
      ndi: ndi, cortisol: cortisol, focus: focus, mirror: mirror,
      phy: phy, res: res,
      sleepDebt: 0,
      travel: 0,                        // 看小说/看漫画攒下的穿越熟练
      earlyEdu: null,                   // 早教（家长安排）
      manga: false,                     // 爱看漫画 → 解锁动漫穿越
      buffs: [],                        // 学校政策/师资带来的长期增益与减益
      eduIQ: 0,                         // 教育带来的智力累计
      eduTaken: [],                     // 已触发过的教育事件
      mastery: 0, tier: 'none',
      log: []                           // 年度发育记录（18 岁后可看）
    };
  }

  /* ---------- 年度发育 ---------- */
  function yearDevelop(b, age, extra){
    b = b; extra = extra || {};
    const p = b.parent, s = b.school;

    // 睡眠
    let sleep;
    if (age <= 5) sleep = 9.6;
    else if (age <= 11) sleep = 8.9;
    else if (age <= 14) sleep = 7.8;
    else sleep = 6.6;
    sleep -= (s.pressure - 1) * 0.75;
    sleep -= p.pressure * 0.6;
    sleep += (extra.sleep || 0);

    // 运动 / 自由玩耍 / 同龄社交
    let sport = 1 + (s.recess > 0.35 ? 0.4 : -0.2) + (p.id === 'permissive' ? 0.3 : 0);
    if (age > 14) sport -= 0.35;
    sport += (extra.sport || 0);

    let play = (age <= 9 ? 1.3 : age <= 12 ? 0.9 : age <= 15 ? 0.5 : 0.25);
    play *= (0.25 + s.recess * 1.5);
    play += (extra.play || 0);

    const peer = Math.max(0, play * 0.85 + (extra.peer || 0));
    const academic = (age <= 9 ? 0.2 : age <= 12 ? 1.1 : age <= 15 ? 2.1 : 2.9) * s.pressure;
    const stress = (extra.stress || 0);
    const sport2 = clamp(sport, 0, 3);
    const play2 = clamp(play, 0, 3);

    const sleepOK = sleep >= 8 ? 1 : sleep >= 7 ? 0.4 : sleep >= 6 ? -0.3 : -1.4;

    b.ndi += 0.65 * sport2 + 0.55 * play2 + 0.20 * peer
           + sleepOK * 0.55
           + (b.focus > 55 ? 0.30 : 0.10)
           - 0.018 * b.cortisol
           - 0.30 * Math.max(0, academic - 1);
    b.cortisol += 2.1 * academic + 3.4 * stress
                - 1.25 * sport2 - 1.0 * play2
                - (sleepOK > 0 ? sleepOK * 1.6 : 0.6)
                - 0.25 * (b.res / 40);
    b.focus += ((extra.interrupt ? -1.1 : 1.0) - 0.55 * Math.max(0, academic - 1.2) + 0.2) * (70 / (70 + b.focus));
    b.mirror += (1.35 * peer - 0.3 * Math.max(0, academic - 2)) * (70 / (70 + b.mirror));
    b.phy += (1.7 * sport2 - 0.018 * b.cortisol + (age > 13 ? -0.3 : 0.2)) * (70 / (70 + b.phy));
    b.res += 0.35 * (b.ndi > 60 ? 1 : 0) - 0.35 * (b.cortisol > 70 ? 1 : 0) + 0.12;
    b.sleepDebt += Math.max(0, 8 - sleep);

    b.ndi = clamp(b.ndi, 5, 100);
    b.cortisol = clamp(b.cortisol, 0, 100);
    b.focus = clamp(b.focus, 5, 100);
    b.mirror = clamp(b.mirror, 5, 100);
    b.phy = clamp(b.phy, 5, 100);
    b.res = clamp(b.res, 5, 100);

    const rec = { age: age, ndi: Math.round(b.ndi), cort: Math.round(b.cortisol),
                  focus: Math.round(b.focus), sleep: Math.round(sleep*10)/10, sport: Math.round(sport2*10)/10, play: Math.round(play2*10)/10 };
    b.log.push(rec);
    return rec;
  }

  /* ---------- 18 岁结算 ---------- */
  function finalIQ(b){
    const p = b.parent;
    let iq = b.geneIQ
      + 0.30 * (b.ndi - 70)
      + 0.09 * (b.focus - 42)
      + 0.04 * (b.mirror - 42)
      - 0.10 * Math.max(0, b.cortisol - 45)
      - 0.05 * b.sleepDebt
      + (b.eduIQ || 0)
      + p.guide;
    if (b.earlyEdu === 'enrich') iq += 1.5;
    if (b.earlyEdu === 'drill') iq -= 1.2;
    iq = Math.round(clamp(iq, 62, 160));
    b.iq = iq;
    return iq;
  }

  function masteryOf(b){
    let m = 1.0 * (b.ndi - 40)
          + 1.4 * (b.iq - IQ_BASE)
          + 0.4 * (b.res - 45)
          + 0.3 * (b.focus - 45)
          - 0.5 * Math.max(0, b.cortisol - 60);
    m = Math.round(clamp(m, 0, 100));
    b.mastery = m;
    return m;
  }

  function tierOf(m){
    if (m < 18) return { key:'none', name:'完全不会用', desc:'你盯着面板，只想到最直白的那个按钮。', optBonus:0, sysScale:0.5, showOdds:false };
    if (m < 38) return { key:'low', name:'勉强摸索', desc:'你能用，但经常用错地方。', optBonus:0, sysScale:0.8, showOdds:false };
    if (m < 62) return { key:'mid', name:'用得挺顺', desc:'你摸清了它的脾气，知道什么时候该按。', optBonus:0, sysScale:1.0, showOdds:true };
    return { key:'high', name:'钻研透了', desc:'你不是在使用它，你是在改它。', optBonus:1, sysScale:1.3, showOdds:true };
  }

  /* ---------- 选择权：智商决定你能看见几个选项 ---------- */
  function optionCount(iq, base){
    base = base || 3;
    if (iq < 110) return 2;
    if (iq < 120) return 2;
    return Math.min(3, base);
  }
  // 10 岁前没有选择权
  function hasChoice(age, iq){
    if (age < 10) return 0;
    return optionCount(iq, 3);
  }

  /* ---------- 18 岁报告文案 ---------- */
  function verdict(b){
    const iq = b.iq || b.geneIQ;
    if (iq >= 131) return '你的脑子转得比嘴快。别人还在读题，你已经在想这题出得对不对。';
    if (iq >= 120) return '你属于那种"老师讲一遍就懂，但要装作没懂"的人。';
    if (iq >= 110) return '你不笨，只是在这个体系里不算显眼。';
    if (iq >= 100) return '你是标准答案里的那个"大多数"。';
    if (iq >= 90) return '你学得慢一点，但你不傻——只是没人有耐心等。';
    return '你一直在被推着走，从没有人问过你想去哪。';
  }

  return {
    IQ_BASE: IQ_BASE, IQ_SD: IQ_SD,
    PARENTS: PARENTS, SCHOOLS: SCHOOLS,
    init: init, yearDevelop: yearDevelop, finalIQ: finalIQ,
    masteryOf: masteryOf, tierOf: tierOf, optionCount: optionCount,
    hasChoice: hasChoice, verdict: verdict, clamp: clamp
  };
})();

/* ================= 童年事件 → 脑发育影响 =================
 * 每个选项：[ndi, 皮质醇, 专注, 镜像, 体能, 抗压]
 * 未列出的事件按 0 处理。
 */
LS.CHILD_BRAIN = {
  c_kindergarten: [
    { ndi:0.5, cort:1.5, res:1 },      // 抢回来
    { ndi:0.5, cort:-1, focus:1 },     // 告诉老师
    { ndi:-0.5, cort:3, res:-1 }       // 忍下去
  ],
  c_book: [
    { ndi:2, focus:4, cort:-1 },
    { ndi:0.5, focus:0.5, cort:0.5 },
    { ndi:0, focus:0, cort:0 }
  ],
  c_move: [
    { ndi:1, mirror:2, cort:-1 },
    { ndi:-0.5, mirror:-1.5, cort:2 },
    { ndi:1.5, mirror:1.5, cort:0 }
  ],
  c_exam: [
    { ndi:0.5, cort:3.5, res:1.5 },
    { ndi:0.5, cort:4, focus:-1 },
    { ndi:-1, cort:-0.5, focus:-1 }
  ],
  c_friend: [
    { ndi:0.5, cort:2, res:2 },
    { ndi:-0.5, mirror:-1.5, cort:0 },
    { ndi:1.5, focus:2.5, cort:1 }
  ],
  c_money: [
    { ndi:0.5, cort:0.5, res:1 },
    { ndi:-0.5, cort:2, res:-0.5 },
    { ndi:0.5, cort:-0.5, res:0.5 }
  ],
  c_fight: [
    { ndi:0, cort:2, phy:2, res:1.5 },
    { ndi:0.5, cort:1.5, res:2.5, focus:1 },
    { ndi:0.5, cort:-1, phy:1.5, mirror:1 }
  ],
  c_teacher: [
    { ndi:1.5, focus:4, cort:1.5 },
    { ndi:0, cort:-1.5, focus:-2 },
    { ndi:1, cort:-1, res:2 }
  ],
  c_first_love: [
    { ndi:1, mirror:2, cort:-1.5 },
    { ndi:0.5, focus:2, cort:2, mirror:-1 },
    { ndi:-0.5, mirror:-2, cort:3 }
  ],
  c_illness: [
    { ndi:0.5, phy:2, res:2, cort:2 },
    { ndi:0.5, phy:1, cort:1, res:-0.5 },
    { ndi:0, cort:4, res:-1.5 }
  ],
  c_internet: [
    { ndi:2, focus:1, cort:-1 },
    { ndi:0.5, cort:0.5, mirror:-0.5 },
    { ndi:0.5, mirror:1, cort:-1.5 }
  ],
  c_job: [
    { ndi:0.5, phy:3, res:3, cort:2 },
    { ndi:0.5, cort:0.5, res:1 },
    { ndi:1.5, cort:1, res:1.5 }
  ],
  c_choice: [
    { ndi:0.5, cort:4, focus:-1, res:-1 },
    { ndi:1.5, cort:1.5, res:3 },
    { ndi:1, cort:2, res:1 }
  ],
  c_grandparent: [
    { ndi:0.5, mirror:1.5, cort:-2 },
    { ndi:0.5, res:2.5, cort:1.5 },
    { ndi:1, cort:-1, res:1 }
  ],
  c_bullying: [
    { ndi:0.5, phy:1.5, res:2, cort:2 },
    { ndi:0.5, cort:0.5, res:0.5 },
    { ndi:-1, cort:3.5, res:-2 }
  ],
  c_talent: [
    { ndi:2, focus:4, phy:1.5, cort:1 },
    { ndi:1.5, focus:3, cort:-1 },
    { ndi:0, focus:-1, cort:1 }
  ],
  c_storm: [
    { ndi:0.5, cort:1, res:1 },
    { ndi:0, cort:1.5, res:-1 },
    { ndi:0.5, cort:-0.5, res:0.5 }
  ],
  c_dream: [
    { ndi:1.5, focus:2, cort:-1 },
    { ndi:0, cort:1, res:-0.5 },
    { ndi:1, focus:1.5, cort:1.5 }
  ]
};

/* ================= 年度生活事件（可一年多起） =================
 * 用 LS.EVENTS 同构结构；brain 字段直接作用于发育。
 */
LS.LIFE_EVENTS = [
  {
    id:'l_expert', tags:['校园','日常','成长'], minAge:8, maxAge:12, weight:9,
    title:'专家进校园',
    text:'升旗仪式后，全校被赶到操场上，听一位"青少年成长专家"讲课。前半场他带你们做体能操，喊得很大声；后半场他放下话筒，开始讲"感恩"和"爱和奉献"。',
    opts:[
      { n:'跟着做操，做到出汗', dim:'体', dc:18,
        s:'你真的跳了一整场，腿酸得抬不起来。回教室时你比谁都清醒。',
        f:'你敷衍了两下，被体育老师点名。',
        eff:{ brain:{ ndi:2.2, phy:3, cort:-3, sport:0.5 } } },
      { n:'坐着听他讲"爱与奉献"', dim:'智', dc:22,
        s:'他讲了一个孩子给母亲洗脚的故事，全场都在哭。你也跟着红了眼睛，但心里有点空。',
        f:'你听到一半就开始走神，脑子里全是刚才没做完的那道题。',
        eff:{ brain:{ cort:7, ndi:-1.5, focus:-1 }, risk:{ p:0.35, cort:5, ndi:-2, text:'散场时你觉得胸口发闷，说不上为什么。' } } },
      { n:'借口上厕所，溜回教室', dim:'运', dc:20,
        s:'你躲在教室里看课外书。没人发现，那是你这学期最安静的四十分钟。',
        f:'你刚坐下，班主任就推门进来了。',
        eff:{ brain:{ focus:4, ndi:1.5, cort:-2 }, effF:{ brain:{ cort:5, res:-1 } } } }
    ]
  },
  {
    id:'l_recess', tags:['校园','日常'], minAge:9, maxAge:16, weight:10,
    title:'课间十分钟',
    text:'下课铃响了。班主任站在门口说：都坐着，别出去，走廊不许跑。窗外阳光很好，操场上空无一人。',
    opts:[
      { n:'偷偷溜出去打球', dim:'体', dc:22,
        s:'你们五个人在操场角落打了八分钟。上课铃响时满头汗跑回去，心跳得像要飞出来。',
        f:'被教导主任抓了个正着，全班通报。',
        eff:{ brain:{ phy:3, ndi:2, mirror:2, cort:-4, play:0.6 }, risk:{ p:0.3, cort:6, text:'班主任在班会上点了你的名。' } },
        effF:{ brain:{ cort:6, phy:1 } } },
      { n:'坐在座位上发呆', dim:'智', dc:16,
        s:'你盯着窗外看了一整节课间。什么也没做，但脑子里转了很多东西。',
        f:'你什么都没想，只是更困了。',
        eff:{ brain:{ focus:1, cort:1 } } },
      { n:'趴着补觉', dim:'体', dc:14,
        s:'你睡了十分钟，醒来时觉得世界清楚了一点。',
        f:'你睡过头了，被下一节课的老师叫起来站着。',
        eff:{ brain:{ sleep:0.6, cort:-3, focus:1 } } }
    ]
  },
  {
    id:'l_private_math', tags:['校园','学业'], minAge:8, maxAge:11, weight:7, when:'private',
    title:'转学后的第一次数学考试',
    text:'你在私立小学时数学一直九十分以上。转回公办的第一张卷子发下来，红笔写着 10 分。老师把你叫到讲台前，问你到底学过没有。',
    opts:[
      { n:'承认自己没学过，从头补', dim:'智', dc:24,
        s:'你花了半年把落下的补完。那半年你每天只睡六个小时，但你跟上了。',
        f:'你补了一阵子就放弃了，从此数学成了你的噩梦。',
        eff:{ brain:{ ndi:1.5, focus:3, cort:4 } } },
      { n:'硬撑着说"我们学过"', dim:'社', dc:20,
        s:'你嘴硬了，老师半信半疑。你在心里发誓要自己学会。',
        f:'老师当场翻出课本，你一个字都念不出来。全班笑了。',
        eff:{ brain:{ res:1.5, cort:5 } }, effF:{ brain:{ cort:9, res:-2 } } },
      { n:'回家跟爸妈说', dim:'社', dc:18,
        s:'他们第二天就去了学校，跟老师吵了一架。你站在办公室外面，觉得很丢人，又有点安心。',
        f:'他们只是说"你怎么这么笨"，然后给你报了个补习班。',
        eff:{ brain:{ cort:-1.5, res:1 } }, effF:{ brain:{ cort:7, ndi:-1 } } }
    ]
  },
  {
    id:'l_smoke', tags:['校园','青春','成长'], minAge:15, maxAge:18, weight:9,
    title:'天台上的烟',
    text:'放学后，几个同学拉你去天台。有人掏出一包烟，说：都高中了，试试呗。风很大，烟点着了又灭。',
    opts:[
      { n:'接过来抽一口', dim:'运', dc:20,
        s:'你咳得眼泪都出来了，他们在旁边笑。后来你又抽了第二次、第三次。',
        f:'你抽完头晕了半小时，回家被闻出来了。',
        eff:{ brain:{ phy:-3, ndi:-1.5, cort:3 }, flag:'smoke' } },
      { n:'说不会，但留下来聊天', dim:'社', dc:18,
        s:'你坐在旁边听他们吹牛，什么也没抽。那一小时过得挺开心。',
        f:'他们觉得你扫兴，后来就不叫你了。',
        eff:{ brain:{ mirror:2, cort:-2 } }, effF:{ brain:{ mirror:-1, cort:1 } } },
      { n:'转身下楼，回家', dim:'智', dc:16,
        s:'你走了。路上买了瓶汽水，一个人喝完。',
        f:'你走得太急，把书包落在天台了。',
        eff:{ brain:{ focus:2, cort:-1, phy:1 } } }
    ]
  },
  {
    id:'l_phone_secret', tags:['校园','家庭','屏幕'], minAge:7, maxAge:9, weight:9,
    title:'被窝里的那块屏幕',
    text:'家里那台旧手机没设密码，晚上被塞在枕头底下充电。你听见客厅的电视声停了，走廊的灯也灭了。',
    sci:'睡前 1 小时看发光屏幕，会抑制褪黑素分泌、推迟入睡时间；被窝里近距离用眼还会加重调节痉挛。这个年龄段每天少睡 1 小时，注意力和工作记忆第二天就会掉。',
    opts:[
      { n:'蒙着被子，玩到它没电', dim:'运', dc:13,
        s:'你玩到屏幕发烫、电量报警。第二天早读你趴在桌上，老师叫了三次。',
        f:'你玩到一半睡着了，手机砸在脸上，屏幕裂了一道。',
        eff:{ brain:{ sleep:-1.4, focus:-2.5, cort:2, ndi:-1 } },
        effF:{ brain:{ sleep:-1.2, focus:-2, cort:4 } } },
      { n:'只玩十分钟，然后放回去', dim:'智', dc:16,
        s:'你盯着时间，到点就把它塞回枕头底下。心里痒，但你睡着了。',
        f:'十分钟变成了四十分钟。你把手机放回去时，天已经有点亮了。',
        eff:{ brain:{ sleep:-0.2, focus:0.5 } },
        effF:{ brain:{ sleep:-0.8, focus:-1 } } },
      { n:'把它放回客厅', dim:'体', dc:12,
        s:'你下床，光着脚把手机放回客厅茶几上。回来时反而睡得很沉。',
        f:'你走到一半又折回去了。',
        eff:{ brain:{ sleep:0.4, focus:1.5 } },
        effF:{ brain:{ focus:-0.5 } } }
    ]
  },
  {
    id:'l_shortvideo', tags:['校园','屏幕','熬夜'], minAge:9, maxAge:12, weight:10, lockIQ:100,
    title:'一刷就到两点',
    text:'短视频一个接一个，永远有下一个。你告诉自己"看完这条就睡"，然后天就快亮了。',
    sci:'短视频是可变间隔强化（variable-ratio reinforcement），和老虎机同一套机制——你不知道下一条好不好看，所以停不下来。青少年前额叶尚未发育成熟，抑制"再看一条"的能力比成人弱，熬夜刷屏会直接损伤次日的工作记忆与情绪调节。',
    opts:[
      { n:'再看一条，就一条', dim:'运', dc:14,
        s:'你刷到凌晨两点十七分。手机烫，眼睛干，脑子里全是别人的生活。',
        f:'你刷到天亮，第二天在学校吐了。',
        eff:{ brain:{ sleep:-1.8, focus:-3, cort:5, ndi:-1.4 } },
        effF:{ brain:{ sleep:-2.2, focus:-4, cort:8, ndi:-2 } } },
      { n:'定个闹钟，响了就放下', dim:'智', dc:18,
        s:'闹钟响的时候你正看到关键处，但你按掉了它，把手机翻过去。',
        f:'闹钟响了三遍，你把它关了。',
        eff:{ brain:{ sleep:-0.3, focus:1 } },
        effF:{ brain:{ sleep:-1.2, focus:-2, cort:2 } } },
      { n:'把手机交给爸妈保管', dim:'社', dc:15,
        s:'你把手机放到客厅，跟他们说：晚上别给我。他们愣了一下，然后答应了。',
        f:'他们笑着说"你能坚持三天就不错"，你有点被激到了。',
        eff:{ brain:{ sleep:0.6, focus:2 } },
        effF:{ brain:{ focus:-0.5 } } }
    ]
  },
  {
    id:'l_parent_phone', tags:['家庭','屏幕','模仿'], minAge:10, maxAge:13, weight:9,
    title:'饭桌上的三块屏幕',
    text:'吃饭的时候，爸爸在刷短视频，妈妈在刷短视频，声音叠在一起。没有人说话。你看着他们，忽然想到一个问题：以后要不要也变成这样。',
    sci:'孩子对屏幕使用的态度，主要不是被"教育"出来的，而是模仿来的（社会学习理论）。父母每天屏幕时间越长，孩子的问题性使用风险越高——这条关联在多项追踪研究里都成立，且不受家庭收入影响。',
    opts:[
      { n:'一起刷，反正也没人说话', dim:'社', dc:12,
        s:'你把碗往前推了推，掏出手机。三个人坐在一张桌子上，各自看各自的。',
        f:'你刷到一条很吵的视频，爸爸抬头瞪了你一眼，然后又低头刷自己的。',
        eff:{ brain:{ focus:-2, mirror:-1, cort:3, sleep:-0.4 } },
        effF:{ brain:{ focus:-1.5, cort:4 } } },
      { n:'不要成为这样的人', dim:'灵', dc:17,
        s:'你放下手机，把碗里的饭吃完。那一刻你做了一个很小的决定，但它留了很久。',
        f:'你这么想着，手还是伸向了手机。',
        eff:{ brain:{ focus:2.5, cort:-4, ndi:1 } },
        effF:{ brain:{ focus:-1, cort:2 } } }
    ]
  },
  {
    id:'l_funny_video', tags:['校园','网络','同伴'], minAge:12, maxAge:14, weight:9,
    title:'六年级的"团队"',
    text:'班里有几个人组了个账号，说要拍点"能火的"。他们列了几个方向：吃奇怪的东西、做危险动作、打擦边球、剪明星视频带节奏。他们问你：你来不来？',
    sci:'12–14 岁是同伴认可需求最强的阶段，大脑对"被群体接纳"的奖赏反应接近对食物的反应。但平台算法偏好高唤醒内容（惊奇、愤怒、猎奇），越极端越容易被推——这不是内容好坏的问题，是分发机制的问题。',
    opts:[
      { n:'拍猎奇：吃别人不敢吃的东西', dim:'体', dc:15,
        s:'你吃了一口，全班都在笑。视频有八千个赞，你胃疼了一晚上。',
        f:'你吐了，视频还是被发了出去。评论区都在笑你。',
        tag:'猎奇', eff:{ brain:{ cort:6, phy:-4, mirror:1 } },
        effF:{ brain:{ cort:9, phy:-6 } } },
      { n:'打擦边球，反正只是镜头', dim:'运', dc:18,
        s:'视频火了。三天后班主任把你们叫到办公室，家长也来了。账号被清了。',
        f:'视频没火。但截图在年级里传开了，有人认出了你。',
        tag:'被约谈', eff:{ brain:{ cort:8, mirror:-2 } },
        effF:{ brain:{ cort:10, focus:-2 } } },
      { n:'搞饭圈，剪明星视频带节奏', dim:'社', dc:16,
        s:'你剪的视频在超话里有几万播放。你在评论区跟人对骂到凌晨。',
        f:'你被对方粉丝人肉了，只能注销账号。',
        tag:'饭圈', eff:{ brain:{ sleep:-1, cort:5, mirror:2 } },
        effF:{ brain:{ cort:8, sleep:-1 } } },
      { n:'不参与，回家写作业', dim:'智', dc:12,
        s:'你说"我不太行"，然后走了。后来那个账号被封了，你有点庆幸。',
        f:'他们说你没意思。你在座位上坐了一节课，什么也没干。',
        eff:{ brain:{ focus:2, cort:-3 } },
        effF:{ brain:{ focus:1, cort:1 } } }
    ]
  },
  /* 初中：看小说。看得越深，穿越时越懂"那个世界怎么运转" */
  {
    id:'l_novel', tags:['校园','青春','兴趣'], minAge:13, maxAge:15, weight:10,
    title:'同桌塞给你一本小说',
    sci:'深度阅读小说会持续调用"心理理论"（theory of mind）网络：你在脑内模拟他人的意图、情绪与背叛。读得越多，这套模拟越熟练——这也是为什么老读者进一个新世界，上手比别人快。',
    text:'一本被翻得起毛的厚书，封面早没了。同桌压低声音说：别在课上看，看到"那一夜"你会睡不着。',
    opts:[
      { n:'熬夜看完，看完再翻一遍', dim:'智', dc:16,
        s:'你连着几晚看到凌晨。山门、境界、暗语、谁在第几章会死，你都记住了，还自己在草稿纸上画了一张地图。\n\n你开始琢磨：如果真有那种地方，人该怎么活下来。',
        f:'你看到凌晨三点，第二天在课堂上睡了一整节，书被班主任收走了。',
        eff:{ brain:{ travel:9, focus:-2, cort:3 }, flag:'novel' },
        effF:{ brain:{ travel:3, cort:5 } } },
      { n:'一天两章，当个消遣', dim:'灵', dc:12,
        s:'你看得慢，但每一章都记得。故事成了你藏在课桌下的一个出口。',
        f:'你翻了几页，觉得没意思，还给了同桌。',
        eff:{ brain:{ travel:3 }, flag:'novel' } },
      { n:'推回去，继续刷题', dim:'智', dc:10,
        s:'你把书推了回去。晚自习的灯很白，你做完了两套卷子。',
        f:'',
        eff:{ brain:{ focus:3, cort:2 } } }
    ]
  },
  {
    id:'l_manga', tags:['校园','青春','兴趣'], minAge:9, maxAge:12, weight:8,
    title:'书报亭里的那本漫画',
    sci:'图像叙事同样会激活情景记忆与空间想象。区别在于：看画面比读文字省力，所以更容易上瘾，但对"理解他人意图"的训练弱一些。',
    text:'放学路上，书报亭最下层摆着一本漫画，封面上的少年举着刀，背后是一片火。老板说：租一天五毛。',
    opts:[
      { n:'租下来，一本接一本地看', dim:'运', dc:14,
        s:'你从此有了一个自己的世界。上课时你在课本角落画那些招式，画得越来越像。',
        f:'你上课偷看被没收了，书也被撕了。',
        eff:{ brain:{ mirror:2, focus:1.5, cort:-3 }, flag:'manga' } },
      { n:'只看封面，走开', dim:'智', dc:12,
        s:'你多看了两眼，记住了那个画面，然后回家了。',
        f:'',
        eff:{ brain:{ focus:0.5 } } },
      { n:'攒钱买下来', dim:'财', dc:16,
        s:'你攒了两周早饭钱。那本书后来被你翻烂了，边角全是汗渍。',
        f:'钱攒到一半被家里发现了，挨了一顿骂。',
        eff:{ brain:{ mirror:2.5, focus:1, cort:2 }, flag:'manga' }, effF:{ brain:{ cort:4 } } }
    ]
  },
  {
    id:'l_pyramid', tags:['都市','职场','骗局'], minAge:20, maxAge:45, weight:8, iqMax:112,
    title:'老同学的电话',
    sci:'这类骗局用的是"权威 + 稀缺 + 熟人背书"三件套，专门绕过人的理性判断。研究显示，人在疲惫、孤独或急需用钱时，对高回报承诺的怀疑能力会显著下降——不是笨，是状态。',
    text:'一个多年没联系的老同学突然约你吃饭。他穿得很好，抢着买单，说有个"国家支持的阳光工程"，只要交 69800，三年能赚 1040 万。他说：我不是叫你投，我是想到你。',
    opts:[],
    auto:'你回家想了三个晚上，把准备装修的钱取了出来。\n签合同那天，他的手比你抖得还厉害。\n\n半年后，那个项目没了，他也失联了。你成了别人的"上线"，也成了别人的"下线"。',
    eff:{ econ:{ cash:-8, debt:18 }, brain:{ cort:14 }, tag:'被套' }
  },
  {
    id:'l_marry', tags:['都市','人情','家庭'], minAge:23, maxAge:30, weight:9, iqMax:112,
    title:'结婚',
    sci:'婚礼支出属于"一次性炫耀性消费"，对长期幸福感的贡献远低于同等金额的稳定资产。多项研究显示，婚礼花费越高，婚姻满意度反而略低——压力来自债务。',
    text:'女方家里说：彩礼十八万八，三金另算，酒席不能比隔壁差。你算了一下，这些钱够你在老家付个首付。',
    opts:[],
    auto:'你借了钱，办了三十桌。婚礼那天你笑得很累，敬酒敬到胃疼。\n婚后第二年，你们开始为还债吵架。',
    eff:{ econ:{ cash:-10, debt:26 }, brain:{ cort:12 }, tag:'成家' }
  },
  {
    id:'l_didi', tags:['都市','生存','劳累'], minAge:28, maxAge:55, weight:7, iqMax:112,
    title:'下班以后',
    sci:'长期每天工作 10 小时以上，心血管疾病风险显著上升；睡眠不足 6 小时会同时削弱免疫与情绪调节。这不是"吃不吃苦"的问题，是生理账。',
    text:'房贷、车贷、孩子的补习班。你在手机上注册了一个跑单的账号。第一天晚上，你跑了四个小时，赚了八十七块。',
    opts:[],
    auto:'你从此没有过完整的周末。\n车里的座椅被你坐出了一个坑，你也没舍得换。',
    eff:{ econ:{ active:2.4 }, brain:{ phy:-4, cort:8, sleep:-0.4 }, tag:'跑单' }
  }
];

/* ================= 学校政策 / 师资 buff =================
 * 这是"教育实验"那层：政策生效 → 每年稳定产出；家长投诉 → 中断。
 * iq 为每年智力增量（用户设定：杜威+0.1、数学做中学+0.2、科学探究+0.5）
 * ndi 为每年神经元发育增量（课间运动最明显）
 */
LS.EDU_EVENTS = [
  {
    id:'edu_sport', age:[6,6], prob:0.95,
    title:'专家进校园：课间动起来',
    text:'区里来的专家在升旗仪式上讲话，说孩子每天至少要有六十分钟户外活动，不然"脑子会缺一块"。校长当场拍板：课间开放操场，体育器材室也打开。',
    buff:{
      id:'recess_sport', name:'课间运动', iq:0.1, ndi:1.2, untilAge:12,
      stopRisk:0.38,
      stopText:'有家长在班级群里发了一张照片：孩子膝盖擦破了皮，配文"学校到底管不管"。第二天课间，教室门又关上了。'
    }
  },
  {
    id:'edu_dewey', age:[8,10], prob:0.30,
    title:'班主任去培训了',
    text:'班主任去省城培训了一周，回来在黑板上写了三个字：做中学。她开始让你们分组做项目、自己查资料，不再只念教案。',
    buff:{ id:'dewey', name:'杜威式班主任', iq:0.1, untilAge:12 }
  },
  {
    id:'edu_math', age:[8,11], prob:0.28,
    title:'数学老师的"做中学"',
    text:'数学老师参加了一个培训，回来把教具箱搬进了教室。你们用积木学通分，用卷尺量操场算面积，第一次觉得数学不是背公式。',
    buff:{ id:'math_handson', name:'数学·做中学', iq:0.2, untilAge:12 }
  },
  {
    id:'edu_science', age:[9,12], prob:0.45,
    title:'科学课终于不是念课本',
    text:'新教材配了一整箱器材。老师带你们去操场测风速，在花坛里挖蚯蚓，教室里第一次有人举手问"为什么"。',
    buff:{
      id:'science', name:'科学探究课', iq:0.5, ndi:2, untilAge:12,
      stopRisk:0.55,
      stopText:'家长会上有人质问："挖蚯蚓、玩水、用剪刀，出了事谁负责？" 第二周，探究课改成了看视频。'
    }
  },
  {
    id:'edu_junior', age:[13,13], prob:0.9,
    title:'早七晚十',
    text:'初中作息表贴在教室后墙：7:10 到校，21:40 放学。你的闹钟从六点半开始响，一天两次。',
    buff:{ id:'junior_hell', name:'初中早七晚十', iq:-0.3, ndi:-2.5, sleep:-1.5, untilAge:15 }
  }
];

/* 课间被取消后的持续损耗 */
LS.EDU_NO_RECESS = { id:'no_recess', name:'课间被取消', iq:0, ndi:-0.8, untilAge:12 };

/* 学校政策对"能不能投诉成功"的差异：私立不太吃这一套 */
LS.EDU_STOP_RATE = { public:1.0, private:0.45 };


/* ================= 每年的意外死因 =================
 * 不是"命中注定"，是活得越久、越危险的世界，抽到的次数越多。
 */
LS.ANNUAL_DEATH = {
  modern: [
    '在下班路上的十字路口，一辆闯红灯的车没有减速。',
    '体检报告上的那个词，医生说得很快，你只听懂了后半句。',
    '一场来得很急的病，住院第三天就没再醒过来。',
    '楼道里的电线老化，火从半夜烧起来，你在睡梦里。',
    '你走在人行道上，头顶的广告牌被风掀了下来。'
  ],
  campus: ['体育课上的一次冲撞，你倒下去就没再起来。','一场突发的急病，救护车来得太晚。'],
  zombie: ['你在找物资时被围在了一条死巷里。','伤口感染，退烧药早就没有了。','队伍的防线在夜里被冲破，你留在了最后。'],
  weird: ['你违反了那条规则，代价是立刻的。','镜子里的东西先动了，你比它慢了半秒。'],
  isekai: ['你接了一个超出等级的委托，森林没有把你吐出来。','魔法的反噬比你算的更狠，你倒在了自己画出的阵里。'],
  pirate: ['炮火把甲板掀开，你掉进了两艘船之间。','一场没人预料到的风暴，海吞掉了整条船。'],
  medieval: ['一场围城战，你被留在城墙上。','伤口化脓，牧师说他已经尽力了。'],
  wow: ['你在前线被一支冷箭射穿了喉咙。','古神的低语终于把你的名字念完了。'],
  guimi: ['你演得不够像，被"观众"识破了。','你在仪式中途失去了对自己的控制。'],
  xianxia: ['一炉丹药炸开，你连灰都没剩下。','天劫落下第九道，你的护身法阵碎了。','秘境闭合时，你还在里面。'],
  cyber: ['你的义体过热，在街角烧成了一团光。','一段清理程序找到了你的备份，全部删掉了。'],
  scifi: ['气闸在错误的时间打开了。','殖民地失压，你没能跑到避难舱。'],
  sanguo: ['乱军之中，你被一杆长枪挑落马下。','疫病先于敌军进了城。'],
  wasteland: ['你吸进了那阵沙暴，肺里像塞满了玻璃。','拾荒时踩到了旧时代的雷。'],
  abyss: ['你在水下看到了不该看的东西，然后忘了怎么呼吸。','牵引绳断了，你一个人留在了黑暗里。']
};
