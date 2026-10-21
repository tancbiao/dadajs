/* 本地存档：人生路径 / 事件片段缓存 / 自制系统 / API 配置 */
window.LS = window.LS || {};

(function(){
  const K = {
    paths:'ls.paths.v1',
    snips:'ls.snips.v1',
    systems:'ls.systems.v1',
    api:'ls.api.v1',
    fav:'ls.fav.v1',
    research:'ls.research.v1'
  };

  function read(key, def){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : def;
    }catch(e){ return def; }
  }
  function write(key, val){
    try{
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    }catch(e){
      console.warn('[store] 写入失败，可能空间已满', e);
      return false;
    }
  }
  function uid(prefix){
    return (prefix||'') + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  }

  const Store = {
    paths: [],       // 已结束的人生路径
    snips: {},       // AI 生成的事件片段缓存 { key: [variant...] }
    systems: [],     // 玩家自制系统
    fav: [],         // 收藏的路径 id
    research: [],    // 玩家自创的系统用法

    init(){
      this.paths = read(K.paths, []);
      this.snips = read(K.snips, {});
      this.systems = read(K.systems, []);
      this.fav = read(K.fav, []);
      this.research = read(K.research, []);
      if (!Array.isArray(this.research)) this.research = [];
      if (!Array.isArray(this.paths)) this.paths = [];
      if (!Array.isArray(this.systems)) this.systems = [];
      if (!this.snips || typeof this.snips !== 'object') this.snips = {};
    },

    uid: uid,

    /* ---------- 系统自制库 ---------- */
    saveSystem(sys){
      sys.custom = true;
      const i = this.systems.findIndex(function(s){ return s.id === sys.id; });
      if (i >= 0) this.systems[i] = sys; else this.systems.push(sys);
      write(K.systems, this.systems);
      return sys;
    },
    removeSystem(id){
      this.systems = this.systems.filter(function(s){ return s.id !== id; });
      write(K.systems, this.systems);
    },

    /* ---------- 路径 ---------- */
    savePath(path){
      if (!path.id) path.id = uid('p_');
      const i = this.paths.findIndex(function(p){ return p.id === path.id; });
      if (i >= 0) this.paths[i] = path; else this.paths.push(path);
      // 只保留最近 400 条，防止本地爆掉
      if (this.paths.length > 400) this.paths = this.paths.slice(-400);
      write(K.paths, this.paths);
      return path;
    },
    getPath(id){
      return this.paths.find(function(p){ return p.id === id; }) || null;
    },
    ratePath(id, stars, note){
      const p = this.getPath(id);
      if (!p) return;
      p.ratingCount = (p.ratingCount || 0) + 1;
      p.ratingSum = (p.ratingSum || 0) + stars;
      p.rating = p.ratingSum / p.ratingCount;
      if (note) p.note = note;
      p.ratedAt = Date.now();
      write(K.paths, this.paths);
    },
    toggleFav(id){
      const i = this.fav.indexOf(id);
      if (i >= 0) this.fav.splice(i,1); else this.fav.push(id);
      write(K.fav, this.fav);
    },

    /* 某世界观+某系统的口碑（用于"少刷"低分路径） */
    comboStats(worldId, systemId){
      let sum = 0, n = 0;
      this.paths.forEach(function(p){
        if (p.worldId === worldId && p.systemId === systemId && p.ratingCount) {
          sum += p.ratingSum; n += p.ratingCount;
        }
      });
      return n ? { avg: sum/n, n: n } : { avg: 0, n: 0 };
    },
    /* 口碑低于 2.6 且样本≥2 → 降权 */
    comboPenalty(worldId, systemId){
      const st = this.comboStats(worldId, systemId);
      if (st.n >= 2 && st.avg < 2.6) return 0.25;
      if (st.n >= 2 && st.avg < 3.4) return 0.6;
      return 1;
    },

    /* ---------- 事件片段缓存 ---------- */
    snipKey(parts){
      return [parts.worldId, parts.systemId, parts.age, parts.kind || 'evt'].join('|');
    },
    getSnip(key){
      const arr = this.snips[key];
      if (!arr || !arr.length) return null;
      // 优先高分片段
      const pool = [];
      arr.forEach(function(v){
        const w = Math.max(1, Math.round((v.score || 3) * 2));
        for (let i=0;i<w;i++) pool.push(v);
      });
      return pool[Math.floor(Math.random()*pool.length)];
    },
    addSnip(key, rec){
      if (!this.snips[key]) this.snips[key] = [];
      const arr = this.snips[key];
      // 同标题去重
      if (arr.some(function(v){ return v.title === rec.title; })) return;
      arr.push(rec);
      if (arr.length > 6) arr.shift();
      // 控制总键数
      const keys = Object.keys(this.snips);
      if (keys.length > 900) {
        delete this.snips[keys[0]];
      }
      write(K.snips, this.snips);
    },
    rateSnip(key, title, delta){
      const arr = this.snips[key];
      if (!arr) return;
      const v = arr.find(function(x){ return x.title === title; });
      if (v) { v.score = Math.min(5, Math.max(1, (v.score||3) + delta)); write(K.snips, this.snips); }
    },
    snipCount(){
      let n = 0;
      for (const k in this.snips) n += this.snips[k].length;
      return n;
    },

    /* ---------- API 配置 ---------- */
    apiCfg(){
      // 本机私有配置（js/config.local.js）作为默认值；设置页保存的值覆盖它
      const local = (typeof LS.LOCAL_CONFIG === 'object' && LS.LOCAL_CONFIG) ? LS.LOCAL_CONFIG : {};
      const def = Object.assign({
        base:'https://api.deepseek.com',   // 官方：base_url 不带 /v1
        model:'deepseek-flash',            // DeepSeek-V4.1-Flash-1017
        key:'',
        proxy:'',
        temp:0.95,
        mode:'auto',                       // auto | always | offline
        budget:60,
        thinking:'disabled',               // 游戏关掉思考模式：快、省、正文不跑偏
        jsonMode:true
      }, local);
      const saved = read(K.api, null) || {};
      const out = Object.assign({}, def, saved);
      // 空值不覆盖内置配置，避免"清空输入框"把内置 Key 弄没
      if (!saved.key) out.key = def.key || '';
      if (!saved.base) out.base = def.base;
      if (!saved.model) out.model = def.model;
      return out;
    },
    saveApiCfg(cfg){ write(K.api, cfg); },

    /* ---------- 玩家自创用法 ---------- */
    addResearch(rec){
      if (!rec || !rec.idea) return;
      const same = this.research.some(function(x){
        return x.systemId === rec.systemId && x.idea === rec.idea;
      });
      if (same) return;
      rec.at = Date.now();
      this.research.push(rec);
      if (this.research.length > 300) this.research = this.research.slice(-300);
      write(K.research, this.research);
    },
    researchFor(systemId){
      return this.research.filter(function(x){ return x.systemId === systemId; }).slice(-5).reverse();
    },

    /* ---------- 导入导出 ---------- */
    exportAll(){
      return {
        v: LS.VERSION,
        at: new Date().toISOString(),
        paths: this.paths,
        systems: this.systems,
        snips: this.snips
      };
    },
    importAll(obj){
      if (!obj) return '空数据';
      let n = 0;
      if (Array.isArray(obj.paths)) { this.paths = this.paths.concat(obj.paths).slice(-400); write(K.paths, this.paths); n += obj.paths.length; }
      if (Array.isArray(obj.systems)) {
        const ids = this.systems.map(function(s){ return s.id; });
        obj.systems.forEach(function(s){ if (ids.indexOf(s.id) < 0) { s.custom = true; this.systems.push(s); } }, this);
        write(K.systems, this.systems); n += obj.systems.length;
      }
      if (obj.snips && typeof obj.snips === 'object') {
        const self = this;
        Object.keys(obj.snips).forEach(function(k){
          if (!self.snips[k]) self.snips[k] = obj.snips[k];
        });
        write(K.snips, this.snips);
      }
      return '已导入 ' + n + ' 项';
    }
  };

  LS.Store = Store;
})();
