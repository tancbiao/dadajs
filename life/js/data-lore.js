/* 世界知识库：内置正典种子 + 可增长的同人/设定条目
 * 说明：这里存的是"梗概级"设定（人物、势力、地点、基调），不复制原文。
 * 运行时会把 AI 生成的世界考据合并进来，存在 localStorage（ls.lore.v1），越玩越厚。
 */
window.LS = window.LS || {};

LS.LORE_SEED = {
  pirate: {
    tone: '热血、伙伴、自由、出海',
    chars: [
      { n:'蒙奇·D·路飞', d:'草帽一伙船长，橡胶果实能力者，目标是海贼王' },
      { n:'罗罗诺亚·索隆', d:'三刀流剑士，路飞的第一个伙伴，路痴' },
      { n:'娜美', d:'航海士，精通气象与海图，爱钱' },
      { n:'乌索普', d:'狙击手，胆小但关键时刻可靠' },
      { n:'山治', d:'厨师，踢技，绝不浪费食物' },
      { n:'托尼托尼·乔巴', d:'船医，吃了人人果实的驯鹿' }
    ],
    orgs: ['草帽一伙', '海军本部', '四皇', '王下七武海', '革命军'],
    places: ['风车村', '东海', '伟大航路', '水之七岛', '和之国'],
    fanfic: [
      { t:'同人向：新船员的第一课', s:'一个刚上船的年轻人，在第一次风暴里学会"把自己的命交给伙伴"。' },
      { t:'同人向：海军哨所的一夜', s:'一个底层海兵在正义与命令之间做了一次很小的选择。' }
    ]
  },
  ninja: {
    tone: '羁绊、努力、守护村子',
    chars: [
      { n:'漩涡鸣人', d:'九尾人柱力，梦想成为火影，永不放弃' },
      { n:'宇智波佐助', d:'宇智波一族末裔，为复仇而活' },
      { n:'春野樱', d:'医疗忍者，怪力，重视同伴' },
      { n:'旗木卡卡西', d:'第七班指导上忍，写轮眼，爱看亲热天堂' },
      { n:'自来也', d:'三忍之一，情报与修行都靠脚走' },
      { n:'三代火影·猿飞日斩', d:'木叶的守望者，把村子当家人' }
    ],
    orgs: ['木叶隐村', '第七班', '暗部', '晓', '音忍村'],
    places: ['木叶村', '死亡森林', '终末之谷', '短册街', '火影岩'],
    fanfic: [
      { t:'同人向：下忍的第一份 C 级任务', s:'护送一个不肯说话的老人回村，路上学会"任务之外还有人情"。' },
      { t:'同人向：忍校的吊车尾', s:'一个总被嘲笑的学员，在毕业考试前夜被卡卡西单独留下。' }
    ]
  },
  xianxia: {
    tone: '长生、道心、因果',
    chars: [
      { n:'青云掌门', d:'守着一座快断传承的山门，择徒极严' },
      { n:'丹药长老', d:'一炉丹能救命，也能要命' },
      { n:'外门执事', d:'管着最脏最累的活，也最懂人情' },
      { n:'云游散修', d:'无门无派，靠脚步换机缘' }
    ],
    orgs: ['青云山门', '坊市商会', '散修盟', '秘境守门人'],
    places: ['青云山门', '坊市', '妖兽山脉', '秘境入口', '论道台'],
    fanfic: [
      { t:'同人向：外门第一年', s:'一个资质平平的外门弟子，用三年时间把一口破剑养成自己的道。' },
      { t:'同人向：坊市里的假丹', s:'有人在坊市卖假丹，你识破了，但对方背后有人。' }
    ]
  },
  lotm: {
    tone: '神秘、克制、代价',
    chars: [
      { n:'克莱恩·莫雷蒂', d:'值夜者，谨慎到近乎偏执，靠扮演消化魔药' },
      { n:'奥黛丽·霍尔', d:'心理医生，观众途径，善于观察' },
      { n:'阿尔杰·威尔逊', d:'风暴教会神职人员，野心与谨慎并存' }
    ],
    orgs: ['值夜者', '塔罗会', '教会', '非凡者家族'],
    places: ['贝克兰德东区', '廷根市', '塔罗会', '黑荆棘安保公司'],
    fanfic: [
      { t:'同人向：第一次值夜', s:'一个新人值夜者第一次见到"不该存在的东西"，学会先记录再恐惧。' },
      { t:'同人向：一份匿名委托', s:'委托人说只要找回一只怀表，你却发现表里藏着别人的记忆。' }
    ]
  },
  cyber: {
    tone: '霓虹、义体、代价',
    chars: [
      { n:'义体医生', d:'地下诊所的手艺人，收费看人' },
      { n:'数据掮客', d:'卖信息也卖沉默' },
      { n:'公司安全主管', d:'冷静、合规、不留痕迹' }
    ],
    orgs: ['巨型企业', '街头帮派', '地下诊所', '数据黑市'],
    places: ['霓虹下城区', '义体诊所', '数据中心', '高架轻轨'],
    fanfic: [
      { t:'同人向：一次义体移植', s:'你换了一只手，它偶尔会做出不属于你的动作。' },
      { t:'同人向：删除一份档案', s:'有人出一笔钱，让你从公司库里删掉一个人的全部记录。' }
    ]
  },
  zombie: {
    tone: '生存、互助、人性',
    chars: [
      { n:'断腿的老兵', d:'据点里最会看地形的人' },
      { n:'抱婴儿的女人', d:'为了孩子什么都敢做' },
      { n:'军医', d:'药不够，就得选救谁' }
    ],
    orgs: ['南岸避难所', '拾荒队', '巡逻队', '广播塔守夜人'],
    places: ['锈城高速收费站', '南岸避难所', '倒塌的超市', '地下车库'],
    fanfic: [
      { t:'同人向：一夜守墙', s:'你和老兵守了一整夜的墙，天亮时他只说了一句"你没跑"。' },
      { t:'同人向：最后半瓶水', s:'你把水给了一个陌生人，后来他在你最缺水的时候回来。' }
    ]
  },
  isekai: {
    tone: '冒险、成长、伙伴',
    chars: [
      { n:'公会前台', d:'见过太多新人，也埋过太多新人' },
      { n:'退役冒险者', d:'教你第一件事是怎么活着回来' },
      { n:'王立学院导师', d:'严厉，但从不放弃笨学生' }
    ],
    orgs: ['冒险者公会', '王立学院', '商会', '骑士团'],
    places: ['边境小镇', '公会大厅', '迷宫入口', '王都'],
    fanfic: [
      { t:'同人向：第一个委托', s:'采药任务变成了救人任务，你第一次知道委托书不会写全。' },
      { t:'同人向：公会新人夜谈', s:'退役老兵给你讲了他第一次下迷宫时犯的错。' }
    ]
  },
  wasteland: {
    tone: '拾荒、交易、活下去',
    chars: [
      { n:'商队头子', d:'只认秤，不认人' },
      { n:'据点技师', d:'能把一堆废铁修成水泵' },
      { n:'拾荒少年', d:'跑得比谁都快，饿得比谁都久' }
    ],
    orgs: ['商队', '据点议会', '拾荒帮', '水站'],
    places: ['废土公路', '据点集市', '旧时代工厂', '水站'],
    fanfic: [
      { t:'同人向：一趟押货', s:'你押的那车水里，有一桶是给孩子们的。' },
      { t:'同人向：修好一台泵', s:'技师说修不好，你偏要试，最后你们一起把水抽了上来。' }
    ]
  },
  medieval: {
    tone: '权谋、信仰、生存',
    chars: [
      { n:'行会师傅', d:'手艺是唯一的护身符' },
      { n:'修道院抄写员', d:'书比命贵' },
      { n:'领主管家', d:'记得每一户该交多少' }
    ],
    orgs: ['行会', '教会', '领主府', '雇佣兵'],
    places: ['城墙外的集市', '修道院', '领主城堡', '麦田'],
    fanfic: [
      { t:'同人向：学徒的第一件成品', s:'你做了一把歪掉的刀，师傅没骂你，只说"再打一把"。' },
      { t:'同人向：冬夜的施粥', s:'修道院门口排了很长的队，你分到了最后一勺。' }
    ]
  },
  scifi: {
    tone: '探索、责任、远方',
    chars: [
      { n:'舰长', d:'把每个人的名字都记住' },
      { n:'首席工程师', d:'能在失压下修好气闸' },
      { n:'殖民地管理员', d:'在规章和活人之间选' }
    ],
    orgs: ['殖民舰队', '地球总部', '科研站', '航运公司'],
    places: ['殖民舰桥', '气闸舱', '轨道站', '新地表'],
    fanfic: [
      { t:'同人向：第一次出舱', s:'牵引绳另一头的人，比你更怕。' },
      { t:'同人向：一份被驳回的申请', s:'你想给殖民地多申请一台净水器，总部说预算不够。' }
    ]
  },
  sanguo: {
    tone: '乱世、谋略、人心',
    chars: [
      { n:'军中老卒', d:'打了十年仗，只想活着回家种地' },
      { n:'随军谋士', d:'一封信能退一支部队' },
      { n:'粮官', d:'粮草比刀更能决定胜负' }
    ],
    orgs: ['军营', '世家', '郡府', '流民'],
    places: ['官道', '军营', '城门', '麦田'],
    fanfic: [
      { t:'同人向：守城第七日', s:'城里只剩三天的粮，你被派去和城外的人谈。' },
      { t:'同人向：一封家书', s:'你替不识字的老卒写了封信，他听完哭了。' }
    ]
  },
  modern: { tone:'现实、克制、普通人的选择', chars:[], orgs:[], places:[], fanfic:[] },
  campus: { tone:'青春、成长、同伴', chars:[], orgs:[], places:[], fanfic:[] },
  weird: {
    tone:'规则、克制、求生', chars:[], orgs:[], places:[],
    fanfic: [{ t:'同人向：第一条规则', s:'你发现只要不回头，走廊就还是走廊。' }]
  },
  abyss: {
    tone:'深海、压迫、敬畏', chars:[], orgs:[], places:[],
    fanfic: [{ t:'同人向：断掉的牵引绳', s:'你在黑暗里数了三十七下心跳，等到了灯。' }]
  }
};

