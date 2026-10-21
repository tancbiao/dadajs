/* 经济模型 · 穿越映射 · 新增世界（火影 / 海贼） */
window.LS = window.LS || {};

/* ================= 追加两个动漫世界 ================= */
(function(){
  const add = [
    {
      id:'ninja', name:'忍者世界', icon:'🍥', era:'木叶历 · 忍界', danger:4,
      brief:'忍者是雇佣兵，村子是公司。查克拉、任务等级、上忍中忍下忍，一切都标好了价。',
      tags:['忍者','战斗','成长','热血'],
      places:['木叶村','死亡森林','短册街','雨隐村','任务大厅','终结之谷'],
      threats:['叛忍','尾兽','暗部','战争','查克拉耗尽'],
      npcs:['中忍考试考官','卖团子的老板娘','叛逃的师兄','医疗忍者','情报贩子'],
      birth:['你出生在一个忍者家族，满月那天，父亲在你额头点了一点朱砂。','你生在村外的流民区，母亲说你是"没有查克拉的那一种"。'],
      flavor:['任务板上贴着一张 S 级委托，没人敢接。','村口新开了家一乐拉面，排队排到街尾。','最近总有戴斗笠的人在村子附近转。'],
      ending:'慰灵碑上多了一个名字，或者没有。'
    },
    {
      id:'pirate', name:'大海贼时代', icon:'🏴‍☠️', era:'大海贼时代 · 伟大航路', danger:5,
      brief:'海上有无数条船，每一条都想成为传说。恶魔果实、悬赏令、海军与四皇，自由是要用命换的。',
      tags:['海贼','冒险','战斗','自由'],
      places:['风车村','伟大航路入口','香波地群岛','海底监狱','空岛','新世界'],
      threats:['海军本部','四皇的船队','海王类','赏金猎人','恶魔果实副作用'],
      npcs:['船医','航海士','赏金猎人','海军中校','人鱼店主'],
      birth:['你出生在一艘船上，接生的时候浪很大，船医骂了一整夜。','你被放在木盆里漂到岸边，村里人说这是海送的。'],
      flavor:['港口的悬赏令又换了新的一张，金额后面多了一个零。','酒馆里都在传：有人找到了 ONE PIECE 的线索。','海军的军舰昨天在近海巡了一圈。'],
      ending:'某张悬赏令上印着你的脸，或者连一张都没有。'
    }
  ];
  add.forEach(function(w){ LS.WORLDS.push(w); });
})();

/* 系统自带的世界观（决定是否穿越） */
LS.SYS_HOME = {
  cultivation:'xianxia', sequence:'lotm', beast:'isekai', maingod:'wasteland',
  arms:'zombie', affix:'isekai', card:'ninja', plunder:'zombie',
  mall:'isekai', gacha:'ninja', charm:'modern', dataeye:'cyber'
};

/* 穿越身份文案：低智商在异世界也还是打工人 */
LS.TRAVEL_ROLE = {
  low:  ['还债的猎魔人','公会里最底层的跑腿','给商会抄账的学徒','在码头扛货的异乡人','被雇佣的炮灰'],
  mid:  ['小有名气的冒险者','公会的固定成员','靠手艺吃饭的匠人','某个贵族的随从'],
  high: ['公会里最年轻的分析师','被人抢着挖的战术顾问','靠脑子吃饭的操盘手','能改写规则的那一类人']
};

