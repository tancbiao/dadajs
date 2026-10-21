/* 世界层：货币 / 本地学历 / 世界专属事件模板 */
window.LS = window.LS || {};

/* ================= 货币 =================
 * 内部经济数值统一用"万"，显示时按 k 换算成当地单位。
 * 数额不一致是故意的：大航海几千万贝利，修真界几十块灵石。
 */
LS.WORLD_MONEY = {
  modern: {
    "n": "万",
    "k": 1
  },
  campus: {
    "n": "元",
    "k": 10000
  },
  zombie: {
    "n": "罐头",
    "k": 20
  },
  weird: {
    "n": "冥币",
    "k": 5000
  },
  isekai: {
    "n": "金币",
    "k": 8
  },
  pirate: {
    "n": "贝利",
    "k": 20000
  },
  medieval: {
    "n": "银币",
    "k": 20
  },
  wow: {
    "n": "金币",
    "k": 10
  },
  lotm: {
    "n": "镑",
    "k": 12.5
  },
  xianxia: {
    "n": "灵石",
    "k": 0.6
  },
  cyber: {
    "n": "信用点",
    "k": 2000
  },
  scifi: {
    "n": "星币",
    "k": 500
  },
  sanguo: {
    "n": "两银",
    "k": 2
  },
  wasteland: {
    "n": "瓶盖",
    "k": 300
  },
  abyss: {
    "n": "银币",
    "k": 20
  },
  ninja: {
    "n": "两",
    "k": 3
  }
};

LS.worldMoney = function(id){
  return LS.WORLD_MONEY[id] || LS.WORLD_MONEY.modern;
};

/* v 是内部"万"，返回带单位的字符串 */
LS.fmtMoney = function(v, id){
  const c = LS.worldMoney(id);
  const x = (Number(v) || 0) * c.k;
  let num;
  if (Math.abs(x) >= 1000) num = Math.round(x).toLocaleString('en-US');
  else if (Math.abs(x) >= 100) num = Math.round(x);
  else if (Math.abs(x) >= 10) num = Math.round(x * 10) / 10;
  else num = Math.round(x * 100) / 100;
  return num + ' ' + c.n;
};

/* ================= 本地学历 =================
 * 同一条学历线，落到不同世界就是不同的身份。
 * 顺序：labor / high / junior / college / grad
 */
LS.WORLD_EDU = {
  modern:   ['打零工','高中毕业','大专','本科','读研'],
  campus:   ['打零工','高中毕业','大专','本科','读研'],
  zombie:   ['独行幸存者','小队成员','据点技工','避难所技术员','核心研究员'],
  weird:    ['普通人','守夜人候补','守夜人','调查员','首席调查员'],
  isekai:   ['流浪汉','见习冒险者','三级冒险者','学院生','王立学院优等生'],
  pirate:   ['码头杂工','水手','航海士','副船长候补','船长'],
  medieval: ['农奴','自由民','行会学徒','骑士侍从','领主幕僚'],
  wow:      ['平民','民兵','冒险者','公会精英','远征军参谋'],
  lotm:     ['流浪汉','教会杂役','正式调查员','值夜者','高级执事'],
  xianxia:  ['散修','外门杂役','外门弟子','内门弟子','真传弟子'],
  cyber:    ['街头散工','合同工','企业职员','资深工程师','核心架构师'],
  scifi:    ['地勤','船员','技术员','殖民官','舰队参谋'],
  sanguo:   ['流民','卒','什长','幕僚','军师'],
  wasteland:['拾荒者','商队护卫','据点商人','技师','首席技师'],
  abyss:    ['渔民','潜夫','引路人','深海学者','首席观测员'],
  ninja:    ['忍校辍学','下忍','中忍','上忍候补','暗部']
};

LS.STAGE_INDEX = { labor:0, high:1, junior:2, college:3, grad:4 };

LS.worldEduName = function(stage, id){
  const arr = LS.WORLD_EDU[id] || LS.WORLD_EDU.modern;
  const i = LS.STAGE_INDEX[stage] != null ? LS.STAGE_INDEX[stage] : 0;
  return arr[i];
};

/* ================= 世界专属事件模板 =================
 * {place} {threat} {npc} {world} 会在运行时替换成当前世界的东西。
 * 所以每个世界都会自动长出"只属于它"的事件。
 */
