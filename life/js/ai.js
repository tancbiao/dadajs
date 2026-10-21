/* AI 导演：DeepSeek / 任意 OpenAI 兼容接口
 * 关键点：优先走「本地 server.js 中转」以避免浏览器 CORS 问题。
 */
window.LS = window.LS || {};

(function(){
  const AI = {
    calls: 0,

    cfg(){ return LS.Store.apiCfg(); },

    available(){
      const c = this.cfg();
      if (c.mode === 'offline') return false;
      return !!(c.key || c.proxy);
    },

    mode(){
      const c = this.cfg();
      if (c.mode === 'offline') return 'offline';
      if (!this.available()) return 'offline';
      return c.mode; // auto | always
    },

    /* 底层请求
     * 官方文档（2026）：base_url = https://api.deepseek.com，模型 deepseek-flash
     * 思考模式默认开启 —— 游戏里显式关掉，否则又慢又贵，还会挤掉正文。
     * JSON Output 用 response_format:{type:'json_object'}，prompt 里必须出现 json 字样与样例。
     */
    async chat(messages, opt){
      opt = opt || {};
      const c = this.cfg();
      if (!this.available()) throw new Error('尚未配置 API');

      const thinking = opt.thinking || c.thinking || 'disabled';
      const useJSON = opt.json !== false && c.jsonMode !== false;
      const body = {
        model: c.model || 'deepseek-flash',
        messages: messages,
        max_tokens: opt.maxTokens || 1400,
        stream: false,
        thinking: { type: thinking }
      };
      // 思考模式下 temperature 不生效，就不传了
      if (thinking !== 'enabled') {
        body.temperature = opt.temp != null ? opt.temp : (c.temp != null ? c.temp : 0.95);
      }
      if (useJSON) body.response_format = { type: 'json_object' };

      // 只有本机（localhost）才自动走同源中转；线上静态站直连 DeepSeek（官方已放开 CORS）
      let proxy = c.proxy;
      if (!proxy && typeof location !== 'undefined' &&
          /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
        proxy = '/api/chat';
      }

      let url, headers = { 'Content-Type':'application/json' };
      if (proxy) {
        url = proxy.replace(/\/$/, '');
        if (!/\/api\/chat$/.test(url)) url += '/api/chat';
        body._base = c.base;
        body._key = c.key;
      } else {
        url = (c.base || 'https://api.deepseek.com').replace(/\/$/, '') + '/chat/completions';
        headers['Authorization'] = 'Bearer ' + c.key;
      }

      const ctrl = new AbortController();
      const timer = setTimeout(function(){ ctrl.abort(); }, opt.timeout || 60000);

      for (let attempt = 0; attempt < 2; attempt++) {
        let res;
        try {
          res = await fetch(url, { method:'POST', headers: headers, body: JSON.stringify(body), signal: ctrl.signal });
        } catch (e) {
          clearTimeout(timer);
          throw new Error('网络请求失败（可能是 CORS 或未启动本地服务器）');
        }
        if (!res.ok) {
          clearTimeout(timer);
          const t = await res.text().catch(function(){ return ''; });
          throw new Error('接口返回 ' + res.status + '：' + t.slice(0, 200));
        }
        const data = await res.json();
        const msg = data && data.choices && data.choices[0] && data.choices[0].message;
        const txt = msg ? msg.content : '';
        // 文档说明：JSON Output 有概率返回空 content，重试一次
        if (!txt && attempt === 0) continue;
        clearTimeout(timer);
        if (!txt) throw new Error('接口返回为空');
        this.calls++;
        return txt;
      }
      throw new Error('接口返回为空');
    },

    /* 从模型回复里抠出 JSON */
    parseJSON(txt){
      if (!txt) throw new Error('空回复');
      let s = txt.trim();
      s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      try { return JSON.parse(s); } catch(e){}
      const a = s.indexOf('{'), b = s.lastIndexOf('}');
      if (a >= 0 && b > a) {
        try { return JSON.parse(s.slice(a, b+1)); } catch(e){}
      }
      throw new Error('JSON 解析失败');
    },

    statsText(sys, attrs, res){
      const arr = [];
      (sys.stats||[]).forEach(function(st){
        arr.push(st.n + ' ' + Math.round((attrs[st.k]||0)*10)/10 + '(' + st.dim + ')');
      });
      (sys.res||[]).forEach(function(r){
        if (res && res[r.k] != null) arr.push(r.n + ' ' + Math.round(res[r.k]));
      });
      return arr.join('，');
    },

    /* ============ 生成一个成年事件 ============ */
    async genEvent(ctx){
      const s = ctx.state, w = ctx.world, sys = ctx.system;
      const attrKeys = (sys.stats||[]).map(function(x){ return x.k + '(' + x.n + '/' + x.dim + ')'; }).join('、');
      const recent = (ctx.recent || []).slice(-4).join('；') || '（刚成年）';
      const sys_prompt = [
        '你是一部中文文字人生模拟游戏的"世界导演"。你的文字克制、有画面感、带一点冷幽默，绝不解释游戏规则。',
        '你只输出 JSON，不要任何多余文字。'
      ].join('\n');

      const user = [
        '【世界观】' + w.name + '（' + (w.era||'') + '，危险度 ' + w.danger + '/5）：' + w.brief,
        '【可用地名】' + (w.places||[]).join('、'),
        '【可用威胁】' + (w.threats||[]).join('、'),
        '【可用人物】' + (w.npcs||[]).join('、'),
        '【玩家】' + s.name + '，' + s.age + '岁，' + (s.gender==='f'?'女':'男') + '，出生于' + s.birthplace + '。',
        '【持有系统】' + sys.name + '：' + (sys.tagline||'') + '（机制：' + (sys.mechanicText||'') + '）',
        '【面板】' + this.statsText(sys, s.attrs, s.res),
        '【核心维度】战=' + ctx.dims['战'] + ' 智=' + ctx.dims['智'] + ' 体=' + ctx.dims['体'] + ' 社=' + ctx.dims['社'] + ' 运=' + ctx.dims['运'] + ' 财=' + ctx.dims['财'] + ' 灵=' + ctx.dims['灵'],
        '【近年经历】' + recent,
        '',
        '【他走过的一生（必须承接，不许重复写过的剧情）】',
        ctx.memory || '（无）',
        '写作要求：这一年的故事要能从上面找到至少一处回响——提过的人、结过的仇、欠下的债、选过的路。',
        '',
        '请写'+ s.age +'岁这一年发生的一件事，并给出 3 个选项。要求：',
        '1. 标题 4-8 个汉字；正文 70-130 字，第二人称"你"，必须有具体场景与感官细节。',
        '2. 三个选项路线不同（硬碰/取巧/退让/交易/情感等），最多一个直接使用系统机制；选项要有真实代价，不要都给好处。',
        '3. 每个选项给一个判定维度 dim（只能是 战/智/体/社/运/财/灵 之一）与难度 dc（18-38 的整数），并写成功/失败结果各 50-90 字，两者必须不同且都能推进故事。',
        '4. 数值：attrs 用系统属性 key（' + attrKeys + '），增减 -3~+4；hp 增减 -35~+10；res 用系统资源 key，增减保守。',
        '',
        '只输出如下 JSON：',
        '{"title":"","text":"","options":[{"name":"","dim":"智","dc":24,"success":"","fail":"","eff":{"attrs":{},"hp":0,"res":{},"tags":[]},"effFail":{"attrs":{},"hp":0,"res":{},"tags":[]}}]}'
      ].join('\n');

      const txt = await this.chat([
        { role:'system', content: sys_prompt },
        { role:'user', content: user }
      ], { maxTokens: 1500, temp: 1.0 });

      const j = this.parseJSON(txt);
      return this.normalizeEvent(j);
    },

    normalizeEvent(j){
      if (!j || !j.title) throw new Error('事件结构不完整');
      const opts = (j.options || j.opts || []).slice(0,3).map(function(o, i){
        const dim = LS.DIMS[o.dim] ? o.dim : '智';
        return {
          n: String(o.name || o.n || ('选择' + (i+1))).slice(0, 24),
          dim: dim,
          dc: Math.max(12, Math.min(50, parseInt(o.dc, 10) || 24)),
          s: String(o.success || o.s || '').slice(0, 400),
          f: String(o.fail || o.f || '').slice(0, 400),
          eff: AI.normEff(o.eff),
          effF: AI.normEff(o.effFail || o.effF)
        };
      });
      if (opts.length < 2) throw new Error('选项不足');
      return {
        title: String(j.title).slice(0, 16),
        text: String(j.text || '').slice(0, 500),
        opts: opts,
        source: 'ai'
      };
    },

    normEff(e){
      e = e || {};
      const out = { attrs:{}, hp:0, res:{}, tags:[] };
      if (e.attrs && typeof e.attrs === 'object') {
        Object.keys(e.attrs).forEach(function(k){
          const v = Number(e.attrs[k]);
          if (!isNaN(v) && v !== 0) out.attrs[k] = Math.max(-8, Math.min(10, v));
        });
      }
      out.hp = Math.max(-40, Math.min(30, Number(e.hp) || 0));
      if (e.res && typeof e.res === 'object') {
        Object.keys(e.res).forEach(function(k){
          const v = Number(e.res[k]);
          if (!isNaN(v) && v !== 0) out.res[k] = v;
        });
      }
      if (Array.isArray(e.tags)) out.tags = e.tags.slice(0,3).map(function(t){ return String(t).slice(0,8); });
      return out;
    },

    /* ============ 审核玩家自创的系统用法 ============ */
    async genResearch(ctx){
      const s = ctx.state, sys = ctx.system, w = ctx.world;
      const user = [
        '你是这款人生模拟游戏的"规则裁判"。玩家想自己发明一种系统用法，你来判断它在规则内是否成立。',
        '',
        '【系统】' + sys.name + '（' + (sys.tagline||'') + '）',
        '机制：' + (sys.mechanicText||'') + '（内部类型 ' + sys.mechanic + '）',
        '面板：' + this.statsText(sys, s.attrs, s.res),
        '【玩家】' + s.name + '，' + s.age + '岁，在' + w.name + '。',
        '【他的想法】' + ctx.idea,
        '',
        '判断要求：',
        '1. feasible：这个用法是否在系统规则内说得通（true/false）。',
        '2. score：成立程度 0-100。明显超出机制上限的（无限、无代价、直接无敌）压低到 40 以下；有取舍、有代价、钻规则空子的给 60-90。',
        '3. reason：30-70 字，说明为什么成立或不成立，要具体到机制，不要说教。',
        '4. effect：如果成立，给出一次性的收益（attrs 用系统属性 key，数值保守 -3~+5；res 少量；hp 0~+10）。',
        '5. dim：这个用法长期练下去，主要练哪一维，只能取 战/智/体/社/运/财/灵 之一。',
        '6. action：把这个用法压成一个可以反复做的"动作名"，2-6 字，动词开头（例：磨刀、装死、听墙根、压价）。',
        '',
        '只输出 JSON：',
        '{"feasible":true,"score":72,"dim":"战","action":"磨刀","reason":"","effect":{"label":"一句话命名这个用法","attrs":{},"res":{},"hp":0}}'
      ].join('\n');

      const txt = await this.chat([
        { role:'system', content:'你是严谨但不乏味的规则裁判，只输出 json。' },
        { role:'user', content: user }
      ], { maxTokens: 700, temp: 0.7 });

      const j = this.parseJSON(txt);
      const eff = this.normEff(j.effect || {});
      return {
        feasible: !!j.feasible,
        score: Math.max(0, Math.min(100, parseInt(j.score, 10) || 50)),
        reason: String(j.reason || '').slice(0, 240),
        label: String(j.action || (j.effect && j.effect.label) || '').slice(0, 20),
        dim: ['战','智','体','社','运','财','灵'].indexOf(j.dim) >= 0 ? j.dim : null,
        effect: eff,
        source: 'AI'
      };
    },

    /* ============ 让导演写完这一生 ============ */
    async genEnding(ctx){
      const s = ctx.state, w = ctx.world;
      const prompt = [
        '你是这款人生模拟游戏的世界导演。玩家死了，现在由你写最后一段。',
        '不要煽情，不要总结人生道理，只写具体的东西：一个物件、一个动作、一句没说完的话。',
        '',
        '【世界】' + (w ? w.name : '现代都市'),
        '【姓名】' + s.name + '，' + s.age + '岁',
        '【怎么结束的】' + (s.endReason || ''),
        '【他的一生】',
        ctx.memory || '',
        '',
        '写 120-180 字，第二人称，只输出纯文本，不要 JSON，不要标题。'
      ].join('\n');
      const txt = await this.chat([
        { role:'system', content:'你是克制、有画面感的中文叙事者，只输出正文。' },
        { role:'user', content: prompt }
      ], { maxTokens: 500, temp: 1.0 });
      return String(txt || '').trim();
    },

    /* ============ 生成一个系统 ============ */
    async genSystem(hint){
      const dims = '战/智/体/社/运/财/灵';
      const mechs = 'levelUp, deathReturn, signin, gacha, sim, copy, leech, rewind, fame, wealth, quest, mindread, summon, luck, reverse, analysis, pact, shop';
      const user = [
        '请设计一个中文网文风格的"系统"（金手指），要新颖、有梗、机制清晰。',
        hint ? ('用户灵感：' + hint) : '方向：脱离常见的签到/神豪，做一个有独特代价或独特玩法的系统。',
        '',
        '要求：',
        '1. name 4-8 字，以"系统"结尾；icon 一个 emoji；rarity 取 N/R/SR/SSR。',
        '2. tagline 一句话钩子（20 字内）；desc 60-100 字，第二人称，有画面。',
        '3. mechanic 必须取其一：' + mechs,
        '4. stats 2-4 个，每个含 k(英文小写)、n(中文名2-4字)、dim(取其一：' + dims + ')、init(8-20 的整数)。',
        '5. res 1-2 个资源，含 k/n/icon/init。',
        '6. acts 1-2 个动作，含 id/n/d(描述)/eff(可为空对象)。',
        '7. awaken 30-60 字的觉醒提示语，要有味道。',
        '',
        '只输出 JSON：',
        '{"name":"","icon":"","rarity":"SR","tagline":"","desc":"","mechanic":"levelUp","mechanicText":"","stats":[{"k":"","n":"","dim":"智","init":12}],"res":[{"k":"","n":"","icon":"✨","init":0}],"acts":[{"id":"","n":"","d":"","eff":{}}],"awaken":"","tags":[""]}'
      ].join('\n');

      const txt = await this.chat([
        { role:'system', content:'你是网文系统设定师，擅长把抽象的欲望变成有规则的游戏机制。只输出 JSON。' },
        { role:'user', content: user }
      ], { maxTokens: 1100, temp: 1.05 });

      const j = this.parseJSON(txt);
      if (!j.name) throw new Error('系统结构不完整');
      const sys = {
        id: 'cus_' + Date.now().toString(36),
        name: String(j.name).slice(0,12),
        icon: String(j.icon || '🧩').slice(0,3),
        rarity: LS.RARITY[j.rarity] ? j.rarity : 'SR',
        tagline: String(j.tagline || '').slice(0,40),
        desc: String(j.desc || '').slice(0,300),
        mechanic: j.mechanic || 'levelUp',
        mechanicText: String(j.mechanicText || '').slice(0,120),
        stats: (j.stats||[]).slice(0,4).map(function(st, i){
          return { k: String(st.k || ('s'+i)).replace(/[^a-z0-9_]/gi,'').toLowerCase() || ('s'+i),
                   n: String(st.n || '属性').slice(0,6),
                   dim: LS.DIMS[st.dim] ? st.dim : '智',
                   init: Math.max(5, Math.min(25, parseInt(st.init,10) || 12)) };
        }),
        res: (j.res||[]).slice(0,2).map(function(r, i){
          return { k: String(r.k || ('r'+i)).replace(/[^a-z0-9_]/gi,'').toLowerCase() || ('r'+i),
                   n: String(r.n || '资源').slice(0,6),
                   icon: String(r.icon || '✨').slice(0,3),
                   init: Number(r.init) || 0 };
        }),
        acts: (j.acts||[]).slice(0,2).map(function(a, i){
          return { id: String(a.id || ('act'+i)), n: String(a.n || '行动').slice(0,10), d: String(a.d || '').slice(0,60), eff: a.eff || {} };
        }),
        awaken: String(j.awaken || '').slice(0,200),
        tags: Array.isArray(j.tags) ? j.tags.slice(0,4) : ['自制'],
        custom: true
      };
      if (!sys.stats.length) throw new Error('系统缺少属性');
      return sys;
    },

    /* ============ 生成结局评语 ============ */
    async genEnding(ctx){
      const s = ctx.state, w = ctx.world, sys = ctx.system;
      const user = [
        '为下面这段人生写一段 60-110 字的结局定评（第二人称，克制、有余味，不要总结数值）：',
        '世界：' + w.name + '；系统：' + sys.name + '；',
        '人物：' + s.name + '，活到 ' + s.age + ' 岁，结局：' + ctx.reason + '。',
        '关键经历：' + (ctx.timeline || []).slice(-8).join('；'),
        '最后的面板：' + this.statsText(sys, s.attrs, s.res),
        '只输出一段文字，不要引号不要标题。'
      ].join('\n');
      const txt = await this.chat([
        { role:'system', content:'你是中文文学编辑，善写冷峻而有温度的收束。' },
        { role:'user', content: user }
      ], { maxTokens: 300, temp: 1.0 });
      return txt.trim().replace(/^["「]|["」]$/g,'').slice(0,300);
    }
  };

  LS.AI = AI;
})();