/* ================= 经济 ================= */
LS.ECON = (function(){
  const clamp = function(v,a,b){ return Math.max(a, Math.min(b, v)); };

  function incomeByIQ(iq){
    if (iq < 90) return 4.2;
    if (iq < 110) return 7.2;
    if (iq < 120) return 11.5;
    if (iq < 131) return 19;
    return 34;
  }

  function init(iq){
    return {
      cash: 1.2,
      debt: 0,
      active: 0,          // 主动收入（万/年）
      passive: 0,         // 被动收入（万/年）
      expense: 2.4,       // 年支出（万）
      assets: [],         // { n, v, passive }
      salary: incomeByIQ(iq),
      log: []
    };
  }

  function netWorth(e){
    let a = 0;
    (e.assets||[]).forEach(function(x){ a += x.v; });
    return Math.round((e.cash + a - e.debt) * 10) / 10;
  }

  /* 每年结一次账 */
  function settle(e, age){
    if (!e) return null;
    if (e.active === 0 && age >= 18) e.active = e.salary;
    // 35 岁后主动收入见顶并缓慢下滑
    if (age === 36) e.active = Math.round(e.salary * 0.92 * 10) / 10;
    if (age === 45) e.active = Math.round(e.salary * 0.85 * 10) / 10;
    if (age >= 60) e.active = Math.round(e.active * 0.6 * 10) / 10;

    let flow = e.active + e.passive - e.expense;
    e.cash = Math.round((e.cash + flow) * 10) / 10;

    // 先还债（现金流的一部分）
    if (e.debt > 0) {
      const spare = Math.max(0, e.cash - 2) * 0.5 + Math.max(0, flow) * 0.15;
      const pay = Math.min(e.debt, Math.round(spare * 10) / 10);
      if (pay > 0) {
        e.debt = Math.round((e.debt - pay) * 10) / 10;
        e.cash = Math.max(0, Math.round((e.cash - pay) * 10) / 10);
      }
    }
    // 利息 6%
    if (e.debt > 0) {
      e.debt = Math.round(e.debt * 1.06 * 10) / 10;
    }
    if (e.cash < 0) {
      e.debt = Math.round((e.debt - e.cash) * 10) / 10;
      e.cash = 0;
    }
    // 债务超过年收入 4 倍 → 破产重组（现实里就是这么收场的）
    e.justBankrupt = false;
    if (e.debt > e.active * 4 + 30) {
      e.debt = Math.round((e.active * 2.2) * 10) / 10;
      e.cash = 0;
      e.expense = Math.round((2.2 + e.active * 0.1) * 10) / 10;
      e.justBankrupt = true;
      e.bankrupt = (e.bankrupt || 0) + 1;
    }
    // 资产升值
    (e.assets||[]).forEach(function(a){
      a.v = Math.round(a.v * 1.04 * 10) / 10;
      if (a.passive) e.passive = Math.round(((e.passive||0) + a.passive) * 10) / 10;
    });
    return e;
  }

  function apply(e, eff){
    if (!e || !eff) return [];
    const chips = [];
    if (eff.cash) { e.cash = Math.round((e.cash + eff.cash)*10)/10; chips.push({ text:'现金 ' + (eff.cash>0?'+':'') + eff.cash + '万', good: eff.cash>0 }); }
    if (eff.debt) { e.debt = Math.round((e.debt + eff.debt)*10)/10; chips.push({ text:'负债 ' + (eff.debt>0?'+':'') + eff.debt + '万', good: eff.debt<0 }); }
    if (eff.active) { e.active = Math.round((e.active + eff.active)*10)/10; chips.push({ text:'主动收入 ' + (eff.active>0?'+':'') + eff.active + '万/年', good: eff.active>0 }); }
    if (eff.passive) { e.passive = Math.round((e.passive + eff.passive)*10)/10; chips.push({ text:'被动收入 ' + (eff.passive>0?'+':'') + eff.passive + '万/年', good: eff.passive>0 }); }
    if (eff.expense) { e.expense = Math.round((e.expense + eff.expense)*10)/10; chips.push({ text:'年支出 ' + (eff.expense>0?'+':'') + eff.expense + '万', good: eff.expense<0 }); }
    if (eff.asset) {
      e.assets.push({ n: eff.asset.n, v: eff.asset.v, passive: eff.asset.passive || 0 });
      chips.push({ text:'买入「' + eff.asset.n + '」' + eff.asset.v + '万', good:true });
    }
    return chips;
  }

  return { init: init, settle: settle, apply: apply, netWorth: netWorth, incomeByIQ: incomeByIQ, clamp: clamp };
})();

