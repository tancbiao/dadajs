/* 人生模拟器 · 系统库（金手指）
 * 每个系统有自己的一套属性面板（stats 映射到七大维度），
 * 以及一种核心机制（mechanic），机制会在引擎里被特殊处理。
 */
window.LS = window.LS || {};

/* mechanic 说明：
 * levelUp   经验升级 → 自由加点
 * deathReturn 死亡回归：死亡后复活并变强，解锁"找死"流派
 * signin    签到/挂机：每回合固定收益
 * gacha     抽卡：消耗资源换随机强度
 * sim       推演：可预知选项成功率，并额外获得情报收益
 * copy      复制：从遭遇对象身上复制能力
 * leech     掠夺：击杀/击败后永久吸取属性
 * rewind    回档：可撤销一次致命结果
 * fame      粉丝经济：声望滚雪球
 * wealth    财富复利：资源自我增值
 * quest     任务系统：每回合派发任务，完成给重赏
 * mindread  读心：看穿选项真实概率与隐藏代价
 * summon    召唤/御兽：随从持续成长
 * luck      气运：失败自动重掷一次
 * reverse   反向金手指：失败反而变强
 * analysis  数据化视野：显示成功率且暴击范围更大
 * pact      契约：高风险高回报，代价会累积
 * shop      积分商城：可用资源兑换属性
 * maker     系统制造师（特殊人生）
 */