LS.WORLD_EVENT_TPL = [
  {
    id:'w_meet', weight:10,
    title:'{threat}',
    text:'在{place}，你和{threat}撞了个正着。这个世界的规矩很简单：谁先犹豫，谁就留在这里。',
    opts:[
      { n:'先动手', dim:'战', dc:24,
        s:'你比它快了半秒。收手的时候，你的手在抖，但站着的还是你。',
        f:'你慢了。疼是后来才感觉到的，先是麻，然后才是疼。',
        eff:{ tags:['活下来'], hp:-4 }, effF:{ hp:-16 } },
      { n:'先看它的规律', dim:'智', dc:22,
        s:'你没有动，先看它重复了几次。第四次的时候，你从它没看的方向走了。',
        f:'你判断错了。它比你想象中更熟悉这里。',
        eff:{ tags:['冷静'] }, effF:{ hp:-11 } },
      { n:'绕路，不丢人', dim:'体', dc:16,
        s:'你退了三条街，绕了个大圈。多花了一个时辰，但你还完整。',
        f:'你绕进了死路，只能翻墙。手被划开了。',
        eff:{ hp:2 }, effF:{ hp:-7 } }
    ]
  },
  {
    id:'w_ask', weight:9,
    title:'{npc}的请求',
    text:'{npc}在{place}找到你，说只求你这一件事。他没说报酬，只说"以后你会明白"。',
    opts:[
      { n:'帮他，先不谈条件', dim:'社', dc:20,
        s:'你帮了。三个月后，他在你最缺东西的时候出现了一次。',
        f:'你帮了，然后他再也没出现。',
        eff:{ tags:['人情'], cash:0.5 }, effF:{ hp:-3 } },
      { n:'先把价谈清楚', dim:'财', dc:22,
        s:'你把价钱谈到了他皱眉的程度。钱到手了，人情没了。',
        f:'他觉得你太计较，转身找了别人。',
        eff:{ cash:1 }, effF:{ cash:-0.1, tags:['坏名声'] } },
      { n:'拒绝，你不欠这个世界', dim:'灵', dc:14,
        s:'你说不。他看了你一会儿，走了。夜里你睡得不太好。',
        f:'你拒绝了，但半夜还是追出去帮了他。',
        eff:{ hp:3 }, effF:{ hp:-4, tags:['心软'] } }
    ]
  },
  {
    id:'w_resource', weight:9,
    title:'不够了',
    text:'你的物资见底了。{place}那边据说还有，但去的人有一半没回来。',
    opts:[
      { n:'去，赌一把', dim:'运', dc:24,
        s:'你回来了，背包是满的。路上你一直没敢回头。',
        f:'你空手回来，还丢了一半的东西。',
        eff:{ cash:1.6, hp:-3 }, effF:{ hp:-12, cash:-2 } },
      { n:'省着用，熬过去', dim:'体', dc:18,
        s:'你把每天的口粮减了一半，撑到了下一次补给。瘦了，但活着。',
        f:'你撑不住了，最后还是要出去找。',
        eff:{ hp:-2 }, effF:{ hp:-9 } },
      { n:'找人换', dim:'社', dc:20,
        s:'你拿手上的东西跟人换，换得不算亏。这个世界的规矩，你也学了一点。',
        f:'你被人抬了价，换回来一堆没用的。',
        eff:{ cash:0.3, tags:['人脉'] }, effF:{ cash:-0.1 } }
    ]
  },
  {
    id:'w_rule', weight:8,
    title:'这个世界的一条规矩',
    text:'你在这里待了一段时间，慢慢摸到一条不成文的规矩。说不清是谁定的，但违反的人都不见了。',
    opts:[
      { n:'照着做，先活下来', dim:'智', dc:16,
        s:'你把它记在心里，像记一条保命的公式。之后很多次，它救了你。',
        f:'你记住了，但有一次还是忘了。代价不大，但足够让你后怕。',
        eff:{ tags:['懂规矩'], hp:4 }, effF:{ hp:-5 } },
      { n:'试一试底线在哪', dim:'战', dc:28,
        s:'你踩了一脚，发现底线比传说中远。你拿到了别人不敢拿的东西。',
        f:'底线就在那儿。你撞上去了。',
        eff:{ cash:1.4, tags:['胆大'] }, effF:{ hp:-18 } },
      { n:'问本地人', dim:'社', dc:18,
        s:'{npc}告诉了你一半，另一半让你自己去看。你懂了他的意思。',
        f:'他什么都不肯说，只让你"别多问"。',
        eff:{ tags:['本地通'] }, effF:{ hp:-3 } }
    ]
  },
  {
    id:'w_chance', weight:8,
    title:'一个机会',
    text:'{npc}说有个活儿，钱不少，但得靠得住的人。他看着你，像在掂量你能值多少。',
    opts:[
      { n:'接，做漂亮点', dim:'战', dc:22,
        s:'你干得比他想的好。钱结了，他还留了你的联系方式。',
        f:'你搞砸了一半。钱拿得很少，名声也不好听。',
        eff:{ cash:2, tags:['名声'] }, effF:{ cash:0.3, hp:-8 } },
      { n:'问清楚再决定', dim:'智', dc:20,
        s:'你问了五个问题，他答上来四个。你接了，并且避开了那个他没答上来的坑。',
        f:'你问得太多，他觉得你麻烦，换人了。',
        eff:{ cash:1 }, effF:{ cash:0 } },
      { n:'不接，你还有别的打算', dim:'灵', dc:14,
        s:'你说这次算了。后来听说那活儿出了事，你庆幸了很久。',
        f:'你拒绝之后，那活儿被别人接了，赚了不少。你有点后悔。',
        eff:{ hp:3 }, effF:{ cash:-0.1 } }
    ]
  }
];

