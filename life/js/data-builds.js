/* 系统开发路线（自选流派）
 * 觉醒后由玩家选一条：同一个系统，练法不同，收益曲线完全不同。
 * mods 只列会真正生效的字段：
 *   gainMul   所有属性成长倍率
 *   sysScale  系统能力倍率
 *   apBonus   每年额外行动力
 *   deathGain 死亡收益倍率（仅死亡类）
 *   decay     同种死法收益递减系数（越小越快失效）
 *   regen     每年回血倍率
 */
window.LS = window.LS || {};

LS.BUILDS = {
  deathReturn: [
    { id:'die_hard', name:'找死流', tag:'越死越强',
      desc:'主动往最危险的地方钻。死一次强一次，但同一种死法会越来越不管用——得换着花样死。',
      mods:{ deathGain:1.5, decay:0.78, gainMul:1.1 }, action:'seekDeath' },
    { id:'survive', name:'苟活流', tag:'活着才有输出',
      desc:'不主动送死，靠日常积累。慢，但每一分都是自己挣的，不用拿命换。',
      mods:{ deathGain:0.7, regen:1.7 } },
    { id:'research', name:'死法研究', tag:'把死亡变成变量',
      desc:'记录每一种死法的边际收益，专挑还没试过的。递减来得慢，但需要耐心。',
      mods:{ deathGain:1.15, decay:0.92, sysScale:1.15 }, action:'seekDeath' }
  ],

  levelUp: [
    { id:'grind', name:'苦修流', tag:'把时间换成数值',
      desc:'每天多练两个钟头。成长稳，但你需要放弃很多别的东西。',
      mods:{ gainMul:1.25, regen:1.2, apBonus:1 } },
    { id:'combat', name:'实战流', tag:'在挨打里升级',
      desc:'专挑打不过的对手。经验和伤一起涨。',
      mods:{ gainMul:1.5, sysScale:1.1, apBonus:1 } },
    { id:'insight', name:'顿悟流', tag:'一次想通顶十年',
      desc:'不练肌肉，练脑子。系统能力更强，属性涨得慢。',
      mods:{ sysScale:1.4 } }
  ],

  gacha: [
    { id:'save', name:'攒券流', tag:'不抽就是赢',
      desc:'能不抽就不抽，攒到保底再动手。',
      mods:{ gainMul:0.95, sysScale:1.1, regen:1.2 } },
    { id:'allin', name:'梭哈流', tag:'一把翻身',
      desc:'有券就抽，绝不过夜。上限高，下限也低。',
      mods:{ gainMul:1.45, sysScale:1.25 } },
    { id:'pity', name:'保底流', tag:'只吃确定的那一份',
      desc:'专挑有保底的池子，收益不高但从不空手。',
      mods:{ gainMul:1.1, regen:1.3 } }
  ],

  wealth: [
    { id:'safe', name:'稳健流', tag:'活着比赚快钱重要',
      desc:'不碰杠杆，慢慢滚。',
      mods:{ gainMul:0.95, regen:1.3, sysScale:1.05 } },
    { id:'lever', name:'杠杆流', tag:'借来的钱也是钱',
      desc:'能借多少借多少。赚得快，断得也快。',
      mods:{ gainMul:1.5, sysScale:1.2 } },
    { id:'industry', name:'实业流', tag:'把钱变成会下蛋的东西',
      desc:'买房、开店、买设备。慢，但抗风险。',
      mods:{ gainMul:1.15, regen:1.15, sysScale:1.15 } }
  ],

  leech: [
    { id:'hunt', name:'猎杀流', tag:'主动出门找吃的',
      desc:'哪里危险往哪里去。掠夺效率最高，受伤也最多。',
      mods:{ gainMul:1.45, sysScale:1.15 } },
    { id:'farm', name:'圈养流', tag:'细水长流',
      desc:'不杀光，留着慢慢取。稳定，但慢。',
      mods:{ gainMul:0.95, regen:1.5 } },
    { id:'sym', name:'共生流', tag:'和猎物做朋友',
      desc:'从共生里取一点点。收益最低，但几乎不结仇。',
      mods:{ gainMul:0.85, sysScale:1.25, regen:1.3 } }
  ],

  rewind: [
    { id:'savepoint', name:'存档流', tag:'死之前先存档',
      desc:'把每次关键选择都存下来，稳得可怕。',
      mods:{ regen:1.6, sysScale:1.05 } },
    { id:'speedrun', name:'速通流', tag:'错了就重来，不心疼',
      desc:'不存档，靠重开堆经验。成长快，回档次数少。',
      mods:{ gainMul:1.45 } },
    { id:'sacrifice', name:'献祭流', tag:'用次数换力量',
      desc:'把回档次数烧成属性。一次性的爆发。',
      mods:{ gainMul:1.3, sysScale:1.2 } }
  ],

  sim: [
    { id:'simulate', name:'推演流', tag:'先算，再动',
      desc:'每次行动前先推演一遍。慢，但几乎不犯错。',
      mods:{ sysScale:1.35, regen:1.2 } },
    { id:'gamble', name:'赌博流', tag:'不推演，直接上',
      desc:'把推演次数换成实打实的收益。',
      mods:{ gainMul:1.4 } },
    { id:'record', name:'记录流', tag:'把每次推演写成册子',
      desc:'推演过的路都记下来，属性慢慢涨。',
      mods:{ gainMul:1.2, sysScale:1.15 } }
  ],

  fame: [
    { id:'content', name:'内容流', tag:'把东西做好',
      desc:'慢慢涨粉，口碑扎实。',
      mods:{ gainMul:1.15, regen:1.2 } },
    { id:'hype', name:'炒作流', tag:'先火再说',
      desc:'短期暴涨，长期反噬。',
      mods:{ gainMul:1.5 } },
    { id:'longterm', name:'长线流', tag:'十年后再看',
      desc:'不追热点，做能留下来的东西。',
      mods:{ gainMul:0.95, sysScale:1.3 } }
  ],

  pact: [
    { id:'small', name:'小额契约', tag:'一次只借一点',
      desc:'代价小，收益也小。但不会反噬。',
      mods:{ gainMul:1.1, regen:1.4 } },
    { id:'big', name:'豪赌契约', tag:'一次借够',
      desc:'收益翻倍，代价也翻倍。',
      mods:{ gainMul:1.55, sysScale:1.2 } },
    { id:'counter', name:'反契流', tag:'把代价变成燃料',
      desc:'专门研究条款漏洞，代价越高，你越强。',
      mods:{ gainMul:1.3, sysScale:1.25 } }
  ],

  default: [
    { id:'aggressive', name:'激进流', tag:'先赢再说',
      desc:'把系统往死里用。收益高，代价也高。',
      mods:{ gainMul:1.4, sysScale:1.15 } },
    { id:'steady', name:'稳健流', tag:'不出错就是赢',
      desc:'按部就班，细水长流。',
      mods:{ gainMul:0.95, regen:1.5, sysScale:1.05 } },
    { id:'master', name:'钻研流', tag:'把规则读透',
      desc:'不追求数值，追求把系统用对地方。',
      mods:{ gainMul:1.05, sysScale:1.35 } }
  ]
};

LS.buildsFor = function(mechanic){
  return LS.BUILDS[mechanic] || LS.BUILDS['default'];
};

/* 找死用的"死法"。全部是冒险/奇幻向，不涉及现实伤害方式 */
LS.DEATH_WAYS = [
  { id:'abyss', n:'深渊边缘', t:'你走到裂隙边上，往下看了一眼，然后跳了。' },
  { id:'beast', n:'兽潮', t:'你逆着兽潮走进去，没有回头。' },
  { id:'storm', n:'雷暴', t:'你在旷野中央站定，等着那道雷。' },
  { id:'ruin', n:'坍塌的高塔', t:'你走进正在塌的塔，石头从头顶落下来。' },
  { id:'duel', n:'越级决斗', t:'你约了一个比你强十倍的人，说：现在。' },
  { id:'poison', n:'毒雾', t:'你屏住呼吸，走进那片绿色的雾。' },
  { id:'void', n:'空间裂缝', t:'你把手伸进裂缝，然后整个人跟了进去。' }
];