LS.SYSTEMS = [
  {
    id:'attr_panel', name:'属性面板系统', icon:'📊', rarity:'R', tags:['成长','万能','经典'],
    tagline:'力量、敏捷、体质、智力——每一分努力都会变成数字。',
    desc:'十八岁生日那一刻，你眼前浮出一块半透明面板。它没有说明书，只有四个空荡荡的进度条。',
    mechanic:'levelUp', mechanicText:'行动积累经验，升级获得属性点，可自由加点。',
    stats:[
      {k:'str', n:'力量', dim:'战', init:12},
      {k:'agi', n:'敏捷', dim:'战', init:12},
      {k:'con', n:'体质', dim:'体', init:12},
      {k:'int', n:'智力', dim:'智', init:12}
    ],
    res:[{k:'exp', n:'经验', icon:'✦', init:0}, {k:'pt', n:'属性点', icon:'＋', init:0}],
    acts:[{id:'train', n:'锻炼身体', d:'把身体逼到极限，经验大增', eff:{res:{exp:26}, attrs:{con:1}}}],
    awaken:'【属性面板系统】已绑定。\n宿主当前等级：Lv.1。\n提示：所有努力，从此不会被辜负。'
  },
  {
    id:'death_return', name:'死亡回归系统', icon:'💀', rarity:'SSR', tags:['复活','战斗','找死流','暴力'],
    tagline:'死一次，就更强一次。',
    desc:'你第一次死亡时，世界倒退了三秒。第二次，倒退了七天。第三次，你已经不再害怕死亡这件事了。',
    mechanic:'deathReturn', mechanicText:'死亡不会结束游戏，而是复活并永久强化，死亡次数越多加成越高。',
    stats:[
      {k:'pow', n:'力量', dim:'战', init:14},
      {k:'vit', n:'体质', dim:'体', init:14},
      {k:'sen', n:'感知', dim:'灵', init:10}
    ],
    res:[{k:'deaths', n:'死亡次数', icon:'☠️', init:0}],
    acts:[{id:'seek', n:'主动找死', d:'去最危险的地方，用命换成长（极高风险，死亡必有重赏）', eff:{hp:-45, attrs:{pow:2}}, special:'seekDeath'}],
    awaken:'【死亡回归系统】已绑定。\n当前死亡次数：0。\n提示：你终于可以放心地去死了。'
  },
  {
    id:'top_student', name:'学霸系统', icon:'🎓', rarity:'SR', tags:['学习','知识','逆袭'],
    tagline:'所有题目，都有解法。',
    desc:'你翻开书的那一刻，字迹开始自己排列组合。系统在你脑内说：把知识当作武器，它们会保护你。',
    mechanic:'levelUp', mechanicText:'学习积累知识点，升级解锁"解题"——把任何困境当成一道题来解。',
    stats:[
      {k:'iq', n:'智力', dim:'智', init:15},
      {k:'mem', n:'记忆', dim:'智', init:13},
      {k:'foc', n:'专注', dim:'智', init:13},
      {k:'ins', n:'灵感', dim:'灵', init:11}
    ],
    res:[{k:'kp', n:'知识点', icon:'📘', init:0}, {k:'pt', n:'悟性点', icon:'＋', init:0}],
    acts:[{id:'study', n:'刷题三小时', d:'知识点 + 智力小涨', eff:{res:{kp:30}, attrs:{iq:1}}}],
    awaken:'【学霸系统】已绑定。\n首次任务：三十天内，考进年级前十。\n奖励：解锁"考场无敌"。'
  },
  {
    id:'rich_rebate', name:'神豪返利系统', icon:'💎', rarity:'SR', tags:['财富','都市','打脸'],
    tagline:'你花出去的每一分钱，都会加倍回来。',
    desc:'系统第一次给你打钱时，你在便利店门口站了十分钟，反复确认那串零不是幻觉。',
    mechanic:'wealth', mechanicText:'余额每年按比例生息，花得越狠，回得更快。',
    stats:[
      {k:'asset', n:'资产', dim:'财', init:20},
      {k:'conn', n:'人脉', dim:'社', init:12},
      {k:'fame', n:'声望', dim:'社', init:10}
    ],
    res:[{k:'money', n:'余额（万）', icon:'💰', init:100}],
    acts:[{id:'spend', n:'大额消费', d:'花掉一笔钱，声望上涨、返利翻倍', eff:{res:{money:-30}, attrs:{fame:2}, special:'rebate'}}],
    awaken:'【神豪返利系统】已绑定。\n到账：¥1,000,000.00\n提示：花钱吧，这是命令。'
  },
  {
    id:'daily_checkin', name:'签到打卡系统', icon:'📅', rarity:'R', tags:['挂机','稳健','签到'],
    tagline:'每天签到，风雨无阻。',
    desc:'它不承诺奇迹，只承诺复利。第一天签到给了一瓶水，第 300 天给的是一间铺面。',
    mechanic:'signin', mechanicText:'每年自动签到，连续签到天数越多，奖励越丰厚。',
    stats:[
      {k:'luck', n:'气运', dim:'运', init:13},
      {k:'vit', n:'体质', dim:'体', init:12}
    ],
    res:[{k:'days', n:'签到天数', icon:'🗓️', init:0}, {k:'pt', n:'积分', icon:'🎁', init:0}],
    acts:[{id:'sign', n:'签到', d:'当日签到，积分 + 气运微涨', eff:{special:'signin'}}],
    awaken:'【签到打卡系统】已绑定。\n第 1 天签到成功。\n奖励：矿泉水 ×1、面包 ×2、随机属性 +1。'
  },
  {
    id:'mall', name:'万界商城系统', icon:'🛒', rarity:'SR', tags:['兑换','资源','成长'],
    tagline:'万物皆有价，只看你付不付得起。',
    desc:'商城货架上摆着神兵、丹药、寿命和一段别人的记忆。标价用的不是钱，是你自己。',
    mechanic:'shop', mechanicText:'用积分兑换属性与保命道具，商品每年刷新。',
    stats:[
      {k:'point', n:'积分', dim:'财', init:50},
      {k:'eye', n:'眼力', dim:'智', init:12}
    ],
    res:[{k:'credits', n:'商城积分', icon:'🧾', init:120}],
    acts:[{id:'trade', n:'逛商城', d:'刷新商品并有机会捡漏', eff:{special:'shopRefresh'}}],
    awaken:'【万界商城系统】已绑定。\n新手礼包：商城积分 120。\n提示：本商城不收退款。'
  },
  {
    id:'gacha', name:'抽卡成神系统', icon:'🎴', rarity:'SR', tags:['运气','抽卡','爆装'],
    tagline:'十连保底，一切皆有可能。',
    desc:'你抽到的第一张卡是"普通人（N）"。系统沉默了三秒，说：再来一次吧。',
    mechanic:'gacha', mechanicText:'消耗抽卡券抽取卡牌，可能得到属性、道具或一次性神迹。',
    stats:[
      {k:'fortune', n:'欧气', dim:'运', init:12},
      {k:'pool', n:'卡池深度', dim:'灵', init:6}
    ],
    res:[{k:'ticket', n:'抽卡券', icon:'🎟️', init:5}],
    acts:[{id:'draw', n:'抽一次', d:'消耗 1 张券，随机获得收益', eff:{special:'gacha'}}],
    awaken:'【抽卡成神系统】已绑定。\n赠送：抽卡券 ×5。\n提示：非酋也有春天。'
  },
  {
    id:'simulator', name:'人生模拟器', icon:'🕯️', rarity:'SSR', tags:['预知','谋略','回溯'],
    tagline:'先活一遍，再真的活一遍。',
    desc:'你在梦里活了三十七种人生，每一种都死得很难看。醒来时，你记住了每一种死法。',
    mechanic:'sim', mechanicText:'可推演选项结果（显示成功率），并获得额外情报收益。',
    stats:[
      {k:'cause', n:'因果', dim:'运', init:12},
      {k:'fore', n:'预知', dim:'灵', init:14},
      {k:'wis', n:'阅历', dim:'智', init:13}
    ],
    res:[{k:'sim', n:'推演次数', icon:'🔮', init:3}],
    acts:[{id:'simulate', n:'推演未来', d:'消耗 1 次推演，看穿本回合所有选项的成败概率', eff:{special:'simulate'}}],
    awaken:'【人生模拟器】已绑定。\n剩余推演次数：3。\n提示：你即将看见自己的一百种死法。'
  },
  {
    id:'copy', name:'万物复制系统', icon:'🪞', rarity:'SSR', tags:['复制','成长','万能'],
    tagline:'看一眼，就是我的了。',
    desc:'你第一次复制，是巷口那只野猫的夜视能力。第二次，是一个将死之人的剑法。',
    mechanic:'copy', mechanicText:'每次重大遭遇后可复制一项能力，转化为永久属性。',
    stats:[
      {k:'pow', n:'力量', dim:'战', init:12},
      {k:'vit', n:'体质', dim:'体', init:12}
    ],
    res:[{k:'slots', n:'复制槽', icon:'🧬', init:2}],
    acts:[{id:'copynow', n:'扫描并复制', d:'扫描附近目标，复制其长处（消耗 1 槽）', eff:{special:'copy'}}],
    awaken:'【万物复制系统】已绑定。\n当前复制槽：2/2。\n提示：不要看镜子太久。'
  },
  {
    id:'plunder', name:'掠夺进化系统', icon:'🩸', rarity:'SR', tags:['战斗','进化','残酷'],
    tagline:'杀死什么，就成为什么。',
    desc:'第一次掠夺后，你的指甲缝里三天都洗不干净。但你确实变强了，这让你害怕，也让你上瘾。',
    mechanic:'leech', mechanicText:'击败对手后永久吸取其属性，杀戮越多越强。',
    stats:[
      {k:'plunder', n:'掠夺值', dim:'战', init:10},
      {k:'evo', n:'进化度', dim:'体', init:10}
    ],
    res:[{k:'kills', n:'掠夺次数', icon:'🩸', init:0}],
    acts:[{id:'hunt', n:'外出狩猎', d:'寻找猎物并掠夺（失败会受伤）', eff:{special:'hunt'}}],
    awaken:'【掠夺进化系统】已绑定。\n提示：目标不限物种。'
  },
  {
    id:'rewind', name:'无限回档系统', icon:'⏪', rarity:'SSR', tags:['回档','试错','安全'],
    tagline:'错了就重来，反正没人记得。',
    desc:'它可以让你回到五分钟前。代价是——只有你记得那些被抹掉的死亡。',
    mechanic:'rewind', mechanicText:'致命时刻自动回档，每次回档保留记忆并微幅强化。',
    stats:[
      {k:'cause', n:'因果', dim:'运', init:13},
      {k:'mem', n:'记忆', dim:'智', init:13}
    ],
    res:[{k:'rw', n:'回档次数', icon:'⏳', init:2}],
    acts:[{id:'savepoint', n:'设置存档点', d:'把当前状态钉死，下次死亡可无损回到此刻', eff:{special:'savepoint'}}],
    awaken:'【无限回档系统】已绑定。\n剩余回档次数：2。\n提示：存档点建议设在活着的时候。'
  },
  {
    id:'stream', name:'直播打赏系统', icon:'📺', rarity:'R', tags:['人气','都市','社牛'],
    tagline:'你的每一次社死，都有人刷火箭。',
    desc:'系统在你眼前挂了个在线人数：3。三分钟后变成 3000。你还没搞清发生了什么。',
    mechanic:'fame', mechanicText:'粉丝每年增长，粉丝越多收益越高，也可能引来麻烦。',
    stats:[
      {k:'fans', n:'粉丝', dim:'社', init:50},
      {k:'heat', n:'热度', dim:'社', init:10},
      {k:'talk', n:'口才', dim:'社', init:12}
    ],
    res:[{k:'coin', n:'打赏（元）', icon:'🎁', init:0}],
    acts:[{id:'live', n:'开一场直播', d:'涨粉、赚打赏，偶尔翻车', eff:{special:'live'}}],
    awaken:'【直播打赏系统】已绑定。\n在线人数：3。\n弹幕：这主播有点东西。'
  },
  {
    id:'demon_pact', name:'恶魔契约系统', icon:'😈', rarity:'SR', tags:['契约','代价','黑化'],
    tagline:'你要什么都可以，代价我来定。',
    desc:'它从不骗人，条款写得清清楚楚。问题在于，你每次只看了前半句。',
    mechanic:'pact', mechanicText:'可主动签约换取暴增，但每次签约累积"代价"，代价过高会反噬。',
    stats:[
      {k:'power', n:'力量', dim:'战', init:13},
      {k:'debt', n:'代价', dim:'灵', init:0},
      {k:'soul', n:'灵魂完整度', dim:'灵', init:100}
    ],
    res:[{k:'pacts', n:'契约数', icon:'📜', init:0}],
    acts:[{id:'sign', n:'签一份契约', d:'属性大增，代价 +20（有反噬风险）', eff:{special:'pact'}}],
    awaken:'【恶魔契约系统】已绑定。\n甲方：你。乙方：不告诉你。\n第一条：随时可以终止（本条不实）。'
  },
  {
    id:'quest_sys', name:'任务发布系统', icon:'📋', rarity:'R', tags:['任务','稳定','目标'],
    tagline:'完成它，你就比昨天强一点。',
    desc:'每天早上七点，任务准时出现。第一天是"喝一杯水"，第七天是"辞掉这份工作"。',
    mechanic:'quest', mechanicText:'每年派发一个任务，完成给重赏，失败扣气运。',
    stats:[
      {k:'done', n:'完成度', dim:'智', init:10},
      {k:'will', n:'意志', dim:'体', init:12}
    ],
    res:[{k:'qp', n:'任务点', icon:'✅', init:0}],
    acts:[{id:'check', n:'查看并执行任务', d:'推进当前任务进度', eff:{special:'quest'}}],
    awaken:'【任务发布系统】已绑定。\n今日任务：活到明天。\n奖励：随机属性 +1。'
  },
  {
    id:'affix', name:'词条成神系统', icon:'🔤', rarity:'SSR', tags:['词条','构筑','后期强'],
    tagline:'给自己叠词条，直到无解。',
    desc:'你的第一个词条是【耐饿】。第二个是【夜视】。第一百个是【不可名状】。',
    mechanic:'gacha', mechanicText:'获得随机的"词条"，词条永久生效并可叠加，品质越高越离谱。',
    stats:[
      {k:'affix', n:'词条数', dim:'灵', init:0},
      {k:'quality', n:'词条品质', dim:'运', init:10}
    ],
    res:[{k:'roll', n:'洗练次数', icon:'🎲', init:3}],
    acts:[{id:'roll', n:'洗练词条', d:'消耗 1 次，随机获得一条词条', eff:{special:'gacha'}}],
    awaken:'【词条成神系统】已绑定。\n获得词条：【凡人之躯（白）】。\n提示：一切伟大都从白词条开始。'
  },
  {
    id:'rent', name:'收租系统', icon:'🏠', rarity:'R', tags:['财富','躺平','稳健'],
    tagline:'躺着，钱自己会来。',
    desc:'你名下忽然多了三套房。系统说：这不算什么，真正的收租是收整条街的租。',
    mechanic:'wealth', mechanicText:'房产每年增值并产生租金，房产越多收益越夸张。',
    stats:[
      {k:'house', n:'房产', dim:'财', init:3},
      {k:'rent', n:'年租金（万）', dim:'财', init:12}
    ],
    res:[{k:'cash', n:'现金（万）', icon:'💵', init:50}],
    acts:[{id:'buy', n:'买一套房', d:'现金换房产，长期收益更高', eff:{special:'buyhouse'}}],
    awaken:'【收租系统】已绑定。\n名下房产：3 套（来源不明）。\n提示：本月租金已到账。'
  },
  {
    id:'mindread', name:'读心术系统', icon:'🧠', rarity:'SR', tags:['情报','社交','算计'],
    tagline:'他们嘴上说的，和心里想的，你都听得见。',
    desc:'第一次读心时你听见邻居在想"要不要把她埋进花坛"。你搬走了，但他还在那儿。',
    mechanic:'mindread', mechanicText:'看穿选项的真实概率与隐藏代价，社交类判定大幅加成。',
    stats:[
      {k:'insight', n:'洞察', dim:'智', init:14},
      {k:'heart', n:'人心', dim:'社', init:13}
    ],
    res:[{k:'mp', n:'精神力', icon:'🌀', init:60}],
    acts:[{id:'read', n:'读心', d:'消耗精神力，窥探周围人的真实意图', eff:{special:'mindread'}}],
    awaken:'【读心术系统】已绑定。\n提示：建议不要读你最亲近的人。'
  },
  {
    id:'sequence', name:'序列扮演系统', icon:'🃏', rarity:'SSR', tags:['诡秘','序列','扮演'],
    tagline:'扮演得越像，你越不是你。',
    desc:'系统给了你一个序列名和一个角色。它说：演好他，你就会成为他；演砸了，你就疯了。',
    mechanic:'levelUp', mechanicText:'扮演积累"扮演度"，可消化魔药晋升序列，但理智会持续下降。',
    stats:[
      {k:'seq', n:'序列', dim:'灵', init:9},
      {k:'spirit', n:'灵性', dim:'灵', init:14},
      {k:'sanity', n:'理智', dim:'智', init:80},
      {k:'act', n:'扮演度', dim:'灵', init:0}
    ],
    res:[{k:'potion', n:'魔药（份）', icon:'🧪', init:1}],
    acts:[{id:'act', n:'投入扮演', d:'扮演度大增，理智下降', eff:{special:'act'}}],
    awaken:'【序列扮演系统】已绑定。\n初始序列：9 - 观众。\n守则：不要看观众席第四排。'
  },
  {
    id:'cultivation', name:'灵力修仙系统', icon:'☯️', rarity:'SR', tags:['修真','长生','境界'],
    tagline:'灵力是水的形状，境界是岸。',
    desc:'系统在你丹田里点了一盏灯。它说：灯灭之前，你得学会自己发光。',
    mechanic:'levelUp', mechanicText:'吐纳积累灵力，灵力满可突破境界，境界决定寿元与上限。',
    stats:[
      {k:'qi', n:'灵力', dim:'灵', init:10},
      {k:'realm', n:'境界', dim:'灵', init:1},
      {k:'dao', n:'道心', dim:'智', init:12}
    ],
    res:[{k:'stone', n:'灵石', icon:'🔹', init:10}],
    acts:[{id:'meditate', n:'吐纳打坐', d:'灵力 + 道心微涨', eff:{res:{stone:3}, attrs:{qi:2}}}],
    awaken:'【灵力修仙系统】已绑定。\n境界：炼气一层。\n提示：寿元 +10 年。'
  },
  {
    id:'beast', name:'御兽系统', icon:'🐺', rarity:'SR', tags:['伙伴','战斗','养成'],
    tagline:'你不是一个人在战斗。',
    desc:'第一只契约兽是只三条腿的流浪狗。它救过你两次命，后来成了整片荒野的王。',
    mechanic:'summon', mechanicText:'契约兽随年份成长，替你承担伤害并提供战力。',
    stats:[
      {k:'beast', n:'兽宠战力', dim:'战', init:12},
      {k:'bond', n:'亲和', dim:'社', init:13}
    ],
    res:[{k:'beasts', n:'兽宠数量', icon:'🐾', init:1}],
    acts:[{id:'tame', n:'捕捉/培养兽宠', d:'尝试契约新兽，亲和越高越容易', eff:{special:'tame'}}],
    awaken:'【御兽系统】已绑定。\n初始兽宠：三条腿的流浪狗（F 级）。\n提示：它很饿。'
  },
  {
    id:'arms', name:'军火商人系统', icon:'🔫', rarity:'SR', tags:['交易','末世','灰色'],
    tagline:'战争里最安全的位置，是卖子弹的人。',
    desc:'系统给你一条进货渠道，价格好得离谱。你只问了一句：货从哪来？它说：别问。',
    mechanic:'wealth', mechanicText:'库存与渠道双向增值，乱世里财富增长速度翻倍。',
    stats:[
      {k:'stock', n:'库存', dim:'财', init:15},
      {k:'channel', n:'渠道', dim:'社', init:12},
      {k:'fire', n:'火力', dim:'战', init:12}
    ],
    res:[{k:'cash', n:'资金', icon:'💵', init:200}],
    acts:[{id:'deal', n:'做一笔生意', d:'低买高卖，也可能遇到黑吃黑', eff:{special:'deal'}}],
    awaken:'【军火商人系统】已绑定。\n启动资金已到账。\n提示：别把货卖给认识你的人。'
  },
  {
    id:'luckychild', name:'气运之子系统', icon:'🍀', rarity:'SSR', tags:['运气','躺赢','离谱'],
    tagline:'你不需要赢，世界会输给你。',
    desc:'你掉下悬崖捡到秘籍，摔进河里漂到宝库。系统说：这不是运气，这是设定。',
    mechanic:'luck', mechanicText:'所有失败判定自动重掷一次，机缘事件概率大增。',
    stats:[
      {k:'luck', n:'气运', dim:'运', init:20},
      {k:'boon', n:'福缘', dim:'运', init:15}
    ],
    res:[{k:'fate', n:'天命值', icon:'🌠', init:10}],
    acts:[{id:'wish', n:'顺应天命', d:'消耗天命值，强行把一次结果扭向好的方向', eff:{special:'wish'}}],
    awaken:'【气运之子系统】已绑定。\n提示：从现在开始，倒霉的会是别人。'
  },
  {
    id:'reverse', name:'反向金手指系统', icon:'🕳️', rarity:'SR', tags:['反转','受苦','极限'],
    tagline:'你越惨，你越强。',
    desc:'系统第一次发威，是在你被打断三根肋骨之后。它说：恭喜，力量 +8。',
    mechanic:'reverse', mechanicText:'所有失败结果都会转化为属性成长，越倒霉越强。',
    stats:[
      {k:'bad', n:'倒霉值', dim:'运', init:0},
      {k:'res', n:'抗性', dim:'体', init:14}
    ],
    res:[{k:'scar', n:'伤痕', icon:'🩹', init:0}],
    acts:[{id:'suffer', n:'主动找罪受', d:'自找苦吃，倒霉值与属性同时上涨', eff:{hp:-18, attrs:{res:2}, res:{scar:1}}}],
    awaken:'【反向金手指系统】已绑定。\n检测到宿主当前运势：极差。\n评价：完美。'
  },
  {
    id:'idle', name:'挂机成神系统', icon:'😴', rarity:'R', tags:['挂机','稳健','省心'],
    tagline:'你睡觉的时候，它也在替你努力。',
    desc:'你什么都没做，等级却在涨。系统说：本系统专为懒人设计。',
    mechanic:'signin', mechanicText:'每年自动获得大量经验与属性，主动行动收益减半——躺着也行。',
    stats:[
      {k:'lv', n:'等级', dim:'战', init:1},
      {k:'exp', n:'经验', dim:'战', init:0},
      {k:'rate', n:'倍率', dim:'财', init:1}
    ],
    res:[{k:'hour', n:'挂机时长', icon:'⏱️', init:0}],
    acts:[{id:'idle', n:'继续挂机', d:'什么都不做，收益照拿', eff:{res:{hour:100}, attrs:{exp:10}}}],
    awaken:'【挂机成神系统】已绑定。\n在线时长：0 小时。\n提示：本系统支持离线收益。'
  },
  {
    id:'card', name:'卡牌决斗系统', icon:'🃏', rarity:'SR', tags:['策略','对战','构筑'],
    tagline:'人生是一副牌，你刚好会算。',
    desc:'你抽到的第一张牌是【沉默】。后来你发现，这张牌在对人说谎时特别好用。',
    mechanic:'gacha', mechanicText:'抽卡构筑卡组，卡牌可在现实中一次性发动。',
    stats:[
      {k:'deck', n:'卡组强度', dim:'战', init:12},
      {k:'tactic', n:'策略', dim:'智', init:14}
    ],
    res:[{k:'card', n:'卡牌（张）', icon:'🃏', init:6}],
    acts:[{id:'drawcard', n:'抽一张牌', d:'消耗 1 张卡位，随机获得新卡', eff:{special:'gacha'}}],
    awaken:'【卡牌决斗系统】已绑定。\n初始手牌：6 张。\n提示：规则由强者解释。'
  },
  {
    id:'food', name:'美食系统', icon:'🍜', rarity:'R', tags:['日常','治愈','社交'],
    tagline:'一碗热汤，能解决一半的问题。',
    desc:'系统给了你一份菜谱。你照着做，隔壁三年没说过话的邻居敲门问：这是什么味道？',
    mechanic:'shop', mechanicText:'烹饪换取金钱与人脉，食物可临时提升属性。',
    stats:[
      {k:'cook', n:'厨艺', dim:'社', init:13},
      {k:'ingr', n:'食材', dim:'财', init:10}
    ],
    res:[{k:'dish', n:'菜品', icon:'🍲', init:0}],
    acts:[{id:'cook', n:'做一桌菜', d:'消耗食材，换取金钱、人脉与临时增益', eff:{special:'cook'}}],
    awaken:'【美食系统】已绑定。\n初始菜谱：蛋炒饭（完美级）。\n提示：饥饿的人最好说话。'
  },
  {
    id:'maingod', name:'主神空间系统', icon:'🎬', rarity:'SSR', tags:['轮回','任务','残酷'],
    tagline:'欢迎来到主神空间。请在一分钟内完成选择。',
    desc:'你被拉进一个纯白空间，光球说：完成十场轮回，你可以许一个愿。',
    mechanic:'quest', mechanicText:'强制轮回任务，完成获得强化点，失败将被抹除。',
    stats:[
      {k:'point', n:'轮回点', dim:'财', init:100},
      {k:'power', n:'强化等级', dim:'战', init:10},
      {k:'survive', n:'生还场次', dim:'体', init:0}
    ],
    res:[{k:'tp', n:'奖励点', icon:'🔷', init:100}],
    acts:[{id:'exchange', n:'兑换强化', d:'用奖励点换取永久属性', eff:{special:'exchange'}}],
    awaken:'【主神空间系统】已绑定。\n第一场轮回即将开始：\n《丧尸围城 · 生存七十二小时》'
  },
  {
    id:'timeloop', name:'时间循环系统', icon:'🔄', rarity:'SSR', tags:['循环','解谜','试错'],
    tagline:'同一天，你已经过了三百次。',
    desc:'第一次循环你死于火灾，第二次死于人心，第三百次你终于记住了每一个人的名字。',
    mechanic:'rewind', mechanicText:'死亡后回到本年初，保留全部记忆与部分属性，可反复试错。',
    stats:[
      {k:'loop', n:'循环次数', dim:'运', init:0},
      {k:'mem', n:'记忆强度', dim:'智', init:14}
    ],
    res:[{k:'laps', n:'剩余循环', icon:'🔄', init:3}],
    acts:[{id:'remember', n:'整理记忆', d:'把上一轮的经验变成属性', eff:{special:'remember'}}],
    awaken:'【时间循环系统】已绑定。\n当前循环：第 1 次。\n提示：这一次，别再犯同样的错。'
  },
  {
    id:'dataeye', name:'数据化视野', icon:'👓', rarity:'R', tags:['分析','情报','冷静'],
    tagline:'万物皆有数值。',
    desc:'你看见每个人头顶浮着血条和一行小字：友善度 12。你忽然理解了很多人。',
    mechanic:'analysis', mechanicText:'显示选项成功率，暴击范围更大，判定更稳定。',
    stats:[
      {k:'scan', n:'扫描精度', dim:'智', init:14},
      {k:'calm', n:'冷静', dim:'智', init:13}
    ],
    res:[{k:'energy', n:'能量', icon:'🔋', init:80}],
    acts:[{id:'scan', n:'深度扫描', d:'分析环境与对手弱点', eff:{special:'scan'}}],
    awaken:'【数据化视野】已绑定。\n扫描结果：宿主综合评分 12（满分 1000）。\n建议：多练。'
  },
  {
    id:'charm', name:'万人迷系统', icon:'💗', rarity:'SR', tags:['社交','魅力','人情'],
    tagline:'你开口，别人就愿意。',
    desc:'系统说：你不需要变强，你只需要被人喜欢。你当时觉得这话很轻浮，后来发现它是对的。',
    mechanic:'fame', mechanicText:'魅力影响一切社交判定，人脉会自动为你解决问题。',
    stats:[
      {k:'charm', n:'魅力', dim:'社', init:17},
      {k:'peach', n:'桃花', dim:'运', init:12},
      {k:'net', n:'人脉', dim:'社', init:13}
    ],
    res:[{k:'fan', n:'追随者', icon:'💞', init:5}],
    acts:[{id:'social', n:'出席一场场合', d:'结识关键人物，人脉与粉丝上涨', eff:{special:'socialize'}}],
    awaken:'【万人迷系统】已绑定。\n提示：从今天起，你说的每句话都自带回音。'
  },
  {
    id:'maker', name:'系统制造师·天赋', icon:'🛠️', rarity:'SSR', tags:['制造师','创造','元系统'],
    tagline:'别人抽系统，你造系统。',
    desc:'你能看见"系统"这种东西的源代码。它们像一团团发光的线，你可以剪断、拼接、重新命名。',
    mechanic:'maker', mechanicText:'可亲手设计系统并投入系统库，供其他人生抽取；制造师自身以灵感、工艺、算力为面板。',
    stats:[
      {k:'inspired', n:'灵感', dim:'灵', init:18},
      {k:'craft', n:'工艺', dim:'智', init:15},
      {k:'compute', n:'算力', dim:'财', init:12}
    ],
    res:[{k:'made', n:'已造系统', icon:'🧩', init:0}, {k:'mat', n:'素材', icon:'🧱', init:30}],
    acts:[{id:'design', n:'设计一个系统', d:'消耗素材，创造新系统并入库', eff:{special:'designSystem'}}],
    awaken:'【系统制造师】天赋觉醒。\n你看见了这个世界的底层：\n成千上万条发光的线，正在寻找宿主。'
  }
];

LS.systemById = function(id){
  const all = (LS.SYSTEMS || []).concat((LS.Store && LS.Store.systems) || []);
  return all.find(function(s){ return s.id === id; }) || null;
};
LS.allSystems = function(){
  return (LS.SYSTEMS || []).concat((LS.Store && LS.Store.systems) || []);
};
