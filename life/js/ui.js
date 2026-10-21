/* 人生模拟器 · 界面与流程 v2 */
window.LS = window.LS || {};

(function(){
  const $ = function(s, r){ return (r||document).querySelector(s); };
  const esc = function(s){
    return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  };
  const nl2br = function(s){ return esc(s).replace(/\n/g,'<br>'); };

  const App = {
    screen:'home',
    create:{ gender:'m', name:'', maker:false, sysId:'' },
    aiWarned:false,

    init(){
      const self = this;
      if (typeof window !== 'undefined' && !this._hooked) {
        this._hooked = true;
        const flush = function(){
          try { if (LS.Game && LS.Game.state && !LS.Game.state.ended) LS.Game.saveRun(); } catch(e){}
        };
        window.addEventListener('beforeunload', flush);
        document.addEventListener('visibilitychange', function(){
          if (document.visibilityState === 'hidden') flush();
        });
      }
      this.bind();
      this.home();
    },

    bind(){
      const stage = $('#stage');
      stage.addEventListener('click', function(e){
        const el = e.target.closest('[data-act]');
        if (!el) return;
        App.handle(el.getAttribute('data-act'), el.getAttribute('data-val') || '', el);
      });
      $('#btnHome').addEventListener('click', function(){ App.home(); });
      $('#btnMenu').addEventListener('click', function(){ App.menu(); });
      const sheet = document.getElementById('sheet');
      if (sheet) sheet.addEventListener('click', function(e){
        const el = e.target.closest('[data-act]');
        if (!el) return;
        App.handle(el.getAttribute('data-act'), el.getAttribute('data-val') || '', el);
      });
      document.addEventListener('keydown', function(e){ if (e.key === 'Escape') App.closeSheet(); });
    },

    /* ---------------- 导航 ---------------- */
    home(){
      App.screen = 'home';
      this.applyTheme('modern');
      const st = LS.Store;
      const mode = LS.AI.mode();
      const modeText = mode === 'offline' ? '离线引擎' : (mode === 'always' ? '全 AI 导演' : 'AI + 缓存混合');
      $('#stage').innerHTML = `
        <section class="hero">
          <div class="hero-glow"></div>
          <div class="hero-mark">人生模拟器</div>
          <h1 class="hero-title">十八岁那年，<br>你觉醒了<b>系统</b>。</h1>
          <p class="hero-sub">出生不由你选 · 父母不由你选 · 只有活法能选</p>
          <div class="hero-stats">
            <div><b>${st.paths.length}</b><span>条人生已入库</span></div>
            <div><b>${st.snipCount()}</b><span>个剧情片段</span></div>
            <div><b>${LS.SYSTEMS.length + st.systems.length}</b><span>个系统</span></div>
          </div>
          ${(function(){
            var snap = LS.Store.loadRun ? LS.Store.loadRun() : null;
            if (!snap || !snap.state) return '';
            var s = snap.state;
            var where = s.system ? (s.worldName + ' · ' + (s.system.name||'')) : '尚未觉醒';
            return '<button class="resume-card" data-act="resume">' +
              '<span class="rc-tag">未完成的人生</span>' +
              '<b>' + esc(s.name||'无名') + ' · ' + s.age + ' 岁</b>' +
              '<i>' + esc(where) + '</i>' +
              '<em>继续 →</em></button>';
          })()}
          <button class="btn btn-primary btn-lg btn-block" data-act="go" data-val="create">出生</button>
          <button class="btn btn-ghost btn-block" data-act="slicegame">⏱️ 十分钟版 · 现代都市 18–40 岁</button>
          <div class="hero-links">
            <button class="link" data-act="go" data-val="paths">别人的人生</button>
            <span>·</span>
            <button class="link" data-act="go" data-val="library">系统库</button>
            <span>·</span>
            <button class="link" data-act="go" data-val="rank">排行榜</button>
          </div>
          <div class="mode-chip ${mode==='offline'?'off':'on'}">当前：${modeText}</div>
        </section>
        <section class="home-grid">
          <button class="tile" data-act="go" data-val="editor"><span class="tile-ico">🛠️</span><b>系统编辑器</b><i>自己造一个金手指</i></button>
          <button class="tile" data-act="go" data-val="paths"><span class="tile-ico">📜</span><b>人生路径库</b><i>读过别人的一生</i></button>
          <button class="tile" data-act="go" data-val="rank"><span class="tile-ico">🏆</span><b>排行榜</b><i>最离谱的人生</i></button>
          <button class="tile" data-act="go" data-val="settings"><span class="tile-ico">⚙️</span><b>设置</b><i>API / 存档 / 导出</i></button>
        </section>
        <p class="footnote">前十年的孩子，是被养出来的，不是自己选的。<br>十八岁以后，你才知道自己被杀成了什么形状。</p>
      `;
    },

    menu(){
      const items = [
        ['create','🎲','新的人生'], ['library','🧩','系统库'], ['editor','🛠️','系统编辑器'],
        ['paths','📜','路径库'], ['rank','🏆','排行榜'], ['settings','⚙️','设置']
      ];
      App.sheet(`
        <div class="sheet-head"><b>菜单</b><button class="icon-btn" data-act="closesheet">✕</button></div>
        <div class="menu-list">
          ${items.map(function(it){
            return `<button class="menu-item" data-act="go" data-val="${it[0]}"><span>${it[1]}</span>${it[2]}</button>`;
          }).join('')}
        </div>
        <div class="sheet-foot">v${LS.VERSION} · 本地存档，不上传服务器</div>
      `);
    },

    sheet(html){
      $('#sheetBody').innerHTML = html;
      $('#sheet').classList.add('show');
    },
    closeSheet(){ $('#sheet').classList.remove('show'); },

    toast(msg, ms){
      const t = $('#toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(this._tt);
      this._tt = setTimeout(function(){ t.classList.remove('show'); }, ms || 2200);
    },

    go(screen){
      this.closeSheet();
      if (screen === 'create') this.createScreen();
      else if (screen === 'library') this.library();
      else if (screen === 'rank') this.rank();
      else if (screen === 'paths') this.paths();
      else if (screen === 'settings') this.settings();
      else if (screen === 'editor') this.editor();
      else this.home();
      try { window.scrollTo({ top:0, behavior:'smooth' }); } catch(e){}
    },

    async handle(act, val, el){
      const G = LS.Game;
      switch(act){
        case 'go': this.go(val); break;
        case 'closesheet': this.closeSheet(); break;
        case 'gender':
          this.syncCreateForm(); this.create.gender = val; this.createScreen(); break;
        case 'maker':
          this.syncCreateForm(); this.create.maker = !this.create.maker; this.createScreen(); break;
        case 'clearsys':
          this.create.sysId = ''; this.createScreen(); break;
        case 'libfilter': this.library(val); break;
        case 'sysdetail': this.sysDetail(val); break;
        case 'start': {
          const nm = ($('#nameInput') && $('#nameInput').value || '').trim();
          this.create.name = nm.slice(0,8);
          this.startGame({ gender:this.create.gender, name:this.create.name || null, maker:this.create.maker, systemId:this.create.sysId || null, talent:this.create.talent || null });
          break;
        }
        case 'childnext':
          G.childNext(); this.game(); break;
        case 'fastchild': {
          let n = 0;
          while (G.phase === 'child' && G.pending && G.pending.kind === 'say' && n++ < 30) G.childNext();
          this.game();
          break;
        }
        case 'childopt':
          G.childChoose(parseInt(val,10)); this.game(); break;
        case 'awaken':
          this.doAwaken(); break;
        case 'beginadult':
          LS.Game.beginAdult(); this.beginYear(); break;
        case 'opt':
          this.doChoose(parseInt(val,10)); break;
        case 'autonext':
          G.autoResolve(); this.resultScreen(); break;
        case 'afterresult':
          await this.afterResult(); break;
        case 'free':
          this.doFree(val); break;
        case 'pickbuild':
          LS.Game.chooseBuild(val); this.awakenScreen(); break;
        case 'seekdeath':
          this.doSeekDeath(); break;
        case 'seekway': {
          const wid = (el && el.getAttribute && el.getAttribute('data-val')) || val;
          this.closeSheet();
          this.doSeekDeath(wid); break; }
        case 'backactions':
          this.actionsScreen(); break;
        case 'enterworld':
          await this.enterWorld(); break;
        case 'resume':
          this.resumeGame(); break;
        case 'picktalent':
          this.create.talent = val; this.createScreen(); break;
        case 'slicegame':
          LS.Game.newGame({ slice:true }); this.game(); break;
        case 'civstart': {
          const r = LS.Game.civStart(val);
          if (r && r.error) this.toast(r.error);
          else this.toast(String(r.text).replace(/\n+/g,' '), 2200);
          this.actionsScreen(); break;
        }
        case 'civpush': {
          const r = LS.Game.civPush();
          if (!r) break;
          if (r.error) { this.toast(r.error); break; }
          LS.Game.result = { title:'推动文明 · ' + LS.Game.state.civ.field, text:r.text, chips:r.chips, ok:true };
          LS.Game.phase = 'actionResult';
          this.actionResultScreen(); break;
        }
        case 'dostory':
          await this.doStory(); break;
        case 'aiending':
          await this.doAiEnding(); break;
        case 'doresearch':
          await this.doResearch(); break;
        case 'sysact':
          await this.doSystem(); break;
        case 'endyear':
          this.doEndYear(); break;
        case 'addpt':
          if (G.addPoint(val)) this.actionsScreen(); break;
        case 'rate':
          this.rate(parseInt(val,10)); break;
        case 'quickfeed':
          this.quickFeed(val); break;
        case 'replay':
          this.closeSheet(); this.replay(val); break;
        case 'pathdetail':
          this.pathDetail(val); break;
        case 'fav':
          LS.Store.toggleFav(val); this.paths(); break;
        case 'copycode':
          this.copyCode(); break;
        case 'restart':
          this.create.maker = false; this.create.sysId = '';
          this.createScreen(); break;
        case 'totallog':
          this.logSheet(); break;
        default:
          if (window.LS.Editor && LS.Editor.handle && LS.Editor.handle(act, val, el)) return;
      }
    },

    /* ---------------- 出生 ---------------- */
    syncCreateForm(){
      const nm = document.getElementById('nameInput');
      if (nm) this.create.name = nm.value.trim().slice(0,8);
    },

    createScreen(){
      this.screen = 'create';
      if (!this.create.offer && window.LS && LS.Talent) {
        this.create.offer = LS.Talent.offer(Math.random);
        this.create.talent = this.create.offer[0].id;
      }
      $('#stage').innerHTML = `
        <section class="panel">
          <div class="panel-head">
            <h2>出生</h2>
            <p class="muted">你会出生在 20XX 年的中国，一座普通城市。父母是谁、家里有没有钱、上哪所学校，都由不得你。</p>
          </div>
          <div class="world-brief">
            <b>🏙️ 现代都市 · 20XX 年</b>
            <p>十八岁之前你都在这里。十八岁之后会不会去别的地方——要看你那天遇上的是个什么系统。</p>
          </div>
          <div class="form-row">
            <label>天赋</label>
            <div class="talent-list">
              ${(this.create.offer || []).map((t) => `<button class="talent-chip ${this.create.talent===t.id?'on':''}" data-act="picktalent" data-val="${t.id}">
                <span class="tc-ico">${t.icon}</span>
                <b>${esc(t.n)}</b>
                <i>${esc(t.desc)}</i>
                </button>`).join('')}
            </div>
          </div>
          <div class="form-row">
            <label>名字</label>
            <input id="nameInput" class="input" maxlength="8" placeholder="留空则随机（${this.create.gender==='f'?'女':'男'}）" value="${esc(this.create.name)}">
          </div>
          <div class="form-row">
            <label>性别</label>
            <div class="seg">
              <button class="${this.create.gender==='m'?'on':''}" data-act="gender" data-val="m">男</button>
              <button class="${this.create.gender==='f'?'on':''}" data-act="gender" data-val="f">女</button>
            </div>
          </div>
          <div class="form-row">
            <label>命运</label>
            <button class="toggle ${this.create.maker?'on':''}" data-act="maker">
              <span class="dot"></span>
              系统制造师（罕见，6%）${this.create.maker?'· 已锁定':''}
            </button>
          </div>
          ${this.create.sysId ? `<div class="form-row"><label>指定系统</label><div class="chip-row"><span class="chip on">${esc((LS.systemById(this.create.sysId)||{}).name||'')}</span><button class="chip" data-act="go" data-val="library">换一个</button><button class="chip" data-act="clearsys">改回随机</button></div></div>` : ''}
          <button class="btn btn-primary btn-lg btn-block" data-act="start">出生</button>
          <p class="footnote">1–9 岁你什么都决定不了，全是家长安排。<br>10 岁以后你才开始有选项——能有几个，看你自己。</p>
        </section>
      `;
    },

    startGame(opts){
      LS.Game.newGame(opts);
      this.game();
    },

    /* ---------------- 主流程 ---------------- */
    game(){
      this.screen = 'game';
      const G = LS.Game, st = G.state;
      if (!st) { this.home(); return; }
      this.applyTheme(st.worldId);
      if (G.phase === 'awaken') { this.awakenScreen(); return; }
      if (G.phase === 'end') { this.ending(); return; }
      if (G.phase === 'adult') { this.beginYear(); return; }
      if (G.phase === 'actions') { this.actionsScreen(); return; }
      if (G.phase === 'actionResult') { this.actionResultScreen(); return; }
      if (G.phase === 'result') { this.resultScreen(); return; }
      if (G.phase === 'childResult') { this.childResultScreen(); return; }
      this.childScreen();
    },

    topbar(){
      const st = LS.Game.state;
      if (!st) return '';
      const sys = st.system;
      const iq = st.brain && st.brain.iq;
      return `
        <div class="game-top">
          <div class="gt-left">
            <span class="gt-age">${st.age} 岁</span>
            <span class="gt-world">${esc(st.worldName)}${st.travelRole ? ' · ' + esc(st.travelRole) : ''}</span>
          </div>
          <div class="gt-right">
            ${iq ? `<span class="gt-iq">IQ ${iq}</span>` : ''}
            ${sys ? `<span class="gt-sys rar-${sys.rarity}"><span>${sys.icon}</span>${esc(sys.name)}</span>` : `<span class="gt-sys dim">尚未觉醒</span>`}
          </div>
        </div>
      `;
    },

    eduLinesHtml(lines){
      if (!lines || !lines.length) return '';
      return `<div class="edu-lines">${lines.map(function(l){
        const t = String(l.t || '').replace(/\s*\n+\s*/g, ' ');
        return `<div class="edu-line ${l.good?'good':'bad'}">${esc(t.length>64 ? t.slice(0,64)+'…' : t)}</div>`;
      }).join('')}</div>`;
    },

    childScreen(){
      const G = LS.Game, st = G.state;
      const effOf = this.brainEffectText.bind(this);
      const it = G.pending;
      if (!it) { this.game(); return; }

      // 学校政策卡（无选项）
      if (it.kind === 'edu') {
        $('#stage').innerHTML = `
          ${this.topbar()}
          <section class="year-card edu-card">
            <div class="yc-age">${it.age} 岁 · 学校</div>
            <h2 class="ev-title">${esc(it.title)}</h2>
            <p class="narration">${nl2br(it.text)}</p>
            ${this.sciHtml(it.sci)}
            ${this.eduLinesHtml(it.policyLines)}
            ${this.eduLinesHtml(it.eduLines)}
            <button class="btn btn-primary btn-block" data-act="childnext">继续</button>
          </section>
          ${this.logBlock(4)}
        `;
        return;
      }

      // 1–5 岁速写卡
      if (it.kind === 'batch') {
        $('#stage').innerHTML = `
          ${this.topbar()}
          <section class="year-card">
            <div class="yc-age">${it.from}–${it.to} 岁</div>
            <div class="batch-lines">
              ${it.lines.map(function(l){ return `<p class="batch-line"><b>${l.age}</b>${esc(l.text)}</p>`; }).join('')}
            </div>
            <button class="btn btn-primary btn-block" data-act="childnext">继续</button>
            <button class="btn btn-ghost btn-block" data-act="fastchild">快进到下一件大事</button>
          </section>
          ${this.logBlock(4)}
        `;
        return;
      }

      if (it.kind === 'say') {
        $('#stage').innerHTML = `
          ${this.topbar()}
          <div class="year-card">
            <div class="yc-age">${it.age} 岁</div>
            <p class="narration">${nl2br(it.text)}</p>
            ${this.sciHtml(it.sci)}
            ${this.eduLinesHtml(it.eduLines)}
            <button class="btn btn-primary btn-block" data-act="childnext">继续</button>
            <button class="btn btn-ghost btn-block" data-act="fastchild">快进到下一件大事</button>
          </div>
          ${this.logBlock(4)}
        `;
        return;
      }

      $('#stage').innerHTML = `
        ${this.topbar()}
        <section class="year-card event">
          <div class="yc-age">${it.age} 岁 · ${it.age === 10 ? '第一次自己拿主意' : '你自己拿主意'}</div>
          <h2 class="ev-title">${esc(it.title)}</h2>
          <p class="narration">${nl2br(it.text)}</p>
          ${this.sciHtml(it.sci)}
          <div class="options">
            ${it.opts.map(function(o,i){
              return `<button class="opt" data-act="childopt" data-val="${i}">
                <span class="opt-idx">${'ABC'[i]}</span>
                <span class="opt-main"><b>${esc(o.n)}</b></span>
              </button>`;
            }).join('')}
          </div>
          ${it.locked ? `<p class="limited">你的脑子里没有第二个选项。</p>` : (it.limited ? `<p class="limited">你想不出别的办法了。</p>` : '')}
          ${this.eduLinesHtml(it.eduLines)}
        </section>
        ${this.logBlock(4)}
      `;
    },

    childResultScreen(){
      const G = LS.Game, r = G.result;
      $('#stage').innerHTML = `
        ${this.topbar()}
        <section class="year-card result">
          <div class="yc-age">${r.age} 岁 · ${esc(r.title)}</div>
          <p class="narration">${nl2br(r.text)}</p>
          ${r.eff ? `<div class="result-eff"><b>发育影响</b>${esc(this.brainEffectText(r.eff))}</div>` : ''}
          <button class="btn btn-primary btn-block" data-act="childnext">继续</button>
        </section>
        ${this.childMemories()}
      `;
    },

    childMemories(){
      const st = LS.Game.state;
      if (!st.childMemories.length) return '';
      const last = st.childMemories.slice(-3).reverse();
      return `<div class="mini-list">
        <div class="mini-head">已经做过的决定</div>
        ${last.map(function(m){
          return `<div class="mini-row"><span>${m.age}岁</span><b>${esc(m.title)}</b><i>${esc(m.choice)}</i></div>`;
        }).join('')}
      </div>`;
    },

    /* 发育条 */
    bar(label, v, mode){
      const pct = Math.max(2, Math.min(100, Math.round(v)));
      let cls = '';
      if (mode === 'bad') cls = v > 65 ? 'low' : v > 45 ? 'mid' : '';
      else cls = v < 30 ? 'low' : v < 50 ? 'mid' : '';
      return `<div class="rb-row">
        <span class="rb-l">${label}</span>
        <span class="rb-bar"><i class="${cls}" style="width:${pct}%"></i></span>
        <b>${Math.round(v)}</b>
      </div>`;
    },

    /* 18 岁的教育账本：让玩家看清哪些措施真的有用 */
    eduReportHtml(){
      const G = LS.Game, b = G.state.brain;
      const rows = G.eduReport();
      if (!rows.length) return '';
      const total = Math.round((b.eduIQ || 0) * 10) / 10;
      const gain = rows.filter(function(r){ return r.ndi > 0; }).map(function(r){ return r.name; });
      const stopped = rows.filter(function(r){ return r.status === 'stopped'; });
      let note;
      if (stopped.length) {
        note = '你享受过' + stopped.map(function(r){ return r.name; }).join('、') +
          '，但都被家长投诉打断了。学校永远选最安全的做法，代价由孩子承担。';
      } else if (gain.length) {
        note = gain.join('、') + ' 一路没被打断，这些才是真正长在脑子里的东西。';
      } else {
        note = '这一年年的政策都只是纸面上的，没落到你身上。';
      }
      return `<div class="rc-edu">
        <b>教育账本</b>
        ${rows.map(function(r){
          const amt = [];
          if (r.iq) amt.push('智力 ' + (r.iq>0?'+':'') + r.iq);
          if (r.ndi) amt.push('神经元 ' + (r.ndi>0?'+':'') + r.ndi);
          const st = r.status === 'stopped' ? ('投诉中断 @' + r.stoppedAge + '岁')
                   : r.status === 'ended' ? '已结束' : '仍在生效';
          return `<div class="re-row ${r.status}">
            <span>${esc(r.name)}${r.years ? ' · ' + r.years + ' 年' : ''}</span>
            <em class="${((r.iq||0)+(r.ndi||0))<0?'neg':''}">${esc(amt.join(' / '))}</em>
            <i>${esc(st)}</i>
          </div>`;
        }).join('')}
        <div class="re-sum">教育累计：智力 ${total>0?'+':''}${total}</div>
        <p class="re-note">${esc(note)}</p>
      </div>`;
    },

    awakenScreen(){
      const G = LS.Game, st = G.state;
      this.applyTheme(st.worldId);
      if (!st.system) {
        $('#stage').innerHTML = `${this.topbar()}
          <section class="year-card awaken">
            <div class="yc-age">18 岁 · 生日夜</div>
            <p class="narration">你在十八岁生日的夜里醒来。房间里什么都没变，除了你眼前多了一块只有你能看见的东西。</p>
            <button class="btn btn-primary btn-lg btn-block" data-act="awaken">触碰它</button>
          </section>`;
        return;
      }
      const sys = st.system, b = st.brain, p = G.panelData();
      const tier = b.tier || LS.BRAIN.tierOf(b.mastery);
      const verdict = LS.BRAIN.verdict(b);
      const builds = G.builds();
      const modsOf = this.buildModsText.bind(this);
      const selBuild = st.buildId || (builds[0] && builds[0].id);

      $('#stage').innerHTML = `
        ${this.topbar()}
        <section class="report-card">
          <div class="rc-head"><b>神经发育报告</b><span>18 岁</span></div>
          <div class="rc-iq">
            <b>${b.iq}</b>
            <i>智商 · 全国儿童均值 106</i>
          </div>
          <p class="rc-verdict">${esc(verdict)}</p>
          <div class="rc-bars">
            ${this.bar('神经元发育', b.ndi)}
            ${this.bar('皮质醇', b.cortisol, 'bad')}
            ${this.bar('专注力', b.focus)}
            ${this.bar('镜像神经元', b.mirror)}
            ${this.bar('体能', b.phy)}
            ${this.bar('抗压能力', b.res)}
          </div>
          <div class="rc-meta">
            <span>家庭：${esc(b.parent.name)}</span>
            <span>学校：${esc(b.school.name)}</span>
          </div>
          <div class="rc-mastery ${tier.key}">
            <b>系统掌握度 ${b.mastery}%</b>
            <i>${esc(tier.name)}</i>
            <p>${esc(tier.desc)}</p>
          </div>
          ${this.eduReportHtml()}
        </section>

        <section class="awaken-card rar-${sys.rarity}">
          <div class="aw-badge rar-${sys.rarity}">${sys.rarity}</div>
          <div class="aw-icon">${sys.icon}</div>
          <h2>${esc(sys.name)}</h2>
          <p class="aw-tag">「${esc(sys.tagline||'')}」</p>
          <div class="aw-awaken">${nl2br(sys.awaken||'')}</div>
          ${sys.mechanicText?`<div class="aw-mech"><b>核心机制</b>${esc(sys.mechanicText)}</div>`:''}
          <div class="stat-grid">
            ${p.stats.map(function(s){
              return `<div class="stat-box"><span>${esc(s.n)}</span><b>${s.v}</b><i>${s.dim}</i></div>`;
            }).join('')}
          </div>
        </section>

        ${st.travelText ? `<section class="world-strip">
          <span>${LS.worldById(st.worldId).icon} ${esc(st.worldName)}</span>
          <b>${esc(st.travelRole || '')}</b>
        </section>` : `<section class="world-strip stay">
          <span>🏙️ 现代都市</span>
          <b>你没有离开 · 运气好得不像话</b>
        </section>`}

        ${this.tropeCard()}

        <section class="build-card">
          <div class="bc-head"><b>选择系统开发路线</b><span>同一个系统，练法不同</span></div>
          <div class="build-list">
            ${builds.map(function(x){
              return `<button class="build ${selBuild===x.id?'on':''}" data-act="pickbuild" data-val="${x.id}">
                <span class="bd-top"><b>${esc(x.name)}</b><i>${esc(x.tag)}</i></span>
                <span class="bd-desc">${esc(x.desc)}</span>
                <span class="bd-mods">${esc(modsOf(x))}</span>
              </button>`;
            }).join('')}
          </div>
        </section>

        <button class="btn btn-primary btn-lg btn-block" data-act="beginadult">开始 18 岁以后的人生</button>
        <p class="footnote">${tier.key === 'none' || tier.key === 'low'
          ? '你盯着面板看了很久，只想到最直白的几种用法。'
          : '你看懂了它一部分逻辑，也知道该在什么时候按下去。'}</p>
      `;
    },

    doAwaken(){
      const res = LS.Game.awaken();
      this.toast('系统已绑定：' + res.system.name);
      if (LS.Game.state.travelText) { this.travelReveal(); return; }
      this.awakenScreen();
    },

    /* 穿越：整屏换世界 */
    travelReveal(){
      const G = LS.Game, st = G.state;
      const w = LS.worldById(st.worldId) || {};
      const cur = LS.worldMoney ? LS.worldMoney(w.id) : { n:'万', k:1 };
      const stars = '★'.repeat(Math.max(1, Math.min(5, w.danger || 1))) + '☆'.repeat(5 - Math.max(1, Math.min(5, w.danger || 1)));
      this.applyTheme(w.id);
      const isekaiEdu = st.econ ? st.econ.eduName : '';
      const LL = LS.Lore ? LS.Lore.get(w.id) : { chars:[], fanfic:[] };
      const loreInfo = LL.chars.length + ' 位人物 · ' + LL.fanfic.length + ' 条同人支线';
      $('#stage').innerHTML = `
        <section class="world-reveal">
          <div class="wr-rings"></div>
          <div class="wr-kicker">世界正在重写</div>
          <div class="wr-icon">${w.icon || '🌍'}</div>
          <h1 class="wr-name">${esc(w.name || '未知世界')}</h1>
          <p class="wr-era">${esc(w.era || '')}</p>
          <p class="wr-brief">${esc(w.brief || '')}</p>
          <div class="wr-facts">
            <div><span>你现在的身份</span><b>${esc(st.travelRole || '—')}</b></div>
            <div><span>这里的钱</span><b>${esc(cur.n)}（1 万 ≈ ${cur.k} ${esc(cur.n)}）</b></div>
            <div><span>这里的学历</span><b>${esc(isekaiEdu || '—')}</b></div>
            <div><span>危险等级</span><b class="danger">${stars}</b></div>
          </div>
          <div class="wr-buff">落地加成 · 全属性 +${st.flags.travelBoost || 0}%</div>
          <div class="wr-kb">知识库：${loreInfo}</div>
          <p class="wr-text">${nl2br(st.travelText || '')}</p>
          <button class="btn btn-primary btn-lg btn-block" data-act="enterworld">在这里活下去</button>
        </section>
      `;
    },

    async enterWorld(){
      const G = LS.Game, st = G.state, w = LS.worldById(st.worldId);
      const key = 'ls.lore.done.' + w.id;
      let done = false;
      try { done = localStorage.getItem(key) === '1'; } catch(e){}
      if (LS.AI.available() && !done && w.id !== 'modern') {
        $('#stage').innerHTML = '<section class="loading-card"><div class="spinner"></div><p>正在考据「' + esc(w.name) + '」的人物与势力……</p><p class="muted small">这份设定会存进知识库，之后再进这个世界不用重查。</p></section>';
        try {
          const lore = await LS.AI.genLore(w);
          if (lore) LS.Lore.merge(w.id, lore);
          try { localStorage.setItem(key, '1'); } catch(e){}
          this.toast('已收录 ' + ((lore && lore.chars && lore.chars.length) || 0) + ' 位人物', 1800);
        } catch(e) {
          this.toast('考据失败，先用内置设定：' + (e.message || e), 2600);
        }
      }
      this.awakenScreen();
    },

    tropeCard(){
      const st = LS.Game.state;
      if (!st || !st.tropes || !st.tropes.length || !LS.Tropes) return '';
      const list = st.tropes.map(function(id){ return LS.Tropes.byId(id); }).filter(Boolean);
      if (!list.length) return '';
      let html = '<section class="trope-card">' +
        '<div class="tc-head"><b>这个系统的常见活法</b><span>系统文套路</span></div>' +
        '<div class="tc-list">';
      list.forEach(function(t){
        html += '<div class="tc-item"><b>' + esc(t.n) + '</b><i>' + esc(t.core || '') + '</i>';
        html += '<div class="tc-routes">' + (t.routes || []).map(function(r){
          return '<span title="' + esc(r.d) + '">' + esc(r.n) + '</span>';
        }).join('') + '</div></div>';
      });
      html += '</div></section>';
      return html;
    },

    applyTheme(worldId){
      if (typeof document !== 'undefined' && document.body) {
        document.body.setAttribute('data-world', worldId || 'modern');
      }
    },

    async doAiEnding(){
      const G = LS.Game, st = G.state;
      const btn = document.querySelector('[data-act="aiending"]');
      if (btn) { btn.disabled = true; btn.textContent = '导演正在写……'; }
      try {
        const txt = await LS.AI.genEnding({ state: st, world: LS.worldById(st.worldId), memory: G.lifeMemory() });
        const epi = document.querySelector('.end-epi');
        if (epi && txt) epi.innerHTML = nl2br(txt);
        if (btn) btn.textContent = '再写一版';
      } catch(e) {
        this.toast('导演没接话：' + (e.message || e));
        if (btn) btn.textContent = '让导演写完这一段';
      }
      if (btn) btn.disabled = false;
    },

    resumeGame(){
      const G = LS.Game;
      const st = G.resumeRun();
      if (!st) { this.toast('没有可继续的人生'); this.home(); return; }
      this.applyTheme(st.worldId);
      this.screen = 'game';
      if (G.phase === 'event' && G.pending) { this.eventScreen(); return; }
      if (G.phase === 'actions') { this.actionsScreen(); return; }
      if (G.phase === 'awaken') { this.awakenScreen(); return; }
      if (G.phase === 'child') { this.childScreen(); return; }
      if (G.phase === 'childResult') { this.childResultScreen(); return; }
      if (G.phase === 'actionResult') { this.actionResultScreen(); return; }
      this.actionsScreen();
    },

    async beginYear(){
      const G = LS.Game;
      this.actionFeedback = null;
      $('#stage').innerHTML = `${this.topbar()}
        <section class="loading-card"><div class="spinner"></div><p>${G.state.age} 岁这年……</p></section>`;
      const ev = await G.startYear();
      if (!ev) { this.ending(); return; }
      if (G.lastAiError && !this.aiWarned) {
        this.aiWarned = true;
        this.toast('AI 调用失败，已切回离线：' + G.lastAiError, 3200);
      }
      this.eventScreen();
    },

    eventScreen(){
      const G = LS.Game, st = G.state, ev = G.pending;
      if (!ev) { this.game(); return; }
      const reveal = G.revealOdds();
      const tier = st.brain.tier || LS.BRAIN.tierOf(0);

      if (ev.kind === 'quiet') {
        $('#stage').innerHTML = `
          ${this.topbar()}
          <section class="year-card quiet-card">
            <div class="yc-age">${st.age} 岁</div>
            <h2 class="ev-title">${esc(ev.title)}</h2>
            <p class="narration">${nl2br(ev.text)}</p>
            <button class="btn btn-primary btn-block" data-act="afterresult">继续</button>
          </section>
          ${this.panelBlock()}
          ${this.logBlock(4)}
        `;
        return;
      }

      if (ev.auto) {
        $('#stage').innerHTML = `
          ${this.topbar()}
          <section class="year-card event">
            <div class="yc-age">${st.age} 岁 <span class="src-tag">${esc(ev.source||'')}</span></div>
            <h2 class="ev-title">${esc(ev.title)}</h2>
            <p class="narration">${nl2br(ev.text)}</p>
            ${this.sciHtml(ev.sci)}
            <div class="no-choice">你没有选择的余地。</div>
            <button class="btn btn-primary btn-block" data-act="autonext">继续</button>
          </section>
          ${this.panelBlock()}
          ${this.logBlock(4)}
        `;
        return;
      }

      $('#stage').innerHTML = `
        ${this.topbar()}
        <section class="year-card event">
          <div class="yc-age">${st.age} 岁 · 第 ${st.turn} 年 <span class="src-tag">${esc(ev.source||'')}</span></div>
          <h2 class="ev-title">${esc(ev.title)}</h2>
          <p class="narration">${nl2br(ev.text)}</p>
          ${this.sciHtml(ev.sci)}
          <div class="options">
            ${ev.opts.map(function(o,i){
              const p = (reveal && o.dim) ? Math.round(G.odds(o.dim, o.dc)*100) : null;
              return `<button class="opt" data-act="opt" data-val="${i}">
                <span class="opt-idx">${'ABC'[i]}</span>
                <span class="opt-main">
                  <b>${esc(o.n)}</b>
                  ${p != null ? `<i>成功率 <em class="${p>=60?'good':p>=35?'mid':'bad'}">${p}%</em></i>` : ''}
                </span>
              </button>`;
            }).join('')}
          </div>
          ${ev.limited ? `<p class="limited">你想不出别的办法。</p>` : ''}
        </section>
        ${this.panelBlock()}
        ${this.logBlock(4)}
      `;
    },

    resultScreen(){
      const G = LS.Game, st = G.state, r = G.result;
      const death = r.death;
      $('#stage').innerHTML = `
        ${this.topbar()}
        <section class="year-card result ${r.ok?'ok':'fail'}">
          <div class="yc-age">${st.age} 岁 · ${esc(r.title)} ${r.auto?'':(r.ok?'<span class="tag-ok">成功</span>':'<span class="tag-bad">失败</span>')}</div>
          <p class="narration">${nl2br(r.text)}</p>
          <div class="chips">${this.chipsHtml(r.chips)}</div>
          ${death && death.revived ? `<div class="revive">${nl2br(death.text)}</div>` : ''}
          ${death && death.ended ? `<div class="died">${nl2br(death.text)}</div>` : ''}
          <button class="btn btn-primary btn-block" data-act="afterresult">${death && death.ended ? '看看这一生' : '继续'}</button>
        </section>
        ${this.panelBlock()}
        ${this.logBlock(4)}
      `;
    },

    async afterResult(){
      const G = LS.Game, st = G.state;
      if (st.ended) {
        if (!st.pathSaved) G.endRun(st.endReason || '你的一生结束了');
        this.ending(); return;
      }
      const r = await G.afterEvent();
      if (r === 'end') { this.ending(); return; }
      if (r === 'event') { this.eventScreen(); return; }
      this.actionsScreen();
    },

    buildModsText(b){
      const m = (b && b.mods) || {};
      const out = [];
      if (m.gainMul) out.push('成长 ×' + m.gainMul);
      if (m.sysScale) out.push('系统能力 ×' + m.sysScale);
      if (m.apBonus) out.push('行动力 +' + m.apBonus);
      if (m.regen) out.push('回血 ×' + m.regen);
      if (m.deathGain) out.push('死亡收益 ×' + m.deathGain);
      if (m.decay) out.push('死法衰减 ' + m.decay + '^n');
      return out.length ? out.join(' · ') : '没有额外加成';
    },

    pathCard(){
      const G = LS.Game, st = G.state;
      if (!LS.Paths) return '';
      const defs = LS.Paths.all();
      const mine = st.paths || {};
      const rows = [];
      defs.forEach(function(def){
        const cur = mine[def.id];
        if (!cur) return;
        const step = def.stages[Math.min(cur.stage, def.stages.length) - 1];
        const pct = Math.round(cur.stage / def.stages.length * 100);
        rows.push('<div class="path-row">' +
          '<div class="pr-top"><b>' + def.icon + ' ' + esc(def.n) + '</b><span>' + cur.stage + '/' + def.stages.length + '</span></div>' +
          '<div class="pr-bar"><i style="width:' + pct + '%"></i></div>' +
          '<i class="pr-step">' + esc(step ? step.n : '') + (cur.stage < def.stages.length ? '　下一步：' + esc(def.stages[cur.stage].n) : '　已走到尽头') + '</i>' +
          '</div>');
      });
      if (!rows.length) return '';
      return '<div class="path-card"><div class="pc-head"><b>你走出来的路</b><span>研究同一方向会自动推进</span></div>' +
        rows.join('') + '</div>';
    },

    civCard(){
      const G = LS.Game, st = G.state;
      if (!G.civAvailable()) return '';
      const c = st.civ;
      if (!c) {
        const fields = G.civFields();
        return '<div class="civ-card">' +
          '<div class="cv-head"><b>🌍 推动文明</b><span>十年 · 2 行动力/年</span></div>' +
          '<p class="cv-desc">这个世界有些东西还没被想明白。选一个方向，把接下来十年押上去。</p>' +
          '<div class="cv-fields">' + fields.map(function(f){
            return '<button class="chip" data-act="civstart" data-val="' + esc(f) + '">' + esc(f) + '</button>';
          }).join('') + '</div></div>';
      }
      const pct = Math.min(100, Math.round((c.years || 0) / 10 * 100));
      return '<div class="civ-card active">' +
        '<div class="cv-head"><b>🌍 ' + esc(c.field) + '</b><span>第 ' + (c.years||0) + ' / 10 年</span></div>' +
        '<div class="cv-bar"><i style="width:' + pct + '%"></i></div>' +
        (c.done
          ? '<p class="cv-desc">' + (c.success ? '成了。这个世界因为你往前走了一格。' : '十年，白费了。') + '</p>'
          : '<p class="cv-desc">专注推动一年（消耗 2 行动力）。智商越高，每年推进得越多。</p>' +
            '<button class="btn btn-ghost btn-block" data-act="civpush" ' + (st.ap < 2 ? 'disabled' : '') + '>再推一年</button>') +
        '</div>';
    },

    /* 基础 6 个行动，被自研行动按维度顶替 */
    /* 不是永远 6 个：脑子不够，你只知道其中几个办法 */
    actionList(){
      const st = LS.Game.state;
      const iq = (st.brain && st.brain.iq) || 100;
      const customs = st.customActs || [];
      return LS.FREE_ACTIONS.map(function(base){
        const own = customs.find(function(c){ return c.dim === base.dim; });
        // 自研要 IQ≥100 才用得上；否则退回原来的行动，别让格子空掉
        const picked = (own && iq >= 100) ? own : base;
        return picked;
      }).filter(function(a){
        return iq >= (a.iqMin || 0);
      }).concat(st.worldId === 'pirate' && LS.SEA_ACTS ? LS.SEA_ACTS.filter(function(a){ return LS.Game.dimVal(a.dim) >= a.need; }) : []);
    },

    actionFeedbackHtml(){
      const f = this.actionFeedback;
      if (!f) return '';
      return `<section class="action-fb ${f.ok?'ok':'bad'}">
        <div class="af-head"><b>${esc(f.title)}</b><span>${f.left} 点行动力</span></div>
        <p>${esc(f.text)}</p>
        <div class="chips">${this.chipsHtml(f.chips)}</div>
      </section>`;
    },

    actionsScreen(){
      const G = LS.Game, st = G.state;
      const tier = st.brain.tier || LS.BRAIN.tierOf(0);
      const build = st.build;
      const deathCount = st.deaths || 0;
      $('#stage').innerHTML = `
        ${this.topbar()}
        ${this.panelBlock(true)}
        ${this.econBlock()}
        ${this.actionFeedbackHtml()}
        <section class="panel">
          <div class="panel-head row">
            <h2>这一年，你还想做点什么</h2>
            <span class="ap">行动力 ${Math.min(st.ap, G.apMax())} / ${G.apMax()}</span>
          </div>
          <div class="action-grid">
            ${this.actionList().map(function(a){
              return `<button class="action-btn ${a.custom?'custom':''}" data-act="free" data-val="${a.id}" ${st.ap<=0?'disabled':''}>
                <span class="ab-ico">${a.icon}</span>
                <b>${a.n}${a.custom?'<em class="ab-tag">自研</em>':''}</b>
                <i>${a.desc}</i>
              </button>`;
            }).join('')}
          </div>

          ${this.pathCard()}
          ${this.civCard()}

          <div class="research-act">
            <div class="ra-head">
              <b>🧠 你想做什么</b>
              <span>${G.researchAvailable() ? '今年可用一次' : '今年已经研究过了'}</span>
            </div>
            <p>可以研究一种新的系统用法，也可以直接写下你要去做的事（比如"去干四皇"）。两件事每年各一次。</p>
            <textarea id="ideaInput" class="input" rows="2" maxlength="80"
              placeholder="例：把死亡换来的力量存起来 / 去挑战四皇 / 找海军本部算账"
              ${G.researchAvailable()?'':'disabled'}></textarea>
            <div class="idea-actions">
              <button class="btn btn-ghost" data-act="doresearch" ${G.researchAvailable()?'':'disabled'}>
                ${G.researchAvailable() ? '研究用法' : '研究已用'}
              </button>
              <button class="btn btn-primary" data-act="dostory" ${G.storyAvailable()?'':'disabled'}>
                ${G.storyAvailable() ? '直接去做' : '今年做过了'}
              </button>
            </div>
          </div>

          ${G.canSeekDeath() ? `          <div class="seek-act">
            <div class="sa-head">
              <b>💀 找死</b>
              <span class="${st.ap<=0?'used':''}">剩 ${st.ap} / ${G.apMax()} 点行动力</span>
            </div>
            <p>主动去最危险的地方。死一次，强一次——但同一种死法会指数递减，得换着来。</p>
            <p class="sa-tier">已死亡 ${deathCount} 次 · 同种死法收益 ×${(build && build.mods && build.mods.decay) || 0.82}<sup>n</sup>，越死越少</p>
            <button class="btn btn-ghost btn-block" data-act="seekdeath" ${st.ap<=0?'disabled':''}>去死一死（消耗 1 行动力）</button>
          </div>` : ''}

          <div class="sys-act">
            <div class="sa-head">
              <b>${st.system.icon} ${esc(st.system.name)}</b>
              <span class="${G.systemUsed?'used':''}">${G.systemUsed?'本年已使用':'本年可用一次'}</span>
            </div>
            <p>${esc(st.system.mechanicText||'')}</p>
            <p class="sa-tier">掌握度 ${st.brain.mastery}% · ${esc(tier.name)}${build ? ' · ' + esc(build.name) : ''}</p>
            <button class="btn btn-ghost btn-block" data-act="sysact" ${G.systemUsed?'disabled':''}>
              ${tier.key === 'none' ? '随便按一个' : '使用系统能力'}
            </button>
          </div>
          <button class="btn btn-primary btn-block" data-act="endyear">结束这一年 · 进入 ${st.age+1} 岁</button>
        </section>
        ${this.logBlock(8)}
      `;
    },

    actionResultScreen(){
      const G = LS.Game, st = G.state, r = G.result;
      if (!r) { this.actionsScreen(); return; }
      $('#stage').innerHTML = `
        ${this.topbar()}
        <section class="year-card result death">
          <div class="yc-age">${st.age} 岁 · ${esc(r.title||'找死')}</div>
          <p class="narration">${nl2br(r.text)}</p>
          <div class="chips">${this.chipsHtml(r.chips)}</div>
          ${r.act ? `<div class="new-act"><b>✦ 新动作：${esc(r.act.n)}</b><i>练 ${esc(r.act.dim)} · 强度 ${r.act.grow.v}${r.replaces?' · 替代「'+esc(r.replaces)+'」':''}</i></div>` : ''}
          ${r.research ? `<p class="r-meta">审核：${esc(r.source || '本地规则')} · 成算 ${r.chance || 0}% · 掌握度 ${st.brain.mastery}%</p>` : ''}
          ${r.death && r.death.revived ? `<div class="revive">${nl2br(r.death.text)}</div>` : ''}
          <button class="btn btn-primary btn-block" data-act="backactions">继续</button>
        </section>
        ${this.panelBlock()}
      `;
    },

    async doStory(){
      const G = LS.Game;
      const ta = document.querySelector('#ideaInput');
      const idea = ((ta && ta.value) || '').trim();
      if (idea.length < 2) { this.toast('写下你要做什么，哪怕只有四个字'); return; }
      const r = await G.narrativeStory(idea);
      if (r && r.error) { this.toast(r.error); return; }
      G.result = { title: r.title, text: r.text, chips: r.chips, ok: r.ok, death: r.death, story: true };
      G.phase = r.death && r.death.ended ? 'end' : 'actionResult';
      if (G.phase === 'end') { this.ending(); return; }
      this.actionResultScreen();
    },

    async doResearch(){
      const G = LS.Game;
      const ta = document.querySelector('#ideaInput');
      const idea = (ta && ta.value || '').trim();
      if (idea.length < 4) { this.toast('再具体一点，至少写四个字'); return; }
      const btn = document.querySelector('[data-act="doresearch"]');
      if (btn) { btn.disabled = true; btn.textContent = '系统正在推演……'; }
      const r = await G.research(idea);
      if (r && r.error) {
        this.toast(r.error);
        if (btn) { btn.disabled = false; btn.textContent = '提交给系统'; }
        return;
      }
      this.actionResultScreen();
    },

    doSeekDeath(wayId){
      const G = LS.Game;
      if (!wayId) { this.deathSheet(); return; }
      const r = G.seekDeath(wayId);
      if (!r) return;
      if (G.state.ended) { this.ending(); return; }
      this.actionResultScreen();
    },

    deathSheet(){
      const G = LS.Game, st = G.state;
      const mods = G.buildMods();
      const decay = mods.decay || 0.82;
      const dg = mods.deathGain || 1;
      const ways = LS.DEATH_WAYS;
      this.sheet(`
        <div class="sheet-head"><b>怎么死</b><button class="icon-btn" data-act="closesheet">✕</button></div>
        <p class="muted small">同一种死法用得越多，收益越低。换着死，才能一直涨。</p>
        <div class="death-list">
          ${ways.map(function(w){
            const n = (st.deathWays && st.deathWays[w.id]) || 0;
            const f = Math.max(0.05, Math.pow(decay, n) * dg);
            return `<button class="death-way" data-act="seekway" data-val="${w.id}" ${st.ap<=0?'disabled':''}>
              <span class="dw-main"><b>${esc(w.n)}</b><i>已用 ${n} 次</i></span>
              <span class="dw-f ${f<0.6?'low':''}">×${Math.round(f*100)/100}</span>
            </button>`;
          }).join('')}
        </div>
        <div class="sheet-foot">行动力 ${st.ap} / ${G.apMax()} · 每次消耗 1 点</div>
      `);
    },

    doChoose(i){
      const r = LS.Game.chooseOption(i);
      if (!r) return;
      this.resultScreen();
    },

    doFree(id){
      const G = LS.Game;
      const r = G.freeAction(id);
      if (!r) return;
      const fa = this.actionList().find(function(x){ return x.id === id; });
      this.actionFeedback = {
        ok: !!r.ok,
        title: (fa ? fa.n : '行动') + (r.ok ? ' · 成了' : ' · 没成'),
        text: r.text,
        chips: r.chips || [],
        left: r.ap
      };
      if (G.state.ended) {
        if (!G.state.pathSaved) G.endRun(G.state.endReason || '你的一生结束了');
        this.ending(); return;
      }
      this.actionsScreen();
    },

    systemSheet(sys){
      if (!sys) return;
      const st = LS.Game.state;
      const stats = (sys.stats || []).map(function(s){ return '<div class="ss-stat"><span>' + esc(s.n) + '</span><b>' + Math.round((st.attrs[s.k]||0)*10)/10 + '</b><i>' + esc(s.dim) + '</i></div>'; }).join('');
      const acts = (sys.acts || []).map(function(a){ return '<div class="ss-act"><b>【' + esc(a.n) + '】</b>' + esc(a.d || '') + '</div>'; }).join('');
      this.sheet('<div class="sheet-head"><b>新系统诞生</b><button class="icon-btn" data-act="closesheet">✕</button></div>' +
        '<div class="ss-card"><div class="ss-ico">' + (sys.icon||'✦') + '</div>' +
        '<h2>' + esc(sys.name) + '</h2>' +
        '<p class="ss-tag">「' + esc(sys.tagline||'') + '」</p>' +
        '<p class="ss-desc">' + esc(sys.desc||'') + '</p>' +
        '<div class="ss-stats">' + stats + '</div>' +
        (acts ? '<div class="ss-acts">' + acts + '</div>' : '') +
        '<p class="ss-note">它已经写进系统库，别人也可能抽到。</p></div>' +
        '<button class="btn btn-primary btn-block" data-act="closesheet">收下</button>');
    },

    async doSystem(){
      const G = LS.Game;
      const btn = $('[data-act="sysact"]');
      if (btn) { btn.disabled = true; btn.textContent = '……'; }
      const r = await G.systemAction();
      if (r && r.system) { this.systemSheet(r.system); return; }
      if (r && r.text) {
        this.actionFeedback = {
          ok: !!(r.chips && r.chips.length),
          title: '系统能力 · ' + (G.state.system ? G.state.system.name : ''),
          text: r.text,
          chips: r.chips || [],
          left: G.state.ap
        };
      }
      if (G.state.ended) {
        if (!G.state.pathSaved) G.endRun(G.state.endReason || '你的一生结束了');
        this.ending(); return;
      }
      this.actionsScreen();
    },

    doEndYear(){
      const G = LS.Game;
      G.endYear();
      if (G.state.ended) { this.ending(); return; }
      this.beginYear();
    },

    /* ---------------- 面板 ---------------- */
    panelBlock(expanded){
      const G = LS.Game, st = G.state;
      if (!st.system) return '';
      const p = G.panelData();
      const hpPct = Math.max(0, Math.min(100, p.hp / p.maxHp * 100));
      const hpCls = hpPct < 25 ? 'low' : hpPct < 55 ? 'mid' : '';
      return `
        <section class="panel stats-panel ${expanded?'open':''}">
          <div class="sp-head">
            <div class="sp-name"><span class="rar-dot rar-${st.rarity}"></span>${esc(p.systemName)}</div>
            <div class="sp-hp">
              <span class="hp-bar"><i class="${hpCls}" style="width:${hpPct}%"></i></span>
              <b>${p.hp}/${p.maxHp}</b>
            </div>
          </div>
          <div class="sp-stats">
            ${p.stats.map(function(s){
              return `<div class="stat">
                <div class="stat-top"><span>${esc(s.n)}</span><b>${s.v}</b></div>
                <div class="stat-bar"><i style="width:${Math.min(100, s.v)}%"></i></div>
                <div class="stat-dim">${LS.DIMS[s.dim].icon} ${s.dim}</div>
              </div>`;
            }).join('')}
          </div>
          ${p.res.length?`<div class="res-row">
            ${p.res.map(function(r){ return `<span class="res"><b>${esc(r.icon)}</b>${esc(r.n)} ${r.v}</span>`; }).join('')}
          </div>`:''}
          <div class="dim-row">
            ${LS.DIM_LIST.map(function(d){
              return `<span class="dim"><i>${LS.DIMS[d].icon}</i>${d} <b>${p.dims[d]}</b></span>`;
            }).join('')}
          </div>
          ${st.freePts>0?`<div class="pts">
            <b>可分配属性点：${st.freePts}</b>
            <div class="pts-row">
              ${p.stats.map(function(s){ return `<button class="chip on" data-act="addpt" data-val="${s.k}">${esc(s.n)} +1</button>`; }).join('')}
            </div>
          </div>`:''}
          <div class="tag-row">
            <span class="tag iq">IQ ${p.iq}</span>
            <span class="tag">掌握度 ${p.mastery}%</span>
            ${p.tags.map(function(t){ return `<span class="tag">${esc(t)}</span>`; }).join('')}
          </div>
        </section>
      `;
    },

    econBlock(){
      const st = LS.Game.state;
      if (!st.econ) return '';
      const e = st.econ;
      const iq = st.brain.iq;
      const note = iq < 110
        ? '你对钱没什么概念。别人家里有的，你也觉得该有。'
        : iq < 120 ? '你知道要存钱，但常常忍不住。' : '你开始算收益率了。';
      const M = function(v){ return LS.ECON.money(v, st.worldId); };
      return `
        <section class="panel econ-panel">
          <div class="ep-head">
            <b>经济面板</b>
            <span class="${LS.ECON.netWorth(e) < 0 ? 'neg' : ''}">净资产 ${M(LS.ECON.netWorth(e))}</span>
          </div>
          ${this.bountyRow()}
          <div class="ep-grid">
            <div><span>学历</span><b>${esc(e.eduName || '—')}${e.graduated ? '（已毕业）' : '（在读）'}</b></div>
            <div><span>${e.graduated ? '状态' : '毕业时间'}</span><b>${e.graduated ? '已工作' : (e.gradAge - st.age) + ' 年后'}</b></div>
            <div><span>现金</span><b>${M(e.cash)}</b></div>
            <div><span>负债</span><b class="${e.debt>0?'neg':''}">${M(e.debt)}</b></div>
            <div><span>主动收入</span><b>${M(e.active)}/年</b></div>
            <div><span>被动收入</span><b>${M(e.passive)}/年</b></div>
          </div>
          <p class="ep-note">${!e.graduated ? ('你还在读书，今年没有工资。' + Math.max(0, e.gradAge - st.age) + ' 年后毕业。') : esc(note)}</p>
          ${(e.assets||[]).length?`<div class="ep-assets">${e.assets.map(function(a){ return `<span>${esc(a.n)} ${M(a.v)}</span>`; }).join('')}</div>`:''}
        </section>
      `;
    },

    brainEffectText(bb){
      if (!bb) return '';
      const map = [['ndi','神经元'],['iq','智力'],['cort','皮质醇'],['focus','专注'],['mirror','镜像'],['phy','体能'],['sleep','睡眠']];
      return map.filter(function(x){ return bb[x[0]]; }).map(function(x){
        const v = bb[x[0]];
        return x[1] + (v > 0 ? ' +' : ' ') + (Math.round(v * 10) / 10);
      }).join(' · ');
    },

    sciHtml(sci){
      if (!sci) return '';
      return '<details class="sci"><summary>🔬 科学解释</summary><p>' + esc(sci) + '</p></details>';
    },

    bountyRow(){
      const st = LS.Game.state;
      if (!st || st.worldId !== 'pirate' || !LS.fmtBounty) return '';
      const v = st.bounty || 0;
      const tier = LS.bountyTier ? (LS.bountyTier(v) || {}).n : '';
      return '<div class="bounty-row"><span>悬赏金</span><b>' + LS.fmtBounty(v) + '</b><i>' + esc(tier) + '</i></div>';
    },

    chipsHtml(chips){
      if (!chips || !chips.length) return '<span class="chip">没有留下什么</span>';
      return chips.map(function(c){ return `<span class="chip ${c.good?'good':'bad'}">${esc(c.text)}</span>`; }).join('');
    },

    logBlock(n){
      const st = LS.Game.state;
      const logs = st.log.slice(-(n||5)).reverse();
      if (!logs.length) return '';
      return `<section class="log-block">
        <div class="log-head"><b>人生记录</b><button class="link" data-act="totallog">完整的一生 →</button></div>
        ${logs.map(function(l){
          const t = String(l.text||'').replace(/\s*\n+\s*/g, ' / ');
          return `<div class="log-row ${l.kind}"><span>${l.age}岁</span><p>${esc(t.slice(0,90))}${t.length>90?'…':''}</p></div>`;
        }).join('')}
      </section>`;
    },

    logSheet(){
      const st = LS.Game.state;
      const logs = st.log.slice().reverse();
      this.sheet(`
        <div class="sheet-head"><b>完整记录 · ${st.age} 岁</b><button class="icon-btn" data-act="closesheet">✕</button></div>
        <div class="full-log">
          ${logs.map(function(l){ return `<div class="fl-row ${l.kind}"><span>${l.age}岁</span><p>${nl2br(l.text)}</p></div>`; }).join('')}
        </div>
      `);
    },

    /* ---------------- 结局 ---------------- */
    ending(){
      const G = LS.Game, st = G.state;
      this.applyTheme(st.worldId);
      if (!st.pathSaved) G.endRun(st.endReason || '你的一生结束了');
      const p = LS.Store.getPath(st.id) || G.pathRecord || {};
      const rank = st.rank || G.rankOf(st.score||0);
      const rated = (p.ratingCount || 0) > 0;
      const b = st.brain;
      const net = st.econ ? LS.ECON.netWorth(st.econ) : 0;
      $('#stage').innerHTML = `
        <section class="end-card">
          <div class="end-rank" style="color:${rank.c}">${rank.t}</div>
          <h1 class="end-title">${esc(st.name)} · ${st.age} 岁</h1>
          <p class="end-reason">${esc(st.endReason||'')}</p>
          ${st.epilogueText ? `<p class="end-epi">${nl2br(st.epilogueText)}</p>` : ''}
          ${LS.AI.available() ? `<button class="btn btn-ghost btn-block" data-act="aiending">让导演写完这一段</button>` : ''}
          <div class="end-score"><b>${st.score||0}</b><span>人生评分</span></div>
          <p class="end-comment">${esc(rank.d)}</p>
          <div class="end-grid">
            <div><span>世界</span><b>${esc(st.worldName)}</b></div>
            <div><span>系统</span><b>${esc(st.systemName||'无')}</b></div>
            <div><span>智商</span><b>${b.iq}（${b.iq>=131?'天才':b.iq>=120?'聪明':b.iq>=110?'中上':b.iq>=95?'普通':'偏慢'}）</b></div>
            <div><span>教育影响</span><b>智力 ${b.eduIQ>0?'+':''}${b.eduIQ||0}</b></div>
            <div><span>系统掌握度</span><b>${b.mastery}%</b></div>
            <div><span>家庭</span><b>${esc(b.parent.name)}</b></div>
            <div><span>净资产</span><b class="${net<0?'neg':''}">${LS.ECON.money(net, st.worldId)}</b></div>
            ${st.econ?`<div><span>主动/被动</span><b>${LS.ECON.money(st.econ.active, st.worldId)} / ${LS.ECON.money(st.econ.passive, st.worldId)}</b></div>`:''}
            ${st.econ&&st.econ.debt>0?`<div><span>负债</span><b class="neg">${LS.ECON.money(st.econ.debt, st.worldId)}</b></div>`:''}
            <div><span>死亡次数</span><b>${st.deaths}</b></div>
          </div>
          ${(st.achievements && st.achievements.length) ? ('<div class="end-ach"><b>成就</b><div class="ach-grid">' +
            st.achievements.map(function(a){ return '<div class="ach"><span>' + a.icon + '</span><b>' + esc(a.name) + '</b><i>' + esc(a.desc) + '</i></div>'; }).join('') +
            '</div></div>') : ''}
          <div class="end-timeline">
            <b>人生关键节点</b>
            ${(p.timeline||st.timeline).slice(-10).map(function(t){ return `<div class="et-row">${esc(t)}</div>`; }).join('') || '<div class="et-row muted">没有留下什么记录</div>'}
          </div>
          ${st.tags.length?`<div class="tag-row">${st.tags.slice(-10).map(function(t){ return `<span class="tag">${esc(t)}</span>`; }).join('')}</div>`:''}
        </section>

        <section class="panel rate-panel">
          <div class="panel-head"><h2>这条人生，值得别人玩吗？</h2><p class="muted">低分的路径组合会被系统降权，少刷到。</p></div>
          <div class="stars">
            ${[1,2,3,4,5].map(function(i){ return `<button class="star ${rated&&(p.rating>=i)?'on':''}" data-act="rate" data-val="${i}" ${rated?'disabled':''}>★</button>`; }).join('')}
          </div>
          <div class="quick-feed">
            <button class="chip" data-act="quickfeed" data-val="good" ${rated?'disabled':''}>剧情好</button>
            <button class="chip" data-act="quickfeed" data-val="boring" ${rated?'disabled':''}>太水了</button>
            <button class="chip" data-act="quickfeed" data-val="weird" ${rated?'disabled':''}>太离谱</button>
          </div>
          ${rated?`<p class="rated-note">已记录你的反馈（${(p.rating||0).toFixed(1)} 星）</p>`:''}
        </section>

        <div class="end-actions">
          <button class="btn btn-primary btn-block" data-act="restart">再活一次</button>
          <button class="btn btn-ghost" data-act="go" data-val="rank">看排行榜</button>
          <button class="btn btn-ghost" data-act="copycode">复制人生码</button>
          <button class="btn btn-ghost" data-act="go" data-val="paths">路径库</button>
          <button class="btn btn-ghost" data-act="go" data-val="home">回首页</button>
        </div>
      `;
    },

    rate(n){
      LS.Store.ratePath(LS.Game.state.id, n);
      this.ending();
      this.toast('反馈已记录：' + n + ' 星');
    },

    quickFeed(kind){
      const map = { good:[5,'剧情好'], boring:[2,'太水了'], weird:[1,'太离谱'] };
      const v = map[kind] || [3,''];
      LS.Store.ratePath(LS.Game.state.id, v[0], v[1]);
      this.ending();
      this.toast('已记录：' + v[1]);
    },

    copyCode(){
      const code = JSON.stringify(LS.Game.exportRun());
      const done = function(){ App.toast('人生码已复制'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(done).catch(function(){ App.promptCopy(code); });
      } else this.promptCopy(code);
    },
    promptCopy(code){
      this.sheet(`<div class="sheet-head"><b>复制这段人生码</b><button class="icon-btn" data-act="closesheet">✕</button></div>
        <textarea class="input" rows="6" style="width:100%">${esc(code)}</textarea>`);
    },

    /* ---------------- 系统库 ---------------- */
    library(filter){
      this.screen = 'library';
      const all = LS.allSystems();
      const rar = filter || 'ALL';
      const list = rar === 'ALL' ? all : all.filter(function(s){ return s.rarity === rar; });
      $('#stage').innerHTML = `
        <section class="panel">
          <div class="panel-head">
            <h1>系统库</h1>
            <p class="muted">共 ${all.length} 个，其中 ${LS.Store.systems.length} 个由玩家（系统制造师）创造。</p>
          </div>
          <div class="chip-row">
            ${['ALL','SSR','SR','R','N'].map(function(r){
              return `<button class="chip ${rar===r?'on':''}" data-act="libfilter" data-val="${r}">${r==='ALL'?'全部':r}</button>`;
            }).join('')}
            <button class="chip" data-act="go" data-val="editor">＋ 造一个</button>
          </div>
          <div class="sys-list">
            ${list.map(function(s){
              return `<button class="sys-card rar-${s.rarity}" data-act="sysdetail" data-val="${s.id}">
                <span class="sc-ico">${s.icon}</span>
                <span class="sc-main">
                  <b>${esc(s.name)} ${s.custom?'<em class="mc">玩家造</em>':''}</b>
                  <i>${esc(s.tagline||'')}</i>
                  <span class="sc-tags">${(s.stats||[]).map(function(x){ return x.n; }).join(' · ')}</span>
                </span>
                <span class="sc-rar rar-${s.rarity}">${s.rarity}</span>
              </button>`;
            }).join('')}
          </div>
        </section>
      `;
    },

    sysDetail(id){
      const s = LS.systemById(id);
      if (!s) return;
      const maker = s.authorName ? `<div class="sd-author">制造师：${esc(s.authorName)}（${esc(s.authorWorld||'某处')}）</div>` : '';
      const resLine = (s.res||[]).length
        ? '<div class="sd-block"><b>资源</b><p>' + s.res.map(function(r){ return esc(r.icon||'') + ' ' + esc(r.n); }).join('、') + '</p></div>' : '';
      const actLine = (s.acts||[]).length
        ? '<div class="sd-block"><b>专属动作</b><p>' + s.acts.map(function(a){ return '【' + esc(a.n) + '】' + esc(a.d||''); }).join('<br>') + '</p></div>' : '';
      this.sheet(`
        <div class="sheet-head"><b>${s.icon} ${esc(s.name)}</b><button class="icon-btn" data-act="closesheet">✕</button></div>
        <div class="sd-body">
          <div class="sd-rar rar-${s.rarity}">${s.rarity} · ${(LS.RARITY[s.rarity]||{}).name||''}</div>
          <p class="sd-tag">「${esc(s.tagline||'')}」</p>
          <p class="sd-desc">${nl2br(s.desc||'')}</p>
          ${maker}
          <div class="sd-block"><b>面板</b>
            <div class="stat-grid">
              ${(s.stats||[]).map(function(x){ return `<div class="stat-box"><span>${esc(x.n)}</span><b>${x.init}</b><i>${x.dim}</i></div>`; }).join('')}
            </div>
          </div>
          <div class="sd-block"><b>核心机制</b><p>${esc(s.mechanicText||'—')}</p></div>
          ${(function(){
            const rs = LS.Store.researchFor(s.id) || [];
            if (!rs.length) return '';
            return '<div class="sd-block"><b>玩家研究出的用法</b><p>' +
              rs.map(function(x){ return '「' + esc(x.idea) + '」——' + esc(x.author || '某位玩家') + '，' + x.age + '岁'; }).join('<br>') +
              '</p></div>';
          })()}
          ${resLine}${actLine}
          <div class="sd-actions">
            <button class="btn btn-primary" data-act="usesys" data-val="${s.id}">指定它出生</button>
            <button class="btn btn-ghost" data-act="editsys" data-val="${s.id}">${s.custom?'编辑':'复制改造'}</button>
          </div>
        </div>
      `);
      const self = this;
      document.querySelectorAll('[data-act="usesys"]').forEach(function(b){
        b.onclick = function(){
          self.closeSheet();
          self.create.sysId = b.getAttribute('data-val');
          self.createScreen();
          self.toast('已指定系统，出生后 18 岁必觉醒它');
        };
      });
      document.querySelectorAll('[data-act="editsys"]').forEach(function(b){
        b.onclick = function(){ self.closeSheet(); LS.Editor.open(b.getAttribute('data-val')); };
      });
    },

    /* ---------------- 排行榜 ---------------- */
    rank(){
      this.screen = 'rank';
      const paths = LS.Store.paths.slice().sort(function(a,b){ return (b.score||0)-(a.score||0); }).slice(0,50);
      const byIq = LS.Store.paths.slice().filter(function(p){ return p.iq; }).sort(function(a,b){ return b.iq - a.iq; }).slice(0,20);
      const makers = LS.Store.paths.filter(function(p){ return p.maker; }).sort(function(a,b){ return (b.made||0)-(a.made||0); }).slice(0,20);

      $('#stage').innerHTML = `
        <section class="panel">
          <div class="panel-head"><h1>排行榜</h1><p class="muted">评分来自真实玩过的人。</p></div>
          <div class="tabs">
            <button class="tab on" data-tab="life">人生榜</button>
            <button class="tab" data-tab="iq">智力榜</button>
            <button class="tab" data-tab="maker">制造师</button>
          </div>
          <div class="tab-body" id="tabLife">
            ${paths.length?paths.map(function(p,i){
              const rk = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1);
              return `<div class="rank-row">
                <span class="rk">${rk}</span>
                <span class="rr-main">
                  <b>${esc(p.name)} · ${p.age}岁 <em class="rank-tag">${esc(p.rank||'')}</em></b>
                  <i>${esc(p.worldName)} / ${esc(p.systemName||'无系统')} · IQ ${p.iq||'?'}${p.econ?' · 净资产 '+p.econ.net+'万':''}</i>
                </span>
                <span class="rr-score">${p.score||0}</span>
                <button class="mini-btn" data-act="replay" data-val="${p.id}">同框重活</button>
              </div>`;
            }).join(''):'<p class="muted">还没有人走完一生。</p>'}
          </div>
          <div class="tab-body" id="tabIq" hidden>
            ${byIq.length?byIq.map(function(p,i){
              return `<div class="rank-row">
                <span class="rk">${i+1}</span>
                <span class="rr-main"><b>${esc(p.name)} · ${p.iq}</b><i>${esc(p.systemName||'无系统')} · 掌握度 ${p.mastery||0}% · ${esc(p.parent||'')}</i></span>
                <span class="rr-score">${p.iq}</span>
              </div>`;
            }).join(''):'<p class="muted">还没有数据。</p>'}
          </div>
          <div class="tab-body" id="tabMaker" hidden>
            ${makers.length?makers.map(function(p,i){
              return `<div class="rank-row">
                <span class="rk">${i+1}</span>
                <span class="rr-main"><b>${esc(p.name)}</b><i>造出 ${p.made} 个系统 · ${p.age}岁</i></span>
                <span class="rr-score">${p.made}</span>
              </div>`;
            }).join(''):'<p class="muted">还没有系统制造师。</p>'}
          </div>
        </section>
      `;
      const tabs = document.querySelectorAll('.tab');
      const map = { life:'tabLife', iq:'tabIq', maker:'tabMaker' };
      tabs.forEach(function(t){
        t.onclick = function(){
          tabs.forEach(function(x){ x.classList.remove('on'); });
          t.classList.add('on');
          Object.keys(map).forEach(function(k){
            document.getElementById(map[k]).hidden = (k !== t.getAttribute('data-tab'));
          });
        };
      });
    },

    replay(pathId){
      const p = LS.Store.getPath(pathId);
      if (!p) { this.toast('找不到这条人生'); return; }
      LS.Game.newGame({
        worldId:p.worldId, systemId:p.systemId, seed:p.seed, maker:p.maker,
        gender:p.gender, name:p.name, replay:true
      });
      this.game();
      this.toast('你走进了他的人生。同样的起点，你可以走出不同的路。');
    },

    /* ---------------- 路径库 ---------------- */
    paths(){
      this.screen = 'paths';
      const list = LS.Store.paths.slice().reverse();
      const favs = LS.Store.fav;
      $('#stage').innerHTML = `
        <section class="panel">
          <div class="panel-head">
            <h1>人生路径库</h1>
            <p class="muted">${list.length} 条人生。点开可以读他的一生，也可以从同一个起点重活一次。</p>
          </div>
          <div class="chip-row">
            <button class="chip" data-act="importcode">导入人生码</button>
            <button class="chip" data-act="exportdata">导出全部存档</button>
          </div>
          <div class="path-list">
            ${list.length?list.map(function(p){
              const r = p.ratingCount ? (p.ratingSum/p.ratingCount) : 0;
              return `<div class="path-card">
                <div class="pc-top">
                  <b>${esc(p.name)} · ${p.age}岁</b>
                  <span class="pc-rank">${esc(p.rank||'')} · ${p.score||0}</span>
                </div>
                <div class="pc-meta">${esc(p.worldName)} / ${esc(p.systemName||'无系统')} · IQ ${p.iq||'?'}${p.maker?' · 制造师':''}</div>
                <div class="pc-foot">
                  <span class="pc-stars">${r?'★'.repeat(Math.round(r))+'☆'.repeat(5-Math.round(r)):'未评分'}</span>
                  <span class="pc-reason">${esc((p.reason||'').slice(0,24))}</span>
                  <button class="mini-btn" data-act="pathdetail" data-val="${p.id}">读</button>
                  <button class="mini-btn" data-act="replay" data-val="${p.id}">重活</button>
                  <button class="mini-btn" data-act="fav" data-val="${p.id}">${favs.indexOf(p.id)>=0?'★':'☆'}</button>
                </div>
              </div>`;
            }).join(''):'<p class="muted">还没有记录。先活一辈子吧。</p>'}
          </div>
        </section>
      `;
      const self = this;
      document.querySelectorAll('[data-act="importcode"]').forEach(function(b){ b.onclick = function(){ self.importSheet(); }; });
      document.querySelectorAll('[data-act="exportdata"]').forEach(function(b){ b.onclick = function(){ self.exportSheet(); }; });
    },

    pathDetail(id){
      const p = LS.Store.getPath(id);
      if (!p) { this.toast('找不到这条人生'); return; }
      const r = p.ratingCount ? (p.ratingSum / p.ratingCount) : 0;
      const stats = (p.statsSchema || []).map(function(s){
        return `<div class="stat-box"><span>${esc(s.n)}</span><b>${Math.round(p.attrs[s.k]||0)}</b><i>${s.dim}</i></div>`;
      }).join('');
      this.sheet(`
        <div class="sheet-head"><b>${esc(p.name)} · ${p.age} 岁</b><button class="icon-btn" data-act="closesheet">✕</button></div>
        <div class="sd-body">
          <div class="sd-rar">${esc(p.worldName)} / ${esc(p.systemName||'无系统')} · IQ ${p.iq||'?'} · ${esc(p.rank||'')}</div>
          <p class="sd-tag">${esc(p.reason||'')}</p>
          <div class="sd-block"><b>最终面板</b><div class="stat-grid">${stats || '<span class="muted">没有数据</span>'}</div></div>
          <div class="sd-block"><b>出身</b><p>家庭：${esc(p.parent||'未知')}<br>学校：${esc(p.school||'未知')}<br>掌握度：${p.mastery||0}%</p></div>
          ${p.econ?`<div class="sd-block"><b>经济</b><p>净资产 ${p.econ.net} 万 · 主动 ${p.econ.active} 万/年 · 被动 ${p.econ.passive} 万/年${p.econ.debt?' · 负债 '+p.econ.debt+' 万':''}</p></div>`:''}
          ${p.childMemories && p.childMemories.length?`<div class="sd-block"><b>童年</b><p>${p.childMemories.slice(-8).map(esc).join('<br>')}</p></div>`:''}
          <div class="sd-block"><b>关键节点</b><p>${(p.timeline||[]).map(esc).join('<br>') || '没有记录'}</p></div>
          <div class="sd-block"><b>口碑</b><p>${r?('★'.repeat(Math.round(r)) + ' ' + r.toFixed(1) + ' 星 · ' + p.ratingCount + ' 人评价'):'还没有人评分'}</p></div>
          <div class="sd-actions">
            <button class="btn btn-primary" data-act="replay" data-val="${p.id}">从同一个起点重活</button>
            <button class="btn btn-ghost" data-act="closesheet">关闭</button>
          </div>
        </div>
      `);
    },

    importSheet(){
      this.sheet(`
        <div class="sheet-head"><b>导入人生码 / 存档</b><button class="icon-btn" data-act="closesheet">✕</button></div>
        <textarea id="importArea" class="input" rows="6" placeholder='粘贴单条人生码或完整存档'></textarea>
        <button class="btn btn-primary btn-block" data-act="doimport">导入</button>
      `);
      const self = this;
      document.querySelectorAll('[data-act="doimport"]').forEach(function(b){
        b.onclick = function(){
          try{
            const obj = JSON.parse(document.getElementById('importArea').value.trim());
            if (obj.seed != null) {
              self.closeSheet();
              LS.Game.newGame({ worldId:obj.worldId, systemId:obj.systemId, seed:obj.seed, maker:!!obj.maker, replay:true });
              self.game();
              self.toast('已载入这条人生码');
            } else {
              self.toast(LS.Store.importAll(obj));
              self.closeSheet(); self.paths();
            }
          }catch(e){ self.toast('格式不对'); }
        };
      });
    },

    exportSheet(){
      const data = JSON.stringify(LS.Store.exportAll());
      this.sheet(`
        <div class="sheet-head"><b>导出存档</b><button class="icon-btn" data-act="closesheet">✕</button></div>
        <p class="muted">包含 ${LS.Store.paths.length} 条人生、${LS.Store.systems.length} 个自制系统、${LS.Store.snipCount()} 个剧情片段。</p>
        <textarea class="input" rows="8" style="width:100%">${esc(data.slice(0,20000))}</textarea>
      `);
    },

    /* ---------------- 设置 ---------------- */
    maskKey(k){
      if (!k) return '';
      if (k.length <= 10) return k.slice(0,3) + '***';
      return k.slice(0, 6) + '••••••' + k.slice(-4);
    },

    settings(){
      this.screen = 'settings';
      const c = LS.Store.apiCfg();
      const hasLocal = !!(LS.LOCAL_CONFIG && LS.LOCAL_CONFIG.key);
      $('#stage').innerHTML = `
        <section class="panel">
          <div class="panel-head"><h1>设置</h1>
            <p class="muted">没配 API 也能玩。配了之后 AI 会接管新剧情。</p>
          </div>
          <div class="form-row">
            <label>模式</label>
            <div class="seg">
              <button class="${c.mode==='auto'?'on':''}" data-act="setmode" data-val="auto">混合</button>
              <button class="${c.mode==='always'?'on':''}" data-act="setmode" data-val="always">全 AI</button>
              <button class="${c.mode==='offline'?'on':''}" data-act="setmode" data-val="offline">离线</button>
            </div>
          </div>
          <div class="form-row col">
            <label>接口地址（官方 base_url 不带 /v1）</label>
            <input id="cfgBase" class="input" value="${esc(c.base)}" placeholder="https://api.deepseek.com">
          </div>
          <div class="form-row col">
            <label>模型</label>
            <div class="chip-row">
              <button class="chip ${c.model==='deepseek-flash'?'on':''}" data-act="setmodel" data-val="deepseek-flash">deepseek-flash</button>
              <button class="chip ${c.model==='deepseek-v4-pro'?'on':''}" data-act="setmodel" data-val="deepseek-v4-pro">deepseek-v4-pro</button>
            </div>
            <input id="cfgModel" class="input" value="${esc(c.model)}" placeholder="deepseek-flash">
            <p class="hint">flash 写剧情够用且便宜；pro 更会写但贵 4–9 倍。</p>
          </div>
          <div class="form-row">
            <label>思考</label>
            <div class="seg">
              <button class="${c.thinking!=='enabled'?'on':''}" data-act="setthink" data-val="disabled">关闭（快 / 省）</button>
              <button class="${c.thinking==='enabled'?'on':''}" data-act="setthink" data-val="enabled">开启（慢 / 贵）</button>
            </div>
          </div>
          <p class="hint">官方默认开启思考模式，但游戏只要文笔和 JSON，开着会慢好几倍、还多花 token。</p>
          <div class="form-row col">
            <label>API Key ${hasLocal?'· 已内置在 js/config.local.js':''}</label>
            <input id="cfgKey" class="input" type="password" value="" placeholder="${c.key ? '已保存：' + this.maskKey(c.key) + '（留空则不修改）' : 'sk-...'}">
          </div>
          <div class="form-row"><label>中转</label><input id="cfgProxy" class="input" value="${esc(c.proxy||'')}" placeholder="留空自动用同源 /api/chat"></div>
          <div class="form-row"><label>单局上限</label><input id="cfgBudget" class="input" type="number" value="${c.budget||60}"></div>
          <div class="seg-row">
            <button class="btn btn-ghost" data-act="testsave">保存并测试</button>
            <button class="btn btn-ghost" data-act="cleardata">清空存档</button>
          </div>
          <div class="api-state" id="apiState">${LS.AI.available()
            ? ('已配置 · ' + esc(c.model) + ' · 思考' + (c.thinking==='enabled'?'开启':'关闭'))
            : '未配置，使用离线引擎'}</div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>关于接口</h2></div>
          <p class="muted small">
            当前官方参数：base_url <code>https://api.deepseek.com</code>，模型 <code>deepseek-flash</code>（V4.1-Flash-1017）或 <code>deepseek-v4-pro</code>。
            浏览器直连会被 CORS 拦，所以用 <b>启动游戏.bat</b> 打开时，游戏会自动走本机 <code>/api/chat</code> 中转，不用手填。
          </p>
          <div class="data-row">
            <span>人生记录 <b>${LS.Store.paths.length}</b></span>
            <span>自制系统 <b>${LS.Store.systems.length}</b></span>
            <span>剧情片段 <b>${LS.Store.snipCount()}</b></span>
          </div>
        </section>
      `;
      const self = this;
      document.querySelectorAll('[data-act="setmode"]').forEach(function(b){
        b.onclick = function(){
          const c2 = LS.Store.apiCfg(); c2.mode = b.getAttribute('data-val');
          LS.Store.saveApiCfg(c2); self.settings();
        };
      });
      document.querySelectorAll('[data-act="setmodel"]').forEach(function(b){
        b.onclick = function(){
          const c2 = LS.Store.apiCfg(); c2.model = b.getAttribute('data-val');
          LS.Store.saveApiCfg(c2); self.settings();
        };
      });
      document.querySelectorAll('[data-act="setthink"]').forEach(function(b){
        b.onclick = function(){
          const c2 = LS.Store.apiCfg(); c2.thinking = b.getAttribute('data-val');
          LS.Store.saveApiCfg(c2); self.settings();
        };
      });
      document.querySelectorAll('[data-act="testsave"]').forEach(function(b){ b.onclick = function(){ self.saveSettings(); }; });
      document.querySelectorAll('[data-act="cleardata"]').forEach(function(b){
        b.onclick = function(){
          if (confirm('清空本机所有记录？不可恢复。')) {
            ['ls.paths.v1','ls.snips.v1','ls.systems.v1','ls.fav.v1'].forEach(function(k){ localStorage.removeItem(k); });
            LS.Store.init(); self.toast('已清空'); self.settings();
          }
        };
      });
    },

    saveSettings(){
      const c = LS.Store.apiCfg();
      c.base = ($('#cfgBase').value||'').trim() || 'https://api.deepseek.com';
      c.model = ($('#cfgModel').value||'').trim() || 'deepseek-flash';
      const typedKey = ($('#cfgKey').value||'').trim();
      if (typedKey) c.key = typedKey;          // 留空 = 不改（保护内置 Key）
      c.proxy = ($('#cfgProxy').value||'').trim();
      c.budget = parseInt($('#cfgBudget').value,10) || 60;
      LS.Store.saveApiCfg(c);
      const state = $('#apiState');
      if (!c.key && !c.proxy) { state.textContent = '已保存，但没有 Key 或中转，仍走离线。'; return; }
      state.textContent = '测试中……（' + c.model + '）';
      LS.AI.chat([{ role:'user', content:'只回复两个字：通了' }], { maxTokens: 16, json:false })
        .then(function(t){ state.textContent = '测试成功：' + t.replace(/\s+/g,' ').slice(0,30); App.toast('API 已连通'); })
        .catch(function(e){ state.textContent = '失败：' + e.message; });
    },

    editor(){
      this.screen = 'editor';
      LS.Editor.render($('#stage'));
    }
  };

  window.LS.App = App;
  document.addEventListener('DOMContentLoaded', function(){
    LS.Store.init();
    App.init();
  });
})();
