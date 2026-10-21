/* 天赋系统
 * 核心规则：天赋不是加成，是"需要被养对才成立"的东西。
 * 只有高知 / 宽容型父母能把它养出来；其余家庭大概率反噬。
 */
window.LS = window.LS || {};

/* 能养住天赋的父母类型 */
LS.TALENT_SAFE_PARENTS = ['intellectual', 'permissive'];

LS.TALENTS = [
  {
    id:'iq', n:'先天智力超群', icon:'🧠', rare:'SR',
    desc:'一岁半能说完整句子，三岁自己看说明书。亲戚说这孩子将来不得了。',
    start:{ iq:20 },
    good:{ iq:0.4, ndi:0.6, focus:0.3 },
    bad:{ iq:-1.2, cort:2.2, ndi:-0.8 },
    badText:'你学得太快，四十分钟的课你十分钟就懂了，剩下的三十分钟只能发呆。老师说你不专心，建议去查一下。',
    crisis:{ age:9, text:'医院的确诊单上写着两个缩写。你父母拿着它，像拿着一份说明书。', eff:{ iq:-25, cort:8, focus:-6 }, tag:'被确诊' }
  },
  {
    id:'talk', n:'天生会说话', icon:'🗣️', rare:'R',
    desc:'一岁就会喊人，两岁能跟整条巷子的人聊。你不怕生。',
    start:{ mirror:8, focus:-2 },
    good:{ mirror:0.8, focus:0.2 },
    bad:{ mirror:-1.1, focus:-0.8, cort:1.2 },
    badText:'你话太多，吃饭坐不住。爷爷奶奶端着碗追，最后把手机架在桌上，放动画片，一勺一勺喂。',
    crisis:{ age:9, text:'你成了班里最会接话的人，也是最不会写作业的人。老师说你"聪明不用在正地方"。', eff:{ focus:-5, cort:4 }, tag:'耍嘴皮' }
  },
  {
    id:'quiet', n:'安静专注', icon:'🧩', rare:'R',
    desc:'你能一个人玩一下午积木，不吵不闹。大人说这孩子省心。',
    start:{ focus:10, cort:-4 },
    good:{ focus:0.7, ndi:0.4 },
    bad:{ focus:-0.9, cort:2.4 },
    badText:'你搭到一半，妈妈把积木收走："别人家孩子都在学拼音了。"你坐在原地，很久没说话。',
    crisis:{ age:9, text:'你的专注变成了"反应慢"。你开始怀疑自己是不是真的笨。', eff:{ focus:-6, cort:7 }, tag:'自我怀疑' }
  },
  {
    id:'dive', n:'跳水天赋', icon:'🤿', rare:'SR',
    desc:'你敢从最高的地方往下跳，落水时身体是直的。',
    start:{ phy:10, res:5 },
    good:{ phy:0.8, res:0.5 },
    bad:{ phy:-0.6, cort:1.8 },
    badText:'体校教练来过一次，你父母算了一笔账：练不出来怎么办。第二天你被送去补习班。',
    crisis:{ age:9, text:'你再站上跳台时，腿软了。不是怕高，是怕辜负谁。', eff:{ phy:-6, cort:6 }, tag:'天赋生锈' }
  },
  {
    id:'swim', n:'游泳天赋', icon:'🏊', rare:'R',
    desc:'你泡在水里比在岸上自在，一口气能潜很远。',
    start:{ phy:8, res:4 },
    good:{ phy:0.7, res:0.4 },
    bad:{ phy:-0.5, cort:1.4 },
    badText:'游泳卡到期了，没续。理由很实际：周末要上两个班。',
    crisis:{ age:9, text:'你在泳池里赢了所有人，回家却因为数学卷子被罚站。', eff:{ phy:-4, cort:5 }, tag:'两条赛道' }
  },
  {
    id:'ski', n:'滑雪天赋', icon:'🎿', rare:'SSR',
    desc:'第一次上雪道就没摔，教练问你家是不是有人练过。',
    start:{ phy:9, res:8 },
    good:{ phy:0.9, res:0.6 },
    bad:{ phy:-0.4, cort:1.2 },
    badText:'雪场太远，一年去一次。你只能在电视上看别人滑。',
    crisis:{ age:9, text:'你开始觉得，喜欢一件事是件很奢侈的事。', eff:{ cort:5 }, tag:'奢侈' }
  },
  {
    id:'fps', n:'射击游戏天赋', icon:'🎯', rare:'SR',
    desc:'压枪、听声、预瞄，你的手比脑子快。',
    start:{ focus:4, mirror:4 },
    good:{ focus:0.4, mirror:0.3, res:0.4 },
    bad:{ focus:-1.2, mirror:-0.6, cort:1.6 },
    badText:'你在游戏里是队里的大腿，在班里是倒数。父母拔了网线，你翻墙去网吧。',
    crisis:{ age:13, text:'你的反应速度测出来是同龄前 1%，但没有人知道该拿它做什么。', eff:{ focus:-8, cort:7 }, tag:'无处安放' }
  },
  {
    id:'moba', n:'MOBA 天赋', icon:'🕹️', rare:'R',
    desc:'你能记住所有技能冷却，还能指挥五个人。',
    start:{ mirror:6, focus:2 },
    good:{ mirror:0.5, focus:0.2, res:0.3 },
    bad:{ mirror:-0.9, focus:-0.9, cort:1.5 },
    badText:'你打得越好，越不想写作业。你想过打职业，家里说那是歪门邪道。',
    crisis:{ age:13, text:'你在排位里赢了一整夜，天亮时发现作业一个字没动。', eff:{ focus:-6, cort:5 }, tag:'通宵' }
  },
  {
    id:'memory', n:'过目不忘', icon:'📚', rare:'SR',
    desc:'三岁能背下整本绘本，连页码都不错。',
    start:{ iq:8, focus:6 },
    good:{ iq:0.3, focus:0.4 },
    bad:{ iq:-0.6, focus:-0.7, cort:2 },
    badText:'你能背下整篇课文，却讲不出它什么意思。老师说你"死记硬背"。',
    crisis:{ age:9, text:'试卷开始考"理解"，你第一次觉得自己脑子不够用。', eff:{ iq:-10, focus:-5 }, tag:'背不动了' }
  },
  {
    id:'music', n:'绝对音感', icon:'🎵', rare:'SSR',
    desc:'听一遍就能哼出调，琴键上哪个音不准你都知道。',
    start:{ mirror:8, focus:4 },
    good:{ mirror:0.7, focus:0.3 },
    bad:{ focus:-0.8, cort:2.2 },
    badText:'练琴从喜欢变成了任务。每天一小时，错一个音重来。你开始讨厌音乐。',
    crisis:{ age:9, text:'考级过了，你把琴盖合上，再也没打开。', eff:{ focus:-6, cort:7 }, tag:'恨琴' }
  },
  {
    id:'space', n:'空间感极强', icon:'🧭', rare:'R',
    desc:'你闭着眼也能画出家里的平面图，方向感好得离谱。',
    start:{ iq:5, focus:4 },
    good:{ iq:0.3, focus:0.3 },
    bad:{ iq:-0.4, focus:-0.5, cort:1.2 },
    badText:'这个本事在考试里不算分。你父母说："画这些有什么用。"',
    crisis:{ age:9, text:'你的草稿本被撕了，因为上面画满了地图。', eff:{ focus:-5, cort:5 }, tag:'被撕掉' }
  },
  {
    id:'rich', n:'家里有点钱', icon:'💰', rare:'R',
    desc:'你不是富二代，但你家从没让你缺过什么。',
    start:{ res:20, money:6 },
    good:{ money:0.8 },
    bad:{ money:-0.2, iq:-0.3, cort:0.8 },
    badText:'钱替你解决了很多事，也替你挡掉了很多必须自己面对的事。',
    crisis:{ age:13, text:'你第一次发现，有些事花钱也没用。', eff:{ cort:5 }, tag:'第一次碰壁' }
  },
  {
    id:'looks', n:'长得好看', icon:'✨', rare:'SR',
    desc:'从小被夸到大，走到哪儿都有人多看你一眼。',
    start:{ mirror:10 },
    good:{ mirror:0.6, focus:0.2 },
    bad:{ mirror:-0.5, focus:-0.8, cort:1.6 },
    badText:'你太早知道好看有用，于是不太想努力。',
    crisis:{ age:13, text:'有人夸你，也有人因为这张脸找你麻烦。', eff:{ cort:6 }, tag:'被围观' }
  },
  {
    id:'body', n:'身体底子好', icon:'💪', rare:'R',
    desc:'很少生病，摔了也爬起来得快。',
    start:{ phy:12, res:6 },
    good:{ phy:0.8, res:0.3 },
    bad:{ phy:-0.5, cort:1 },
    badText:'身体好反而被当成"能扛"，作业写到十二点也没人心疼。',
    crisis:{ age:13, text:'你第一次熬夜到心悸，才知道底子也会用完。', eff:{ phy:-6, cort:6 }, tag:'透支' }
  }
];