/* 运行时知识库（localStorage 增长） */
LS.Lore = (function(){
  const KEY = 'ls.lore.v1';
  function all(){
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch(e){ return {}; }
  }
  function save(o){ try { localStorage.setItem(KEY, JSON.stringify(o)); } catch(e){} }
  function seedOf(w){ return LS.LORE_SEED[w] || { chars:[], orgs:[], places:[], fanfic:[], tone:'' }; }

  function get(w){
    const allObj = all();
    const seed = seedOf(w);
    const mine = allObj[w] || {};
    const uniq = function(list, key){
      const map = {};
      (list || []).forEach(function(x){ const k = (x && (x[key] || x.n || x.t)) || ''; if (k) map[k] = x; });
      return Object.keys(map).map(function(k){ return map[k]; });
    };
    return {
      tone: mine.tone || seed.tone || '',
      chars: uniq((seed.chars || []).concat(mine.chars || []), 'n'),
      orgs: uniq((seed.orgs || []).concat(mine.orgs || []).map(function(x){ return typeof x === 'string' ? { n:x } : x; }), 'n').map(function(x){ return x.n || x; }),
      places: uniq((seed.places || []).concat(mine.places || []).map(function(x){ return typeof x === 'string' ? { n:x } : x; }), 'n').map(function(x){ return x.n || x; }),
      fanfic: uniq((seed.fanfic || []).concat(mine.fanfic || []), 't'),
      facts: mine.facts || []
    };
  }

  function merge(w, data){
    if (!w || !data) return;
    const allObj = all();
    const cur = allObj[w] || { chars:[], orgs:[], places:[], fanfic:[], facts:[] };
    ['chars','fanfic'].forEach(function(k){
      (data[k] || []).forEach(function(x){
        if (!x) return;
        const key = k === 'chars' ? 'n' : 't';
        if (!x[key]) return;
        if (!cur[k]) cur[k] = [];
        if (!cur[k].some(function(y){ return y[key] === x[key]; })) cur[k].push(x);
        if (cur[k].length > 30) cur[k] = cur[k].slice(-30);
      });
    });
    ['orgs','places','facts'].forEach(function(k){
      (data[k] || []).forEach(function(x){
        const v = typeof x === 'string' ? x : (x && (x.n || x.t));
        if (!v) return;
        if (!cur[k]) cur[k] = [];
        if (cur[k].indexOf(v) < 0) cur[k].push(v);
        if (cur[k].length > 40) cur[k] = cur[k].slice(-40);
      });
    });
    if (data.tone) cur.tone = data.tone;
    allObj[w] = cur;
    save(allObj);
  }

  /* 给 AI 的设定块 */
  function prompt(w){
    const L = get(w);
    if (!L.chars.length && !L.facts.length) return '';
    const lines = [];
    if (L.tone) lines.push('基调：' + L.tone);
    if (L.chars.length) lines.push('人物：' + L.chars.slice(0,8).map(function(c){ return c.n + '（' + (c.d||'') + '）'; }).join('；'));
    if (L.orgs.length) lines.push('势力：' + L.orgs.slice(0,6).join('、'));
    if (L.places.length) lines.push('地点：' + L.places.slice(0,6).join('、'));
    if (L.fanfic.length) lines.push('可参考的同人支线：' + L.fanfic.slice(-4).map(function(f){ return f.t + '——' + (f.s||''); }).join('；'));
    if (L.facts.length) lines.push('这个世界已经发生过：' + L.facts.slice(-6).join('；'));
    return lines.join('\n');
  }

  /* 每局学到的东西写回知识库 */
  function noteEvent(w, title, text){
    if (!w || !title) return;
    const L = get(w);
    const found = [];
    (L.chars || []).forEach(function(c){
      const shortName = String(c.n||'').split('·').pop();
      if (text && (text.indexOf(c.n) >= 0 || (shortName.length >= 2 && text.indexOf(shortName) >= 0))) found.push(c.n);
    });
    const fact = String(title).slice(0, 20) + (found.length ? '（' + found.join('、') + '）' : '');
    merge(w, { facts: [fact] });
  }

  return { all: all, get: get, merge: merge, prompt: prompt, noteEvent: noteEvent, seedOf: seedOf };
})();