/* ================= 经济决策事件（智商够才给你选） ================= */
LS.ECON_EVENTS = [
  {
    id:'x_house', tags:['财富','都市','家庭'], minAge:24, maxAge:34, weight:9,
    title:'买房',
    text:'首付三十万，月供六千八，三十年。中介说：不买还会涨。你算了算自己的存款，刚好够，也刚好不够。',
    opts:[
      { n:'掏空存款，上车', dim:'财', dc:22,
        s:'你签了三十年的合同。拿到钥匙那晚，你在空房子里坐了很久。',
        f:'你买在了最高点。第二年，同小区挂牌价比你买时低了两成。',
        eff:{ econ:{ cash:-30, expense:1.2, asset:{ n:'一套房', v:110, passive:1.8 } } },
        effF:{ econ:{ cash:-30, expense:1.4, asset:{ n:'一套房', v:78 } } } },
      { n:'先租，把钱留着', dim:'智', dc:18,
        s:'你继续租房，把钱分成了三份。朋友说你没魄力，你没接话。',
        f:'房租涨了两次，你搬了两次家。',
        eff:{ econ:{ cash:-3, passive:1.2 } } },
      { n:'首付也不够，先算了', dim:'运', dc:16,
        s:'你关掉了中介的对话框。那一年你过得很轻松。',
        f:'你什么都没做，钱也慢慢花掉了。',
        eff:{ econ:{ cash:-2, expense:0.4 } } }
    ]
  },
  {
    id:'x_startup', tags:['财富','创业','职场'], minAge:26, maxAge:42, weight:7, iqMin:112,
    title:'一个可以做的生意',
    text:'你发现一个还没人做的口子。要投进去的是你全部积蓄，加上能借到的所有钱。失败的话，你要还好几年。',
    opts:[
      { n:'干，全部押上', dim:'智', dc:30,
        s:'第一年亏，第二年平，第三年开始有人主动找上门。',
        f:'一年半以后，账上只剩下最后一个月的房租。',
        eff:{ econ:{ cash:-25, active:12, passive:3 }, tag:'创业' },
        effF:{ econ:{ cash:-25, debt:20 }, tag:'失败' } },
      { n:'小规模试，先验证', dim:'智', dc:24,
        s:'你只投了五万，跑了半年，把模型跑通了才加码。',
        f:'试了半年，数据不好看，你及时收了手，只亏了五万。',
        eff:{ econ:{ cash:-5, active:5 } }, effF:{ econ:{ cash:-5 } } },
      { n:'不碰，继续上班', dim:'体', dc:14,
        s:'你把这个想法记在备忘录里，然后继续上班。三年后，有人把它做成了。',
        f:'你什么也没做，但那年公司的年终奖还不错。',
        eff:{ econ:{ cash:3 } } }
    ]
  },
  {
    id:'x_invest', tags:['财富','投资','都市'], minAge:28, maxAge:55, weight:8, iqMin:115,
    title:'一笔闲钱',
    text:'你手上有一笔暂时用不上的钱。理财经理推荐了三样东西，说辞都很漂亮。',
    opts:[
      { n:'分散买指数，长期不动', dim:'智', dc:20,
        s:'你设了自动定投，然后强迫自己不去看。十年后，它自己长成了样子。',
        f:'你中途忍不住割在了低点。',
        eff:{ econ:{ cash:-8, passive:1.1 } }, effF:{ econ:{ cash:-8 } } },
      { n:'押一个"内部消息"', dim:'运', dc:32,
        s:'那个消息是真的。你三个月翻了一倍，然后立刻退出。',
        f:'消息是假的。你亏了七成，还不敢跟家里说。',
        eff:{ econ:{ cash:12 } }, effF:{ econ:{ cash:-9, debt:3 } } },
      { n:'存起来，什么都不做', dim:'体', dc:12,
        s:'钱躺在账上，跑不过通胀，但你睡得着。',
        f:'你忍不住花掉了一部分。',
        eff:{ econ:{ cash:-1 } } }
    ]
  },
  {
    id:'x_pyramid_high', tags:['骗局','都市','职场'], minAge:22, maxAge:50, weight:7, iqMin:112,
    title:'一个"项目"',
    text:'老同学请你吃饭，说有个国家支持的项目，交 69800，三年 1040 万。他说得很真诚，桌上还有三个人在点头。',
    opts:[
      { n:'当场识破，把话挑明', dim:'智', dc:26,
        s:'你问了他三个问题，他一个都没答上来。你把单买了，起身走了。',
        f:'你被他绕进去了，回家查了一夜才明白。你没投，但也没睡好。',
        eff:{ econ:{ cash:-0.3 }, tag:'清醒' } },
      { n:'假装感兴趣，摸清结构', dim:'智', dc:30,
        s:'你花了两周把他们的层级和分账摸透，然后把资料匿名寄了出去。三个月后，那个点被端了。',
        f:'你摸底太明显，被他们盯上了。',
        eff:{ econ:{ cash:2 }, tag:'反手' }, effF:{ econ:{ cash:-2 }, tag:'被盯' } },
      { n:'直接投，赌一把', dim:'运', dc:34,
        s:'你成了"导师"，拉了七个人。钱是真的来了，你的手也是真的脏了。',
        f:'你是最后一棒。钱没了，人也没了。',
        eff:{ econ:{ cash:14 }, tag:'脏钱' }, effF:{ econ:{ cash:-8, debt:24 }, tag:'被套' } }
    ]
  },
  {
    id:'x_wedding', tags:['人情','家庭','都市'], minAge:23, maxAge:33, weight:7,
    title:'婚礼预算',
    text:'两家人坐在一张桌子上，谈彩礼、酒席、三金、车。你夹在中间，谁都在等你表态。',
    opts:[
      { n:'按规矩办，借钱也要体面', dim:'社', dc:20,
        s:'婚礼很风光。你敬酒敬到胃疼，散场后在酒店后门吐了。',
        f:'钱花了，面子有了，日子难了。',
        eff:{ econ:{ cash:-12, debt:16, expense:0.6 } } },
      { n:'谈一个双方都能承受的数', dim:'智', dc:24,
        s:'你把账算给两家人看。气氛一度很僵，最后各让一步。',
        f:'谈崩了。婚期推了半年，两家都记着你。',
        eff:{ econ:{ cash:-6, expense:0.4 }, tag:'成家' } },
      { n:'不办酒席，领证就行', dim:'体', dc:22,
        s:'你们两个人去民政局，出来吃了顿火锅。你妈在电话里哭了半小时。',
        f:'没办酒席，亲戚的闲话传了好几年。',
        eff:{ econ:{ cash:-0.5, expense:0.2 }, tag:'成家' } }
    ]
  }
];
