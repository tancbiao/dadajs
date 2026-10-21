/* 人生模拟器 · 核心引擎 v2
 * 新规则：
 *  - 18 岁前固定在现代都市，开局不选世界
 *  - 1-9 岁没有选择权（家长安排），10 岁开智后才有选项
 *  - 选项数量由智商决定（<120 两项，≥120 三项，≥131 多一条系统骚操作）
 *  - 每年可触发多起事件；选项不告诉玩家加什么属性
 *  - 18 岁结算神经发育与智力，觉醒系统，看系统背景决定是否穿越
 *  - 18 岁后解锁经济面板：主动收入 / 被动收入 / 负债，智商决定你有没有决定权
 */
window.LS = window.LS || {};

(function(){
  const clamp = function(v,a,b){ return Math.max(a, Math.min(b, v)); };

  function mulberry32(a){
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* 童年播报：严格按年龄分桶，1 岁不会出现"周末三个班" */
  const CHILD_LINES = {
    '1': [
      '你出生了。世界没有为你停下来，但有一两个人，在你面前忽然不会说话了。',
      '你在产房的第一声哭被雨声盖住了一半。',
      '家里为了你的名字争了三天，最后一笔落在族谱上，谁也不太满意。',
      '你满月那天，家里来了很多人，每个人都说你像爸爸。'
    ],
    '2-3': [
      '你走得还不稳，摔了就自己爬起来，没人在后面扶。',
      '你开口说的第一个词，被家里人反复学了很久。',
      '你开始认人。陌生人一抱就哭，只认那两张脸。',
      '你把抽屉里的东西一件件搬出来，再一件件塞回去。'
    ],
    '4-5': [
      '你上了幼儿园。第一天在门口哭了很久，后来发现里面比家里有意思。',
      '你开始记事。记忆里第一个画面，是午睡室的天花板。',
      '你有了第一个朋友，也有了第一个讨厌的人。',
      '你学会了自己穿鞋，虽然左右总是反的。'
    ],
    '6': [
      '你背上书包，第一次走进校门。教室里的桌子比幼儿园高，椅子腿是不平的。',
      '开学第一天，老师让每个人站起来说自己的名字。你说了，声音小得只有同桌听见。',
      '你被分到最后一排靠窗的位置，窗外有一棵树，风一吹就响。'
    ],
    '7-9': [
      '你升了年级。书包比你的背还宽。',
      '你第一次考了满分，那张卷子被贴在墙上，贴到纸都黄了。',
      '你在路上捡到一枚硬币，攥了一路，最后买了一根冰棍。',
      '你开始知道，家里并不像你以为的那么宽裕。'
    ],
    '10-12': [
      '你升了高年级。作业本从薄变厚，课间从十分钟变成"别出去"。',
      '你第一次熬夜，不是为了学习，是为了一件说不清的事。',
      '你开始注意到这座城市里那些大人不愿解释的东西。',
      '你学会了一件事：有些问题不问，日子会好过一点。'
    ],
    '13-15': [
      '你上了初中。身高长得很快，脾气也是。',
      '你和家里吵了一架，摔了门，然后在楼道上坐了很久。',
      '你开始有自己的秘密，锁在抽屉里，钥匙随身带着。',
      '你第一次意识到，成绩会把人和人分成两列。'
    ],
    '16-17': [
      '你上了高中。时间被切成了一节一节，每节四十五分钟。',
      '你在课桌上刻了一个字，毕业时才发现已经被磨平了。',
      '你开始想以后。想不清楚，但停不下来。',
      '有一天你在天台上站了很久，忽然意识到：十八岁快到了。'
    ]
  };

  function childBucket(age){
    if (age <= 1) return '1';
    if (age <= 3) return '2-3';
    if (age <= 5) return '4-5';
    if (age === 6) return '6';
    if (age <= 9) return '7-9';
    if (age <= 12) return '10-12';
    if (age <= 15) return '13-15';
    return '16-17';
  }

  /* 家长安排（1-9 岁，玩家无选择权）——每条都标了适用年龄 */
  const UPBRINGING = {
    intellectual: [
      { a:[1,3], t:'书架最下面一层专门给你空出一格，放你的绘本。' },
      { a:[1,3], t:'你半夜哭，爸爸抱着你在客厅走了四十分钟，一边走一边跟你说话。' },
      { a:[4,6], t:'你把家里的收音机拆了，他们没骂你，还陪你装了回去。' },
      { a:[7,9], t:'你问"为什么天是蓝的"，爸爸放下手里的活，给你讲了半小时。' },
      { a:[7,9], t:'周末去的是科技馆，不是商场。' }
    ],
    anxious: [
      { a:[1,3], t:'你刚会坐，妈妈就在放英语儿歌，说"语感要从小养"。' },
      { a:[1,3], t:'你哭了十分钟，她看了眼手表，说"不能一哭就抱，会惯坏"。' },
      { a:[4,4], t:'四岁那年，你被送去学钢琴。老师说你有天赋，妈妈说那就每天两小时。' },
      { a:[5,6], t:'钢琴课还在继续。每天两小时，指尖按得发红，你数着节拍器等它结束。' },
      { a:[7,9], t:'周末三个班。你在车上吃午饭，字写得歪歪扭扭。' },
      { a:[7,9], t:'你考了 98 分，妈妈问那 2 分扣在哪。' }
    ],
    permissive: [
      { a:[1,3], t:'你在地上爬，抓到什么啃什么，没人拦。' },
      { a:[1,3], t:'哭了就抱，抱起来又放下——他们实在太困了。' },
      { a:[4,6], t:'你整天在小区里跑，膝盖上的伤没好过。' },
      { a:[7,9], t:'放学自己回家，钥匙挂在脖子上。' }
    ],
    absent: [
      { a:[1,3], t:'你被送回老家，跟着爷爷奶奶。视频里的妈妈总是很模糊。' },
      { a:[1,3], t:'你发烧那晚，是奶奶背着你走了两里路去诊所。' },
      { a:[4,6], t:'家长会没人来，你坐在最后一排，假装不在意。' },
      { a:[7,9], t:'你学会了自己签字，笔迹练得很像。' },
      { a:[7,9], t:'过年他们回来七天，走的时候你躲在被子里没出来。' }
    ],
    pragmatic: [
      { a:[1,3], t:'邻居家孩子会背唐诗了，妈妈回来念叨了一路。' },
      { a:[1,3], t:'你被抱着在楼下晒太阳，谁路过都要捏一下你的脸。' },
      { a:[4,6], t:'邻居家孩子报了班，妈妈第二天也给你报了。' },
      { a:[7,9], t:'爸爸说：老师说的准没错，你听老师的。' },
      { a:[7,9], t:'饭桌上聊得最多的是别人家孩子。' }
    ],
    strict: [
      { a:[1,3], t:'你哭得久了，门会被关上，让你"哭够了再说"。' },
      { a:[1,3], t:'你伸手去抓桌上的杯子，被拍了一下手背。' },
      { a:[4,6], t:'你摔碎了一个碗，被罚站到半夜。' },
      { a:[7,9], t:'考了第三名，父亲问：为什么不是第一。' },
      { a:[7,9], t:'你藏了一本日记，藏在床板下面，还是被翻出来了。' }
    ]
  };

  const Game = {
    state:null,
    plan:[],
    idx:0,
    phase:'idle',
    pending:null,
    queue:[],
    result:null,
    rnd:Math.random,
    usedEvents:[],
    usedChild:[],
    usedLife:[],
    systemUsed:false,
    aiUsed:0,
    lastAiError:'',
    pathRecord:null,

    /* ================= 新游戏 ================= */
    newGame(opts){
      opts = opts || {};
      const seed = opts.seed != null ? opts.seed : Math.floor(Math.random()*1e9);
      this.rnd = mulberry32(seed);

      // 18 岁前固定现代都市；只有回放旧路径时才允许别的世界
      const startWorld = opts.worldId || 'modern';
      const world = LS.worldById(startWorld);

      const maker = opts.maker != null ? !!opts.maker : (this.rnd() < 0.06);
      const gender = opts.gender || (this.rnd() < 0.5 ? 'm' : 'f');
      const names_m = ['林决','陈砚','周野','顾南','沈既定','江迟','许照','程野'];
      const names_f = ['林晚','苏离','周宁','顾青','沈见月','江眠','许星','程雾'];
      const name = opts.name || LS.pick(gender==='f'?names_f:names_m, this.rnd.bind(this));

      const brain = LS.BRAIN.init(this.rnd.bind(this));

      const st = {
        id: LS.Store.uid('run_'),
        seed: seed,
        replay: !!opts.replay,
        worldId: world.id,
        worldName: world.name,
        systemId: opts.systemId || null,
        maker: maker,
        name: name,
        gender: gender,
        birthplace: LS.pick(world.places, this.rnd.bind(this)),
        age: 0,
        hp: 100, maxHp: 100,
        child: { hp:8, mind:8, guts:8, soci:8, study:8, home:8, luck:8 },
        brain: brain,
        attrs:{}, res:{}, econ:null,
        level:1, expNeed:100, freePts:0,
        tags:[], flags:{},
        ap:3, turn:0, year:1,
        alive:true, ended:false, endReason:'',
        deaths:0, rewinds:0, usedReroll:false,
        log:[], timeline:[], history:[], childMemories:[],
        dimBonus:{战:0,智:0,体:0,社:0,运:0,财:0,灵:0},
        made:0, aiUsed:0, devDone:0, customActs:[],
        buildId:null, build:null, deathWays:{},
        slice: !!(LS.SLICE && opts && opts.slice),
        talentId: (opts && opts.talent) || null,
        talentCrisis: 0,
        bounty: 0,
        lifeVar: Math.round((this.rnd() * 26 - 10)),   // 每个人天生寿元不同
        achievements: [],
        startedAt: Date.now()
      };
      this.state = st;
      // 天赋：选了就用选的，没选就随机给一个（老存档兼容）
      if (LS.Talent) {
        let tid = st.talentId;
        if (!tid) {
          const offer = LS.Talent.offer(this.rnd.bind(this));
          tid = offer[0].id;
        }
        LS.Talent.apply(st, tid);
      }
      this.aiUsed = 0;
      this.usedEvents = [];
      this.usedChild = [];
      this.usedLife = [];
      this._lastLine = '';
      this.eduAge = -1;
      this.eduLines = [];
      this.eduLinesShown = -1;
      this.eduNew = null;
      this.eduReplay = false;
      this.systemUsed = false;
      this.result = null;
      this.queue = [];
      this.pathRecord = null;
      this.lastAiError = '';

      // 童年节奏：1-9 无选择；10 岁开智；10-17 六次事件
      // 另外在 8/11/12/16 岁各插一场"学校生活"：10 岁前由学校替你决定，10 岁后你才有得选
      const evtAges = [10, 11, 13, 14, 15, 17];
      const lifeAges = { 8:null, 9:'l_expert_test', 10:'l_hw_crash', 11:'l_manga', 12:null, 13:'l_smoke_hard', 14:'l_novel', 15:null, 16:null };
      this.plan = [];
      // 1–5 岁：一张速写卡带过（学《人生重开模拟器》的节奏，别让玩家点九次）
      this.plan.push({ age:2, kind:'batch', from:1, to:2 });
      for (let age=3; age<=5; age++) {
        this.plan.push({ age:age, kind:'say' });
        this.plan.push({ age:age, kind:'life', force: age===3 ? 'l_phone_feed' : (age===4 ? 'l_class_early' : null) });
      }
      for (let age=6; age<=9; age++) {
        this.plan.push({ age:age, kind:'say' });
        if (lifeAges[age] !== undefined) this.plan.push({ age:age, kind:'life', force:lifeAges[age] });
      }
      for (let age=10; age<=17; age++) {
        this.plan.push({ age:age, kind: evtAges.indexOf(age) >= 0 ? 'event' : 'say' });
        if (lifeAges[age] !== undefined) this.plan.push({ age:age, kind:'life', force:lifeAges[age] });
      }
      this.plan.push({ age:18, kind:'awaken' });

      this.idx = 0;
      this.phase = 'child';
      st.age = 1;
      this.buildChildItem();
      return st;
    },

    /* 给 AI 的"人生履历"：它必须记得你之前选过什么 */
    lifeMemory(){
      const st = this.state;
      if (!st) return '';
      const lines = [];
      if (st.brain) {
        lines.push('家庭：' + (st.brain.parent ? st.brain.parent.name : '—') + '；学校：' + (st.brain.school ? st.brain.school.name : '—'));
        lines.push('智商 ' + st.brain.iq + '，系统掌握度 ' + st.brain.mastery + '%');
        if (st.brain.travel) lines.push('穿越熟练 ' + st.brain.travel);
      }
      lines.push('关键节点：' + (st.timeline.slice(-10).join('；') || '刚成年'));
      const recent = st.log.slice(-10).map(function(l){
        return l.age + '岁 ' + String(l.text || '').slice(0, 40);
      }).join(' / ');
      lines.push('近年经历：' + (recent || '—'));
      lines.push('身上的标签：' + (st.tags.slice(-8).join('、') || '无'));
      if (st.econ) {
        lines.push('经济：现金 ' + LS.ECON.money(st.econ.cash, st.worldId) +
          '，年收入 ' + LS.ECON.money(st.econ.active, st.worldId) +
          '，负债 ' + LS.ECON.money(st.econ.debt, st.worldId));
      }
      if (st.civ) lines.push('文明计划：' + st.civ.field + ' 第 ' + (st.civ.years || 0) + ' 年');
      if (st.deaths) lines.push('死过 ' + st.deaths + ' 次');
      return lines.join('\n');
    },

    /* ================= 快进：把年纪一口气过掉 ================= */
    canFast(){
      const st = this.state;
      if (!st || !st.system || st.ended) return 0;
      if (st.age < 30) return 0;
      return st.age >= 50 ? 10 : 5;
    },

    async fastForward(years){
      const st = this.state;
      const rows = [];
      this._fast = true;
      for (let i = 0; i < years; i++) {
        if (st.ended) break;
        const age0 = st.age;
        const ev = await this.startYear();
        if (!ev) break;
        let guard = 0;
        while (this.phase === 'event' && guard++ < 5) {
          let pick = 0;
          if (this.pending.opts && this.pending.opts.length > 1) {
            let best = -1;
            const self = this;
            this.pending.opts.forEach(function(o, k){
              const p = self.odds(o.dim, o.dc);
              if (p > best) { best = p; pick = k; }
            });
          }
          if (this.pending.auto) this.autoResolve();
          else this.chooseOption(pick);
          const r = await this.afterEvent();
          if (r === 'actions' || r === 'end' || st.ended) break;
        }
        const first = this.result ? String(this.result.text || '').split('\n')[0] : '';
        rows.push({ age: age0, text: (this.pending && this.pending.title ? this.pending.title + ' · ' : '') + first.slice(0, 34) });
        if (st.ended) break;
        st.ap = 0;
        this.endYear();
        if (st.ended) break;
      }
      this._fast = false;
      return rows;
    },

    /* ================= 主导剧情：直接去做一件大事 ================= */
    storyAvailable(){
      const st = this.state;
      return !!(st && st.system) && st.storyYear !== st.age;
    },

    async narrativeStory(idea){
      const st = this.state, w = LS.worldById(st.worldId);
      idea = String(idea || '').replace(/\s+/g,' ').trim();
      if (idea.length < 2) return { error:'写清楚你要做什么。' };
      if (!this.storyAvailable()) return { error:'这一年你已经做过一件大事了。' };
      if (st.ap < 1) return { error:'至少需要 1 点行动力。' };
      st.storyYear = st.age;
      st.ap -= 1;

      const power = this.dimVal('战');
      const iq = st.brain.iq || 100;
      const text0 = idea;
      let dc = 26, tier = '对手', reward = 1;
      if (/(四皇|大将|七武海|影级|宗主|掌门|魔王|龙王|星海|古神)/.test(idea)) { dc = 48; tier = '顶尖存在'; reward = 6; }
      else if (/(海军|叛忍|上忍|妖兽|首领|头目|干部|军团长)/.test(idea)) { dc = 36; tier = '强敌'; reward = 3; }

      const p = Math.max(0.05, Math.min(0.92, 0.5 + (power - dc) / dc * 0.9 + (iq - 100) * 0.001));
      const ok = this.rnd() < p;
      const chips = [];

      if (ok) {
        const attrKey = (st.system.stats || []).find(function(x){ return x.dim === '战'; });
        if (attrKey) st.attrs[attrKey.k] = Math.round(((st.attrs[attrKey.k] || 0) + 2 * reward) * 10) / 10;
        st.tags.push('做过：' + text0.slice(0, 10));
        if (st.worldId === 'pirate') {
          const add = 20000000 * reward;
          st.bounty = (st.bounty || 0) + add;
          chips.push({ text:'悬赏金 +' + LS.fmtBounty(add) + '（现 ' + LS.fmtBounty(st.bounty) + '）', good:true });
        }
        if (st.econ) {
          const cash = 20 * reward;
          st.econ.cash = Math.round((st.econ.cash + cash) * 10) / 10;
          chips.push({ text:'收获 ' + LS.ECON.money(cash, st.worldId), good:true });
        }
        st.brain.mastery = Math.min(100, (st.brain.mastery || 0) + 2);
        chips.push({ text:'战力提升', good:true });
        st.timeline.push(st.age + '岁·' + text0.slice(0, 14));
        // 余波：名声会自己找上门
        if (LS.makeWave) {
          st.waves = st.waves || [];
          const tier = (dc >= 48) ? 'top' : 'mid';
          const count = (dc >= 48) ? 3 : 1;
          const pool = (LS.WAVES[tier] || []).slice();
          for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
          for (let i = 0; i < count && i < pool.length; i++) {
            st.waves.push({ at: st.age + 1 + i, tpl: pool[i] });
          }
        }
        const text = '你去了。\n\n' + (tier === '顶尖存在'
          ? '那不是一场势均力敌的战斗。你准备了很多年，把所有能算的都算了一遍。\n\n最后站着的人是你。'
          : '比想象中顺利。你花了半炷香的时间，收尾很干净。') +
          '\n\n从此' + w.name + '的人提起你，会先停一下。';
        st.log.push({ age: st.age, kind:'good', text: text.replace(/\n+/g,' ') });
        return { title:'你做到了：' + text0.slice(0, 10), text:text, chips:chips, ok:true, story:true, chance:Math.round(p*100) };
      }

      const dmg = tier === '顶尖存在' ? 45 : 22;
      st.hp = Math.max(0, st.hp - dmg);
      chips.push({ text:'气血 -' + dmg, good:false });
      st.brain.cortisol = Math.min(100, (st.brain.cortisol || 0) + 4);
      const text = '你去了。\n\n' + (tier === '顶尖存在'
        ? '你连它的正面都没撑过。醒来时天已经黑了，肋骨断了两根，身上的钱被人摸走了。\n\n有些东西，不是靠勇气就能越过去的。'
        : '你打得很吃力。最后被人拖了出来，刀口很深，血止不住。') +
        '\n\n你活下来了，但这件事你暂时不会再提。';
      st.log.push({ age: st.age, kind:'bad', text: text.replace(/\n+/g,' ') });
      let death = null;
      if (st.hp <= 0) death = this.handleDeath('你在挑战' + tier + '时没能活下来');
      return { title:'你没做到：' + text0.slice(0, 10), text:text, chips:chips, ok:false, story:true, death:death, chance:Math.round(p*100) };
    },

    /* ================= 自发路线（研究出来的那条路） ================= */
    advancePath(idea){
      const st = this.state;
      if (!LS.Paths) return null;
      const def = LS.Paths.match(idea);
      if (!def) return null;
      st.paths = st.paths || {};
      const cur = st.paths[def.id] || { stage: 0 };
      if (cur.stage >= def.stages.length) return { def: def, stage: null, done: true };
      const step = def.stages[cur.stage];
      cur.stage += 1;
      st.paths[def.id] = cur;

      // 真改数值：收入结构、寿元、死亡率
      if (step.econ && st.econ) {
        if (step.econ.cash) st.econ.cash = Math.round((st.econ.cash + step.econ.cash) * 10) / 10;
        if (step.econ.active) st.econ.active = Math.round((st.econ.active + step.econ.active) * 10) / 10;
        if (step.econ.passive) st.econ.passive = Math.round((st.econ.passive + step.econ.passive) * 10) / 10;
      }
      if (step.life) st.flags.longevity = (st.flags.longevity || 0) + step.life;
      if (step.risk) st.flags.riskMul = Math.min(st.flags.riskMul == null ? 1 : st.flags.riskMul, step.risk);
      if (step.immortal) st.flags.immortal = 1;
      st.timeline.push(st.age + '岁·' + def.n + '：' + step.n);
      st.tags.push(def.n + '·' + step.n);
      return { def: def, stage: step, index: cur.stage, total: def.stages.length };
    },

    /* ================= 推动文明 ================= */
    civFields(){
      const st = this.state;
      const w = LS.worldById(st.worldId);
      const tags = (w.tags || []).join(',');
      if (/神秘|诡异|克苏鲁/.test(tags)) return ['神秘学', '禁忌学', '宇宙学', '医学'];
      if (/魔法|异世界|史诗/.test(tags)) return ['魔法学', '炼金术', '宇宙学', '农学'];
      if (/修真|长生/.test(tags)) return ['丹道', '阵法', '宇宙学', '农学'];
      if (/忍者|查克拉/.test(tags)) return ['忍术', '查克拉研究', '医疗忍术', '封印术'];
      if (/海贼|航海|贸易/.test(tags)) return ['航海学', '造船', '恶魔果实研究', '宇宙学'];
      if (/赛博|科幻|殖民/.test(tags)) return ['人工智能', '能源学', '宇宙学', '生物工程'];
      if (/末世|废土|生存/.test(tags)) return ['农学', '医学', '能源学', '工程学'];
      return ['哲学', '数学', '宇宙学', '医学'];
    },

    civAvailable(){
      const st = this.state;
      if (!st || !st.system || st.age < 25) return false;
      if (st.worldId === 'modern') return false;
      if (st.brain.iq < 105) return false;
      return true;
    },

    civStart(field){
      const st = this.state;
      if (!this.civAvailable()) return { error:'你现在还做不了这件事。' };
      if (st.civ) return { error:'你已经在做另一件事了。' };
      st.civ = { field: field || '宇宙学', years: 0, failed: false, done: false };
      st.timeline.push(st.age + '岁·开始研究' + st.civ.field);
      return { ok:true, text:'你决定把接下来的十年，投进【' + st.civ.field + '】。\n\n没有人知道这有没有用。你自己也不知道。' };
    },

    civPush(){
      const st = this.state;
      if (!st.civ || st.civ.done) return null;
      if (st.ap < 2) return { error:'要推动它，得一次投进两点行动力。' };
      st.ap -= 2;
      const c = st.civ;
      c.years += 1;
      const iq = st.brain.iq;
      const gain = Math.max(1, Math.round(1 + (iq - 105) / 25));
      c.progress = (c.progress || 0) + gain;
      const chips = [{ text:'第 ' + c.years + ' 年 · 进度 +' + gain, good:true }];
      let text = '你把这一年能挤出来的时间都给了【' + c.field + '】。\n\n';
      text += c.years < 10
        ? '离"可能有用"还差 ' + (10 - c.years) + ' 年。'
        : '第十年。你把所有记录摊在桌上，手指停在其中一行。';

      if (c.years >= 10) {
        const p = Math.min(0.78, 0.10 + Math.max(0, iq - 100) * 0.012 + (st.brain.mastery || 0) * 0.002);
        c.done = true;
        if (this.rnd() < p) {
          c.success = true;
          st.flags.civilized = 1;
          st.timeline.push(st.age + '岁·' + c.field + '推动了这个世界的文明');
          st.tags.push('文明推动者');
          chips.push({ text:'文明跃迁', good:true });
          text += '\n\n你写下的那一页，后来被人抄了很多遍。\n\n这个世界往前走了一小步，而那一小步上有你的名字。';
        } else {
          c.success = false;
          st.timeline.push(st.age + '岁·' + c.field + '研究失败');
          chips.push({ text:'十年白费', good:false });
          text += '\n\n你算错了一个前提。十年，塌在一行数字上。';
        }
      }
      return { ok:true, text:text, chips:chips, done:c.done, success:c.success };
    },

    /* ================= 成就 ================= */
    computeAchievements(){
      const st = this.state;
      const dims = this.dims();
      const net = st.econ ? LS.ECON.netWorth(st.econ) : 0;
      const list = [];
      const add = function(icon, name, desc){ list.push({ icon:icon, name:name, desc:desc }); };

      if (dims['战'] >= 90) add('⚔️', '万夫莫开', '战斗力 ' + Math.round(dims['战']) + '，你一个人就是一支队伍。');
      if (st.brain.iq >= 131) add('🧠', '天生异类', '智商 ' + st.brain.iq + '，你一直比周围人快半步。');
      if (st.brain.mastery >= 70) add('🔮', '把系统看穿了', '掌握度 ' + st.brain.mastery + '%，规则在你手里是透明的。');
      if (net >= 500) add('💎', '富可敌国', '净资产 ' + LS.ECON.money(net, st.worldId) + '。');
      if (st.age >= 90) add('🕯️', '活得比时代久', '你活到了 ' + st.age + ' 岁。');
      if (st.deaths >= 5) add('💀', '死过很多次', '死亡 ' + st.deaths + ' 次，你还在。');
      if ((st.customActs || []).length) add('✦', '自创一门', '你想出了【' + st.customActs[0].n + '】，它替代了原本的活法。');
      if (st.flags.civilized) add('🌍', '文明推动者', '你用十年，把' + (st.civ ? st.civ.field : '某个学科') + '往前推了一格。');
      if (st.flags.numb) add('🌫️', '浑浑噩噩的一生', '你把日子过成了一条直线：上班、回家、抽烟、睡觉，然后重复了 ' + (st.numbYears || 0) + ' 年。');
      if (st.worldId === 'xianxia' && st.age >= 150) add('⛰️', '长生', '在修真界活了 ' + st.age + ' 年。');
      if (st.worldId !== 'modern' && st.flags.stayed) add('🏙️', '没被带走', '全世界都穿越了，只有你留在了原地。');
      if (!list.length) add('🪨', '普通人', '没有奇迹，也没有塌方。你只是活过。');
      st.achievements = list;
      return list;
    },

    /* ================= 存档 / 续玩 ================= */
    snapshot(){
      if (!this.state) return null;
      return {
        v: LS.VERSION, at: Date.now(),
        state: this.state,
        phase: this.phase,
        plan: this.plan,
        idx: this.idx,
        pending: this.pending,
        result: this.result,
        queue: this.queue,
        systemUsed: this.systemUsed,
        aiUsed: this.aiUsed
      };
    },

    saveRun(){
      if (!LS.Store.saveRun) return;
      if (!this.state || this.state.ended) return;
      try { LS.Store.saveRun(this.snapshot()); } catch(e){}
    },

    resumeRun(){
      const sn = LS.Store.loadRun && LS.Store.loadRun();
      if (!sn) return null;
      this.state = sn.state;
      this.phase = sn.phase || 'actions';
      this.plan = sn.plan || [];
      this.idx = sn.idx || 0;
      this.pending = sn.pending || null;
      this.result = sn.result || null;
      this.queue = sn.queue || [];
      this.systemUsed = !!sn.systemUsed;
      this.aiUsed = sn.aiUsed || 0;
      return this.state;
    },

    /* ================= 系统开发路线 ================= */
    buildMods(){
      const b = this.state && this.state.build;
      return (b && b.mods) || {};
    },

    builds(){
      const st = this.state;
      if (!st || !st.system) return [];
      if (!LS.buildsFor) return [];
      return LS.buildsFor(st.system.mechanic);
    },

    chooseBuild(id){
      const st = this.state;
      const list = this.builds();
      const b = list.find(function(x){ return x.id === id; }) || list[0];
      st.buildId = b.id;
      st.build = b;
      return b;
    },

    canSeekDeath(){
      const st = this.state;
      if (!st || !st.system) return false;
      if (st.system.mechanic !== 'deathReturn') return false;
      return !!(st.build && st.build.action === 'seekDeath');
    },

    /* ================= 童年 ================= */
    estIQ(){
      const b = this.state.brain;
      if (b.iq) return b.iq;
      const copy = Object.assign({}, b, { log: b.log });
      return LS.BRAIN.finalIQ(copy);
    },

    childItem(){ return this.pending; },

    /* 每年发育结算（年龄结束时调用） */
    develop(age){
      const st = this.state;
      if (st.devDone >= age) return;
      const b = st.brain;
      const mods = b.mods || {};
      LS.BRAIN.yearDevelop(b, age, mods);
      b.mods = null;
      st.devDone = age;
      this.talentTick(age);
    },

    /* 学校生活事件（童年版）：10 岁前由学校替你决定，10 岁后才给你选 */
    buildChildLife(step){
      const st = this.state;
      const used = this.usedLife;
      let pool;
      if (step.force) {
        pool = LS.LIFE_EVENTS.filter(function(e){ return e.id === step.force; });
      } else {
        const iq0 = st.brain.iq || this.estIQ();
        const okWhen = function(e){
          if (e.when === 'private' && st.brain.school.id.indexOf('private') !== 0) return false;
          if (e.iqMin && iq0 < e.iqMin) return false;
          if (e.iqMax && iq0 > e.iqMax) return false;
          return true;
        };
        pool = LS.LIFE_EVENTS.filter(function(e){
          return step.age >= e.minAge && step.age <= e.maxAge && (e.opts||[]).length && okWhen(e) && used.indexOf(e.id) < 0;
        });
        if (!pool.length) pool = LS.LIFE_EVENTS.filter(function(e){
          return step.age >= e.minAge && step.age <= e.maxAge && (e.opts||[]).length && okWhen(e);
        });
      }
      if (!pool.length) { this.idx++; return this.buildChildItem(); }

      const tpl = pool[Math.floor(this.rnd()*pool.length)];
      used.push(tpl.id);
      // 私立转公办：学校真的换了，后面的课间/压力描述才不会前后矛盾
      if (tpl.id === 'l_private_math') {
        const pub = LS.BRAIN.SCHOOLS.find(function(s){ return s.id === 'public_plain'; });
        if (pub) { st.brain.school = pub; st.tags.push('转学'); }
      }
      const ev = this.normalizeOffline(tpl);
      const self = this;

      let opts = (ev.opts || []).map(function(o){
        return { n:o.n, s:o.s, f:o.f, res:o.s, dim:o.dim, dc:o.dc, eff:o.eff || {},
                 brain: (o.eff && o.eff.brain) || null, risk: o.risk || null };
      });
      if (!opts.length) { this.idx++; return this.buildChildItem(); }

      // 10 岁前：没有选择权
      if (step.age < 10) {
        const o = opts[0];
        if (o.brain) this.applyBrain(o.brain);
        const text = '【' + ev.title + '】\n\n' + ev.text + '\n\n' + (o.s || '');
        this.pending = { kind:'say', age:step.age, text:text, title:ev.title, sci:tpl.sci || '', eduLines: this._showEduLines || [] };
        st.log.push({ age:step.age, kind:'say', text:text });
        this.phase = 'child';
        return this.pending;
      }

      // 智商不够的时候，连"还有别的办法"都想不出来——只留第一个选项
      if (tpl.lockIQ && (st.brain.iq || this.estIQ()) < tpl.lockIQ) {
        opts = opts.slice(0, 1);
        this.pending = {
          kind:'event', age:step.age, id:tpl.id, title:ev.title, text:ev.text,
          opts:opts, limited:true, life:true, sci:ev.sci || ev.tpl && ev.tpl.sci || tpl.sci || '',
          locked:true, eduLines: this._showEduLines || []
        };
        st.log.push({ age:step.age, kind:'event', text:'【' + ev.title + '】' + ev.text });
        this.phase = 'child';
        return this.pending;
      }

      const n = LS.BRAIN.hasChoice(step.age, this.estIQ());
      if (opts.length > n) {
        opts = opts.map(function(o){ return { o:o, r:self.rnd() }; })
                   .sort(function(a,b){ return a.r - b.r; })
                   .slice(0, n).map(function(x){ return x.o; });
      }
      this.pending = {
        kind:'event', age:step.age, id:tpl.id, title:ev.title, text:ev.text,
        opts:opts, limited: opts.length < (ev.opts||[]).length, life:true,
        sci: tpl.sci || '',
        eduLines: this._showEduLines || []
      };
      st.log.push({ age:step.age, kind:'event', text:'【' + ev.title + '】' + ev.text });
      this.phase = 'child';
      return this.pending;
    },

    /* 每年的教育政策结算：先算今年收益，再判投诉，最后可能触发新政策 */
    eduTick(age){
      const st = this.state, b = st.brain;
      if (!b.buffs) b.buffs = [];
      if (!b.eduTaken) b.eduTaken = [];
      b.eduIQ = b.eduIQ || 0;
      const lines = [];
      const isPublic = (b.school.id || '').indexOf('public') === 0;

      // 1) 生效中的政策：今年产出
      b.buffs.forEach(function(buff){
        if (buff.stopped || buff.expired) return;
        if (age > buff.untilAge) { buff.expired = true; return; }
        buff.years = (buff.years || 0) + 1;
        const parts = [];
        if (buff.iq) {
          b.eduIQ = Math.round((b.eduIQ + buff.iq) * 10) / 10;
          buff.sumIQ = Math.round(((buff.sumIQ || 0) + buff.iq) * 10) / 10;
          parts.push('智力 ' + (buff.iq > 0 ? '+' : '') + buff.iq);
        }
        if (buff.ndi) {
          b.ndi = LS.BRAIN.clamp(b.ndi + buff.ndi, 5, 100);
          buff.sumNDI = Math.round(((buff.sumNDI || 0) + buff.ndi) * 10) / 10;
          parts.push('神经元 ' + (buff.ndi > 0 ? '+' : '') + buff.ndi);
        }
        if (buff.sleep) {
          b.mods = b.mods || {};
          b.mods.sleep = (b.mods.sleep || 0) + buff.sleep;
          parts.push('睡眠 ' + buff.sleep + ' 小时');
        }
        if (parts.length) {
          lines.push({ t:'〔教育〕' + buff.name + ' · ' + parts.join('、'), good: ((buff.iq||0) + (buff.ndi||0)) > 0 });
        }
      });

      // 2) 家长投诉：政策中断
      const self = this;
      b.buffs.forEach(function(buff){
        if (buff.stopped || buff.expired || !buff.stopRisk) return;
        const rate = LS.EDU_STOP_RATE[isPublic ? 'public' : 'private'] || 1;
        if (self.rnd() < buff.stopRisk * rate) {
          buff.stopped = true;
          buff.stoppedAge = age;
          lines.push({ t:'〔教育〕家长投诉 · ' + buff.name + ' 中断。' + (buff.stopText || ''), good:false });
          if (buff.id === 'recess_sport' && b.school.recess > 0.1) {
            b.school.recess = 0.05;
            b.buffs.push(Object.assign({}, LS.EDU_NO_RECESS, { addedAge: age, years: 0 }));
            lines.push({ t:'〔教育〕课间被取消 · 神经元发育受抑制（每年 -0.8）', good:false });
          }
        }
      });

      // 3) 新政策/新师资（每年最多一件）
      let newEvent = null;
      if (age >= 6 && age <= 16) {
        for (let i = 0; i < LS.EDU_EVENTS.length; i++) {
          const e = LS.EDU_EVENTS[i];
          if (b.eduTaken.indexOf(e.id) >= 0) continue;
          if (age < e.age[0] || age > e.age[1]) continue;
          if (e.publicOnly && !isPublic) continue;
          if (this.rnd() >= e.prob) continue;
          newEvent = e;
          b.eduTaken.push(e.id);
          b.buffs.push(Object.assign({}, e.buff, { addedAge: age, years: 0 }));
          break;
        }
      }
      return { lines: lines, newEvent: newEvent };
    },

    eduReport(){
      const b = this.state.brain;
      return (b.buffs || []).map(function(x){
        return {
          name: x.name, years: x.years || 0,
          iq: Math.round((x.sumIQ || 0) * 10) / 10,
          ndi: Math.round((x.sumNDI || 0) * 10) / 10,
          status: x.stopped ? 'stopped' : (x.expired ? 'ended' : 'active'),
          stoppedAge: x.stoppedAge
        };
      });
    },

    buildChildItem(){
      const step = this.plan[this.idx];
      if (!step) { this.phase = 'awaken'; return null; }
      const st = this.state, w = LS.worldById(st.worldId), b = st.brain;
      st.age = step.age;

      if (step.kind === 'awaken') {
        this.pending = { kind:'awaken', age:18 };
        this.phase = 'awaken';
        return this.pending;
      }

      /* 1–5 岁：一张卡写五年，发育照算（一年都不能少） */
      if (step.kind === 'batch') {
        const from = step.from, to = step.to;
        const lines = [];
        const self = this;
        for (let a = from; a <= to; a++) {
          const bank = CHILD_LINES[childBucket(a)];
          lines.push({ age:a, text: LS.pick(bank, self.rnd.bind(self)) });
          this.develop(a);
        }
        this.pending = { kind:'batch', age:to, from:from, to:to, lines:lines };
        st.log.push({ age:to, kind:'say', text: lines.map(function(l){ return l.age + '岁：' + l.text; }).join(' ') });
        this.phase = 'child';
        return this.pending;
      }

      /* 教育政策：同一个年龄只结算一次；新政策优先单独成卡 */
      let edu;
      if (this.eduAge !== step.age) {
        edu = this.eduTick(step.age);
        this.eduAge = step.age;
        this.eduLines = edu.lines;
        this.eduLinesShown = -1;
        this.eduNew = edu.newEvent;
      } else {
        edu = { lines: this.eduLines || [], newEvent: null };
      }
      if (this.eduNew) {
        const ev = this.eduNew;
        this.eduNew = null;
        this.eduLinesShown = step.age;
        this.eduReplay = true;
        const bf = ev.buff || {};
        const amt = [];
        if (bf.iq) amt.push('智力 ' + (bf.iq > 0 ? '+' : '') + bf.iq);
        if (bf.ndi) amt.push('神经元 ' + (bf.ndi > 0 ? '+' : '') + bf.ndi);
        if (bf.sleep) amt.push('睡眠 ' + bf.sleep + ' 小时');
        const policyLines = [];
        if (amt.length) {
          policyLines.push({ t:'〔政策〕每年 ' + amt.join('、') + '，持续到 ' + (bf.untilAge || 12) + ' 岁', good: ((bf.iq||0)+(bf.ndi||0)) > 0 });
        }
        if (bf.stopRisk) {
          const isPub = (this.state.brain.school.id || '').indexOf('public') === 0;
          const rate = Math.round(bf.stopRisk * (LS.EDU_STOP_RATE[isPub?'public':'private']||1) * 100);
          policyLines.push({ t:'〔风险〕每年约有 ' + rate + '% 概率被家长投诉中断', good:false });
        }
        const body = ev.text + (edu.lines.length ? '\n\n' + edu.lines.map(function(l){ return l.t; }).join('\n') : '');
        this.pending = { kind:'edu', age:step.age, title:ev.title, text:ev.text, eduLines: edu.lines, policyLines: policyLines };
        this.state.log.push({ age:step.age, kind:'edu',
          text:'【' + ev.title + '】' + ev.text + (edu.lines.length ? ' ' + edu.lines.map(function(l){ return l.t; }).join(' ') : '') });
        this.phase = 'child';
        return this.pending;
      }
      const showLines = (this.eduLinesShown !== step.age) ? (this.eduLines || []) : [];
      this.eduLinesShown = step.age;
      this._showEduLines = showLines;

      // 生活事件是概率事件：不是每一世都会遇到手机、短视频、饭圈
      if (step.kind === 'life' && !step.force && this.rnd() < 0.42) {
        this.idx++;
        return this.buildChildItem();
      }
      if (step.kind === 'life') return this.buildChildLife(step);

      if (step.kind === 'say') {
        const bucket = childBucket(step.age);
        // 相邻两年不播同一句
        const bankAll = CHILD_LINES[bucket];
        const bank = bankAll.filter(function(t){ return t !== this._lastLine; }, this);
        let line = LS.pick(bank.length ? bank : bankAll, this.rnd.bind(this));
        this._lastLine = line;

        // 1-9 岁：家长安排的戏份（按年龄过滤，避免 1 岁出现小学剧情）
        if (step.age <= 9) {
          const upAll = UPBRINGING[b.parent.id] || UPBRINGING.pragmatic;
          const up = upAll.filter(function(x){ return step.age >= x.a[0] && step.age <= x.a[1]; });
          if (up.length) line += '\n\n' + LS.pick(up, this.rnd.bind(this)).t;

          if (step.age === 4 && b.parent.id !== 'permissive' && b.parent.id !== 'absent') {
            b.earlyEdu = b.parent.id === 'intellectual' ? 'enrich' : (b.parent.id === 'anxious' || b.parent.id === 'strict') ? 'drill' : 'plain';
            line += b.earlyEdu === 'enrich'
              ? '\n\n他们给你报了一个不考试的启蒙班，只是玩。'
              : b.earlyEdu === 'drill'
                ? '\n\n你被送去上"专注力训练"。你坐不住，被老师按在椅子上。'
                : '\n\n兴趣班试听了一节，你只顾着玩积木，老师说你还没准备好。';
          }
          if (step.age === 6) {
            line += '\n\n你被送进了' + b.school.name + '。' + b.school.desc;
            if (b.school.id === 'private_elite') line += ' 学费是家里一年多的收入，爸妈说值得。';
            else if (b.school.id === 'private_cheap') line += ' 学费不便宜，妈妈说"总比菜小强"。';
            else if (b.school.id === 'public_plain') line += ' 校门口的小卖部，一根辣条五毛。';
          }
        }

        // 用文字暗示状态（不给数字）
        if (step.age % 4 === 3) {
          if (b.cortisol > 70) line += '\n\n你最近总是肚子疼，医生说是"情绪引起的"。';
          else if (b.ndi > 65) line += '\n\n你学东西很快，快到大人都觉得奇怪。';
          else if (b.focus < 30) line += '\n\n你坐不住，十分钟就要起来一次。';
          else if (b.mirror > 65) line += '\n\n小区里的孩子都爱找你玩。';
        }

        // 每三年补一句环境：让"这座城"有存在感
        if ([3,6,9,12,15,17].indexOf(step.age) >= 0) {
          line += '\n\n' + LS.pick(w.flavor, this.rnd.bind(this));
        }

        this.pending = { kind:'say', age:step.age, text:line, eduLines: this._showEduLines || [] };
        st.log.push({ age:step.age, kind:'say', text:line });
        this.phase = 'child';
        return this.pending;
      }

      // 事件：10 岁前不可能出现
      const used = this.usedChild;
      let cands = LS.CHILD_EVENTS.filter(function(e){
        return step.age >= e.minAge && step.age <= e.maxAge && used.indexOf(e.id) < 0;
      });
      if (!cands.length) {
        this.usedChild = [];
        cands = LS.CHILD_EVENTS.filter(function(e){ return step.age >= e.minAge && step.age <= e.maxAge; });
      }
      const ev = LS.pick(cands, this.rnd.bind(this));
      used.push(ev.id);

      let text = ev.text
        .replace('{place}', LS.pick(w.places, this.rnd.bind(this)))
        .replace('{school}', b.school.name);

      // 选项数量由当前智力估计决定
      const iq = this.estIQ();
      const n = LS.BRAIN.hasChoice(step.age, iq);
      let opts = ev.opts.map(function(o, i){ return { n:o.n, eff:o.eff, res:o.res, tag:o.tag, _i:i }; });
      // 打乱后截断：看不全，就是看不全
      const self = this;
      opts = opts.map(function(o){ return { o:o, r:self.rnd() }; })
                 .sort(function(a,b){ return a.r - b.r; })
                 .slice(0, n)
                 .map(function(x){ return x.o; });

      this.pending = {
        kind:'event', age:step.age, id:ev.id, title:ev.title, text:text, opts:opts,
        limited: n < ev.opts.length, eduLines: this._showEduLines || []
      };
      st.log.push({ age:step.age, kind:'event', text:'【' + ev.title + '】' + text });
      this.phase = 'child';
      return this.pending;
    },

    childChoose(i){
      const ev = this.pending;
      if (!ev || ev.kind !== 'event') return null;
      const o = ev.opts[i];
      if (!o) return null;
      const st = this.state;

      const chips = [];
      Object.keys(o.eff || {}).forEach(function(k){
        const v = o.eff[k];
        st.child[k] = clamp((st.child[k] || 8) + v, 1, 20);
        const meta = LS.CHILD_KEYS.find(function(x){ return x.k === k; });
        chips.push({ text: (meta?meta.n:k) + (v>0?' +':' ') + v, good: v>0 });
      });

      // 脑发育影响（童年最关键的一层）
      const bb = (LS.CHILD_BRAIN[ev.id] || [])[o._i] || null;
      if (bb) this.applyBrain(bb);
      if (o.brain) this.applyBrain(o.brain);      // 来自"学校生活"事件

      let text = o.res || o.s || '';
      // 事件自带的概率风险
      if (o.risk && this.rnd() < o.risk.p) {
        text += (text ? '\n\n' : '') + (o.risk.text || '');
        this.applyBrain(o.risk);
      }

      if (o.tag && st.tags.indexOf(o.tag) < 0) st.tags.push(o.tag);
      if (o.eff && o.eff.flag) {
        st.flags[o.eff.flag] = 1;
        if (o.eff.flag === 'manga') st.brain.manga = true;   // 解锁动漫世界的穿越池
      }
      st.childMemories.push({ age:ev.age, title:ev.title, choice:o.n, tag:o.tag || '' });

      this.result = { text:text, chips:[], title:ev.title, age:ev.age, eff: o.brain || null };
      // 童年不告诉玩家数值，chips 留空
      this.phase = 'childResult';
      return this.result;
    },

    childNext(){
      // 教育政策卡看完后，回到同一年的正常内容
      if (this.eduReplay) { this.eduReplay = false; return this.buildChildItem(); }
      const cur = this.plan[this.idx];
      if (cur && cur.kind !== 'batch' && cur.age >= 1 && cur.age <= 17) this.develop(cur.age);
      this.idx++;
      if (this.idx >= this.plan.length) this.idx = this.plan.length - 1;
      this.buildChildItem();
      return this.pending;
    },

    /* 天赋每年结算：养得住就长，养不住就碎 */
    talentTick(age){
      const st = this.state, b = st.brain;
      const t = LS.Talent && LS.Talent.byId(st.talentId);
      if (!t) return;
      const safe = LS.TALENT_SAFE_PARENTS.indexOf(b.parent.id) >= 0;
      const eff = safe ? (t.good || {}) : (t.bad || {});
      const mult = safe ? 1 : (age >= 10 ? 1.4 : 1);   // 越往后越难扭转

      if (eff.ndi) b.ndi = Math.max(5, Math.min(100, b.ndi + eff.ndi * mult));
      if (eff.focus) b.focus = Math.max(5, Math.min(100, b.focus + eff.focus * mult));
      if (eff.mirror) b.mirror = Math.max(5, Math.min(100, b.mirror + eff.mirror * mult));
      if (eff.cort) b.cortisol = Math.max(0, Math.min(100, b.cortisol + eff.cort * mult));
      if (eff.iq) { const d = Math.round(eff.iq * mult * 10) / 10; b.geneIQ = Math.round((b.geneIQ || 100) + d); b.familyIQ = Math.round(((b.familyIQ || 0) + d) * 10) / 10; }

      // 危机节点：天赋被现实撞碎的那一刻
      const c = t.crisis;
      // 高知/放养家庭有机会把天赋保住；其余家庭几乎必然被撞碎
      const crisisHit = c ? (safe ? this.rnd() < 0.35 : true) : false;
      if (c && age === c.age && !st.talentCrisis && crisisHit) {
        st.talentCrisis = 1;
        const scale = safe ? 0.4 : 1;
        const ce = {};
        Object.keys(c.eff || {}).forEach(function(k){ ce[k] = Math.round((c.eff[k] || 0) * scale); });
        if (ce.iq) { b.geneIQ = Math.round((b.geneIQ || 100) + ce.iq); b.familyIQ = Math.round(((b.familyIQ || 0) + ce.iq) * 10) / 10; }
        if (ce.cort) b.cortisol = Math.min(100, b.cortisol + ce.cort);
        if (ce.focus) b.focus = Math.max(5, b.focus + ce.focus);
        if (ce.phy) b.phy = Math.max(5, b.phy + ce.phy);
        if (c.tag) st.tags.push(c.tag);
        st.timeline.push(age + '岁·' + t.n + '：' + c.text);
        b.log.push({ age: age, text: '【天赋危机】' + t.n + '：' + c.text });
      }
      if (c && age === c.age && safe && !crisisHit) {
        st.flags.talentKept = 1;
        st.tags.push('天赋保住了');
        st.timeline.push(age + '岁·' + t.n + '被父母保住了');
      }
    },

    /* 脑发育增量（童年用，成年后只影响身体） */
    applyBrain(bb){
      const b = this.state.brain;
      if (!bb) return;
      if (bb.ndi) b.ndi = clamp(b.ndi + bb.ndi, 5, 100);
      if (bb.cort) b.cortisol = clamp(b.cortisol + bb.cort, 0, 100);
      if (bb.focus) b.focus = clamp(b.focus + bb.focus, 5, 100);
      if (bb.mirror) b.mirror = clamp(b.mirror + bb.mirror, 5, 100);
      if (bb.travel) { b.travel = clamp((b.travel || 0) + bb.travel, 0, 100); b.novel = (b.novel || 0) + 1; }
      if (bb.phy) b.phy = clamp(b.phy + bb.phy, 5, 100);
      if (bb.iq) b.selfIQ = Math.round(((b.selfIQ || 0) + bb.iq) * 10) / 10;
      if (bb.res) b.res = clamp(b.res + bb.res, 5, 100);
      // 年度生活修正（下一年发育时用）
      b.mods = b.mods || {};
      ['sleep','play','sport','stress'].forEach(function(k){
        if (bb[k]) b.mods[k] = (b.mods[k] || 0) + bb[k];
      });
      if (bb.interrupt) b.mods.interrupt = 1;
    },

    /* ================= 18 岁：结算 + 觉醒 + 穿越 ================= */
    awaken(){
      const st = this.state, b = st.brain;
      LS.BRAIN.finalIQ(b);

      let sys;
      if (st.maker) sys = LS.systemById('maker');
      else if (st.systemId && LS.systemById(st.systemId)) sys = LS.systemById(st.systemId);
      else sys = this.rollSystem(LS.worldById('modern'));

      st.systemId = sys.id;
      st.systemName = sys.name;
      st.rarity = sys.rarity;
      st.system = sys;

      // 童年折算进面板
      const childAvgByDim = {};
      LS.CHILD_KEYS.forEach(function(ck){
        const v = st.child[ck.k] || 8;
        if (!childAvgByDim[ck.dim]) childAvgByDim[ck.dim] = [];
        childAvgByDim[ck.dim].push(v);
      });
      const bonusOf = function(dim){
        const arr = childAvgByDim[dim];
        if (!arr || !arr.length) return 0;
        const avg = arr.reduce(function(a,b){ return a+b; },0)/arr.length;
        return Math.round((avg - 8) * 0.7);
      };

      st.attrs = {};
      (sys.stats||[]).forEach(function(s){
        st.attrs[s.k] = Math.max(3, (s.init || 10) + bonusOf(s.dim));
      });
      st.res = {};
      (sys.res||[]).forEach(function(r){ st.res[r.k] = r.init || 0; });

      st.dimBonus = {战:0,智:0,体:0,社:0,运:0,财:0,灵:0};
      const map = {'不服输':'战','狠':'战','江湖气':'战','硬气':'战','义气':'战','冒险':'运',
        '早慧':'智','懂规则':'智','善查':'智','开窍':'智','冷静':'智','生意经':'智','城府':'智',
        '命硬':'体','能吃苦':'体','基本功':'体','硬撑':'体',
        '重情':'社','人脉':'社','守信':'社','自在':'社','少年心事':'社','懂事':'社',
        '运气':'运','念想':'运','大机缘':'运','赌对了':'运',
        '一技之长':'智','藏拙':'智','愧疚':'体','怕失望':'智'};
      st.tags.forEach(function(t){
        const d = map[t];
        if (d) st.dimBonus[d] = (st.dimBonus[d] || 0) + 1;
      });
      // 智力直接给"智"加成：这是 131 以上能玩出花样的底层原因
      const iqBonus = Math.max(0, Math.round((b.iq - 100) * 0.18));
      st.dimBonus['智'] = (st.dimBonus['智'] || 0) + iqBonus;

      // 系统掌握度
      LS.BRAIN.masteryOf(b);
      b.tier = LS.BRAIN.tierOf(b.mastery);

      st.maxHp = this.calcMaxHp();
      st.hp = Math.round(st.maxHp * 0.92);
      st.turn = 0;
      st.level = 1;
      st.expNeed = 100;
      st.freePts = 0;

      // 经济面板开张
      st.econ = LS.ECON.init(b.iq, 'modern');
      LS.ECON.sinks = st.slice ? LS.SLICE.sinks : null;

      // 这个系统有哪几种常见的活法（系统文套路）
      st.tropes = [];
      if (LS.Tropes) {
        const pool = (sys.tags || []).concat(['系统']);
        st.tropes = LS.Tropes.pick(pool, this.rnd.bind(this), 2).map(function(t){ return t.id; });
      }

      // 穿越判定
      const travel = this.rollTravel(sys, b);

      this.phase = 'adult';
      this.saveRun();
      return {
        system: sys,
        isMaker: !!st.maker,
        travel: travel,
        iq: b.iq,
        mastery: b.mastery,
        tier: b.tier,
        text: sys.awaken || ('【' + sys.name + '】已绑定。'),
        panel: this.panelData()
      };
    },

    rollSystem(w){
      let all = LS.SYSTEMS.filter(function(s){ return s.id !== 'maker'; });
      const allow = (this.state && this.state.slice && LS.SLICE) ? LS.SLICE.systems : null;
      if (allow) all = all.filter(function(s){ return allow.indexOf(s.id) >= 0; });
      const self = this;
      const pool = [];
      all.forEach(function(s){
        let weight = (LS.RARITY[s.rarity] || LS.RARITY.R).weight;
        const overlap = (s.tags||[]).filter(function(t){ return (w.tags||[]).indexOf(t) >= 0; }).length;
        weight += overlap * 12;
        weight *= LS.Store.comboPenalty(w.id, s.id);
        for (let i=0;i<Math.max(1, Math.round(weight));i++) pool.push(s);
      });
      (LS.Store.systems||[]).forEach(function(s){
        for (let i=0;i<8;i++) pool.push(s);
      });
      return pool[Math.floor(this.rnd()*pool.length)];
    },

    /* 系统的"出身"决定你被带到哪里 */
    rollTravel(sys, b){
      const st = this.state;
      if (st.slice) { st.flags.stayed = 1; return null; }   // 切片不穿越
      if (st.worldId !== 'modern') return null;
      // 极少数人运气好，被留在了原来的世界
      if (this.rnd() < 0.1) {
        st.travelSkill = b.travel || 0;
        st.flags.stayed = 1;
        return null;
      }
      let target = null;
      const home = LS.SYS_HOME[sys.id];
      if (b.manga && this.rnd() < 0.28) target = this.rnd() < 0.5 ? 'ninja' : 'pirate';
      else if (home && home !== 'modern' && this.rnd() < 0.7) target = home;
      else {
        const pool = ['isekai','xianxia','cyber','zombie','lotm','wasteland','ninja','pirate'];
        target = LS.pick(pool, this.rnd.bind(this));
      }

      const w = LS.worldById(target);
      st.worldId = w.id;
      st.worldName = w.name;
      const skill = b.travel || 0;
      st.travelSkill = skill;
      // 小说看得深，落地就知道哪条街不能走、哪种人会杀你
      let tierKey = b.iq >= 120 ? 'high' : b.iq >= 105 ? 'mid' : 'low';
      if (skill >= 60 && tierKey === 'low') tierKey = 'mid';
      if (skill >= 60 && tierKey === 'mid') tierKey = 'high';
      const role = LS.pick(LS.TRAVEL_ROLE[tierKey], this.rnd.bind(this));
      st.travelRole = role;
      st.flags.crossed = 1;
      // 同一份身家，换成这个世界的钱与身份
      if (LS.ECON.remap) LS.ECON.remap(st.econ, w.id);
      // 把玩家这套系统的常见练法，写成这个世界里可能发生的支线
      if (LS.Tropes && LS.Lore && st.tropes && st.tropes.length) {
        const self = this;
        const seeds = st.tropes.map(function(id){
          const t = LS.Tropes.byId(id);
          const r = t ? LS.Tropes.routeOf(t, self.rnd.bind(self)) : null;
          return (t && r) ? LS.Tropes.toSeed(t, r) : null;
        }).filter(Boolean);
        if (seeds.length) LS.Lore.merge(w.id, { fanfic: seeds });
      }
      // 先垫一层网文套路支线，保证没网也能有'那个味'
      if (LS.Webnovel && LS.Lore) {
        try { LS.Lore.merge(w.id, { fanfic: LS.Webnovel.seeds(w.tags, this.rnd.bind(this), 3) }); } catch(e){}
      }
      // 落地那一刻，身体被这个世界重写了一遍——这是"大杀四方"的本钱
      const boost = 1 + Math.min(0.35, 0.15 + skill / 400);
      Object.keys(st.attrs).forEach(function(k){
        st.attrs[k] = Math.round(st.attrs[k] * boost * 10) / 10;
      });
      st.flags.travelBoost = Math.round((boost - 1) * 100);
      st.travelText = '你睁开眼，天花板不见了。\n空气里有' + (w.id === 'ninja' ? '铁锈和树叶' : w.id === 'pirate' ? '海盐和火药' : w.id === 'zombie' ? '铁锈和消毒水' : '一种说不上来的味道') + '。\n\n这里是' + w.name + '。你现在的身份：' + role + '。\n\n落地的一瞬间，你的身体被这里的规则重写了一遍（全属性 +' + Math.round((boost-1)*100) + '%）。';
      return { worldId: w.id, worldName: w.name, role: role, text: st.travelText };
    },

    /* ================= 面板 ================= */
    calcMaxHp(){
      return Math.round(100 + this.dimVal('体') * 3.2);
    },

    dimVal(dim){
      const st = this.state;
      if (!st || !st.system) return 10;
      const vals = [];
      (st.system.stats||[]).forEach(function(s){
        if (s.dim === dim) vals.push(st.attrs[s.k] || 0);
      });
      let v;
      if (!vals.length) v = 6 + (st.dimBonus[dim] || 0) * 1.5;
      else {
        const max = Math.max.apply(null, vals);
        const sum = vals.reduce(function(a,b){ return a+b; },0);
        v = max + (sum - max) * 0.2;
      }
      v += (st.dimBonus[dim] || 0) * 1.2;
      v += (st.brain && st.brain.mastery ? st.brain.mastery * 0.12 : 0);
      return Math.round(v * 10) / 10;
    },

    visibleDims(){
      const all = this.dims();
      if (!this.state || !this.state.slice || !LS.SLICE) return all;
      const out = {};
      LS.SLICE.dims.forEach(function(d){ out[d] = all[d]; });
      return out;
    },

    dims(){
      const self = this;
      const out = {};
      LS.DIM_LIST.forEach(function(d){ out[d] = self.dimVal(d); });
      return out;
    },

    panelData(){
      const st = this.state, sys = st.system;
      if (!sys) return null;
      return {
        name: st.name, age: st.age, hp: Math.round(st.hp), maxHp: st.maxHp,
        level: st.level, freePts: st.freePts,
        stats: (sys.stats||[]).map(function(s){
          return { k:s.k, n:s.n, v: Math.round((st.attrs[s.k]||0)*10)/10, dim:s.dim };
        }),
        res: (sys.res||[]).map(function(r){
          return { k:r.k, n:r.n, icon:r.icon || '◆', v: Math.round((st.res[r.k]||0)*10)/10 };
        }),
        dims: this.visibleDims(),
        tags: st.tags.slice(-8),
        rarity: sys.rarity, systemName: sys.name, icon: sys.icon,
        iq: st.brain.iq, mastery: st.brain.mastery,
        build: st.build ? { name: st.build.name, tag: st.build.tag } : null,
        deaths: st.deaths, deathWays: st.deathWays || {},
        econ: st.econ ? {
          cash: Math.round(st.econ.cash*10)/10,
          debt: Math.round(st.econ.debt*10)/10,
          active: Math.round(st.econ.active*10)/10,
          passive: Math.round(st.econ.passive*10)/10,
          expense: Math.round(st.econ.expense*10)/10,
          net: LS.ECON.netWorth(st.econ)
        } : null
      };
    },

    /* ================= 成年回合 ================= */
    beginAdult(){
      if (this.state && !this.state.build) this.chooseBuild(null);   // 兜底：测试/回放时默认第一条
      this.phase = 'adult';
      return this.phase;
    },

    startYear(){
      const st = this.state;
      if (st.ended) return null;
      st.turn += 1;
      st.year = st.turn;
      st.usedReroll = false;
      this.systemUsed = false;

      LS.ECON.settle(st.econ, st.age, st.brain.cortisol);
      if (st.econ && st.econ.justBankrupt) {
        st.log.push({ age:st.age, kind:'bad', text:'债务滚到你再也还不动，最后做了债务重组。征信黑了，日子还得照样过。' });
      }
      if (st.econ && st.econ.justGraduated) {
        st.log.push({ age: st.age, kind:'good', text:
          '你出师了（' + st.econ.eduName + '）。第一份进项，一年 ' + LS.ECON.money(st.econ.active, st.worldId) + '。' +
          (st.econ.debt > 1 ? '先还助学贷款和之前欠下的 ' + Math.round(st.econ.debt) + ' 万。' : '') });
      } else if (st.econ && !st.econ.graduated) {
        st.log.push({ age: st.age, kind:'say', text:
          '你还在' + st.econ.eduName + '，这一年没有收入。（' + st.econ.gradAge + ' 岁毕业）' });
      }
      const linkChips = this.syncEcon();
      if (linkChips.length) {
        st.log.push({ age: st.age, kind:'sys', text: linkChips.map(function(c){ return c.text; }).join('，') });
      }
      const pas = this.passive();
      if (pas) st.log.push({ age: st.age, kind:'sys', text: pas });

      st.maxHp = this.calcMaxHp();
      if (st.hp > 0 && st.hp < st.maxHp) {
        const regen = (this.buildMods().regen || 1);
        st.hp = Math.min(st.maxHp, st.hp + Math.round(st.maxHp * 0.12 * regen));
      }

      const lifespan = this.lifespan();
      if (st.age > lifespan) {
        this.endRun('寿终正寝：你在睡梦中安静地走完了一生', '寿终');
        return null;
      }

      // 每年都有意外。活得越久、世界越危险，这个数字越大。
      const risk = this.annualRisk();
      if (this.rnd() < risk) {
        const cause = this.rollAnnualDeath();
        this.endRun('你 ' + st.age + ' 岁那年，' + cause, '意外');
        return null;
      }
      return this.buildYearQueue();
    },

    lifespan(){
      const st = this.state;
      let life = 62 + this.dimVal('体') * 0.9 + (st.flags.longevity || 0) + (st.lifeVar || 0);
      const w = st.worldId;
      if (w === 'xianxia') {
        // 修真：境界越高，寿元越长。这是"长生路"最直接的那一层回报。
        life += 30 + this.dimVal('灵') * 2.2 + (st.level || 1) * 4;
      } else if (w === 'isekai' || w === 'wow' || w === 'abyss') {
        // 魔法/神秘侧：延寿一点点，不是长生
        life += 12 + this.dimVal('灵') * 0.8;
      } else if (w === 'cyber' || w === 'scifi') {
        life += 8;
      }
      return Math.round(life);
    },

    annualRisk(){
      const st = this.state;
      const w = LS.worldById(st.worldId) || {};
      let r = 0.0025 + Math.max(0, st.age - 45) * 0.0014 + (w.danger || 1) * 0.0014;
      if (st.flags.smoker && st.age >= 40) r += 0.0035;
      if (st.worldId === 'pirate' && st.bounty > 0) r += Math.min(0.02, st.bounty / 2e8 * 0.004);
      if (st.flags.riskMul != null) r *= st.flags.riskMul;
      if (st.flags.immortal) r *= 0.15;
      r -= this.dimVal('体') * 0.00012;
      r -= this.dimVal('运') * 0.00010;
      // 穿越熟练：刚落地那几年，你懂得怎么活。
      const grace = (st.travelSkill || 0) / 20;
      if (st.age - 18 < grace) r *= 0.4;
      return clamp(r, 0.0012, 0.05);
    },

    rollAnnualDeath(){
      const st = this.state;
      const pool = (LS.ANNUAL_DEATH && (LS.ANNUAL_DEATH[st.worldId] || LS.ANNUAL_DEATH.modern))
        || LS.ANNUAL_DEATH.modern;
      return LS.pick(pool, this.rnd.bind(this));
    },

    /* 一年可以撞上不止一件事 */
    numbTick(){
      const st = this.state;
      if (!st.flags.numb) return null;
      if (st.worldId !== 'modern') return null;   // 浑浑噩噩的现代剧情不要串到异世界
      st.numbYears = (st.numbYears || 0) + 1;
      const female = st.gender === 'f';
      const pool = (female ? LS.NUMB_EVENTS_F : LS.NUMB_EVENTS) || LS.NUMB_EVENTS || [];
      const ev = pool[(st.numbYears - 1) % Math.max(1, pool.length)];
      // 男性更容易猝死；女性不会，只会慢慢坏下去
      const deathP = female
        ? (st.numbYears >= 8 ? 0.05 + st.numbYears * 0.008 : 0)
        : (st.numbYears >= 5 ? 0.18 + st.numbYears * 0.02 : 0);
      if (deathP && this.rnd() < deathP) {
        const list = female ? (LS.NUMB_DEATH_F || []) : (LS.NUMB_DEATH || []);
        const death = LS.pick(list.length ? list : ['你在睡梦里没有再醒过来。'], this.rnd.bind(this));
        this.endRun(death, female ? '耗损' : '猝死');
        return { ended:true };
      }
      // 家暴：麻木的人不会离开
      if (female && st.numbYears >= 3 && this.rnd() < 0.3 && st.tags.indexOf('家暴') < 0) {
        st.tags.push('家暴');
        st.flags.abused = 1;
        st.brain.cortisol = Math.min(100, st.brain.cortisol + 6);
      }
      if (ev && ev.tag && st.tags.indexOf(ev.tag) < 0) st.tags.push(ev.tag);
      this.pending = { kind:'quiet', age:st.age, title:ev ? ev.t : '又一年', text:ev ? ev.x : '这一年没什么可说的。', auto:true, opts:[], source:'' };
      this.phase = 'event';
      return this.pending;
    },

    buildYearQueue(){
      const st = this.state;
      // 先看有没有"去年那件事"的余波到了
      if (st.waves && st.waves.length) {
        const idx = st.waves.findIndex(function(w){ return w.at <= st.age; });
        if (idx >= 0) {
          const w = st.waves[idx].tpl;
          st.waves.splice(idx, 1);
          this.queue = [];
          this.pending = {
            kind:'wave', age:st.age, title:w.t, text:w.x, wave:true,
            opts: w.opts.map(function(o){ return { n:o.n, dim:o.dim, dc:o.dc, s:o.s, f:o.f, eff:o.eff||{}, effF:o.effF||{} }; }),
            source:'余波'
          };
          this.phase = 'event';
          return this.pending;
        }
      }
      const nb = this.numbTick();
      if (nb) return nb;
      this.queue = [];
      const self = this;

      // 第一件：主事件（AI / 缓存 / 离线）
      this.queue.push({ kind:'main' });

      // 第二件：生活事件（按年龄/智商门控）
      const life = this.pickLifeEvent();
      if (life) this.queue.push({ kind:'life', ev:life });

      // 第三件：经济决策（18 岁后，智力够才有选项；不够就是自动剧情）
      if (st.age >= 18 && st.econ && st.worldId === 'modern') {
        const econ = this.pickEconEvent();
        if (econ) this.queue.push({ kind:'econ', ev:econ });
      }

      // 按年龄减量：18–29 最多 3 件，30–59 两件，60 以后只留主事件
      const age = st.age;
      let cap = 3;
      if (age >= 60) cap = 1;
      else if (age >= 30) cap = 2;
      if (st.slice && LS.SLICE) cap = LS.SLICE.eventCap;

      if (this.queue.length > cap) this.queue = this.queue.slice(0, cap);

      // 上了年纪，有些年份就是安安静静地过去了
      if (age >= 65 && this.rnd() < 0.28) {
        st.log.push({ age: age, kind:'say', text: '这一年没什么事发生。你把窗帘洗了，天气好的时候下楼走了走。' });
        this.pending = {
          kind:'quiet', age:age, title:'平静的一年',
          text:'这一年没什么事发生。\n\n你把窗帘洗了，天气好的时候下楼走了走。电视里还在吵，但你已经不太关心了。',
          auto:true, opts:[], source:''
        };
        this.queue = [];
        this.phase = 'event';
        return this.pending;
      }

      return this.nextEvent();
    },

    pickLifeEvent(){
      const st = this.state, b = st.brain;
      // 到了别的世界，就别再演都市买房那一套了
      if (st.worldId !== 'modern' && st.age >= 18) {
        if (LS.makeWorldEvent) return LS.makeWorldEvent(LS.worldById(st.worldId), this.rnd.bind(this));
        return null;
      }
      const used = this.usedLife;
      const iq = b.iq || this.estIQ();
      let pool = LS.LIFE_EVENTS.filter(function(e){
        if (st.age < e.minAge || st.age > e.maxAge) return false;
        if (e.iqMax && iq > e.iqMax) return false;   // 智商够的人不会掉进这种坑
        if (e.iqMin && iq < e.iqMin) return false;
        return used.indexOf(e.id) < 0;
      });
      if (!pool.length) return null;
      const weights = pool.map(function(e){
        let w = e.weight || 5;
        if (e.iqMax && iq > e.iqMax - 6) w = Math.round(w * 0.6);
        return { e:e, w:w };
      });
      const arr = [];
      weights.forEach(function(x){ for (let i=0;i<x.w;i++) arr.push(x.e); });
      const ev = arr[Math.floor(this.rnd()*arr.length)];
      used.push(ev.id);
      return this.normalizeOffline(ev);
    },

    pickEconEvent(){
      const st = this.state;
      const iq = st.brain.iq;
      const used = this.usedEvents;
      const pool = LS.ECON_EVENTS.filter(function(e){
        if (st.age < e.minAge || st.age > e.maxAge) return false;
        if (e.iqMin && iq < e.iqMin) return false;
        return used.indexOf(e.id) < 0;
      });
      if (!pool.length || this.rnd() > 0.55) return null;
      const ev = pool[Math.floor(this.rnd()*pool.length)];
      used.push(ev.id);
      return this.normalizeOffline(ev);
    },

    nextEvent(){
      const st = this.state;
      const item = this.queue.shift();
      if (!item) { this.phase = 'actions'; return null; }

      if (item.kind === 'main') {
        return this.makeMainEvent(); // async
      }
      const ev = item.ev;
      const iq = st.brain.iq || this.estIQ();
      // 选项数量：智商决定视野
      let opts = ev.opts || [];
      if (opts.length) {
        const n = LS.BRAIN.hasChoice(st.age, iq);
        if (opts.length > n) {
          const self = this;
          opts = opts.map(function(o){ return { o:o, r:self.rnd() }; })
                     .sort(function(a,b){ return a.r - b.r; })
                     .slice(0, n).map(function(x){ return x.o; });
        }
      }
      this.pending = Object.assign({}, ev, {
        opts: opts,
        source: ev.opts && ev.opts.length ? '离线' : '没有选择',
        auto: !opts.length ? ev.auto : null,
        kind: item.kind
      });
      this.phase = 'event';
      return this.pending;
    },

    async makeMainEvent(){
      const st = this.state, w = LS.worldById(st.worldId), sys = st.system;
      const key = LS.Store.snipKey({ worldId: st.worldId, systemId: st.systemId, age: st.age, kind:'evt' });

      const mode = LS.AI.mode();
      const canAI = mode !== 'offline' && !this._fast && this.aiUsed < this.aiBudget();
      const wantFresh = canAI && !st.replay && (mode === 'always' || this.rnd() < 0.3);
      let snip = wantFresh ? null : LS.Store.getSnip(key);

      if (snip) {
        this.pending = {
          title: snip.title, text: snip.text,
          opts: snip.opts.map(function(o){ return Object.assign({}, o); }),
          source: '他人路径', key: key, kind:'main'
        };
        this.limitOpts();
        this.phase = 'event';
        return this.pending;
      }

      if (canAI) {
        try {
          const ev = await LS.AI.genEvent({
            state: st, world: w, system: sys,
            recent: st.timeline.slice(-4),
            memory: this.lifeMemory(),
            lore: LS.Lore ? LS.Lore.prompt(st.worldId) : '',
            dims: this.dims()
          });
          this.aiUsed++;
          st.aiUsed = this.aiUsed;
          if (LS.Lore && LS.Lore.noteEvent) LS.Lore.noteEvent(st.worldId, ev.title, ev.text);
          LS.Store.addSnip(key, {
            title: ev.title, text: ev.text,
            opts: ev.opts.map(function(o){ return { n:o.n, dim:o.dim, dc:o.dc, s:o.s, f:o.f, eff:o.eff, effF:o.effF }; }),
            score: 3, at: Date.now()
          });
          this.pending = Object.assign({}, ev, { source:'AI 导演', key:key, kind:'main' });
          this.limitOpts();
          this.phase = 'event';
          return this.pending;
        } catch (e) {
          this.lastAiError = e.message || String(e);
        }
      }

      const ev = this.buildOfflineEvent(w, sys);
      this.pending = Object.assign(ev, { source:'离线', key:key, kind:'main' });
      this.limitOpts();
      this.phase = 'event';
      return this.pending;
    },

    limitOpts(){
      const st = this.state, ev = this.pending;
      if (!ev || !ev.opts) return;
      const iq = st.brain.iq || this.estIQ();
      // 皮质醇长期过高：人已经麻木了，看不见别的路
      if (st.age >= 18 && st.brain.cortisol >= 82) {
        st.numbCount = (st.numbCount || 0) + 1;
        if (st.numbCount >= 3) st.flags.numb = 1;
        ev.opts = (ev.opts || []).slice(0, 1);
        ev.numb = true;
        ev.limited = true;
      }
      const n = LS.BRAIN.hasChoice(st.age, iq);
      if (ev.opts.length > n) {
        const self = this;
        ev.opts = ev.opts.map(function(o){ return { o:o, r:self.rnd() }; })
                    .sort(function(a,b){ return a.r - b.r; })
                    .slice(0, n).map(function(x){ return x.o; });
        ev.limited = true;
      }
      // 智商 131+：多一条系统骚操作
      if (iq >= 131 && st.system) {
        ev.opts.push({
          n: '【系统】换个它没想过的方式',
          dim: '智',
          dc: 22,
          s: '你把面板翻过来看了一遍，发现规则里有一处写得很含糊。\n规则没写不能这么做。',
          f: '你赌了一把，系统没接住。',
          eff: { attrs: {}, res: {}, tags: ['骚操作'] },
          effF: { hp: -8 },
          _wild: true
        });
        ev.wild = true;
      }
    },

    buildOfflineEvent(w, sys){
      const st = this.state;
      const self = this;
      if (st.worldId !== 'modern' && LS.makeWorldEvent) {
        const we = LS.makeWorldEvent(w, this.rnd.bind(this));
        if (we && we.opts && we.opts.length) return we;
      }
      const wTags = (w.tags||[]).concat(sys.tags||[]);
      let cands = LS.EVENTS.filter(function(t){ return self.usedEvents.indexOf(t.id) < 0; });
      if (!cands.length) { this.usedEvents = []; cands = LS.EVENTS.slice(); }
      const scored = cands.map(function(t){
        let s = (t.weight || 5);
        (t.tags||[]).forEach(function(tag){ if (wTags.indexOf(tag) >= 0) s += 4; });
        return { t:t, s:s };
      });
      const pool = [];
      scored.forEach(function(x){ for (let i=0;i<Math.max(1,Math.round(x.s));i++) pool.push(x.t); });
      const tpl = pool[Math.floor(this.rnd()*pool.length)];
      this.usedEvents.push(tpl.id);

      const fill = function(str){
        return String(str||'')
          .replace(/\{place\}/g, LS.pick(w.places, self.rnd.bind(self)))
          .replace(/\{threat\}/g, LS.pick(w.threats, self.rnd.bind(self)))
          .replace(/\{npc\}/g, LS.pick(w.npcs, self.rnd.bind(self)))
          .replace(/\{world\}/g, w.name);
      };

      return {
        title: tpl.title,
        text: fill(tpl.text),
        opts: tpl.opts.map(function(o){
          return { n:o.n, dim:o.dim, dc:o.dc, s:fill(o.s), f:fill(o.f), eff:o.eff||{}, effF:o.effF||{} };
        })
      };
    },

    normalizeOffline(tpl){
      const w = LS.worldById(this.state.worldId);
      const self = this;
      const fill = function(str){
        return String(str||'')
          .replace(/\{place\}/g, LS.pick(w.places, self.rnd.bind(self)))
          .replace(/\{threat\}/g, LS.pick(w.threats, self.rnd.bind(self)))
          .replace(/\{npc\}/g, LS.pick(w.npcs, self.rnd.bind(self)))
          .replace(/\{world\}/g, w.name);
      };
      let title = tpl.title, text = fill(tpl.text), auto = tpl.auto ? fill(tpl.auto) : null;
      // 异世界版：跑滴滴 → 接私单打人
      if (tpl.id === 'l_didi' && this.state.worldId !== 'modern') {
        title = '接私活';
        text = '白天在公会挂名，晚上接私单。有人管这叫"滴滴打人"——只要给钱，打谁都行。';
        auto = '你从此没有过完整的夜。\n刀柄被汗浸得发亮，你也舍不得换。';
      }
      return {
        title: title, text: text, sci: tpl.sci || '',
        opts: (tpl.opts||[]).map(function(o){
          return { n:o.n, dim:o.dim||'智', dc:o.dc||20, s:fill(o.s), f:fill(o.f),
                   eff:o.eff||{}, effF:o.effF||{}, risk:o.risk||null, tag:o.tag||'' };
        }),
        auto: auto,
        eff: tpl.eff || null,
        tag: tpl.tag || ''
      };
    },

    aiBudget(){
      const c = LS.Store.apiCfg();
      return c.mode === 'always' ? 999 : (c.budget || 60);
    },

    passive(){
      const st = this.state, mech = st.system ? st.system.mechanic : '';
      const lines = [];
      if (mech === 'signin') {
        st.res.days = (st.res.days || 0) + 1;
        const d = st.res.days;
        st.res.pt = (st.res.pt || 0) + Math.round(5 + d * 0.3);
        this.growRandom(1);
        if (d === 30 || d === 100) { this.growRandom(2); lines.push('连续签到 ' + d + ' 天，奖励升级。'); }
      }
      if (mech === 'wealth') {
        const mk = this.moneyKey();
        if (mk) {
          const cur = st.res[mk] || 0;
          // 越有钱，年化越低：20% → 6% → 2%，防止三年搞满
          const rate = cur < 200 ? 0.12 : cur < 800 ? 0.05 : 0.015;
          const gain = Math.max(1, Math.round(cur * rate + 2));
          st.res[mk] = Math.round((cur + gain) * 10) / 10;
          lines.push('余额生息 +' + gain + ' 万（现有 ' + LS.ECON.money(st.res[mk], st.worldId) + '）');
        }
      }
      if (mech === 'fame') {
        const f = st.res.fans != null ? 'fans' : (st.res.fan != null ? 'fan' : null);
        if (f) {
          st.res[f] = Math.round(st.res[f] * (1.06 + this.dimVal('社') * 0.004));
          lines.push('粉丝数上涨到 ' + Math.round(st.res[f]) + '。');
        }
      }
      if (mech === 'pact' && (st.res.debt || 0) > 80) {
        st.hp -= 12;
        lines.push('代价过高，反噬发作。');
      }
      if (mech === 'summon') this.growRandom(1, '战');
      if (mech === 'maker') {
        st.res.mat = (st.res.mat || 0) + 6;
        if (!lines.length) lines.push('素材缓慢凝聚（+6）。');
      }
      return lines.join(' ');
    },

    /* 找到系统里的"钱"资源键 */
    moneyKey(){
      const st = this.state;
      const res = (st.system && st.system.res) || [];
      for (let i = 0; i < res.length; i++) {
        if (/(余额|现金|资金|存款|钱|金)/.test(res[i].n || '')) return res[i].k;
      }
      return null;
    },

    /* 把系统面板折算成经济面板：资产→现金，人脉/声望→收入 */
    syncEcon(){
      const st = this.state, e = st.econ;
      if (!e || !st.system) return [];
      const chips = [];
      const attrs = st.attrs || {};
      const res = st.res || {};

      // 资产属性 → 现金（只升不降，取高水位）
      const asset = attrs.asset || attrs.estate || attrs.stock || 0;
      const fromAsset = Math.round(asset * 0.6 * 10) / 10;
      if (fromAsset > (e.assetMark || 0)) {
        const add = Math.round((fromAsset - (e.assetMark || 0)) * 10) / 10;
        e.cash = Math.round((e.cash + add) * 10) / 10;
        e.assetMark = fromAsset;
        chips.push({ text:'资产折现 +' + LS.ECON.money(add, st.worldId), good:true });
      }

      // 系统余额 → 现金（按 50% 计入可用现金）
      const mk = this.moneyKey();
      if (mk && (res[mk] || 0) > 0) {
        const target = Math.round(res[mk] * 0.5 * 10) / 10;
        if (target > (e.moneyMark || 0)) {
          const add = Math.round((target - (e.moneyMark || 0)) * 10) / 10;
          e.cash = Math.round((e.cash + add) * 10) / 10;
          e.moneyMark = target;
          chips.push({ text:'余额到账 +' + LS.ECON.money(add, st.worldId), good:true });
        }
      }

      // 人脉 / 声望 → 主动收入加成
      const conn = (attrs.conn || 0) + (attrs.network || 0);
      const fame = (attrs.fame || 0) + (attrs.rep || 0);
      const bonus = Math.round((conn * 0.05 + fame * 0.04) * 10) / 10;
      if (bonus !== (e.linkMark || 0)) {
        const diff = Math.round((bonus - (e.linkMark || 0)) * 10) / 10;
        e.active = Math.round(((e.active || 0) + diff) * 10) / 10;
        e.linkMark = bonus;
        if (diff) chips.push({ text:'人脉/声望带来收入 ' + (diff>0?'+':'') + LS.ECON.money(diff, st.worldId) + '/年', good: diff>0 });
      }
      return chips;
    },

    growRandom(v, dim){
      const st = this.state;
      let pool = (st.system.stats||[]).filter(function(s){ return !dim || s.dim === dim; });
      if (!pool.length) pool = st.system.stats || [];
      if (!pool.length) return null;
      const s = pool[Math.floor(this.rnd()*pool.length)];
      const cur = st.attrs[s.k] || 0;
      const gain = Math.max(1, Math.round(v * 80 / (80 + cur) * (this.buildMods().gainMul || 1)));
      this._lastGrow = { k:s.k, n:s.n, gain:gain };
      st.attrs[s.k] = Math.round((cur + gain) * 10) / 10;
      return { k:s.k, n:s.n, gain:gain };
    },

    odds(dim, dc){
      const st = this.state;
      const effDc = dc + Math.min(14, Math.floor(st.turn * 0.75));
      let p = 0.5 + (this.dimVal(dim) - effDc) / (effDc * 1.7);
      const mech = st.system ? st.system.mechanic : '';
      if (mech === 'analysis') p += 0.08;
      if (mech === 'sim') p += 0.03;
      return clamp(p, 0.15, 0.94);
    },

    /* 只有系统给了你"看见"的能力，才显示概率 */
    revealOdds(){
      const st = this.state;
      const mech = st.system ? st.system.mechanic : '';
      const tier = st.brain && st.brain.tier;
      return ['sim','analysis','mindread'].indexOf(mech) >= 0 || (tier && tier.showOdds);
    },

    /* ---------- 选择 ---------- */
    chooseOption(i){
      const ev = this.pending, st = this.state;
      if (!ev || !ev.opts || !ev.opts[i]) return null;
      const o = ev.opts[i];
      const p = this.odds(o.dim, o.dc);
      let ok = this.rnd() < p;
      let crit = false;
      let rerolled = false;

      if (st.flags.autoWin) { st.flags.autoWin = 0; ok = true; rerolled = true; }

      // 时间循环：把一次失败倒回三秒前
      if (!ok && st.flags.savepoint) {
        st.flags.savepoint = 0;
        st.rewinds = (st.rewinds || 0) + 1;
        rerolled = true;
        ok = this.rnd() < Math.min(0.95, p + 0.35);
        if (!ok) ok = true;   // 读档至少保证这一次活着
        st.timeline.push(st.age + '岁·时间倒回了三秒');
      }

      if (!ok && st.system && st.system.mechanic === 'luck' && !st.usedReroll) {
        st.usedReroll = true; rerolled = true;
        ok = this.rnd() < Math.min(0.92, p + 0.25);
      }
      const mech = st.system ? st.system.mechanic : '';
      if (ok && (mech === 'analysis' || mech === 'sim') && this.rnd() < 0.18) crit = true;

      const eff = ok ? (o.eff || {}) : (o.effF || {});
      const chips = this.applyEff(eff, crit);
      if (eff.bounty) {
        st.bounty = (st.bounty || 0) + eff.bounty;
        chips.push({ text:'悬赏金 ' + (eff.bounty > 0 ? '+' : '') + LS.fmtBounty(Math.abs(eff.bounty)), good: eff.bounty > 0 });
      }
      if (eff.tag && st.tags.indexOf(eff.tag) < 0) st.tags.push(eff.tag);
      let text = ok ? (o.s || '你做到了。') : (o.f || '你失败了。');
      if (crit) text += ' 这一切完成得比你想的更漂亮。';
      if (rerolled) text = '（命运偏了一下头）' + text;

      if (!ok && mech === 'reverse') {
        st.attrs[st.system.stats[0].k] = (st.attrs[st.system.stats[0].k]||0) + 2;
        st.res.bad = (st.res.bad || 0) + 1;
      }

      st.history.push({
        age: st.age, title: ev.title, choice: o.n, ok: ok, dim: o.dim,
        dc: o.dc, odds: Math.round(p*100), text: text.slice(0, 120)
      });
      st.timeline.push(st.age + '岁·' + ev.title + '（' + o.n + '）' + (ok?'成':'败'));
      st.log.push({ age:st.age, kind: ok?'good':'bad', text:'【' + ev.title + '】' + text });

      // 选项自带的风险判定
      if (o.risk && this.rnd() < o.risk.p) {
        text += '\n' + (o.risk.text || '');
        this.applyBrain(o.risk);
      }

      let death = null;
      if (st.hp <= 0) death = this.handleDeath('在' + st.age + '岁那年，你没能从「' + ev.title + '」里活下来');

      this.result = { ok:ok, crit:crit, text:text, chips:chips, death:death, title:ev.title, source:ev.source };
      this.phase = 'result';
      if (death && death.ended) this.phase = 'end';
      return this.result;
    },

    /* 自动事件：玩家没有选择权 */
    autoResolve(){
      const ev = this.pending, st = this.state;
      if (!ev) return null;
      const chips = this.applyEff(ev.eff || {});
      if (ev.tag && st.tags.indexOf(ev.tag) < 0) st.tags.push(ev.tag);
      st.log.push({ age:st.age, kind:'bad', text:'【' + ev.title + '】' + (ev.auto||'') });
      st.timeline.push(st.age + '岁·' + ev.title + '（没有选择）');
      let death = null;
      if (st.hp <= 0) death = this.handleDeath('在' + st.age + '岁那年，你没能撑过去');
      this.result = { ok:false, auto:true, text: ev.auto || '', chips:chips, death:death, title:ev.title };
      this.phase = 'result';
      if (death && death.ended) this.phase = 'end';
      return this.result;
    },

    applyEff(eff, crit){
      const st = this.state;
      const chips = [];
      if (!eff) return chips;
      if (eff.attrs) {
        Object.keys(eff.attrs).forEach(function(k){
          let v = Number(eff.attrs[k]) || 0;
          if (crit && v > 0) v = Math.round(v * 1.6 * 10)/10;
          if (!v) return;
          if (st.attrs[k] == null) return;
          st.attrs[k] = Math.max(0, Math.round((st.attrs[k] + v)*10)/10);
          const meta = (st.system.stats||[]).find(function(s){ return s.k === k; });
          chips.push({ text:(meta?meta.n:k) + (v>0?' +':' ') + v, good: v>0 });
        });
      }
      if (eff.hp) {
        st.maxHp = this.calcMaxHp();
        st.hp = clamp(st.hp + eff.hp, 0, st.maxHp);
        chips.push({ text:'气血 ' + (eff.hp>0?'+':'') + eff.hp, good: eff.hp>0 });
      }
      if (eff.res) {
        Object.keys(eff.res).forEach(function(k){
          const v = Number(eff.res[k]) || 0;
          if (!v) return;
          st.res[k] = Math.round(((st.res[k]||0) + v)*10)/10;
          const meta = (st.system.res||[]).find(function(r){ return r.k === k; });
          chips.push({ text:(meta?meta.n:k) + (v>0?' +':' ') + v, good: v>0 });
        });
      }
      if (eff.tags) {
        eff.tags.forEach(function(t){
          if (st.tags.indexOf(t) < 0) { st.tags.push(t); }
        });
      }
      if (eff.brain) {
        if (st.age < 18) this.applyBrain(eff.brain);
        else {
          const b = st.brain;
          if (eff.brain.phy) {
            b.phy = clamp(b.phy + eff.brain.phy, 5, 100);
            st.maxHp = Math.max(60, st.maxHp + Math.round(eff.brain.phy * 2));
            st.hp = Math.min(st.hp, st.maxHp);
          }
          if (eff.brain.cort) b.cortisol = clamp(b.cortisol + eff.brain.cort, 0, 100);
        }
      }
      if (eff.econ && st.econ) {
        LS.ECON.apply(st.econ, eff.econ, st.worldId).forEach(function(c){ chips.push(c); });
      }
      if (eff.flag) st.flags[eff.flag] = 1;

      if (st.system && st.system.mechanic === 'levelUp') {
        const hasExpRes = st.res.exp != null;
        let cur = (hasExpRes ? st.res.exp : (st.exp || 0)) + 18;
        while (cur >= st.expNeed) {
          cur -= st.expNeed;
          st.level += 1;
          st.freePts += 2;
          st.expNeed = Math.round(st.expNeed * 1.35);
        }
        if (hasExpRes) st.res.exp = cur; else st.exp = cur;
      }
      st.maxHp = this.calcMaxHp();
      return chips;
    },

    handleDeath(reason, opts){
      const st = this.state;
      opts = opts || {};
      if (st.system && st.system.mechanic === 'deathReturn') {
        st.deaths += 1;
        st.res.deaths = (st.res.deaths || 0) + 1;
        const boost = 1 + st.deaths * 0.5;
        st.maxHp = this.calcMaxHp();
        st.hp = st.maxHp;
        if (!opts.noBoost) {
          (st.system.stats||[]).forEach(function(s){
            st.attrs[s.k] = Math.round((st.attrs[s.k]||0) + Math.round(2 * boost));
          });
        }
        st.log.push({ age:st.age, kind:'sys', text:'你死了。世界倒退。你重新睁开眼睛。' });
        return { revived:true, ended:false, text: opts.noBoost
          ? ('你死了。\n然后，你睁开了眼睛。\n第 ' + st.deaths + ' 次。')
          : ('你死了。\n然后，你睁开了眼睛。\n第 ' + st.deaths + ' 次死亡，属性永久提升。') };
      }
      // 濒死一次：普通人也不是一碰就死。这一生只给一次。
      if (!opts.force && (st.flags.nearDeath || 0) < 2 && st.age < 58) {
        st.flags.nearDeath = (st.flags.nearDeath || 0) + 1;
        st.maxHp = this.calcMaxHp();
        st.hp = Math.max(1, Math.round(st.maxHp * 0.12));
        if (st.tags.indexOf('从鬼门关回来') < 0) st.tags.push('从鬼门关回来');
        st.log.push({ age: st.age, kind:'bad', text:'你差点没挺过来。有人在最后一刻把你拽了回来。' });
        return { revived:true, ended:false, near:true,
                 text:'你眼前一黑，以为就这么结束了。\n\n再睁开眼时，你躺在一片白灯下面。有人叫了你的名字。\n\n（这样的运气，一生不会有第三次。）' };
      }

      const rwKey = (st.system.res||[]).some(function(r){ return r.k === 'rw' || r.k === 'laps'; })
        ? (st.res.rw != null ? 'rw' : 'laps') : null;
      if (rwKey && st.res[rwKey] > 0) {
        st.res[rwKey] -= 1;
        st.maxHp = this.calcMaxHp();
        st.hp = Math.round(st.maxHp * 0.75);
        st.rewinds += 1;
        this.growRandom(1);
        return { revived:true, ended:false, text:'时间折了回去。\n你带着记忆回到一年前。' };
      }
      st.alive = false;
      st.ended = true;
      st.endReason = reason;
      st.hp = 0;
      return { revived:false, ended:true, text: reason };
    },

    /* 18 岁 3 点，60 岁只剩 1 点 */
    apMax(){
      const st = this.state;
      if (!st) return 3;
      if (st.slice && LS.SLICE) return LS.SLICE.apMax + (this.buildMods().apBonus || 0);
      const bonus = this.buildMods().apBonus || 0;
      if (st.age < 45) return 3 + bonus;
      if (st.age < 60) return 2 + bonus;
      return 1 + bonus;
    },

    /* ---------- 事件之后 ---------- */
    afterEvent(){
      const st = this.state;
      if (st.ended) { this.phase = 'end'; return 'end'; }
      if (this.queue.length) {
        const ev = this.nextEvent();
        return ev ? 'event' : 'actions';
      }
      st.ap = this.apMax();
      this.phase = 'actions';
      this.saveRun();
      return 'actions';
    },

    /* ================= 自创用法：玩家打字，AI 裁决 ================= */
    researchAvailable(){
      const st = this.state;
      return !!(st && st.system && st.age >= 18 && st.researchYear !== st.age && !st.ended);
    },

    localResearch(idea){
      const st = this.state, sys = st.system;
      let score = 45;
      const text = String(idea || '');
      if (text.length >= 10) score += 5;
      if (text.length >= 20) score += 5;
      if (text.indexOf(String(sys.name).replace('系统','')) >= 0) score += 6;
      if (/(每天|无限|直接|立刻|永久|无敌|全部|所有)/.test(text)) score -= 14;
      if (/(换|轮流|组合|记录|研究|分析|借|代价|限制|反过来|先.*再)/.test(text)) score += 8;
      if (/(死|复活|签到|抽|积分|复制|掠夺|回档|推演|粉丝|契约|词条)/.test(text)) score += 4;
      score = Math.max(15, Math.min(88, score));
      const feasible = score >= 50;
      let reason;
      if (!feasible) reason = '这个用法越过了系统的上限——它要的是代价，你给的是空想。';
      else if (score >= 75) reason = '规则里确实留着这个口子，代价也算得过来。';
      else reason = '说得通，但执行起来会打折扣。';
      const dim = this.guessDim(text);
      return { feasible: feasible, score: score, reason: '（离线审核）' + reason,
               label: this.shortAction(text, dim), dim: dim,
               effect: { attrs:{}, res:{}, hp:0 }, source:'离线' };
    },

    async research(idea){
      const st = this.state, sys = st.system, b = st.brain;
      if (!this.researchAvailable()) return { error: '今年不能再研究了。' };
      idea = String(idea || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (idea.length < 4) return { error: '再具体一点，至少写四个字。' };

      st.researchYear = st.age;
      const w = LS.worldById(st.worldId);
      let v = null;
      if (LS.AI.mode() !== 'offline' && this.aiUsed < this.aiBudget()) {
        try {
          v = await LS.AI.genResearch({ state: st, system: sys, world: w, idea: idea });
          this.aiUsed++; st.aiUsed = this.aiUsed;
        } catch (e) { this.lastAiError = e.message || ''; }
      }
      if (!v) v = this.localResearch(idea);

      const iq = b.iq || 100;
      const mastery = b.mastery || 0;
      const iqF = clamp((iq - 82) / 58, 0, 1);
      const chance = clamp(v.score / 100 * 0.55 + iqF * 0.25 + mastery / 100 * 0.2, 0.05, 0.95);

      // 想法成立，但你未必想得到怎么落地——这一层由"从小到大的人生"决定
      const blindP = clamp((115 - iq) / 50, 0, 0.75);
      if (v.feasible && this.rnd() < blindP) {
        const road = [b.parent.name + '的家庭', b.school.name];
        if (b.ndi < 60) road.push('只有 ' + Math.round(b.ndi) + ' 的神经元发育');
        if (b.cortisol > 60) road.push('长期偏高的皮质醇');
        if (b.focus < 40) road.push('总被打断的专注力');
        if (b.phy < 45) road.push('很少活动的身体');
        const text = '你把这个想法在脑子里过了一遍，然后就卡住了。\n\n' +
          '不是它不成立——是你说不出下一步该干什么。\n\n' +
          '你从小到大的路：' + road.join('、') + '。这条路没教过你这种思路。\n\n' +
          '（这个用法其实是成立的。只是你的脑子，到不了那儿。）';
        st.log.push({ age: st.age, kind:'bad', text:'【研究】' + idea + ' —— 想不下去。' });
        st.timeline.push(st.age + '岁·研究系统（想不下去）');
        const r = { title:'研究：想不下去', text:text, chips:[], ok:false, blind:true,
                    research:true, chance:Math.round(chance*100) };
        this.result = r;
        this.phase = 'actionResult';
        return r;
      }

      const ok = this.rnd() < chance;
      if (ok) {
        const eff = v.effect || {};
        const chips = this.applyEff({ attrs: eff.attrs || {}, res: eff.res || {}, hp: eff.hp || 0 });
        const pathStep = this.advancePath(idea);
        if (pathStep && pathStep.stage) {
          chips.push({ text: pathStep.def.icon + ' ' + pathStep.def.n + '：' + pathStep.stage.n, good:true });
        }
        b.mastery = clamp((b.mastery || 0) + 3, 0, 100);
        b.tier = LS.BRAIN.tierOf(b.mastery);
        st.customUses = st.customUses || [];
        const act = this.makeCustomAction(idea, v, eff);
        st.customActs = (st.customActs || []).filter(function(x){ return x.dim !== act.dim; });
        st.customActs.push(act);
        const replaced = LS.FREE_ACTIONS.find(function(x){ return x.dim === act.dim; });
        const rec = { age: st.age, idea: idea, label: v.label || '', systemId: sys.id, systemName: sys.name };
        st.customUses.push(rec);
        LS.Store.addResearch(Object.assign({ author: st.name, world: st.worldName }, rec));
        st.log.push({ age: st.age, kind:'sys', text:'【研究成功】' + idea + (v.label ? '（' + v.label + '）' : '') });
        st.timeline.push(st.age + '岁·自创用法：' + (v.label || idea.slice(0, 10)));
        const text = '你把想法说了出来，系统沉默了 ' + (2 + Math.floor(this.rnd()*4)) + ' 秒。\n\n' +
          '然后它给了你回应：这条路，走得通。\n\n' + (v.reason || '') +
          '\n\n你把它练成了一个固定的动作：【' + act.n + '】' +
          (replaced ? '——从此它替代了你原来的【' + replaced.n + '】。' : '。') +
          '\n\n（掌握度 +3。这个用法已经写进系统库，别人也许会用上。）';
        const r = { title:'研究：成立', text:text, chips:chips, ok:true,
                    research:true, source:v.source, chance:Math.round(chance*100),
                    label:v.label || '', act: act, replaces: replaced ? replaced.n : '' };
        this.result = r;
        this.phase = 'actionResult';
        return r;
      }

      b.mastery = clamp((b.mastery || 0) + 1, 0, 100);
      b.tier = LS.BRAIN.tierOf(b.mastery);
      const text = '你把想法说了出来。\n\n系统给了否定：\n' + (v.reason || '这条路径不成立。') +
        '\n\n' + (iq < 110
          ? '你不太确定自己是不是问错了方向。'
          : '你记下了它否定的理由，下次换个角度。');
      st.log.push({ age: st.age, kind:'bad', text:'【研究失败】' + idea + '：' + (v.reason || '') });
      st.timeline.push(st.age + '岁·研究系统（被否）');
      const r = { title:'研究：被否定', text:text, chips:[], ok:false,
                  research:true, source:v.source, chance:Math.round(chance*100) };
      this.result = r;
      this.phase = 'actionResult';
      return r;
    },

    shortAction(idea, dim){
      const pool = {
        '战': ['磨刀','练手','找架打','负重'],
        '智': ['推演','拆解','复盘','记盘'],
        '体': ['跑圈','憋气','扛重','早睡'],
        '社': ['听墙根','攒人情','组局','递烟'],
        '运': ['押注','踩点','试手气','烧香'],
        '财': ['压价','囤货','走量','记账'],
        '灵': ['静坐','观息','抄书','守夜']
      }[dim] || ['琢磨','试错','反复练'];
      let h = 0;
      const t = String(idea || '');
      for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 9973;
      return pool[h % pool.length];
    },

    guessDim(t){
      t = String(t || '');
      if (/(死|杀|战|打|斗|猎|刀|剑|攻|守|拳)/.test(t)) return '战';
      if (/(钱|赚|卖|买|投资|生意|股|债|资产)/.test(t)) return '财';
      if (/(人|朋友|说话|名|粉丝|社交|势力|招)/.test(t)) return '社';
      if (/(跑|练|身体|睡|吃|体力|锻|熬)/.test(t)) return '体';
      if (/(运|运气|抽|赌|概率|签|随机)/.test(t)) return '运';
      if (/(修|心|静|灵|感|悟|冥想|魂)/.test(t)) return '灵';
      return '智';
    },

    makeCustomAction(idea, v, eff){
      const dim = (v && v.dim) || this.guessDim(idea);
      const score = (v && v.score) || 60;
      const power = clamp(3 + Math.round(score / 18), 3, 8);   // 基础行动是 2，自研更狠
      const label = String((v && v.label) || idea || '自研').slice(0, 12);
      if (!this._cid) this._cid = 0;
      this._cid += 1;
      return {
        id: 'c_' + this._cid,
        n: label,
        icon: '✦',
        custom: true,
        dim: dim,
        desc: '自研 · 你自己想出来的练法',
        grow: { dim: dim, v: power },
        eff: { hp: (eff && eff.hp) || 0 },
        effF: { hp: -Math.round(power * 1.6) },
        ok: ['你按自己研究出来的路子走了一遍。系统没有拦你。',
             '这一次不是系统给的，是你自己想出来的。',
             '你把那条路走通了，比想象中顺。'],
        bad: ['你想得太理想了，代价比预计的重。',
              '路子是对的，但你的手还跟不上。',
              '你漏算了一步，白费了力气。']
      };
    },

    /* 找死：一次行动力换一次死亡，同种死法收益指数递减 */
    seekDeath(wayId){
      const st = this.state, sys = st.system;
      if (!sys || sys.mechanic !== 'deathReturn') return null;
      if (st.ap <= 0) return { text:'没有行动力了。', chips:[] };
      if (!st.deathWays) st.deathWays = {};
      const ways = LS.DEATH_WAYS;
      // 玩家可以指定死法；不指定就挑一种用得最少的
      let way = wayId ? ways.find(function(w){ return w.id === wayId; }) : null;
      if (!way && this.rnd() < 0.6) {
        const sorted = ways.slice().sort(function(a,b){
          return (st.deathWays[a.id]||0) - (st.deathWays[b.id]||0);
        });
        way = sorted[0];
      } else {
        way = ways[Math.floor(this.rnd()*ways.length)];
      }

      const n = st.deathWays[way.id] || 0;
      st.deathWays[way.id] = n + 1;
      st.ap -= 1;

      const mods = this.buildMods();
      const decay = mods.decay || 0.82;
      const deathGain = mods.deathGain || 1;
      const factor = Math.max(0.05, Math.pow(decay, n) * deathGain);

      st.hp = 0;
      const death = this.handleDeath('你在' + st.age + '岁那年，死于' + way.n + '。', { noBoost: true });
      const chips = [];
      let text = way.t + '\n\n';

      if (death.revived) {
        const pool = sys.stats || [];
        const picks = [];
        for (let i = 0; i < Math.min(2, pool.length); i++) picks.push(pool[(n + i) % pool.length]);
        picks.forEach(function(s){
          const cur = st.attrs[s.k] || 0;
          // 数值越高涨得越慢，避免无限膨胀
          const gain = Math.max(1, Math.round(6 * factor * 80 / (80 + cur)));
          st.attrs[s.k] = Math.round((cur + gain) * 10) / 10;
          chips.push({ text: s.n + ' +' + gain, good:true });
        });
        text += '第 ' + (n + 1) + ' 次。你睁开眼睛，身体比刚才更结实。';
        text += '\n同一种死法收益 ×' + (Math.round(factor * 100) / 100);
        if (n >= 2) text += '\n\n这一种死法对你越来越没用了。换个死法，或者换个活法。';
      } else {
        text += '这一次，没有人把你叫醒。';
      }

      st.log.push({ age:st.age, kind:'sys', text:text.replace(/\n/g,' ') });
      st.timeline.push(st.age + '岁·找死（' + way.n + '）');
      this.result = { ok:true, auto:false, text:text, chips:chips, death:death,
                      title:'找死：' + way.n, seek:true,
                      factor:Math.round(factor*100)/100, way:way.n, times:n+1 };
      this.phase = death.ended ? 'end' : 'actionResult';
      if (death.ended) this.phase = 'end';
      return this.result;
    },

    freeAction(id){
      const st = this.state;
      if (st.ap <= 0) return null;
      let fa = null;
      if (String(id).indexOf('sea_') === 0 && LS.SEA_ACTS) {
        fa = LS.SEA_ACTS.find(function(x){ return x.id === id; });
      } else if (String(id).indexOf('c_') === 0) {
        fa = (st.customActs || []).find(function(x){ return x.id === id; });
      } else {
        fa = LS.FREE_ACTIONS.find(function(x){ return x.id === id; });
      }
      if (!fa) return null;
      const p = this.odds(fa.dim, 20 + Math.floor(st.turn*0.8));
      const ok = this.rnd() < p;
      st.ap -= 1;
      const chips = [];

      // 搞钱这事，脑子不够就是别人的提款机
      if (fa.id === 'earn' && st.econ) {
        const iq = st.brain.iq || 100;
        if (iq < 98) {
          const lose = Math.round((2.5 + this.rnd() * 6) * 10) / 10;
          st.econ.cash = Math.round((st.econ.cash - lose) * 10) / 10;
          if (st.econ.cash < 0) {
            st.econ.debt = Math.round((st.econ.debt - st.econ.cash) * 10) / 10;
            st.econ.cash = 0;
          }
          st.brain.cortisol = clamp(st.brain.cortisol + 4, 0, 100);
          const text = '有人跟你说有个稳赚不赔的门路，只要先交一笔"保证金"。\n\n' +
            '你算了一晚上，觉得他说得对。钱转过去第三天，那个号就搜不到了。';
          st.log.push({ age: st.age, kind:'bad', text: text.replace(/\n+/g, ' ') });
          return { ok:false, text:text, chips:[{ text:'被骗 ' + lose + ' 万', good:false }], death:null, ap:st.ap };
        }
      }
      if (ok) {
        const g = fa.grow;
        const pool = (st.system.stats||[]).filter(function(s){ return s.dim === g.dim; });
        const target = pool.length ? pool[Math.floor(this.rnd()*pool.length)] : (st.system.stats||[])[0];
        if (target) {
          const cur = st.attrs[target.k] || 0;
          const v = Math.max(1, Math.round(g.v * 80 / (80 + cur) * (this.buildMods().gainMul || 1)));
          st.attrs[target.k] = Math.round((cur + v) * 10) / 10;
          chips.push({ text: target.n + ' +' + v, good:true });
        }
        if (fa.eff && fa.eff.hp) {
          st.hp = clamp(st.hp + fa.eff.hp, 0, this.calcMaxHp());
          chips.push({text:'气血 +'+fa.eff.hp, good:true});
        }
      } else {
        if (fa.effF && fa.effF.hp) {
          st.hp = clamp(st.hp + fa.effF.hp, 0, this.calcMaxHp());
          chips.push({text:'气血 '+fa.effF.hp, good:false});
        }
      }
      if (ok && st.res.exp != null) st.res.exp += 8;
      // 海贼世界：打出名声就有悬赏
      if (ok && st.worldId === 'pirate') {
        let add = 0;
        if (id === 'sea_bounty') add = 300000 + Math.round(this.dimVal('战') * 90000);
        else if (id === 'sea_sail') add = Math.round(this.rnd() * 150000);
        else if (id === 'sea_crew') add = 120000 + Math.round(this.dimVal('社') * 20000);
        if (add > 0) {
          st.bounty = (st.bounty || 0) + add;
          chips.push({ text:'悬赏金 +' + LS.fmtBounty(add) + '（现 ' + LS.fmtBounty(st.bounty) + '）', good:true });
        }
      }
      let text = ok ? LS.pick(fa.ok, this.rnd.bind(this)) : LS.pick(fa.bad, this.rnd.bind(this));
      st.log.push({ age:st.age, kind: ok?'good':'bad', text: text });
      let death = null;
      if (st.hp <= 0) death = this.handleDeath('你在' + st.age + '岁那年耗尽了自己');
      if (death && death.ended) this.phase = 'end';
      return { ok:ok, text:text, chips:chips, death:death, ap:st.ap };
    },

    /* ---------- 系统能力（受"掌握度"影响） ---------- */
    async systemAction(){
      const st = this.state, sys = st.system;
      if (!sys) return { text:'你没有系统。', chips:[] };
      if (this.systemUsed) return { text:'本年已经用过一次了。', chips:[] };
      this.systemUsed = true;
      const mech = sys.mechanic;
      const tier = st.brain.tier || LS.BRAIN.tierOf(0);
      const scale = tier.sysScale * (this.buildMods().sysScale || 1);
      const chips = [];
      const rand = this.rnd.bind(this);
      let text = '';

      if (tier.key === 'none') {
        // 完全不会用：只能瞎按，但至少让你看见涨了什么
        const g = this.growRandom(Math.max(1, Math.round(1 * scale)));
        text = '你把面板上的每个按钮都按了一遍，只有两个亮了。\n其中一个还按错了。';
        if (g) chips.push({ text: g.n + ' +' + g.gain + '（勉强）', good:true });
        chips.push({ text:'掌握度太低，效果减半', good:false });
        st.log.push({ age:st.age, kind:'sys', text: text.replace(/\n/g,' ') });
        this.systemUsed = true;
        return { text:text, chips:chips };
      }

      switch(mech){
        case 'deathReturn': {
          if (rand() < 0.55) {
            text = '你又一次把命押在了桌上。';
            this.growRandom(Math.round(5*scale), '战');
            st.hp = clamp(st.hp - 25, 0, this.calcMaxHp());
            chips.push({text:'气血 -25', good:false});
          } else {
            st.hp = 0;
            text = '你主动走进了必死之地。\n心跳停止了七秒。';
          }
          break;
        }
        case 'gacha': {
          const key = st.res.ticket != null ? 'ticket' : (st.res.roll != null ? 'roll' : (st.res.card != null ? 'card' : null));
          if (key) {
            if (st.res[key] <= 0) { this.systemUsed = false; return { text:'没有次数了。', chips:[] }; }
            st.res[key] -= 1;
          }
          const r = rand() / Math.max(0.6, scale);
          if (r < 0.1) { text = '白光一闪。\n【N】一次性纸巾。'; this.growRandom(1); }
          else if (r < 0.55) { text = '【R】普通强化。'; this.growRandom(Math.round(2*scale)); }
          else if (r < 0.85) { text = '【SR】稀有垂青。'; this.growRandom(Math.round(4*scale)); st.hp = Math.min(st.maxHp, st.hp+10); }
          else { text = '【SSR】系统罕见地沉默了两秒。'; this.growRandom(Math.round(7*scale)); st.freePts += 1; }
          break;
        }
        case 'sim': {
          if ((st.res.sim||0) > 0) st.res.sim -= 1;
          text = '你在脑中过了一遍未来的分支。\n有些路看起来安全，其实尽头是墙。';
          if (this.pending && this.pending.opts) this.pending.opts.forEach(function(o){ o._revealed = true; });
          this.growRandom(1);
          break;
        }
        case 'mindread': {
          if ((st.res.mp||0) > 0) st.res.mp = Math.max(0, st.res.mp - 12);
          text = '你听见了他们没说出口的话。';
          this.growRandom(1, '智');
          break;
        }
        case 'analysis': {
          text = '环境在你眼里变成了一排数字。';
          this.growRandom(1, '智');
          break;
        }
        case 'copy': {
          if ((st.res.slots||0) <= 0) { this.systemUsed = false; return { text:'复制槽已满。', chips:[] }; }
          st.res.slots -= 1;
          text = '你盯住眼前的一切，把其中一项"应该是我的东西"抽了出来。';
          this.growRandom(Math.round(3*scale));
          break;
        }
        case 'leech':
        case 'hunt': {
          const p = this.odds('战', 24);
          if (rand() < p) {
            text = '你找到了猎物。过程不必细说，结果是：你变强了。';
            this.growRandom(Math.round(3*scale), '战');
            st.res.kills = (st.res.kills||0) + 1;
            st.hp = Math.min(st.maxHp, st.hp + 8);
          } else {
            text = '猎物比你想的凶。你带着伤回来了。';
            st.hp = clamp(st.hp - 18, 0, this.calcMaxHp());
          }
          break;
        }
        case 'shop': {
          const r = rand();
          if (r < 0.3) { text = '商城里刷出一件保命道具。'; st.hp = Math.min(st.maxHp, st.hp+20); }
          else if (r < 0.7) { text = '你挑了一份强化素材，直接用了。'; this.growRandom(Math.round(3*scale)); }
          else { text = '你什么都没买，只是把货架看了一遍。'; this.growRandom(1); }
          break;
        }
        case 'pact': {
          st.res.pacts = (st.res.pacts||0) + 1;
          st.res.debt = (st.res.debt||0) + 20;
          (sys.stats||[]).forEach(function(s){
            if (s.k === 'debt') return;
            if (s.k === 'soul') { st.attrs.soul = Math.max(0, (st.attrs.soul||100) - 10); return; }
            st.attrs[s.k] = Math.round((st.attrs[s.k]||0) + Math.round(5*scale));
          });
          text = '你在契约上按了手印。\n力量涌上来的那一刻，你听见有人在很远的地方笑。';
          break;
        }
        case 'quest': {
          const p = this.odds('智', 22);
          if (rand() < p) { text = '任务完成。系统难得地给了一句评价：还不错。'; this.growRandom(Math.round(3*scale)); st.res.qp = (st.res.qp||0) + 10; }
          else { text = '任务失败。它没有惩罚你，只是安静地记了一笔。'; st.dimBonus['运'] = (st.dimBonus['运']||0) - 1; }
          break;
        }
        case 'rewind': {
          if ((st.res.rw||0) > 0) { st.res.rw -= 1; text = '你把这一刻钉成了存档点。'; st.flags.savepoint = 1; }
          else text = '没有回档次数了。';
          break;
        }
        case 'maker': {
          return this.craftSystem();
        }
        case 'wealth': {
          const mk = this.moneyKey();
          const act = (sys.acts || [])[0] || { n:'动用资金' };
          if (!mk) { this.growRandom(Math.round(2*scale)); text = '系统在账面上动了一下，你看不懂。'; break; }
          const cur = st.res[mk] || 0;
          const spend = Math.max(5, Math.round(cur * 0.3));
          st.res[mk] = Math.max(0, Math.round((cur - spend) * 10) / 10);
          const back = Math.round(spend * (1.5 + rand() * 0.9) * scale);
          st.res[mk] = Math.round((st.res[mk] + back) * 10) / 10;
          if (st.econ) st.econ.cash = Math.round((st.econ.cash + back * 0.6) * 10) / 10;
          chips.push({ text:'花掉 ' + LS.ECON.money(spend, st.worldId), good:false });
          chips.push({ text:'返利 +' + LS.ECON.money(back, st.worldId), good:true });
          text = '你用【' + act.n + '】把钱砸了出去。\n\n三天后，到账提醒响了 ' + back + ' 次。';
          break;
        }
        case 'fame': {
          const f = st.res.fans != null ? 'fans' : (st.res.fan != null ? 'fan' : null);
          if (f) {
            const gain = Math.max(1, Math.round(st.res[f] * 0.18 * scale));
            st.res[f] += gain;
            chips.push({ text:'粉丝 +' + gain, good:true });
            if (st.econ) st.econ.passive = Math.round((st.econ.passive + gain * 0.002) * 10) / 10;
            text = '你发了一条动态，粉丝涨了 ' + gain + '。\n\n流量变成了账单上的一行小字。';
          } else { this.growRandom(Math.round(2*scale)); text = '你刷了一次存在感。'; }
          break;
        }
        case 'signin': {
          st.res.days = (st.res.days || 0) + 1;
          const gain = Math.round(6 + st.res.days * 0.5);
          st.res.pt = (st.res.pt || 0) + gain;
          this.growRandom(Math.round(1.5*scale));
          chips.push({ text:'签到点 +' + gain, good:true });
          text = '第 ' + st.res.days + ' 天。\n\n奖励到账，不多，但没断过。';
          break;
        }
        case 'luck': {
          if ((st.res.fate||0) > 0) {
            st.res.fate -= 1;
            st.flags.autoWin = 1;
            text = '你顺应了一次天命。\n接下来的一次判定，世界会让着你。';
          } else { text = '天命值不够了。'; this.systemUsed = false; }
          break;
        }
        default: {
          const act = (sys.acts||[])[0];
          if (act && act.eff) {
            this.applyEff(act.eff).forEach(function(c){ chips.push(c); });
            text = '你用了【' + act.n + '】。\n\n' + (act.d || '');
          } else {
            this.growRandom(Math.round(2*scale));
            text = act ? ('你用了【' + act.n + '】。' + (act.d||'')) : '你使用了一次系统能力。';
          }
        }
      }
      const death = st.hp <= 0 ? this.handleDeath('你在' + st.age + '岁那年死在了自己手里') : null;
      if (death && death.revived) text += '\n' + death.text;
      st.log.push({ age:st.age, kind:'sys', text: text.replace(/\n/g,' ') });
      if (death && death.ended) this.phase = 'end';
      return { text:text, chips:chips, death:death };
    },

    async craftSystem(){
      const st = this.state;
      if ((st.res.mat||0) < 10) return { text:'素材不足，造不出稳定结构。', chips:[] };
      st.res.mat -= 10;
      let sys = null;
      if (LS.AI.mode() !== 'offline' && this.aiUsed < this.aiBudget()) {
        try {
          sys = await LS.AI.genSystem(null);
          this.aiUsed++; st.aiUsed = this.aiUsed;
        } catch(e){ this.lastAiError = e.message; }
      }
      if (!sys) {
        const base = LS.SYSTEMS.filter(function(s){ return s.id !== 'maker'; });
        const src = base[Math.floor(this.rnd()*base.length)];
        const prefix = LS.pick(['暗面','无声','万界','逆序','慈悲','疯狂','残缺','第二'], this.rnd.bind(this));
        sys = JSON.parse(JSON.stringify(src));
        sys.id = 'cus_' + Date.now().toString(36);
        sys.name = prefix + sys.name.replace('系统','') + '系统';
        sys.tagline = '由一位制造师在' + st.age + '岁那年写下的规则。';
        sys.desc = '它不是天生的。它是某个人用素材、算力和一段人生拼出来的。';
        sys.rarity = 'SR';
        sys.custom = true;
      }
      sys.authorPathId = st.id;
      sys.authorName = st.name;
      sys.authorWorld = st.worldName;
      sys.createdAt = Date.now();
      LS.Store.saveSystem(sys);
      st.made = (st.made||0) + 1;
      st.res.made = (st.res.made||0) + 1;
      st.tags.push('制造师');
      st.maxHp = this.calcMaxHp();
      st.hp = Math.min(st.maxHp, st.hp + 10);
      this.growRandom(2, '灵');
      return {
        text: '你从自己的面板里抽出一根发光的线，剪断，重新接上。\n\n【' + sys.name + '】诞生了。\n它会在某个陌生人的十八岁，成为他的命运。',
        chips: [{text:'新系统入库：' + sys.name, good:true}],
        system: sys
      };
    },

    addPoint(k){
      const st = this.state;
      if (st.freePts <= 0) return false;
      if (st.attrs[k] == null) return false;
      st.attrs[k] = Math.round((st.attrs[k] + 1)*10)/10;
      st.freePts -= 1;
      st.maxHp = this.calcMaxHp();
      return true;
    },

    endYear(){
      const st = this.state;
      if (st.ended) { this.phase = 'end'; return 'end'; }
      // 年度账单写进日志
      if (st.econ && st.age >= 18) {
        const e = st.econ;
        const M = function(v){ return LS.ECON.money(v, st.worldId); };
        st.log.push({ age:st.age, kind:'sys', text:
          '这一年：收入 ' + M(e.active) + '，被动 ' + M(e.passive) +
          '，支出 ' + M(e.expense) + '。' +
          (e.debt > 0 ? '负债 ' + M(e.debt) + '。' : '没有负债。') });
      }
      // 切片：四十岁收束，一局到此为止
      if (st.slice && LS.SLICE && st.age + 1 > LS.SLICE.to) {
        this.endRun('四十岁这年，你把账本合上，不再往下算了。', '收束');
        return 'end';
      }
      st.age += 1;
      if (st.age % 10 === 0) {
        st.log.push({ age:st.age, kind:'say', text:'你 ' + st.age + ' 岁了。' });
      }
      this.phase = 'adult';
      return 'next';
    },

    computeScore(){
      const st = this.state;
      const dims = this.dims();
      let s = 0;
      Object.keys(dims).forEach(function(d){ s += Math.min(dims[d], 120) * 1.5; });
      s += Math.min(st.age, 100) * 2;
      s += Math.min(st.tags.length, 20) * 3;
      s += (LS.RARITY[st.rarity] ? LS.RARITY[st.rarity].score : 0);
      s += Math.min(st.deaths, 15) * 8 + Math.min(st.rewinds, 10) * 5;
      s += Math.min(st.made || 0, 8) * 30;
      s += Math.max(0, Math.round((st.brain.iq - 100) * 2));
      if (st.econ) s += Math.max(-60, Math.min(120, Math.round(LS.ECON.netWorth(st.econ) * 0.4)));
      if (st.alive) s += 60;
      return Math.round(s);
    },

    /* 结局尾话：同一套数值，落在不同世界、不同活法上，说法不一样 */
    epilogue(){
      const st = this.state;
      const dims = this.dims();
      const order = Object.keys(dims).sort(function(a,b){ return dims[b]-dims[a]; });
      const top = order[0], low = order[order.length-1];
      const net = st.econ ? LS.ECON.netWorth(st.econ) : 0;
      const xian = st.worldId === 'xianxia';
      const dead = st.endTag !== '寿终';
      const lines = [];

      if (xian) {
        if (st.age > 120) lines.push('你活了 ' + st.age + ' 年。同辈的坟头草换了几十茬，你还在。');
        else if (st.level >= 12) lines.push('你修到了第 ' + st.level + ' 层。山门换了三任掌门，你的名字还在碑上。');
        else lines.push('你没能走完这条路。修真界每天都在埋人，你只是其中一个。');
      } else if (st.worldId !== 'modern') {
        if (dead) lines.push('这个世界没有给你第二次机会。你在这里的痕迹，很快会被风沙盖住。');
        else lines.push('你从那个世界活着回来了，或者说，你终于在那里活成了本地人。');
      } else {
        const M = function(v){ return LS.ECON.money(v, st.worldId); };
        if (net >= 300) lines.push('你留下了 ' + M(net) + '。房子、账户、一堆没拆的快递。');
        else if (net < 0) lines.push('你走的时候还欠着 ' + M(-net) + '。催收的电话打到了你儿子的手机上。');
        else lines.push('你没留下什么钱，也没欠下什么。');
      }

      if (top === '财') lines.push('你这一生最擅长的是算账，最后连自己的葬礼都算过成本。');
      else if (top === '战') lines.push('你打赢过很多次，也终于输了一次。');
      else if (top === '智') lines.push('你想明白了不少事，但想明白并不等于能改变。');
      else if (top === '社') lines.push('来送你的人比你想的多，只是没有一个是真正懂你的。');
      else if (top === '灵') lines.push('你到最后都在看远处，没人知道你看见了什么。');
      else if (top === '运') lines.push('你这一生运气不错，好到连你自己都觉得不好意思。');
      else lines.push('你把身体练得很好，可身体终究是会到期的。');

      if (low === '体' && st.age < 60) lines.push('你从来没有好好照顾过它。');
      if (st.brain.iq >= 131) lines.push('你的脑子一直比周围人快半步，这让你既占便宜，也很难跟人走在一起。');
      else if (st.brain.iq < 95) lines.push('很多事你没想明白就过去了，等想明白时，已经来不及。');
      if (st.build && st.build.action === 'seekDeath') lines.push('你死过 ' + st.deaths + ' 次。到最后一次，你没有再睁开眼。');
      if ((st.customActs||[]).length) lines.push('你自己琢磨出来的那套用法，被后来的人记在了系统库里。');
      return lines.join('\n');
    },

    rankOf(score){
      if (score >= 1200) return { t:'SSS · 传说', c:'#D99A2B', d:'你的名字会被写进某种"设定集"里。' };
      if (score >= 900) return { t:'SS · 传奇', c:'#C77B2B', d:'一个时代里，能出几个你这样的人？' };
      if (score >= 700) return { t:'S · 顶尖', c:'#8E6FD8', d:'你活成了别人口中的"如果当年"。' };
      if (score >= 520) return { t:'A · 出色', c:'#4F9DD1', d:'你确实改变了一些事情，包括你自己。' };
      if (score >= 350) return { t:'B · 不错', c:'#4C9A72', d:'普通人的上限，你已经摸到了。' };
      if (score >= 200) return { t:'C · 平凡', c:'#8E9AA6', d:'你活过、爱过、也认输过。' };
      return { t:'D · 微尘', c:'#A08C7D', d:'世界没有记住你，但你确实来过。' };
    },

    endRun(reason, reasonTag){
      const st = this.state;
      if (st.ended && st.pathSaved) return st.pathId;
      st.ended = true;
      st.alive = st.hp > 0;
      st.endReason = reason;
      st.endTag = reasonTag || (st.alive ? '寿终' : '死亡');
      st.score = this.computeScore();
      st.rank = this.rankOf(st.score);
      st.epilogueText = this.epilogue();
      this.computeAchievements();

      const b = st.brain;
      const path = {
        id: st.id, at: Date.now(), v: LS.VERSION,
        name: st.name, gender: st.gender,
        worldId: st.worldId, worldName: st.worldName,
        startWorld: 'modern',
        systemId: st.systemId, systemName: st.systemName, rarity: st.rarity,
        seed: st.seed, age: st.age, score: st.score, rank: st.rank.t,
        reason: reason, endTag: st.endTag,
        attrs: Object.assign({}, st.attrs), res: Object.assign({}, st.res),
        statsSchema: ((st.system&&st.system.stats)||[]).map(function(x){ return {k:x.k,n:x.n,dim:x.dim}; }),
        tags: st.tags.slice(0, 20),
        maker: !!st.maker, made: st.made || 0,
        deaths: st.deaths, aiUsed: st.aiUsed,
        iq: b.iq, mastery: b.mastery,
        econ: st.econ ? { net: LS.ECON.netWorth(st.econ), debt: Math.round(st.econ.debt*10)/10, active: st.econ.active, passive: st.econ.passive } : null,
        parent: b.parent ? b.parent.name : '',
        school: b.school ? b.school.name : '',
        timeline: st.timeline.slice(-24),
        childMemories: st.childMemories.map(function(m){ return m.age + '岁·' + m.title + '：' + m.choice; }),
        ratingCount: 0, ratingSum: 0
      };
      LS.Store.savePath(path);
      if (LS.Store.clearRun) LS.Store.clearRun();
      st.pathSaved = true;
      st.pathId = path.id;
      this.pathRecord = path;
      this.phase = 'end';
      return path;
    },

    exportRun(){
      const st = this.state;
      return {
        v: LS.VERSION, name: st.name, worldId: st.worldId, systemId: st.systemId,
        seed: st.seed, maker: st.maker, age: st.age, score: st.score || 0,
        iq: st.brain ? st.brain.iq : 0,
        timeline: st.timeline.slice(-12)
      };
    }
  };

  LS.Game = Game;
})();