LS.Talent = {
  all(){ return LS.TALENTS; },
  byId(id){ return LS.TALENTS.find(function(t){ return t.id === id; }) || null; },
  /* 出生时随机给 3 个候选 */
  offer(rnd){
    const pool = LS.TALENTS.slice();
    const out = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    }
    return out;
  },
  /* 出生时的一次性效果 */
  apply(st, id){
    const t = this.byId(id);
    if (!t || !st) return null;
    const b = st.brain;
    if (t.start) {
      if (t.start.iq) b.geneIQ = Math.round((b.geneIQ || 100) + t.start.iq);
      if (t.start.ndi) b.ndi = Math.min(100, (b.ndi || 0) + t.start.ndi);
      if (t.start.focus) b.focus = Math.min(100, (b.focus || 0) + t.start.focus);
      if (t.start.mirror) b.mirror = Math.min(100, (b.mirror || 0) + t.start.mirror);
      if (t.start.phy) b.phy = Math.min(100, (b.phy || 0) + t.start.phy);
      if (t.start.cort) b.cortisol = Math.max(0, (b.cortisol || 0) + t.start.cort);
      if (t.start.money && st.econ) st.econ.cash = Math.round((st.econ.cash + t.start.money) * 10) / 10;
    }
    st.talentId = id;
    return t;
  }
};
