/* 系统编辑器：手搓 / AI 生成 / 导入导出 */
window.LS = window.LS || {};

(function(){
  const ESC = function(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
  const MECHS = [
    ['levelUp','经验升级 · 自由加点'],
    ['deathReturn','死亡回归 · 死一次强一次'],
    ['signin','签到挂机 · 稳定复利'],
    ['gacha','抽卡 · 随机爆装'],
    ['sim','推演 · 预知成功率'],
    ['copy','复制 · 复制他人长处'],
    ['leech','掠夺 · 击杀吸取'],
    ['rewind','回档 · 撤销致命结果'],
    ['fame','声望 · 粉丝滚雪球'],
    ['wealth','财富 · 资源复利'],
    ['quest','任务 · 每年派发'],
    ['mindread','读心 · 看穿代价'],
    ['summon','御兽 · 随从成长'],
    ['luck','气运 · 失败重掷'],
    ['reverse','反向 · 越惨越强'],
    ['analysis','数据视野 · 稳定暴击'],
    ['pact','契约 · 高风险高代价'],
    ['shop','商城 · 积分兑换'],
    ['maker','制造师 · 造系统']
  ];

  const Editor = {
    draft:null,
    hint:'',
    msg:'',

    blank(){
      return {
        id:'cus_' + Date.now().toString(36),
        name:'', icon:'🧩', rarity:'SR',
        tagline:'', desc:'',
        mechanic:'levelUp', mechanicText:'',
        stats:[
          { k:'s1', n:'属性一', dim:'智', init:12 },
          { k:'s2', n:'属性二', dim:'体', init:12 }
        ],
        res:[{ k:'r1', n:'资源', icon:'✨', init:0 }],
        acts:[{ id:'act1', n:'使用一次', d:'描述这个动作', eff:{} }],
        awaken:'', tags:['自制'], custom:true
      };
    },

    fromSystem(id){
      const s = LS.systemById(id);
      if (!s) return this.blank();
      const c = JSON.parse(JSON.stringify(s));
      if (!c.custom) {
        c.id = 'cus_' + Date.now().toString(36);
        c.name = '（改）' + c.name;
        c.custom = true;
      }
      c.stats = c.stats || [];
      c.res = c.res || [];
      c.acts = c.acts || [];
      c.tags = c.tags || ['自制'];
      return c;
    },

    open(id){
      this.draft = id ? this.fromSystem(id) : this.blank();
      this.msg = '';
      LS.App.go('editor');
    },

    render(stage){
      if (!this.draft) this.draft = this.blank();
      const d = this.draft;
      const mine = LS.Store.systems.slice().reverse();
      stage.innerHTML = `
        <section class="panel">
          <div class="panel-head">
            <h1>系统编辑器</h1>
            <p class="muted">在这里定义一套专属面板和机制。保存后进入系统库，别人 18 岁时有可能抽到它。</p>
          </div>
          <div class="chip-row">
            <button class="chip on" data-act="ed:new">＋ 新建</button>
            <button class="chip" data-act="ed:ai">✨ AI 帮我设计</button>
            <button class="chip" data-act="ed:export">导出</button>
            <button class="chip" data-act="ed:import">导入</button>
          </div>
          ${this.msg?`<div class="ed-msg">${ESC(this.msg)}</div>`:''}

          <div class="ed-ai">
            <input id="aiHint" class="input" placeholder="AI 灵感（可留空）：例如 越写作业越强的系统 / 靠借债变强的系统" value="${ESC(this.hint)}">
            <button class="btn btn-ghost" data-act="ed:aigen">生成</button>
          </div>
        </section>

        <section class="panel">
          <div class="ed-basic">
            <div class="form-row"><label>名称</label><input class="input" data-f="name" value="${ESC(d.name)}" placeholder="例如：万物折旧系统" maxlength="12"></div>
            <div class="form-row"><label>图标</label><input class="input narrow" data-f="icon" value="${ESC(d.icon)}" maxlength="3"></div>
            <div class="form-row"><label>稀有度</label>
              <div class="seg">
                ${['N','R','SR','SSR'].map(function(r){ return `<button class="${d.rarity===r?'on':''}" data-act="ed:rar" data-val="${r}">${r}</button>`; }).join('')}
              </div>
            </div>
            <div class="form-row"><label>一句话</label><input class="input" data-f="tagline" value="${ESC(d.tagline)}" placeholder="「死一次，就更强一次。」" maxlength="30"></div>
            <div class="form-row col"><label>描述</label><textarea class="input" rows="3" data-f="desc" placeholder="这个系统是怎么来的？给宿主的第一印象是什么？">${ESC(d.desc)}</textarea></div>
            <div class="form-row"><label>核心机制</label>
              <select class="input" data-f="mechanic">
                ${MECHS.map(function(m){ return `<option value="${m[0]}" ${d.mechanic===m[0]?'selected':''}>${m[1]}</option>`; }).join('')}
              </select>
            </div>
            <div class="form-row col"><label>机制说明</label><input class="input" data-f="mechanicText" value="${ESC(d.mechanicText)}" placeholder="一句话说清玩家能做什么、代价是什么"></div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head row"><h2>属性面板</h2><button class="mini-btn" data-act="ed:addstat">＋ 加一条</button></div>
          <p class="muted small">每条属性要选一个维度（战/智/体/社/运/财/灵），事件判定会用它。</p>
          ${d.stats.map(function(s,i){
            return `<div class="ed-row">
              <input class="input xs" data-f="stat.n" data-i="${i}" value="${ESC(s.n)}" placeholder="名称">
              <select class="input xs" data-f="stat.dim" data-i="${i}">
                ${LS.DIM_LIST.map(function(x){ return `<option value="${x}" ${s.dim===x?'selected':''}>${x}</option>`; }).join('')}
              </select>
              <input class="input xs" type="number" data-f="stat.init" data-i="${i}" value="${s.init}" placeholder="初始">
              <input class="input xs" data-f="stat.k" data-i="${i}" value="${ESC(s.k)}" placeholder="key">
              <button class="mini-btn danger" data-act="ed:delstat" data-val="${i}">删</button>
            </div>`;
          }).join('')}
        </section>

        <section class="panel">
          <div class="panel-head row"><h2>资源</h2><button class="mini-btn" data-act="ed:addres">＋ 加一条</button></div>
          ${d.res.map(function(r,i){
            return `<div class="ed-row">
              <input class="input xs" data-f="res.n" data-i="${i}" value="${ESC(r.n)}" placeholder="名称">
              <input class="input xs" data-f="res.icon" data-i="${i}" value="${ESC(r.icon||'')}" placeholder="图标" maxlength="3">
              <input class="input xs" type="number" data-f="res.init" data-i="${i}" value="${r.init}" placeholder="初始">
              <input class="input xs" data-f="res.k" data-i="${i}" value="${ESC(r.k)}" placeholder="key">
              <button class="mini-btn danger" data-act="ed:delres" data-val="${i}">删</button>
            </div>`;
          }).join('')}
        </section>

        <section class="panel">
          <div class="form-row col"><label>觉醒提示语</label>
            <textarea class="input" rows="3" data-f="awaken" placeholder="【某某系统】已绑定。&#10;当前状态：……">${ESC(d.awaken)}</textarea>
          </div>
          <div class="form-row"><label>标签</label><input class="input" data-f="tags" value="${ESC((d.tags||[]).join(','))}" placeholder="用逗号分隔，例如 诡秘,战力,代价"></div>
          <button class="btn btn-primary btn-block" data-act="ed:save">保存进系统库</button>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>我造的系统（${mine.length}）</h2></div>
          ${mine.length?mine.map(function(s){
            return `<div class="ed-item">
              <span>${ESC(s.icon||'🧩')}</span>
              <span class="ed-item-main"><b>${ESC(s.name)}</b><i>${s.rarity} · ${ESC(s.mechanicText||'')}</i></span>
              <button class="mini-btn" data-act="ed:open" data-val="${s.id}">编辑</button>
              <button class="mini-btn danger" data-act="ed:del" data-val="${s.id}">删</button>
            </div>`;
          }).join(''):'<p class="muted">还没有。造一个，让它去别人的十八岁。</p>'}
        </section>
      `;

      // 输入同步
      stage.querySelectorAll('[data-f]').forEach(function(el){
        const handler = function(){
          const f = el.getAttribute('data-f');
          const i = el.getAttribute('data-i');
          const v = el.value;
          if (f === 'tags') { Editor.draft.tags = v.split(/[,，\s]+/).filter(Boolean); return; }
          if (f.indexOf('stat.') === 0) {
            const key = f.slice(5);
            Editor.draft.stats[+i][key] = (key === 'init') ? (parseInt(v,10)||0) : v;
            return;
          }
          if (f.indexOf('res.') === 0) {
            const key = f.slice(4);
            Editor.draft.res[+i][key] = (key === 'init') ? (parseInt(v,10)||0) : v;
            return;
          }
          Editor.draft[f] = v;
        };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
      });
    },

    handle(act, val){
      if (act.indexOf('ed:') !== 0) return false;
      const d = this.draft || (this.draft = this.blank());
      switch(act){
        case 'ed:new': this.draft = this.blank(); this.msg=''; break;
        case 'ed:open': this.draft = this.fromSystem(val); this.msg=''; break;
        case 'ed:rar': d.rarity = val; break;
        case 'ed:addstat':
          d.stats.push({ k:'s' + (d.stats.length+1), n:'新属性', dim:'智', init:12 });
          break;
        case 'ed:delstat': d.stats.splice(+val,1); break;
        case 'ed:addres':
          d.res.push({ k:'r' + (d.res.length+1), n:'新资源', icon:'✨', init:0 });
          break;
        case 'ed:delres': d.res.splice(+val,1); break;
        case 'ed:save': this.save(); return true;
        case 'ed:del':
          if (confirm('删除这个系统？已经抽到它的历史人生不会受影响。')) {
            LS.Store.removeSystem(val);
            this.msg = '已删除';
          }
          break;
        case 'ed:aigen':
          this.aiGen();
          return true;
        case 'ed:export':
          this.exportSheet();
          return true;
        case 'ed:import':
          this.importSheet();
          return true;
      }
      this.render(document.getElementById('stage'));
      return true;
    },

    save(){
      const d = this.draft;
      if (!d.name || !d.name.trim()) { this.msg = '先给系统起个名字。'; this.render(document.getElementById('stage')); return; }
      if (!d.stats.length) { this.msg = '至少留一条属性。'; this.render(document.getElementById('stage')); return; }
      d.name = d.name.trim().slice(0,12);
      d.custom = true;
      d.updatedAt = Date.now();
      if (!d.createdAt) d.createdAt = Date.now();
      if (!d.authorName) d.authorName = '你';
      LS.Store.saveSystem(d);
      this.msg = '已入库：《' + d.name + '》。它现在可能在别人的十八岁出现。';
      this.render(document.getElementById('stage'));
      LS.App.toast('系统已入库');
    },

    async aiGen(){
      const hintEl = document.getElementById('aiHint');
      const hint = hintEl ? hintEl.value.trim() : '';
      this.hint = hint;
      if (LS.AI.mode() === 'offline') {
        this.msg = '当前是离线模式，或还没配 API。可以先去设置里填 Key。';
        this.render(document.getElementById('stage'));
        return;
      }
      this.msg = 'AI 正在设计系统……';
      this.render(document.getElementById('stage'));
      try{
        const sys = await LS.AI.genSystem(hint || null);
        this.draft = sys;
        this.msg = '生成完毕，可以继续改，满意再保存。';
      }catch(e){
        this.msg = '生成失败：' + (e.message||e);
      }
      this.render(document.getElementById('stage'));
    },

    exportSheet(){
      const data = JSON.stringify(this.draft, null, 1);
      LS.App.sheet(`
        <div class="sheet-head"><b>导出这个系统</b><button class="icon-btn" data-act="closesheet">✕</button></div>
        <textarea class="input" rows="10" style="width:100%">${ESC(data)}</textarea>
        <p class="footnote">复制给别人，在"导入"里粘贴即可入库。</p>
      `);
    },

    importSheet(){
      LS.App.sheet(`
        <div class="sheet-head"><b>导入系统 JSON</b><button class="icon-btn" data-act="closesheet">✕</button></div>
        <textarea id="sysImport" class="input" rows="8" placeholder='粘贴 {"name":...}'></textarea>
        <button class="btn btn-primary btn-block" data-act="ed:doimport">导入并编辑</button>
      `);
      const self = this;
      document.querySelectorAll('[data-act="ed:doimport"]').forEach(function(b){
        b.onclick = function(){
          try{
            const obj = JSON.parse(document.getElementById('sysImport').value);
            if (!obj.name || !obj.stats) throw new Error('缺少 name / stats');
            obj.id = obj.id || ('cus_' + Date.now().toString(36));
            obj.custom = true;
            self.draft = obj;
            self.msg = '导入成功，检查后保存。';
            LS.App.closeSheet();
            self.render(document.getElementById('stage'));
          }catch(e){ LS.App.toast('导入失败：' + e.message); }
        };
      });
    }
  };

  LS.Editor = Editor;
})();
