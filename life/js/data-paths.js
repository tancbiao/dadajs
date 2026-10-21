/* 自发路线：玩家研究同一方向，会真的走出一条路
 * 不是加几点属性，而是改变收入结构、寿命、死亡率。
 */
window.LS = window.LS || {};

LS.SELF_PATHS = [
  {
    id:'quant', n:'量化暴富', icon:'📈',
    keys:/(彩票|炒股|量化|编程|代码|算法|交易|金融|投资|套利|机构|股票|期货)/,
    intro:'你开始怀疑：这个世界的价格，是不是可以被算出来。',
    stages:[
      { n:'试水彩票', d:'你买了十注，一注没中。但开奖前那三秒，系统确实卡了一下。', econ:{ cash:0.5 } },
      { n:'发现防穿越', d:'你翻了三百期开奖记录，发现每逢你下注，号码就会被改。这个世界防着你。', econ:{} },
      { n:'学写代码', d:'买不到运气，就买信息。你开始学写代码，把规则拆成可以计算的东西。', econ:{ active:2 } },
      { n:'量化策略', d:'你写出一套很小的策略，年化高得不像话。你没声张。', econ:{ passive:40 } },
      { n:'开量化机构', d:'别人的钱开始流进你的模型。你抽成，抽得很轻，但基数太大。', econ:{ passive:400 } },
      { n:'万亿身家', d:'数字已经失去意义。你开始想别的——比如怎么不死。', econ:{ passive:6000 } }
    ]
  },
  {
    id:'immortal', n:'永生研究', icon:'♾️',
    keys:/(永生|长生|不死|寿命|延寿|基因|意识|克隆|细胞|衰老| immortality)/i,
    intro:'钱够了以后，你第一次认真算了自己的余寿。',
    stages:[
      { n:'记录身体', d:'你开始每天记录心率、睡眠、体重。数据比感觉可靠。', life:5 },
      { n:'第一次延寿', d:'你找到一种代价很大的办法，把寿命往后推了一截。', life:15 },
      { n:'半永生', d:'你的身体开始不再按正常速度老去。有人注意到了。', life:45, risk:0.75 },
      { n:'拒绝死亡', d:'就算心脏停跳，你也知道怎么把自己拉回来。', life:120, risk:0.45, immortal:true }
    ]
  },
  {
    id:'body', n:'护体', icon:'🛡️',
    keys:/(护体|不死身|锻体|横练|肉身|抗打|战斗|战力|防御|练骨|练皮)/,
    intro:'你算过一笔账：意外死亡的概率，是可以被身体压下去的。',
    stages:[
      { n:'练皮', d:'你每天撞沙袋，撞到手掌结茧。', risk:0.9, dim:'战' },
      { n:'练骨', d:'骨头开始比常人硬，落地的方式也变了。', risk:0.8, dim:'战' },
      { n:'练脏', d:'你能控制心跳。受伤时先止血，再想疼。', risk:0.65, dim:'体' },
      { n:'金刚', d:'普通人已经很难杀死你。剩下的，是这个世界的东西。', risk:0.5, dim:'战' }
    ]
  }
];

LS.Paths = {
  all(){ return LS.SELF_PATHS; },
  byId(id){ return LS.SELF_PATHS.find(function(p){ return p.id === id; }) || null; },
  match(idea){
    const t = String(idea || '');
    for (let i = 0; i < LS.SELF_PATHS.length; i++) {
      if (LS.SELF_PATHS[i].keys.test(t)) return LS.SELF_PATHS[i];
    }
    return null;
  }
};
