/* MBTI 人格层
 * 16 型 × 稳定/浮动 = 32 种状态。
 * 成长阶段会变（每 8 岁重算一次），成年后变化变慢（系数 0.35）。
 */
window.LS = window.LS || {};

LS.MBTI_TYPES = {
  INTJ: { n:'建筑师', core:'先想清楚，再动手；不喜欢解释。',
    family:'父母多半要求高、话不多，家里的爱是"把事做好"而不是"抱一下"。',
    track:'少年时像个小大人，成年后在专业领域越走越深，朋友很少但都很久。' },
  INTP: { n:'逻辑学家', core:'什么都要问一句"为什么"，包括规则本身。',
    family:'家里要么很宽松，要么没人管；书和电脑比人更可靠。',
    track:'读书时靠兴趣驱动，偏科严重；成年后靠一门手艺吃饭，讨厌开会。' },
  ENTJ: { n:'指挥官', core:'目标先行，情绪靠后。',
    family:'父母强势或精于算计，他从小在"谁说了算"的氛围里长大。',
    track:'学生时代是班干部，成年后带团队，婚姻里也习惯做主。' },
  ENTP: { n:'辩论家', core:'先反驳，再理解；想法比执行多。',
    family:'家里话多、争论多，他学会用嘴保护自己。',
    track:'换过很多方向，四十岁后才可能沉下来做成一件事。' },
  INFJ: { n:'提倡者', core:'看得懂别人，却很难被人看懂。',
    family:'父母情绪不稳定或过度控制，他很早就学会察言观色、当家里的缓冲带。',
    track:'从小被夸懂事，成年后容易过度付出，中年后学会关门。' },
  INFP: { n:'调停者', core:'心里有一套标准，嘴上不太争。',
    family:'父母要么情感疏远、要么管得太细，他退进自己的世界。',
    track:'少年时像个局外人，成年后做与意义有关的事，最怕被安排。' },
  ENFJ: { n:'主人公', core:'把别人的情绪当成自己的责任。',
    family:'家里需要一个"让大家都好过"的人，他从小就是这个角色。',
    track:'学生时代人缘最好，成年后容易累，四十岁前后开始学拒绝。' },
  ENFP: { n:'竞选者', core:'热情来得快，去得也快。',
    family:'家里气氛热闹但不稳定，他学会用讨喜换安全。',
    track:'兴趣广泛、三分钟热度，若遇到对的人能做出很亮的事。' },
  ISTJ: { n:'物流师', core:'按规矩来，不出错就是赢。',
    family:'父母务实、节俭、讲责任，家里的口头禅是"别人家也一样"。',
    track:'成绩稳定、工作稳定、婚姻稳定，中年后突然怀疑这一切。' },
  ISFJ: { n:'守卫者', core:'记得所有人的喜好，唯独不记得自己想要什么。',
    family:'家里强调付出与懂事，他从小是"省心的那个孩子"。',
    track:'照顾父母、照顾伴侣、照顾孩子，五十岁后才发现自己没活过。' },
  ESTJ: { n:'总经理', core:'事情要有人管，那就我来管。',
    family:'父母讲秩序、讲面子，家里有明确的"该怎样"。',
    track:'一路当干部，成年后管控欲强，与子女关系紧张。' },
  ESFJ: { n:'执政官', core:'人和了，事才顺。',
    family:'家里人情往来多，他从小被带着走亲戚。',
    track:'热心、爱张罗，中年后被消耗得厉害，却不敢停下来。' },
  ISTP: { n:'鉴赏家', core:'少说话，多动手。',
    family:'父母不太管，也不太表达；他学会自己拆东西、自己解决问题。',
    track:'技术型路线，靠手艺立身，不爱社交但关键时刻靠得住。' },
  ISFP: { n:'探险家', core:'不喜欢被定义，喜欢就去做。',
    family:'家里要么太吵，要么太冷；他在自己的小世界里找到安稳。',
    track:'做手艺、做艺术、做服务，活得不算富但比较像自己。' },
  ESTP: { n:'企业家', core:'先干起来，边干边想。',
    family:'父母管不住或不想管，他很早就在外面混。',
    track:'年轻时要机会，中年后要么翻身要么欠债，人生波动大。' },
  ESFP: { n:'表演者', core:'活在当下，讨厌无聊。',
    family:'家里要么宠，要么乱；他很早就学会用讨喜换空间。',
    track:'人缘好、机会多，四十岁后开始为没存下的钱发愁。' }
};

/* 稳定 / 浮动 两档 */
LS.MBTI_STABLE = {
  A: { n:'稳定型', tag:'-A', desc:'情绪起伏不大，遇事能等一等。', effect:'皮质醇回落更快，成年后性格变化慢' },
  T: { n:'浮动型', tag:'-T', desc:'心里一直在打仗，容易反复。', effect:'压力下更容易走极端，性格可能中途改道' }
};

LS.MBTI = {
  /* 由脑发育与维度推人格：不是随机，是"你被养成了什么样" */
  of(st){
    const b = st.brain || {};
    const dims = st.dims || {};
    const social = (dims['社'] || 10) + (b.mirror || 42) * 0.6;
    const intro = (b.focus || 42) + (dims['灵'] || 10) * 1.2;
    const E = social >= intro ? 'E' : 'I';

    const N = ((b.ndi || 60) + (b.iq || 100) * 0.55) >= 100 ? 'N' : 'S';
    const F = ((b.cortisol || 30) < 62 && (b.mirror || 42) > 45) ? 'F' : 'T';
    const J = (b.focus || 42) >= 55 ? 'J' : 'P';

    const code = E + N + F + J;
    const stable = (b.cortisol || 0) < 60 && (b.ndi || 0) > 55 ? 'A' : 'T';
    const base = LS.MBTI_TYPES[code] || LS.MBTI_TYPES.ISTJ;
    return {
      code: code,
      stable: stable,
      full: code + LS.MBTI_STABLE[stable].tag,
      name: base.n,
      core: base.core,
      family: base.family,
      track: base.track,
      stableName: LS.MBTI_STABLE[stable].n,
      stableDesc: LS.MBTI_STABLE[stable].desc,
      effect: LS.MBTI_STABLE[stable].effect
    };
  }
};