/* 生成一条属于当前世界的事件（已填充、已归一化） */
LS.makeWorldEvent = function(w, rnd){
  const pick = function(a){ return a[Math.floor(rnd() * a.length)]; };
  const fill = function(s){
    return String(s || '')
      .replace(/\{place\}/g, pick(w.places || ['某个地方']))
      .replace(/\{threat\}/g, pick(w.threats || ['一个麻烦']))
      .replace(/\{npc\}/g, pick(w.npcs || ['一个陌生人']))
      .replace(/\{world\}/g, w.name || '这个世界');
  };
  // 事件里的 cash/debt 要包进 econ，引擎才认
  const norm = function(e){
    if (!e) return {};
    const out = Object.assign({}, e);
    if (out.cash != null) { out.econ = Object.assign({}, out.econ || {}, { cash: out.cash }); delete out.cash; }
    if (out.debt != null) { out.econ = Object.assign({}, out.econ || {}, { debt: out.debt }); delete out.debt; }
    return out;
  };
  const tpl = LS.WORLD_EVENT_TPL[Math.floor(rnd() * LS.WORLD_EVENT_TPL.length)];
  return {
    id: tpl.id + '_' + Math.floor(rnd() * 9999),
    title: fill(tpl.title),
    text: fill(tpl.text),
    sci: '',
    opts: tpl.opts.map(function(o){
      return {
        n: fill(o.n), dim: o.dim, dc: o.dc,
        s: fill(o.s), f: fill(o.f),
        eff: norm(o.eff), effF: norm(o.effF)
      };
    }),
    auto: null,
    eff: null,
    tag: '世界事件'
  };
};


/* 海贼世界专属行动：属性够了才敢出海 */
LS.SEA_ACTS = [
  { id:'sea_sail', n:'出海', dim:'战', icon:'⛵', desc:'把船开出去', iqMin:0, need:18,
    ok:['你第一次自己掌舵。浪把船顶起来又摔下去，你站住了。','你在海上待了半个月，回来时晒黑了一层。'],
    bad:['你遇上逆风，漂了两天才回来。','船底漏了，你舀了一夜的水。'],
    grow:{ dim:'战', v:3 }, eff:{hp:-4}, effF:{hp:-14} },
  { id:'sea_bounty', n:'接悬赏', dim:'财', icon:'💰', desc:'去领悬赏令上的活', iqMin:0, need:16,
    ok:['你解决了一个小角色，拿着人头去换了钱。','悬赏令上的名字被你划掉了一个。'],
    bad:['目标比悬赏令上写的强得多，你差点没回来。','你被人抢了先，白跑一趟。'],
    grow:{ dim:'财', v:3 }, eff:{cash:2}, effF:{hp:-12} },
  { id:'sea_crew', n:'找草帽一伙', dim:'社', icon:'🏴‍☠️', desc:'去打听那群人的下落', iqMin:0, need:20,
    ok:['你在港口听到了他们的消息。有人说他们刚离开这座岛。','你远远看见了那面草帽旗，没敢靠太近。'],
    bad:['你打听错了方向，跑了一座空岛。','你被当成海军的探子，挨了一顿。'],
    grow:{ dim:'社', v:3 }, eff:{tags:['见过草帽']}, effF:{hp:-6} }
];

/* 海贼世界：悬赏金 */
LS.fmtBounty = function(v){
  v = Number(v) || 0;
  if (v >= 1e8) return (v / 1e8).toFixed(2) + ' 亿';
  if (v >= 1e4) return Math.round(v / 1e4) + ' 万';
  return String(Math.round(v));
};
LS.BOUNTY_TIERS = [
  { at:0,        n:'无名之辈' },
  { at:1000000,  n:'被通缉' },
  { at:30000000, n:'小有名气' },
  { at:100000000,n:'一方之患' },
  { at:500000000,n:'四皇候选' },
  { at:1500000000,n:'传说' }
];
LS.bountyTier = function(v){
  let out = LS.BOUNTY_TIERS[0];
  LS.BOUNTY_TIERS.forEach(function(t){ if (v >= t.at) out = t; });
  return out;
};