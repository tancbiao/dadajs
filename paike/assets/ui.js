/* ============================================================
 *  ui.js —— 界面渲染与交互
 * ============================================================ */
(function (global) {
  'use strict';

  const Store = global.Store, Engine = global.Engine, Xlsx = global.Xlsx;
  const UI = {
    view: 'timetable',
    curGrade: 1,
    curClass: '1-1',
    curTeacher: '',
    mode: 'single',     // single | grid
    focusType: 'class', // class（班级课表，右侧=科任教师缩略图）| teacher（教师课表，右侧=任教班级缩略图）
    planGrade: 1,
    issueFilter: 'all',
    teacherFilter: '',
    dragSrc: null,
    selCell: null
  };

  /* ---------------- 工具 ---------------- */
  const $ = id => document.getElementById(id);
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function toast(msg, kind) {
    const root = $('toastRoot');
    root.innerHTML = '<div class="toast ' + (kind || '') + '">' + esc(msg) + '</div>';
    clearTimeout(root._t);
    root._t = setTimeout(() => { root.innerHTML = ''; }, 2600);
  }
  function subjectStyle(name) {
    const s = Store.subjectByName(name);
    if (!s) return '';
    return 'background:' + s.color + ';color:' + s.text;
  }
  function slotKey(d, p) { return d + '-' + p; }

  // 该时段是否是某科组教研时间（用于着色）
  function researchGroupsAt(d, p) {
    const k = slotKey(d, p);
    return Store.state.research.filter(r => r.slots.indexOf(k) >= 0).map(r => r.group);
  }
  // 当前班级视图下，该时段哪些科组被"屏蔽"
  function isResearchCell(d, p) { return researchGroupsAt(d, p).length > 0; }

  /* ============================================================
   *  视图：班级课表
   * ============================================================ */
  function viewTimetable() {
    const st = Store.state;
    const grades = [1, 2, 3, 4, 5, 6];
    const isT = UI.focusType === 'teacher';

    let h = '';
    h += '<div class="stats" id="stats"></div>';

    h += '<div class="card">';
    h += '<div class="card-h">';
    h += '<div class="tabs">' + grades.map(g =>
      '<button class="tab' + (g === UI.curGrade && !isT ? ' on' : '') + '" data-grade="' + g + '">' + global.cnNum(g) + '年级</button>'
    ).join('') + '</div>';
    h += '<span class="sp"></span>';
    h += '<div class="tabs">';
    h += '<button class="tab' + (UI.mode === 'single' && !isT ? ' on' : '') + '" data-mode="single">单班课表</button>';
    h += '<button class="tab' + (UI.mode === 'grid' && !isT ? ' on' : '') + '" data-mode="grid">年级纵览</button>';
    h += '</div>';
    h += '<button class="btn sm" id="btnPrint">' + (isT ? '打印教师课表' : '打印本班') + '</button>';
    h += '</div>';

    // 教师聚焦时的面包屑：← 返回班级
    if (isT) {
      const t = Store.teacherByName(UI.curTeacher);
      h += '<div class="crumb">' +
        '<button class="btn sm" id="btnBackClass">← 返回 ' + esc(Store.classById(UI.curClass).name) + '</button>' +
        '<b style="font-size:14px">' + esc(UI.curTeacher) + '</b> 的课表' +
        (t && t.groups.length ? '<span class="hint">　' + t.groups.join(' / ') + '</span>' : '') +
        '<span class="sp"></span><span class="hint">右侧缩略图为该老师任教的班级，点击可跳转</span>' +
        '</div>';
    }

    h += '<div class="card-b"><div class="chips" id="classChips">';
    st.classes.filter(c => c.grade === UI.curGrade).forEach(c => {
      const cnt = Object.keys(st.schedule[c.id] || {}).length;
      const cls = cnt >= 30 ? '' : (cnt >= 25 ? ' warn' : ' bad');
      h += '<button class="chip' + (c.id === UI.curClass && !isT ? ' on' : '') + cls + '" data-cls="' + c.id + '">' +
        esc(c.name) + ' <span style="opacity:.65">' + cnt + '/30</span></button>';
    });
    h += '</div></div>';

    // 主从联动布局：左=主课表，右=缩略图面板
    h += '<div class="card-b tight"><div class="tt-layout">' +
      '<div class="tt-main"><div class="tt-wrap" id="ttArea"></div></div>' +
      '<div class="tt-side no-print" id="ttSide"></div>' +
      '</div></div>';
    h += '</div>';

    h += '<div class="card"><div class="card-h"><h3>' + (isT ? '教师课表' : '操作说明') + '</h3></div><div class="card-b hint">' +
      (isT
        ? '· 这是 <b>' + esc(UI.curTeacher) + '</b> 一周的课，格子显示「班级 + 科目」，紫色为教研时间。<br>' +
          '· 点击右侧<b>班级缩略图</b>可回到该班课表继续调整；点「← 返回」回到刚才的班级。<br>' +
          '· 修改课程请回到<b>班级课表</b>，在对应班级的格子上操作（拖拽 / 点击），教师课表自动同步。'
        : '· 点右上角 <b>「⚡ 一键排全校」</b>即可自动排完全部 39 个班；同一教师同一时段只会排一个班，不会冲突。<br>' +
          '· <b>候选区</b>（课表下方）：没排上的课会以方块显示。把方块<b>拖到课表空格</b>可放置、<b>拖到已有课上</b>可交换；' +
          '把课表格子<b>拖回候选区</b>可移除该课。<br>' +
          '· 拖拽时，能放/能换的位置会亮<b style="color:var(--ok)">绿色</b>，松开即完成；不能放（教研、教师撞课、功能室满、固定格）会亮<b style="color:var(--err)">红色</b>。<br>' +
          '· 点击格子可手动改科目与教师；勾选「锁定」后自动排课不会改动该格。<br>' +
          '· 右侧<b>缩略图面板</b>：每个格子是一节课，颜色即科目。点任意<b>教师缩略图</b>进入该老师课表，右侧自动切换为该老师任教的班级缩略图。<br>' +
          '· 紫色底的格子是<b>集体教研时段</b>（语文组周三第5、6节，数学组周四第5、6节，发展组周二第5、6节）；' +
          '星期一第6节固定<b>班会</b>，星期三第4节固定<b>大阅读</b>。' +
      '</div></div>');

    return h;
  }

  function renderStats() {
    const el = $('stats'); if (!el) return;
    const st = Store.state;
    let filled = 0, total = st.classes.length * 30;
    st.classes.forEach(c => { filled += Object.keys(st.schedule[c.id] || {}).length; });
    const issues = Engine.countConflicts();
    const err = issues.filter(i => i.level === 'error').length;
    const warn = issues.filter(i => i.level === 'warn').length;
    el.innerHTML =
      stat(filled + '/' + total, '已排课时', filled === total ? 'g' : 'o') +
      stat(st.classes.length, '教学班', 'b') +
      stat(st.teachers.length, '任课教师', 'b') +
      stat(err, '硬性冲突', err ? 'r' : 'g') +
      stat(warn, '提示项', warn ? 'o' : 'g');
  }
  function stat(v, l, k) {
    return '<div class="stat ' + (k || '') + '"><div class="v">' + v + '</div><div class="l">' + l + '</div></div>';
  }

  function renderTT() {
    const area = $('ttArea'); if (!area) return;
    if (UI.focusType === 'teacher') {
      // 主区 = 教师课表（只读），右侧 = 该教师任教的班级缩略图
      area.innerHTML = teacherTable(UI.curTeacher);
    } else {
      area.innerHTML = UI.mode === 'single' ? singleTable(UI.curClass) : gradeTable(UI.curGrade);
      if (UI.mode === 'single') {
        area.insertAdjacentHTML('beforeend', quotaTable(UI.curClass));
        area.insertAdjacentHTML('beforeend', poolHTML(UI.curClass));
      }
    }
    bindCells();
    bindPool();
    renderThumbs();
    bindThumbs();
  }

  /* ============================================================
   *  主从联动：右侧缩略图面板（借鉴水晶排课：班级↔教师互跳）
   *  看班级 → 右侧列出该班科任教师的迷你课表；
   *  点教师 → 主区变教师课表，右侧自动切换为该教师任教的班级迷你课表
   * ============================================================ */

  /* 某班课表中出现的科任教师（含任课表里尚未排出的，按课时量排序） */
  function classTeachers(cid) {
    const st = Store.state;
    const names = [];
    const sch = st.schedule[cid] || {};
    Object.keys(sch).forEach(k => {
      const t = sch[k].teacher;
      if (t && names.indexOf(t) < 0) names.push(t);
    });
    st.teachers.forEach(t => {
      if (t.nonTeaching) return;
      if (t.duties.some(d => d.classId === cid) && names.indexOf(t.name) < 0) names.push(t.name);
    });
    names.sort((a, b) => Store.teacherLoad(b) - Store.teacherLoad(a));
    return names;
  }

  /* 某教师任教的班级列表（课表反查 + 任课表兜底，按班级自然顺序） */
  function teacherClasses(name) {
    const st = Store.state;
    const t = Store.teacherByName(name);
    return st.classes.filter(c => {
      const sch = st.schedule[c.id] || {};
      const inSchedule = Object.keys(sch).some(k => sch[k].teacher === name);
      const inDuty = !!(t && t.duties.some(d => d.classId === c.id));
      return inSchedule || inDuty;
    });
  }

  /* 迷你课表：6行(节次) × 5列(周一~五)，带周几/节次标签，格子内显示科目首字
     teacherName 为空 → 班级视角（该班全部课）；非空 → 教师视角（仅该教师的课） */
  function thumbGrid(cid, teacherName) {
    const st = Store.state;
    const sch = st.schedule[cid] || {};
    const days = ['一', '二', '三', '四', '五'];
    let h = '<div class="thumb-line"><i></i>' + days.map(d => '<b>' + d + '</b>').join('') + '</div>';
    for (let p = 1; p <= 6; p++) {
      let line = '<div class="thumb-line"><i>' + p + '</i>';
      for (let d = 1; d <= 5; d++) {
        const cell = sch[slotKey(d, p)];
        let cls = 'tc', style = '', text = '', title = '';
        if (cell && cell.subject && (!teacherName || cell.teacher === teacherName)) {
          const isMerge = cell.kind === 'merge';
          if (isMerge) {
            cls += ' mg';
            text = '合';
            title = ' title="' + esc(cell.subject) + '（合堂）"';
          } else {
            const s = Store.subjectByName(cell.subject);
            if (s) { style = 'background:' + s.color + ';color:' + s.text; }
            text = (cell.subject || '').slice(0, 1);
            title = ' title="' + esc(cell.subject) + (teacherName ? '·' + esc(Store.classById(cid).short) : '') + '"';
          }
        } else {
          cls += ' e';
        }
        line += '<span class="' + cls + '" style="' + style + '"' + title + '>' + text + '</span>';
      }
      h += line + '</div>';
    }
    return h;
  }

  /* 教师完整课表缩略图：该教师所有班的课按星期×节次聚合展示；
     当前聚焦班（focusCid）的课显示科目色（高亮），其他班的课灰色显示（仍能看出排课位置） */
  function teacherThumbGrid(teacherName, focusCid) {
    const st = Store.state;
    const slotMap = {};
    st.classes.forEach(c => {
      const sch = st.schedule[c.id] || {};
      Object.keys(sch).forEach(k => {
        const cell = sch[k];
        if (!cell || !cell.subject || cell.teacher !== teacherName) return;
        if (cell.kind === 'merge') return;   // 合堂在班级缩略图里以紫色"合"显示
        slotMap[k] = { subject: cell.subject, short: c.short, focus: c.id === focusCid };
      });
    });
    const days = ['一', '二', '三', '四', '五'];
    let h = '<div class="thumb-line"><i></i>' + days.map(d => '<b>' + d + '</b>').join('') + '</div>';
    for (let p = 1; p <= 6; p++) {
      let line = '<div class="thumb-line"><i>' + p + '</i>';
      for (let d = 1; d <= 5; d++) {
        const slot = slotMap[d + '-' + p];
        if (slot) {
          const s = Store.subjectByName(slot.subject);
          const style = (slot.focus && s)
            ? 'background:' + s.color + ';color:' + s.text
            : 'background:#e2e8f0;color:#64748b';
          line += '<span class="tc' + (slot.focus ? '' : ' dim') + '" style="' + style + '" ' +
            'title="' + esc(slot.short) + ' · ' + esc(slot.subject) + '">' +
            esc((slot.subject || '').slice(0, 1)) + '</span>';
        } else {
          line += '<span class="tc e"></span>';
        }
      }
      h += line + '</div>';
    }
    return h;
  }

  /* 一张缩略图卡片 */
  function thumbCard(cid, teacherName, jumpType, active) {
    const st = Store.state;
    const c = Store.classById(cid);
    const label = teacherName || c.name;
    const meta = teacherName
      ? (Store.teacherLoad(teacherName) + '节')
      : (Store.classCount(cid) + '/30');
    // 教师缩略图 = 完整课表（当前班彩色、其他班灰色）；班级缩略图 = 该班全部课
    const grid = teacherName ? teacherThumbGrid(teacherName, cid) : thumbGrid(cid, null);
    return '<button class="thumb-card' + (active ? ' on' : '') + '" data-jump="' + jumpType + '" ' +
      'data-cid="' + cid + '" data-t="' + esc(teacherName || '') + '" ' +
      'title="查看' + esc(teacherName || c.name) + (teacherName ? '课表' : '课程表') + '">' +
      '<div class="thumb-head"><b>' + esc(label) + '</b><span class="thumb-meta">' + meta + '</span></div>' +
      '<div class="thumb-grid">' + grid + '</div></button>';
  }

  function renderThumbs() {
    const side = $('ttSide'); if (!side) return;
    const st = Store.state;
    let h = '';
    if (UI.focusType === 'teacher') {
      // 教师视角：右侧 = 该教师任教的班级缩略图
      const cs = teacherClasses(UI.curTeacher);
      h += '<div class="side-title">📚 任教班级<span class="hint">' + cs.length + ' 个 · 点击跳转</span></div>';
      if (!cs.length) h += '<div class="hint" style="padding:6px 2px">该老师暂无已排课程</div>';
      cs.forEach(c => {
        h += thumbCard(c.id, null, 'class', c.id === UI.curClass);
      });
    } else if (UI.mode === 'grid') {
      // 年级纵览：右侧 = 该年级各班缩略图
      const cs = st.classes.filter(c => c.grade === UI.curGrade);
      h += '<div class="side-title">📅 ' + global.cnNum(UI.curGrade) + '年级各班<span class="hint">· 点击跳转</span></div>';
      cs.forEach(c => { h += thumbCard(c.id, null, 'class', false); });
    } else {
      // 班级视角：右侧 = 该班科任教师缩略图
      const names = classTeachers(UI.curClass);
      h += '<div class="side-title">👩‍🏫 科任教师<span class="hint">' + names.length + ' 位 · 点击看课表</span></div>';
      if (!names.length) h += '<div class="hint" style="padding:6px 2px">该班尚未排课</div>';
      names.forEach(n => { h += thumbCard(UI.curClass, n, 'teacher', false); });
    }
    side.innerHTML = h;
  }

  function bindThumbs() {
    document.querySelectorAll('#ttSide [data-jump]').forEach(b => {
      b.onclick = () => {
        if (b.dataset.jump === 'teacher') {
          UI.focusType = 'teacher';
          UI.curTeacher = b.dataset.t;
          UI.curClass = b.dataset.cid;     // 记住从哪个班进入
          UI.curGrade = Store.classById(b.dataset.cid).grade;
        } else {
          UI.focusType = 'class';
          UI.curClass = b.dataset.cid;
          UI.curGrade = Store.classById(b.dataset.cid).grade;
        }
        render();
      };
    });
  }

  /* 候选区：该班「应排但未排满」的科目方块 */
  function poolHTML(cid) {
    const st = Store.state;
    const c = Store.classById(cid);
    const plan = st.plan[c.grade] || {};
    const cnt = Store.classCount(cid);
    const items = [];
    Object.keys(plan).forEach(s => {
      const need = plan[s] || 0;
      const missing = need - (cnt[s] || 0);
      if (missing > 0) {
        const hasT = Store.candidatesFor(cid, s)
          .some(n => { const t = Store.teacherByName(n); return t && !t.nonTeaching; });
        items.push({ subject: s, count: missing, hasTeacher: hasT });
      }
    });
    let h = '<div class="pool" id="pool" data-cid="' + cid + '">';
    h += '<div class="pool-title">📦 候选区 · 未排好的课（共 ' +
      items.reduce((a, x) => a + x.count, 0) + ' 节）' +
      '<span class="hint">把方块拖到课表空格放置、拖到已有课上交换；也可把课表格子拖回这里移除</span></div>';
    if (!items.length) {
      h += '<div class="pool-empty">✓ 该班课时已全部排满</div>';
    } else {
      items.forEach(it => {
        h += '<div class="pool-item' + (it.hasTeacher ? '' : ' none') + '"' +
          (it.hasTeacher ? ' draggable="true"' : '') +
          ' data-subj="' + esc(it.subject) + '" style="' + subjectStyle(it.subject) + '">' +
          esc(it.subject) + '<span class="n">×' + it.count + '</span>' +
          (it.hasTeacher ? '' : '<span style="font-size:10px">缺教师</span>') + '</div>';
      });
    }
    h += '</div>';
    return h;
  }

  /* 单班课时核对 */
  function quotaTable(cid) {
    const st = Store.state;
    const c = Store.classById(cid);
    const plan = st.plan[c.grade] || {};
    const cnt = Store.classCount(cid);
    const keys = Object.keys(plan).filter(s => plan[s] > 0);
    let cells = '', okAll = true;
    keys.forEach(s => {
      const got = cnt[s] || 0, need = plan[s];
      const ok = got === need;
      if (!ok) okAll = false;
      cells += '<div style="display:flex;align-items:center;gap:6px;padding:3px 8px;border:1px solid var(--line);' +
        'border-radius:6px;font-size:12px;' + subjectStyle(s) + '">' +
        '<span>' + esc(s) + '</span><b style="margin-left:auto">' + got + '/' + need + '</b>' +
        (ok ? '' : '<span style="color:var(--err)">✕</span>') + '</div>';
    });
    const total = Object.keys(cnt).reduce((a, k) => a + cnt[k], 0);
    return '<div style="padding:12px 16px 16px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
      '<b style="font-size:13px">课时核对</b>' +
      '<span class="pill ' + (okAll && total === 30 ? 'g' : 'r') + '">' + total + ' / 30 节</span>' +
      (okAll && total === 30 ? '<span class="pill g">全部符合方案</span>' : '<span class="pill r">有出入</span>') +
      '</div><div style="display:flex;flex-wrap:wrap;gap:6px">' + cells + '</div></div>';
  }

  /* -------- 单班课表 -------- */
  function singleTable(cid) {
    const st = Store.state, c = Store.classById(cid);
    const sch = st.schedule[cid] || {};
    let h = '<table class="tt"><thead><tr><th class="period">节次</th><th>节次 / 时间</th>';
    st.days.forEach(d => h += '<th>' + esc(d) + '</th>');
    h += '</tr></thead><tbody>';

    const rows = [
      { t: 'extra', label: '早读', time: '8:15—8:30', key: 'read' },
      { t: 'p', p: 1 },
      { t: 'extra', label: '健身大课间', time: '9:40—10:10' },
      { t: 'p', p: 2 },
      { t: 'extra', label: '眼保健操', time: '上午' },
      { t: 'p', p: 3 },
      { t: 'extra', label: '午休时光', time: '12:20—14:00' },
      { t: 'extra', label: '练字一刻钟', time: '14:30—14:45' },
      { t: 'p', p: 4 },
      { t: 'extra', label: '眼保健操', time: '下午' },
      { t: 'p', p: 5 },
      { t: 'p', p: 6 },
      { t: 'extra', label: '课后个性发展时光', time: '16:55—17:55' }
    ];

    rows.forEach(r => {
      if (r.t === 'extra') {
        h += '<tr><th class="period">' + esc(r.label) + '<small>' + esc(r.time) + '</small></th>';
        if (r.key === 'read') {
          h += '<td class="extra"><b>早读</b></td>';
          st.days.forEach((d, i) => {
            const v = st.morningRead[i] || '';
            h += '<td class="extra"><b>' + esc(v) + '</b></td>';
          });
        } else {
          h += '<td class="extra" colspan="' + (st.days.length + 1) + '">' + esc(r.label) + '</td>';
        }
        h += '</tr>';
        return;
      }
      const pd = st.periods.find(x => x.p === r.p);
      h += '<tr><th class="period">' + esc(pd.name) + '<small>' + esc(pd.time) + '</small></th>';
      h += '<td class="extra"><b>' + (pd.half === 'am' ? '上午' : '下午') +
        (r.p >= 4 ? '第' + (r.p - 3) + '节' : '') + '</b></td>';
      for (let d = 1; d <= 5; d++) {
        h += tdCell(cid, d, r.p, sch[slotKey(d, r.p)]);
      }
      h += '</tr>';
    });

    h += '</tbody></table>';
    h = '<div style="padding:14px 16px 4px"><div style="font-size:15px;font-weight:600">' +
      esc(Store.state.meta.name) + esc(c.name) + ' 课程表' +
      '<span class="hint" style="font-weight:400;margin-left:10px">班主任：' + esc(c.headTeacher || '未指定') +
      '　语文：' + esc(c.cnTeacher || '—') + '　数学：' + esc(c.mathTeacher || '—') + '</span></div></div>' + h;
    return h;
  }

  function tdCell(cid, d, p, cell) {
    // 一、二年级固定空槽：周二~周五最后一节为大课间（不指定教师，不可拖拽）
    if (Store.isFixedEmpty(cid, d, p)) {
      return '<td class="fe"><div class="cell fe">大课间</div></td>';
    }
    const rs = isResearchCell(d, p);
    let cls = 'cell empty', inner = '';
    if (cell && cell.subject) {
      cls = 'cell';
      if (cell.locked) cls += ' locked';
      const fixed = Store.state.fixed.find(f => f.slot === slotKey(d, p) && f.subject === cell.subject);
      if (fixed) cls += ' pin';
      if (cell.kind === 'merge') {
        cls += ' merge';
        inner = '<div class="s">' + esc(cell.subject) + '</div>' +
          '<div class="t">' + esc(cell.teacher || '未指定') + '</div>' +
          '<div class="merge-tag">合堂</div>';
      } else {
        inner = '<div class="s">' + esc(cell.subject) + '</div>' +
          '<div class="t">' + esc(cell.teacher || '未指定') + '</div>';
      }
    }
    const style = (cell && cell.subject && cell.kind !== 'merge') ? subjectStyle(cell.subject) : '';
    return '<td class="' + (rs ? 'research' : '') + '" data-cid="' + cid + '" data-d="' + d + '" data-p="' + p + '">' +
      '<div class="' + cls + '" style="' + style + '" ' +
      'draggable="true" data-cid="' + cid + '" data-d="' + d + '" data-p="' + p + '">' + inner + '</div></td>';
  }

  /* -------- 年级纵览 -------- */
  function gradeTable(grade) {
    const st = Store.state;
    const cs = st.classes.filter(c => c.grade === grade);
    let h = '<table class="tt"><thead><tr><th class="period">节次</th>';
    cs.forEach(c => h += '<th>' + esc(c.short) + '</th>');
    h += '</tr></thead><tbody>';
    st.periods.forEach(pd => {
      h += '<tr><th class="period">' + esc(pd.name) + '<small>' + esc(pd.time) + '</small></th>';
      cs.forEach(c => {
        // 纵览按“星期”切换，这里默认显示星期一，配合星期切换条
        h += tdCell(c.id, UI.gridDay || 1, pd.p, (st.schedule[c.id] || {})[slotKey(UI.gridDay || 1, pd.p)]);
      });
      h += '</tr>';
    });
    h += '</tbody></table>';

    let head = '<div style="padding:14px 16px 8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<b style="font-size:14px">' + global.cnNum(grade) + '年级纵览</b>' +
      '<div class="tabs">' + st.days.map((d, i) =>
        '<button class="tab' + ((UI.gridDay || 1) === i + 1 ? ' on' : '') + '" data-gday="' + (i + 1) + '">' + esc(d) + '</button>'
      ).join('') + '</div></div>';
    return head + h;
  }

  /* ============================================================
   *  拖拽交互（候选区 + 课表格子，绿/红提示）
   * ============================================================ */
  function bindCells() {
    const area = $('ttArea'); if (!area) return;
    area.querySelectorAll('.cell').forEach(el => {
      const cid = el.dataset.cid, d = +el.dataset.d, p = +el.dataset.p;
      // 教师视图 / 纵览中的只读格子没有 data-cid，跳过（不绑定编辑与拖拽）
      if (!cid) return;
      const cell = (Store.state.schedule[cid] || {})[slotKey(d, p)];

      el.addEventListener('click', () => {
        if (UI._justDrag) return;
        openCellEditor(cid, d, p);
      });

      // 仅非空、未锁定、非固定的格子可作为拖拽源
      if (cell && cell.subject && !cell.locked && !cell.pinned) {
        el.setAttribute('draggable', 'true');
        el.addEventListener('dragstart', e => {
          UI._justDrag = true; el.classList.add('dragging');
          UI.drag = { type: 'cell', cid, d, p, subject: cell.subject };
          UI._dropCache = {};
          e.dataTransfer.effectAllowed = 'move';
          try { e.dataTransfer.setData('text/plain', cell.subject); } catch (x) {}
          setTimeout(() => { UI._justDrag = false; }, 200);
        });
        el.addEventListener('dragend', () => {
          el.classList.remove('dragging'); clearDropHints(); UI.drag = null;
        });
      } else {
        el.removeAttribute('draggable');
      }

      // 作为放置目标
      el.addEventListener('dragover', e => onCellDragOver(e, el));
      el.addEventListener('dragleave', () => el.classList.remove('drop-ok', 'drop-no', 'dragover'));
      el.addEventListener('drop', e => onCellDrop(e, el));
    });

    bindChipsAndTabs();
  }

  function bindChipsAndTabs() {
    const chips = $('classChips');
    if (chips) chips.querySelectorAll('[data-cls]').forEach(b => {
      b.onclick = () => { UI.curClass = b.dataset.cls; UI.focusType = 'class'; render(); };
    });
    document.querySelectorAll('[data-grade]').forEach(b => {
      b.onclick = () => {
        UI.curGrade = +b.dataset.grade;
        UI.curClass = Store.state.classes.find(c => c.grade === UI.curGrade).id;
        UI.focusType = 'class';
        render();
      };
    });
    document.querySelectorAll('[data-mode]').forEach(b => {
      b.onclick = () => { UI.mode = b.dataset.mode; UI.focusType = 'class'; render(); };
    });
    document.querySelectorAll('[data-gday]').forEach(b => {
      b.onclick = () => { UI.gridDay = +b.dataset.gday; render(); };
    });
    const bb = $('btnBackClass');
    if (bb) bb.onclick = () => { UI.focusType = 'class'; render(); };
    const bp = $('btnPrint');
    if (bp) bp.onclick = () => window.print();
  }

  /* 候选区 */
  function bindPool() {
    const pool = $('pool'); if (!pool) return;
    const cid = pool.dataset.cid;
    pool.querySelectorAll('.pool-item[draggable="true"]').forEach(el => {
      el.addEventListener('dragstart', e => {
        UI._justDrag = true; el.classList.add('dragging');
        UI.drag = { type: 'pool', cid, subject: el.dataset.subj };
        UI._dropCache = {};
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', el.dataset.subj); } catch (x) {}
        setTimeout(() => { UI._justDrag = false; }, 200);
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging'); clearDropHints(); UI.drag = null;
      });
    });

    // 把课表格子拖回候选区 → 移除
    pool.addEventListener('dragover', e => {
      if (!UI.drag || UI.drag.type !== 'cell' || UI.drag.cid !== cid) return;
      e.preventDefault();
      pool.classList.add('drop-ok');
      e.dataTransfer.dropEffect = 'move';
    });
    pool.addEventListener('dragleave', () => pool.classList.remove('drop-ok'));
    pool.addEventListener('drop', e => {
      e.preventDefault();
      pool.classList.remove('drop-ok');
      const drag = UI.drag;
      clearDropHints(); UI.drag = null;
      if (!drag || drag.type !== 'cell' || drag.cid !== cid) return;
      const st = Store.state;
      const k = slotKey(drag.d, drag.p);
      const cell = st.schedule[cid][k];
      if (cell && cell.subject) {
        delete st.schedule[cid][k];
        toast('已移除「' + cell.subject + '」，回到候选区', 'ok');
      }
      render();
    });
  }

  function clearDropHints() {
    document.querySelectorAll('.drop-ok,.drop-no,.dragover').forEach(el =>
      el.classList.remove('drop-ok', 'drop-no', 'dragover'));
  }

  /* 落点合法性判断（带缓存） */
  function dropCheck(cid, d, p) {
    const drag = UI.drag;
    const key = drag.type + '|' + drag.cid + '|' + drag.d + '|' + drag.p + '|' +
      drag.subject + '|' + cid + '|' + d + '|' + p;
    if (UI._dropCache[key]) return UI._dropCache[key];

    const st = Store.state;
    const k = slotKey(d, p);
    const target = (st.schedule[cid] || {})[k];
    let r;
    if (drag.type === 'cell') {
      if (drag.cid === cid && drag.d === d && drag.p === p) r = { ok: false, reason: '同一格' };
      else r = swapCheck(drag.cid, drag.d, drag.p, cid, d, p);
    } else {
      if (drag.cid !== cid) r = { ok: false, reason: '候选块只能拖回本班' };
      else if (target && target.locked) r = { ok: false, reason: '该格已锁定' };
      else if (target && target.pinned) r = { ok: false, reason: '该格是全校固定课' };
      else {
        const ex = {}; ex[cid + '|' + k] = 1;
        r = Engine.canPlace(cid, d, p, drag.subject, ex);
      }
    }
    UI._dropCache[key] = r;
    return r;
  }

  function swapCheck(aCid, aD, aP, bCid, bD, bP) {
    const st = Store.state;
    const a = (st.schedule[aCid] || {})[slotKey(aD, aP)];
    const b = (st.schedule[bCid] || {})[slotKey(bD, bP)];
    if (!a || !a.subject) return { ok: false, reason: '源格为空' };
    if (a.locked) return { ok: false, reason: '源格已锁定' };
    if (a.pinned) return { ok: false, reason: '源格是全校固定课' };
    if (b && b.locked) return { ok: false, reason: '目标格已锁定' };
    if (b && b.pinned) return { ok: false, reason: '目标格是全校固定课' };

    const ex = {};
    ex[aCid + '|' + slotKey(aD, aP)] = 1;
    ex[bCid + '|' + slotKey(bD, bP)] = 1;
    const r1 = Engine.canPlace(bCid, bD, bP, a.subject, ex);
    if (!r1.ok) return { ok: false, reason: '「' + a.subject + '」放过去：' + r1.reason };
    if (b && b.subject) {
      const r2 = Engine.canPlace(aCid, aD, aP, b.subject, ex);
      if (!r2.ok) return { ok: false, reason: '「' + b.subject + '」换回来：' + r2.reason };
    }
    return { ok: true };
  }

  function onCellDragOver(e, el) {
    if (!UI.drag) return;
    e.preventDefault();
    const r = dropCheck(el.dataset.cid, +el.dataset.d, +el.dataset.p);
    el.classList.remove('drop-ok', 'drop-no');
    el.classList.add(r.ok ? 'drop-ok' : 'drop-no');
    e.dataTransfer.dropEffect = r.ok ? 'move' : 'none';
  }

  function onCellDrop(e, el) {
    e.preventDefault();
    const cid = el.dataset.cid, d = +el.dataset.d, p = +el.dataset.p;
    const r = dropCheck(cid, d, p);
    clearDropHints();
    const drag = UI.drag; UI.drag = null;
    if (!r.ok) { toast('不能这样放：' + (r.reason || '该位置不可用'), 'warn'); return; }
    if (drag.type === 'cell') doSwap(drag.cid, drag.d, drag.p, cid, d, p);
    else doPlaceFromPool(cid, d, p, drag.subject);
  }

  function doSwap(aCid, aD, aP, bCid, bD, bP) {
    const st = Store.state;
    const ka = slotKey(aD, aP), kb = slotKey(bD, bP);
    const a = st.schedule[aCid][ka], b = st.schedule[bCid][kb];
    const ex = {}; ex[aCid + '|' + ka] = 1; ex[bCid + '|' + kb] = 1;
    // 教师跟随「班级」重新指派（同班交换时不变，跨班交换时换成目标班任课教师）
    const ra = Engine.canPlace(bCid, bD, bP, a.subject, ex);
    st.schedule[bCid][kb] = { subject: a.subject, teacher: ra.teacher || a.teacher };
    if (b && b.subject) {
      const rb = Engine.canPlace(aCid, aD, aP, b.subject, ex);
      st.schedule[aCid][ka] = { subject: b.subject, teacher: rb.teacher || b.teacher };
    } else {
      delete st.schedule[aCid][ka];
    }
    toast('已交换', 'ok');
    render();
  }

  function doPlaceFromPool(cid, d, p, subject) {
    const st = Store.state;
    const k = slotKey(d, p);
    const ex = {}; ex[cid + '|' + k] = 1;
    const r = Engine.canPlace(cid, d, p, subject, ex);
    const old = st.schedule[cid][k];
    st.schedule[cid][k] = { subject, teacher: r.teacher || '' };
    toast('已放置「' + subject + '」' + (r.teacher ? '（' + r.teacher + '）' : '') +
      (old && old.subject ? '，原「' + old.subject + '」已回候选区' : ''), 'ok');
    render();
  }

  /* -------- 格子编辑器 -------- */
  function openCellEditor(cid, d, p) {
    const st = Store.state;
    const c = Store.classById(cid);
    const k = slotKey(d, p);
    const cell = (st.schedule[cid] || {})[k] || {};
    const rsGroups = researchGroupsAt(d, p);

    let h = '';
    h += '<div class="fld"><label>位置</label><div style="font-size:14px;font-weight:600">' +
      esc(c.name) + '　星期' + global.cnNum(d) + '　第' + p + '节' +
      (rsGroups.length ? '　<span class="pill p">' + rsGroups.join('、') + '教研</span>' : '') +
      '</div></div>';

    h += '<div class="fld"><label>科目</label><div class="opt-grid" id="subjOpts">';
    const plan = st.plan[c.grade] || {};
    const names = Object.keys(plan).length ? Object.keys(plan) : st.subjects.map(s => s.name);
    const all = names.concat(st.subjects.map(s => s.name).filter(n => names.indexOf(n) < 0));
    all.forEach(n => {
      const cnt = Object.keys(st.schedule[cid]).filter(kk => st.schedule[cid][kk].subject === n).length;
      const need = plan[n] || 0;
      h += '<button class="opt' + (cell.subject === n ? ' on' : '') + '" data-subj="' + esc(n) + '" ' +
        'style="' + (cell.subject === n ? '' : subjectStyle(n)) + '">' + esc(n) +
        (need ? ' <span style="opacity:.6;font-size:11px">' + cnt + '/' + need + '</span>' : '') + '</button>';
    });
    h += '</div></div>';

    h += '<div class="fld"><label>任课教师</label><select id="tchSel"></select></div>';
    h += '<div class="fld"><label><input type="checkbox" id="lockChk"' + (cell.locked ? ' checked' : '') + '> 锁定此格（自动排课时不改动）</label></div>';

    modal('编辑课时', h, [
      { text: '清除', cls: 'btn dg', fn: () => { delete st.schedule[cid][k]; closeModal(); render(); } },
      { text: '取消', cls: 'btn', fn: closeModal },
      { text: '保存', cls: 'btn pri', fn: () => {
          const s = $('subjOpts').querySelector('.on');
          const t = $('tchSel').value;
          const lk = $('lockChk').checked;
          if (!s) { toast('请选择科目', 'warn'); return; }
          st.schedule[cid][k] = { subject: s.dataset.subj, teacher: t || '', locked: lk };
          closeModal(); render();
        } }
    ]);

    // 科目点击 -> 刷新候选教师
    function refreshTeachers(subj) {
      const sel = $('tchSel'); if (!sel) return;
      const cands = Store.candidatesFor(cid, subj);
      const allT = st.teachers.filter(t => !t.nonTeaching).map(t => t.name);
      const list = cands.concat(allT.filter(n => cands.indexOf(n) < 0));
      let opts = '';
      if (cands.length) {
        opts += '<optgroup label="推荐">' + cands.map(n => {
          const ban = Store.teacherBusyForResearch(n, d, p);
          const at = Store.teacherAt(n, d, p);
          return '<option value="' + esc(n) + '"' + (cell.teacher === n ? ' selected' : '') + '>' +
            esc(n) + (ban ? '（教研时间，冲突）' : at ? '（已排 ' + Store.classById(at).short + '）' : '') + '</option>';
        }).join('') + '</optgroup>';
      }
      opts += '<optgroup label="全部教师">' +
        allT.filter(n => cands.indexOf(n) < 0).map(n =>
          '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('') + '</optgroup>';
      sel.innerHTML = '<option value="">（不指定）</option>' + opts;
      if (cell.teacher) sel.value = cell.teacher;
    }
    refreshTeachers(cell.subject || '');
    $('subjOpts').querySelectorAll('[data-subj]').forEach(b => {
      b.onclick = () => {
        $('subjOpts').querySelectorAll('[data-subj]').forEach(x => {
          x.classList.remove('on'); x.removeAttribute('style');
        });
        b.classList.add('on');
        refreshTeachers(b.dataset.subj);
      };
    });
  }

  /* ============================================================
   *  视图：教师课表
   * ============================================================ */
  function viewTeacher() {
    const st = Store.state;
    let list = st.teachers.filter(t => !t.nonTeaching);
    if (UI.teacherFilter) {
      const f = UI.teacherFilter;
      list = list.filter(t =>
        t.name.indexOf(f) >= 0 ||
        t.groups.join().indexOf(f) >= 0 ||
        t.duties.some(d => d.subject.indexOf(f) >= 0));
    }
    if (!UI.curTeacher || !Store.teacherByName(UI.curTeacher)) {
      UI.curTeacher = list.length ? list[0].name : '';
    }

    let h = '';
    h += '<div class="card"><div class="card-h">' +
      '<input type="text" id="tFilter" placeholder="搜索教师 / 科组 / 科目" value="' + esc(UI.teacherFilter) + '" style="width:210px;padding:6px 9px;border:1px solid var(--line);border-radius:7px">' +
      '<span class="sp"></span><span class="hint" id="tLoad"></span></div>' +
      '<div class="card-b"><div class="chips" style="max-height:150px;overflow:auto">';
    list.slice(0, 400).forEach(t => {
      h += '<button class="chip' + (t.name === UI.curTeacher ? ' on' : '') + '" data-t="' + esc(t.name) + '">' +
        esc(t.name) + ' <span style="opacity:.6">' + t.groups.map(g => g[0]).join('') + '</span></button>';
    });
    h += '</div></div></div>';

    h += '<div class="card"><div class="card-b tight"><div class="tt-wrap">' +
      teacherTable(UI.curTeacher) + '</div></div></div>';

    h += '<div class="card"><div class="card-h"><h3>任课明细</h3></div><div class="card-b tight"><div class="tbl-scroll">' +
      teacherDutyTable(UI.curTeacher) + '</div></div></div>';

    return h;
  }

  function teacherTable(name) {
    const st = Store.state;
    const t = Store.teacherByName(name);
    if (!t) return '<div class="empty-tip">请选择教师</div>';
    let h = '<table class="tt"><thead><tr><th class="period">节次</th>';
    st.days.forEach(d => h += '<th>' + esc(d) + '</th>');
    h += '</tr></thead><tbody>';
    st.periods.forEach(pd => {
      h += '<tr><th class="period">' + esc(pd.name) + '<small>' + esc(pd.time) + '</small></th>';
      for (let d = 1; d <= 5; d++) {
        const k = slotKey(d, pd.p);
        const rs = t.groups.filter(g => Store.isResearchSlot(g, d, pd.p));
        let content = '', cls = 'cell empty', style = '';
        if (rs.length) {
          cls = 'cell';
          style = 'background:var(--rs-l);color:var(--rs)';
          content = '<div class="s" style="font-size:12px">教研</div>';
        } else {
          const found = [];
          let mergeCell = null;
          st.classes.forEach(c => {
            const cell = (st.schedule[c.id] || {})[k];
            if (cell && cell.teacher === name) {
              if (cell.kind === 'merge') { mergeCell = cell; return; }
              found.push(c.short + ' ' + cell.subject);
            }
          });
          if (mergeCell) {
            // 合堂课：显示科目 + 合堂班级列表
            cls = 'cell merge';
            content = '<div class="s" style="font-size:12px">' + esc(mergeCell.subject) + '</div>' +
              '<div class="t" style="font-size:10.5px">' + esc(mergeCell.classIdsLabel || '合堂') + '</div>';
          } else if (found.length) {
            cls = 'cell';
            content = found.map(x => '<div class="s" style="font-size:12px">' + esc(x) + '</div>').join('');
          }
        }
        h += '<td class="' + (rs.length ? 'research' : '') + '"><div class="' + cls + '" style="' + style + '">' +
          content + '</div></td>';
      }
      h += '</tr>';
    });
    h += '</tbody></table>';
    return '<div style="padding:14px 16px 6px"><b style="font-size:15px">' + esc(name) + '</b>' +
      '<span class="hint">　' + t.groups.join(' / ') + (t.note ? '　· ' + esc(t.note) : '') + '</span></div>' + h;
  }

  function teacherDutyTable(name) {
    const t = Store.teacherByName(name);
    if (!t) return '';
    let h = '<table class="tb"><thead><tr><th>班级</th><th>科目</th><th class="c">已排</th><th class="c">操作</th></tr></thead><tbody>';
    t.duties.forEach(d => {
      const c = Store.classById(d.classId);
      const n = Object.keys(Store.state.schedule[d.classId] || {})
        .filter(k => Store.state.schedule[d.classId][k].teacher === name &&
                     Store.state.schedule[d.classId][k].subject === d.subject).length;
      h += '<tr><td>' + esc(c ? c.name : d.classId) + '</td><td>' + esc(d.subject) + '</td>' +
        '<td class="c">' + n + '</td><td class="c">' +
        '<button class="btn sm" data-jump="' + d.classId + '">查看班级</button></td></tr>';
    });
    h += '</tbody></table>';
    return h || '<div class="empty-tip">暂无任课</div>';
  }

  /* ============================================================
   *  视图：教研时间
   * ============================================================ */
  function viewResearch() {
    const st = Store.state;
    let h = '';
    h += '<div class="card"><div class="card-h"><h3>集体教研（集体备课）时段</h3>' +
      '<span class="sp"></span><span class="hint">点击格子切换该科组的教研时间</span></div>';
    h += '<div class="card-b">';
    st.research.forEach((r, ri) => {
      const members = st.teachers.filter(t => t.groups.indexOf(r.group) >= 0 && !t.nonTeaching);
      h += '<div style="margin-bottom:18px">';
      h += '<div style="margin-bottom:7px"><b>' + esc(r.group) + '</b>' +
        '<span class="hint">　' + members.length + ' 人　当前：' + esc(r.note || r.slots.join('、')) + '</span></div>';
      h += '<table class="tt" style="min-width:600px"><thead><tr><th class="period">节次</th>';
      st.days.forEach(d => h += '<th>' + esc(d) + '</th>');
      h += '</tr></thead><tbody>';
      st.periods.forEach(pd => {
        h += '<tr><th class="period">' + esc(pd.name) + '</th>';
        for (let d = 1; d <= 5; d++) {
          const on = r.slots.indexOf(slotKey(d, pd.p)) >= 0;
          h += '<td><div class="cell" data-ri="' + ri + '" data-d="' + d + '" data-p="' + pd.p + '" ' +
            'style="cursor:pointer;' + (on ? 'background:var(--rs-l);color:var(--rs)' : '') + '">' +
            '<div class="s" style="font-size:12px">' + (on ? '教研' : '') + '</div></div></td>';
        }
        h += '</tr>';
      });
      h += '</tbody></table></div>';
    });
    h += '</div></div>';

    // 教研时段占用统计
    h += '<div class="card"><div class="card-h"><h3>教研时段排课影响</h3></div><div class="card-b tight"><div class="tbl-scroll">';
    h += '<table class="tb"><thead><tr><th>科组</th><th>时段</th><th class="c">涉及教师</th>' +
      '<th class="c">该时段仍被排课</th><th class="c">需由其他科组承担</th></tr></thead><tbody>';
    Engine.researchReport().forEach(r => {
      const bad = r.assigned;
      h += '<tr><td>' + esc(r.group) + '</td><td>星期' + global.cnNum(r.day) + ' 第' + r.period + '节</td>' +
        '<td class="c">' + r.teachers + ' 人</td>' +
        '<td class="c">' + (bad ? '<span class="pill r">' + bad + ' 节冲突</span>' : '<span class="pill g">0</span>') + '</td>' +
        '<td class="c">' + Store.state.classes.length + ' 节</td></tr>';
    });
    h += '</tbody></table></div></div></div>';

    h += '<div class="card"><div class="card-b hint">' +
      '<b>说明</b>：教研时段内该科组教师不排课。因此这些时段的课必须由其他科组教师承担——<br>' +
      '· 星期二第5、6节（发展组教研）→ 只能排语文 / 数学等本班科目；<br>' +
      '· 星期三第5、6节（语文组教研）→ 只能排数学 / 发展学科；<br>' +
      '· 星期四第5、6节（数学组教研）→ 只能排语文 / 发展学科。<br>' +
      '自动排课会优先处理这些受限时段。' +
      '</div></div>';
    return h;
  }

  /* ============================================================
   *  视图：课时方案
   * ============================================================ */
  function viewPlan() {
    const st = Store.state;
    // 分组展示：主科 / 专职 / 语文老师兼 / 数学老师兼 / 专职优先 / 班主任
    const GROUPS = [
      { key: 'main',    title: '主科（节数按省厅规定）',         test: s => s.name === '语文' || s.name === '数学' || s.name === '英语' },
      { key: 'spec',    title: '专职教师',                       test: s => s.mode === 'specialist' },
      { key: 'cn',      title: '语文老师兼任',                   test: s => s.mode === 'classChinese' },
      { key: 'math',    title: '数学老师兼任（课表上写该科名）',  test: s => s.mode === 'classMath' || s.mode === 'autoMath' },
      { key: 'auto',    title: '专职优先，缺则本班语文',         test: s => s.mode === 'auto' },
      { key: 'head',    title: '班主任',                         test: s => s.mode === 'headTeacher' }
    ];
    let h = '';
    h += '<div class="card"><div class="card-h"><h3>各年级周课时方案</h3>' +
      '<span class="sp"></span><button class="btn sm" id="btnPlanRe">恢复默认</button>' +
      '<span class="hint">每周 5 天 × 6 节 = 30 节</span></div>';
    h += '<div class="card-b hint" style="padding-top:10px">科目已按「专职（一）/ 兼职（二）」拆分：' +
      '<b style="color:var(--ok)">专职</b>（音乐一/美术一/科学一/体育一等）由专职教师上；' +
      '<b style="color:var(--warn)">兼职</b>（音乐二/美术二/科学二/科学三/体育二/信息技术二/综合实践等）由本班数学老师上，' +
      '课表上科目名照写（如「美术二」），不算数学课时。</div>';
    GROUPS.forEach(g => {
      const subs = st.subjects.filter(g.test);
      if (!subs.length) return;
      h += '<div class="card-b tight" style="padding-top:4px"><div class="tbl-scroll"><table class="tb"><thead><tr>' +
        '<th colspan="8" style="background:#f0fdf4;color:var(--ok)">◆ ' + esc(g.title) + '</th></tr></thead>' +
        '<tbody><tr><th style="min-width:110px">科目</th>' + [1, 2, 3, 4, 5, 6].map(gg =>
          '<th class="c">' + global.cnNum(gg) + '年级</th>').join('') +
        '<th class="c">承担方式</th></tr>';
      subs.forEach(s => {
        const subj = Store.subjectByName(s.name);
        h += '<tr><td><span style="display:inline-block;width:9px;height:9px;border-radius:2px;' +
          subjectStyle(s.name) + ';margin-right:6px"></span>' + esc(s.name) + '</td>';
        for (let gg = 1; gg <= 6; gg++) {
          const v = (st.plan[gg] || {})[s.name] || 0;
          h += '<td class="c"><input type="number" min="0" max="20" value="' + v + '" data-g="' + gg + '" data-s="' + esc(s.name) + '"></td>';
        }
        h += '<td class="c" style="font-size:12px;color:var(--tx2)">' + modeText(subj ? subj.mode : '') + '</td></tr>';
      });
      h += '</tbody></table></div></div>';
    });
    // 合计行
    h += '<div class="card-b tight"><div class="tbl-scroll"><table class="tb"><thead><tr><th style="min-width:110px">合计</th>' +
      [1, 2, 3, 4, 5, 6].map(gg => '<th class="c">' + global.cnNum(gg) + '年级</th>').join('') +
      '<th class="c"></th></tr></thead><tbody><tr style="background:#f8fafc;font-weight:600"><td>每周总课时</td>';
    for (let gg = 1; gg <= 6; gg++) {
      const sum = st.subjects.reduce((a, s) => a + ((st.plan[gg] || {})[s.name] || 0), 0);
      h += '<td class="c" id="sum' + gg + '" style="color:' + (sum === 30 ? 'var(--ok)' : (sum === 26 ? 'var(--ok)' : 'var(--err)')) + '">' + sum + '</td>';
    }
    h += '<td class="c" style="font-size:12px;color:var(--tx3)">一、二年级 26 节（省厅），三~六年级 30 节</td></tr>' +
      '</tbody></table></div></div></div>';
    return h;
  }
  function modeText(m) {
    return { specialist: '专职教师', classChinese: '本班语文老师', classMath: '本班数学老师',
             autoMath: '本班数学老师', headTeacher: '班主任', auto: '专职优先，否则本班语文' }[m] || m;
  }

  /* ============================================================
   *  视图：教师任课
   * ============================================================ */
  function viewDuty() {
    const st = Store.state;
    let h = '';
    const issues = Engine.countConflicts();
    h += '<div class="card"><div class="card-h"><h3>教师任课与课时统计</h3>' +
      '<span class="sp"></span><span class="hint">已排 = 课表中实际安排的节数（教研时间不计入）；应排 = 该教师承担的班级科目按课时方案合计</span></div>';
    h += '<div class="card-b tight"><div class="tbl-scroll"><table class="tb"><thead><tr>' +
      '<th>教师</th><th>科组</th><th>任课班级 / 科目</th><th class="c">已排</th>' +
      '<th class="c">应排</th><th class="c">表内课时</th><th>备注</th></tr></thead><tbody>';

    st.teachers.filter(t => !t.nonTeaching).forEach(t => {
      const should = Store.expectedLoad(t.name);
      const placed = Store.teacherLoad(t.name);
      const pct = should ? Math.min(100, Math.round(placed / should * 100)) : 0;
      const duties = t.duties.slice(0, 8).map(d => {
        const c = Store.classById(d.classId);
        return (c ? c.short : d.classId) + '·' + d.subject;
      }).join('　');
      h += '<tr><td><b>' + esc(t.name) + '</b></td>' +
        '<td style="font-size:12px">' + t.groups.map(g => '<span class="pill b">' + esc(g) + '</span>').join('') + '</td>' +
        '<td style="font-size:12px;color:var(--tx2)">' + esc(duties) +
        (t.duties.length > 8 ? ' 等 ' + t.duties.length + ' 项' : '') + '</td>' +
        '<td class="c"><b style="color:' + (placed === should ? 'var(--ok)' : 'var(--warn)') + '">' + placed + '</b></td>' +
        '<td class="c">' + should + '</td>' +
        '<td class="c">' + (t.declared || '—') + '</td>' +
        '<td style="font-size:12px;color:var(--tx3)">' + esc(t.note || '') +
        (t.assistant ? '<span class="pill">部门助理</span>' : '') + '</td></tr>';
    });
    h += '</tbody></table></div></div></div>';

    // 缺教师的班级科目
    const noT = Store.noTeacherReport();
    if (noT.length) {
      h += '<div class="card"><div class="card-h"><h3 style="color:var(--err)">⚠ 找不到任课教师的班级科目</h3>' +
        '<span class="hint">在右侧直接指定一位教师，然后重新自动排课即可</span></div>' +
        '<div class="card-b">';
      noT.forEach(x => {
        h += '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--line2)">' +
          '<span class="chip bad">' + esc(x.name) + '「' + esc(x.subject) + '」' + x.count + '节</span>' +
          '<select data-quick="' + x.classId + '|' + esc(x.subject) + '" style="padding:5px 8px;border:1px solid var(--line);border-radius:7px">' +
          '<option value="">— 指定任课教师 —</option>' +
          st.teachers.filter(t => !t.nonTeaching).map(t =>
            '<option value="' + esc(t.name) + '">' + esc(t.name) + '（' + t.groups.map(g => g[0]).join('') + '）</option>').join('') +
          '</select></div>';
      });
      h += '<div class="hint" style="padding-top:9px">提示：若缺的科目对应教师被列在下方「不排课人员」里' +
        '（例如三（4）班数学的农丽春被列为财务室出纳），也可到那里点姓名恢复排课。</div>';
      h += '</div></div>';
    }

    // 班级科目承担人
    h += '<div class="card"><div class="card-h"><h3>班级科目承担人</h3>' +
      '<select id="ovClass" style="padding:5px 8px;border:1px solid var(--line);border-radius:7px">' +
      st.classes.map(c => '<option value="' + c.id + '"' + (c.id === (UI.ovClass || UI.curClass) ? ' selected' : '') + '>' +
        esc(c.name) + '</option>').join('') + '</select>' +
      '<span class="hint">可覆盖系统默认的任课教师（例如某班数学换人、某科由班主任兼）</span></div>';
    h += '<div class="card-b tight"><div class="tbl-scroll">' + overrideTable(UI.ovClass || UI.curClass) + '</div></div></div>';

    // 不排课人员
    h += '<div class="card"><div class="card-h"><h3>不排课人员</h3>' +
      '<span class="hint">点击姓名可切换「恢复排课」</span></div><div class="card-b">';
    const nt = st.teachers.filter(t => t.nonTeaching);
    h += nt.length ? nt.map(t => '<button class="chip bad" data-nt="' + esc(t.name) + '" style="margin:2px">' +
      esc(t.name) + ' ↺</button>').join('') : '<span class="hint">（无）</span>';
    h += '</div></div>';
    return h;
  }

  function overrideTable(cid) {
    const st = Store.state;
    const c = Store.classById(cid); if (!c) return '';
    const plan = st.plan[c.grade] || {};
    const ov = st.overrides[cid] || {};
    let h = '<table class="tb"><thead><tr><th>科目</th><th class="c">周课时</th>' +
      '<th>默认承担人</th><th>指定承担人</th><th class="c">已排</th></tr></thead><tbody>';
    Object.keys(plan).forEach(s => {
      if (!plan[s]) return;
      const def = (function () {
        const mode = (Store.subjectByName(s) || {}).mode;
        if (mode === 'headTeacher') return c.headTeacher || '—';
        if (mode === 'classChinese') return c.cnTeacher || '—';
        if (mode === 'classMath') return c.mathTeacher || '—';
        const spec = st.teachers.filter(t => !t.nonTeaching &&
          t.duties.some(d => d.classId === cid && d.subject === s)).map(t => t.name);
        if (spec.length) return spec.join('、');
        return (Store.subjectByName(s) || {}).mode === 'specialist' ? '（无）' : (c.cnTeacher || '—');
      })();
      const cur = ov[s] || '';
      const placed = Object.keys(st.schedule[cid] || {})
        .filter(k => st.schedule[cid][k].subject === s).length;
      const allT = st.teachers.filter(t => !t.nonTeaching).map(t => t.name);
      h += '<tr><td>' + esc(s) + '</td><td class="c">' + plan[s] + '</td>' +
        '<td style="color:var(--tx2)">' + esc(def) + '</td>' +
        '<td><select data-ov="' + esc(s) + '" style="padding:3px 6px;border:1px solid var(--line);border-radius:6px">' +
        '<option value="">（按默认）</option>' +
        allT.map(n => '<option value="' + esc(n) + '"' + (cur === n ? ' selected' : '') + '>' + esc(n) + '</option>').join('') +
        '</select></td><td class="c">' + placed + '</td></tr>';
    });
    h += '</tbody></table>';
    return h;
  }

  /* ============================================================
   *  视图：冲突检查
   * ============================================================ */
  function viewIssues() {
    const issues = Engine.countConflicts();
    const err = issues.filter(i => i.level === 'error');
    const warn = issues.filter(i => i.level === 'warn');
    let h = '';
    h += '<div class="stats">' +
      stat(err.length, '硬性冲突', err.length ? 'r' : 'g') +
      stat(warn.length, '提醒项', warn.length ? 'o' : 'g') +
      stat(issues.filter(i => i.type === 'clash').length, '教师撞课', 'b') +
      stat(issues.filter(i => i.type === 'research').length, '教研冲突', 'b') +
      stat(issues.filter(i => i.type === 'empty').length, '未排满班级', 'b') +
      '</div>';
    h += '<div class="card"><div class="card-h"><h3>问题清单</h3><span class="sp"></span>' +
      '<div class="tabs">' +
      ['all:全部', 'error:仅冲突', 'warn:仅提醒'].map(x => {
        const [v, t] = x.split(':');
        return '<button class="tab' + (UI.issueFilter === v ? ' on' : '') + '" data-if="' + v + '">' + t + '</button>';
      }).join('') + '</div></div><div class="card-b tight">';
    const list = UI.issueFilter === 'all' ? issues :
      UI.issueFilter === 'error' ? err : warn;
    if (!list.length) h += '<div class="empty-tip">✓ 没有发现问题</div>';
    list.slice(0, 800).forEach(i => {
      h += '<div class="issue ' + i.level + '"><span class="tag">' +
        (i.level === 'error' ? '冲突' : '提醒') + '</span><span class="txt">' + esc(i.text) + '</span></div>';
    });
    if (list.length > 800) h += '<div class="empty-tip">仅显示前 800 条</div>';
    h += '</div></div>';
    return h;
  }

  /* ============================================================
   *  视图：数据与导出
   * ============================================================ */
  function viewData() {
    const st = Store.state;
    let h = '';
    h += '<div class="grid2">';
    h += '<div class="card"><div class="card-h"><h3>导出 Excel</h3></div><div class="card-b">' +
      '<div style="display:flex;flex-direction:column;gap:9px">' +
      '<button class="btn pri" data-exp="classes">导出班级课程表（每班一张工作表，39 张）</button>' +
      '<button class="btn" data-exp="teachers">导出教师课表（每位老师一张工作表）</button>' +
      '<button class="btn" data-exp="duty">导出教师任课与课时统计</button>' +
      '<button class="btn" data-exp="all">导出年级总课表（纵览）</button>' +
      '</div><div class="hint" style="margin-top:11px">导出的 .xlsx 可直接用 Excel / WPS 打开：班级表每班一个标签页，' +
      '方便拆分发送；教师表每位老师一个标签页，格式与班级课表一致、带任课班别信息，教研时间显示「教研」且不计课时。</div>' +
      '</div></div>';

    h += '<div class="card"><div class="card-h"><h3>备份与恢复</h3></div><div class="card-b">' +
      '<div style="display:flex;flex-direction:column;gap:9px">' +
      '<button class="btn" data-exp="json">导出备份（JSON）</button>' +
      '<button class="btn" id="btnImport">从备份恢复</button>' +
      '<input type="file" id="fileImport" accept=".json" style="display:none">' +
      '<button class="btn dg" id="btnClearSchedule">清空所有课表</button>' +
      '<button class="btn dg" id="btnResetAll">恢复初始数据（全部重置）</button>' +
      '</div><div class="hint" style="margin-top:11px">' +
      '当前排课数据保存在本机浏览器。换电脑或清缓存前请先导出备份。</div>' +
      '</div></div>';
    h += '</div>';

    h += '<div class="card"><div class="card-h"><h3>系统设置</h3></div><div class="card-b">' +
      '<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center">' +
      '<label>同一教师在同一班一天最多 <input type="number" id="optMax" min="1" max="6" value="' +
        st.options.maxLessonsPerDay + '" style="width:52px;padding:4px 6px;border:1px solid var(--line);border-radius:6px"> 节</label>' +
      '<label>同班同科目一天最多 <input type="number" id="optSame" min="1" max="4" value="' +
        (Store.state.options.maxSameSubjectPerDay || 2) + '" style="width:52px;padding:4px 6px;border:1px solid var(--line);border-radius:6px"> 节</label>' +
      '<button class="btn sm" id="btnOptSave">保存设置</button>' +
      '</div></div></div>';

    // 功能场所
    h += '<div class="card"><div class="card-h"><h3>功能场所（功能室）</h3>' +
      '<span class="hint">勾选启用后，自动排课会保证同一时段使用该功能室的班数不超过容量</span></div>' +
      '<div class="card-b tight"><table class="tb"><thead><tr>' +
      '<th class="c">启用</th><th>功能室</th><th>适用科目</th><th class="c">容量（同时间可上班级数）</th></tr></thead><tbody>';
    (st.rooms || []).forEach(r => {
      h += '<tr><td class="c"><input type="checkbox" data-room-on="' + r.id + '"' + (r.enabled ? ' checked' : '') + '></td>' +
        '<td><b>' + esc(r.name) + '</b></td>' +
        '<td style="color:var(--tx2)">' + r.subjects.join('、') + '</td>' +
        '<td class="c"><input type="number" min="1" max="10" value="' + r.capacity + '" data-room-cap="' + r.id + '"></td></tr>';
    });
    h += '</tbody></table></div>' +
      '<div class="card-b hint" style="padding-top:8px">默认仅启用「电脑室」（信息课必须上机）。' +
      '科学、音乐、美术、书法课默认在教室上，如需占用对应功能室请勾选启用。</div></div>';

    // 待确认事项
    const todos = (global.SCHOOL_DATA.TODO_CONFIRM || []);
    if (todos.length) {
      h += '<div class="card"><div class="card-h"><h3>⚠ 待确认事项</h3>' +
        '<span class="hint">解析两份原始表时发现的问题，请核对</span></div><div class="card-b tight">';
      todos.forEach(t => {
        h += '<div class="issue ' + (t.level === 'error' ? 'error' : 'warn') + '">' +
          '<span class="tag">' + (t.level === 'error' ? '待补' : '核对') + '</span>' +
          '<span class="txt">' + esc(t.text) + '</span></div>';
      });
      h += '</div></div>';
    }

    h += '<div class="card"><div class="card-h"><h3>数据来源</h3></div><div class="card-b hint">' +
      '· 教师任课：<b>(8.28)天等县城西小学2026年秋季学期教师任课工作安排表(3).xlsx</b><br>' +
      '· 课表结构：<b>天等县城西小学五（2）班2026年秋季学期班级课程表.xlsx</b>（上午3节 + 下午3节）<br>' +
      '· 全校 ' + st.classes.length + ' 个教学班，' + st.teachers.filter(t => !t.nonTeaching).length + ' 位任课教师。<br>' +
      '· 班主任已按任课表中带下划线的姓名识别，共 ' +
      Object.keys(global.SCHOOL_DATA.HEAD_TEACHERS).length + ' 人。' +
      '</div></div>';
    return h;
  }

  /* ============================================================
   *  导出 Excel
   * ============================================================ */
  /* ================= 导出：班级课程表（每班一张工作表） ================= */
  function exportClasses() {
    const st = Store.state;
    const sheets = [];

    // 说明表（第一张）
    sheets.push({
      name: '说明', cols: [16, 16, 16, 16, 16], rows: [
        { h: 30, cells: [{ v: st.meta.name + st.meta.term + '班级课程表', s: 1, merge: [0, 4] }] },
        { h: 20, cells: [{ v: '共 ' + st.classes.length + ' 个班，每班一张工作表（一1班、一2班……），可单独打印或发送给各班班主任。', s: 5, merge: [0, 4] }] },
        { h: 20, cells: [{ v: '作息：上午 3 节 + 下午 3 节，每周 30 节；早读、大课间、眼保健操、午休、练字、课后服务不占课时。', s: 5, merge: [0, 4] }] },
        { h: 20, cells: [{ v: '星期一第6节为全校班会；星期三第4节为全校大阅读。', s: 5, merge: [0, 4] }] },
        { h: 20, cells: [{ v: '集体教研时间（该时段不排对应科组老师的课，也不计入课时）：语文组 周三第5、6节；数学组 周四第5、6节；发展组 周二第5、6节。', s: 5, merge: [0, 4] }] },
        { h: 20, cells: [{ v: '生成时间：' + new Date().toLocaleString('zh-CN'), s: 5, merge: [0, 4] }] }
      ]
    });

    st.classes.forEach(c => {
      const rows = [];
      const sch = st.schedule[c.id] || {};
      rows.push({ h: 34, cells: [{ v: st.meta.name + st.meta.term + c.name + '课程表', s: 1, merge: [0, 6] }] });
      rows.push({ h: 18, cells: [{ v: '班主任：' + (c.headTeacher || '—') + '　语文：' + (c.cnTeacher || '—') + '　数学：' + (c.mathTeacher || '—'), s: 5, merge: [0, 6] }] });
      rows.push({ h: 22, cells: [{ v: '节次', s: 2 }, { v: '时间', s: 2 }]
        .concat(st.days.map(d => ({ v: d, s: 2 }))) });
      const seq = [
        { t: 'e', label: '早读', time: '8:15—8:30', read: true },
        { t: 'p', p: 1 }, { t: 'e', label: '健身大课间', time: '9:40—10:10' },
        { t: 'p', p: 2 }, { t: 'e', label: '眼保健操', time: '上午' },
        { t: 'p', p: 3 }, { t: 'e', label: '午休时光', time: '12:20—14:00' },
        { t: 'e', label: '练字一刻钟', time: '14:30—14:45' },
        { t: 'p', p: 4 }, { t: 'e', label: '眼保健操', time: '下午' },
        { t: 'p', p: 5 }, { t: 'p', p: 6 },
        { t: 'e', label: '课后个性发展时光', time: '16:55—17:55' }
      ];
      seq.forEach(r => {
        if (r.t === 'e') {
          if (r.read) {
            rows.push({ h: 22, cells: [{ v: '早读', s: 3 }, { v: r.time, s: 5 }]
              .concat(st.days.map((d, i) => ({ v: st.morningRead[i] || '', s: 5 }))) });
          } else {
            rows.push({ h: 20, cells: [{ v: r.label, s: 5 }, { v: r.time, s: 5, merge: [0, 5] }] });
          }
          return;
        }
        const pd = st.periods.find(x => x.p === r.p);
        const cells = [{ v: pd.name, s: 3 }, { v: pd.time, s: 5 }];
        for (let d = 1; d <= 5; d++) {
          const cell = sch[slotKey(d, r.p)];
          cells.push({ v: cell ? cell.subject + (cell.teacher ? '\n' + cell.teacher : '') : '', s: 4 });
        }
        rows.push({ h: 40, cells });
      });
      sheets.push({ name: c.short + '班', cols: [12, 13, 15, 15, 15, 15, 15], rows });
    });

    const blob = Xlsx.build(sheets);
    Xlsx.download(blob, '城西小学2026秋_班级课程表_每班一张.xlsx');
    toast('班级课程表已导出（每班一张工作表）');
  }

  /* ================= 导出：教师课表（每位老师一张工作表） ================= */
  function exportTeachers() {
    const st = Store.state;
    const sheets = [];
    const ts = st.teachers.filter(t => !t.nonTeaching);

    // 总览索引表（行=教师，列=节次）
    const overview = [];
    overview.push({ h: 30, cells: [{ v: st.meta.name + st.meta.term + '教师课表总览', s: 1, merge: [0, 32] }] });
    const head = [{ v: '教师', s: 2 }, { v: '科组', s: 2 }, { v: '周课时', s: 2 }];
    st.days.forEach((d, i) => head.push({ v: d, s: 2, merge: [0, 5] }));
    overview.push({ h: 20, cells: head });
    const h2 = [{ v: '', s: 3 }, { v: '', s: 3 }, { v: '', s: 3 }];
    st.days.forEach(() => st.periods.forEach(pd => h2.push({ v: String(pd.p), s: 3 })));
    overview.push({ h: 20, cells: h2 });
    ts.forEach(t => {
      const cells = [{ v: t.name, s: 4 }, { v: t.groups.join('/'), s: 4 }, { v: Store.teacherLoad(t.name), s: 4 }];
      for (let d = 1; d <= 5; d++) {
        for (let p = 1; p <= 6; p++) {
          const rs = t.groups.filter(g => Store.isResearchSlot(g, d, p));
          if (rs.length) { cells.push({ v: '教研', s: 5 }); continue; }
          let txt = '';
          st.classes.forEach(c => {
            const cell = (st.schedule[c.id] || {})[slotKey(d, p)];
            if (cell && cell.teacher === t.name) txt += c.short + cell.subject + ' ';
          });
          cells.push({ v: txt.trim(), s: 4 });
        }
      }
      overview.push({ h: 30, cells });
    });
    const cols = [10, 14, 8];
    for (let i = 0; i < 30; i++) cols.push(13);
    sheets.push({ name: '总览索引', cols, rows: overview });

    // 每位教师一张表（格式与班级课表一致：行=节次、列=星期，没课留空）
    ts.forEach(t => sheets.push(teacherSheet(t)));

    const blob = Xlsx.build(sheets);
    Xlsx.download(blob, '城西小学2026秋_教师课表_每位老师一张.xlsx');
    toast('教师课表已导出（每位老师一张工作表，共 ' + ts.length + ' 位）');
  }

  /* 单张教师课表 */
  function teacherSheet(t) {
    const st = Store.state;
    const rows = [];
    const allDuties = [];
    t.duties.forEach(d => {
      const c = Store.classById(d.classId);
      allDuties.push((c ? c.short + '班' : d.classId) + '·' + d.subject);
    });
    // 补上"由本班老师兼"承担的科目（班会、大阅读、道法等）
    st.classes.forEach(c => {
      const plan = st.plan[c.grade] || {};
      Object.keys(plan).forEach(s => {
        if (!plan[s]) return;
        if (Store.candidatesFor(c.id, s).indexOf(t.name) >= 0 &&
            !t.duties.some(d => d.classId === c.id && d.subject === s)) {
          allDuties.push(c.short + '班·' + s);
        }
      });
    });

    rows.push({ h: 34, cells: [{ v: st.meta.name + st.meta.term + t.name + ' 课表', s: 1, merge: [0, 6] }] });
    rows.push({ h: 20, cells: [{ v: '任课班别：' + (allDuties.join('；') || '（暂无）'), s: 5, merge: [0, 6] }] });
    rows.push({ h: 20, cells: [{ v: '科组：' + t.groups.join('、') + '　已排课时：' + Store.teacherLoad(t.name) +
      ' 节（教研时间不计课时）', s: 5, merge: [0, 6] }] });
    rows.push({ h: 22, cells: [{ v: '节次', s: 2 }, { v: '时间', s: 2 }]
      .concat(st.days.map(d => ({ v: d, s: 2 }))) });

    const seq = [
      { t: 'e', label: '早读', time: '8:15—8:30' },
      { t: 'p', p: 1 }, { t: 'e', label: '健身大课间', time: '9:40—10:10' },
      { t: 'p', p: 2 }, { t: 'e', label: '眼保健操', time: '上午' },
      { t: 'p', p: 3 }, { t: 'e', label: '午休时光', time: '12:20—14:00' },
      { t: 'e', label: '练字一刻钟', time: '14:30—14:45' },
      { t: 'p', p: 4 }, { t: 'e', label: '眼保健操', time: '下午' },
      { t: 'p', p: 5 }, { t: 'p', p: 6 },
      { t: 'e', label: '课后个性发展时光', time: '16:55—17:55' }
    ];
    seq.forEach(r => {
      if (r.t === 'e') {
        rows.push({ h: 18, cells: [{ v: r.label, s: 5 }, { v: r.time, s: 5, merge: [0, 5] }] });
        return;
      }
      const pd = st.periods.find(x => x.p === r.p);
      const cells = [{ v: pd.name, s: 3 }, { v: pd.time, s: 5 }];
      for (let d = 1; d <= 5; d++) {
        const k = slotKey(d, r.p);
        const rs = t.groups.filter(g => Store.isResearchSlot(g, d, r.p));
        if (rs.length) { cells.push({ v: '教研', s: 5 }); continue; }
        let txt = '';
        st.classes.forEach(c => {
          const cell = (st.schedule[c.id] || {})[k];
          if (cell && cell.teacher === t.name) txt += (c.short + cell.subject + '\n');
        });
        cells.push({ v: txt.trim(), s: 4 });
      }
      rows.push({ h: 42, cells });
    });
    return { name: t.name, cols: [12, 13, 15, 15, 15, 15, 15], rows };
  }

  function exportDuty() {
    const st = Store.state;
    const rows = [];
    rows.push({ h: 30, cells: [{ v: st.meta.name + st.meta.term + '教师任课与课时统计', s: 1, merge: [0, 6] }] });
    rows.push({ h: 22, cells: ['教师', '科组', '任课班级 / 科目', '已排节数', '应排节数', '表内课时', '备注']
      .map(v => ({ v, s: 2 })) });
    st.teachers.filter(t => !t.nonTeaching).forEach(t => {
      const should = Store.expectedLoad(t.name);
      rows.push({
        h: 22,
        cells: [
          { v: t.name, s: 4 }, { v: t.groups.join('/'), s: 4 },
          { v: t.duties.map(d => (Store.classById(d.classId) || {}).short + '·' + d.subject).join('　'), s: 4 },
          { v: Store.teacherLoad(t.name), s: 4 }, { v: should, s: 4 },
          { v: t.declared || '', s: 4 }, { v: t.note || '', s: 4 }
        ]
      });
    });
    const blob = Xlsx.build([{ name: '任课统计', cols: [10, 14, 60, 10, 10, 10, 30], rows }]);
    Xlsx.download(blob, '城西小学2026秋_教师任课统计.xlsx');
    toast('任课统计已导出');
  }

  function exportAll() {
    const st = Store.state;
    const sheets = [];
    // 1. 总课表：每年级一张“节次 × 班级”
    [1, 2, 3, 4, 5, 6].forEach(g => {
      const cs = st.classes.filter(c => c.grade === g);
      const rows = [];
      rows.push({ h: 30, cells: [{ v: st.meta.name + st.meta.term + global.cnNum(g) + '年级总课表', s: 1, merge: [0, cs.length] }] });
      st.days.forEach((dName, di) => {
        const d = di + 1;
        rows.push({ h: 20, cells: [{ v: dName, s: 2, merge: [0, cs.length] }] });
        rows.push({ h: 20, cells: [{ v: '节次', s: 2 }].concat(cs.map(c => ({ v: c.short, s: 2 }))) });
        st.periods.forEach(pd => {
          const cells = [{ v: pd.name + '\n' + pd.time, s: 3 }];
          cs.forEach(c => {
            const cell = (st.schedule[c.id] || {})[slotKey(d, pd.p)];
            cells.push({ v: cell ? cell.subject + (cell.teacher ? '\n' + cell.teacher : '') : '', s: 4 });
          });
          rows.push({ h: 38, cells });
        });
        rows.push({ h: 8, cells: [] });
      });
      sheets.push({ name: global.cnNum(g) + '年级总表', cols: [16].concat(cs.map(() => 15)), rows });
    });
    const blob = Xlsx.build(sheets);
    Xlsx.download(blob, '城西小学2026秋_年级总课表.xlsx');
    toast('年级总课表已导出');
  }

  /* ============================================================
   *  Modal / 通用
   * ============================================================ */
  function modal(title, bodyHtml, buttons) {
    const root = $('modalRoot');
    let h = '<div class="mask"><div class="modal">';
    h += '<div class="modal-h"><h3>' + esc(title) + '</h3><span class="sp"></span>' +
      '<button class="x" id="mClose">×</button></div>';
    h += '<div class="modal-b">' + bodyHtml + '</div>';
    h += '<div class="modal-f" id="mFoot"></div></div></div>';
    root.innerHTML = h;
    const foot = $('mFoot');
    (buttons || []).forEach(b => {
      const el = document.createElement('button');
      el.className = b.cls || 'btn'; el.textContent = b.text;
      el.onclick = b.fn; foot.appendChild(el);
    });
    $('mClose').onclick = closeModal;
    root.querySelector('.mask').onclick = e => { if (e.target.classList.contains('mask')) closeModal(); };
  }
  function closeModal() { $('modalRoot').innerHTML = ''; }

  /* ============================================================
   *  渲染入口
   * ============================================================ */
  function render() {
    const st = Store.state;
    const titles = {
      timetable: '班级课表', teacher: '教师课表', research: '教研时间',
      plan: '课时方案', duty: '教师任课', issues: '冲突检查', data: '数据与导出'
    };
    $('viewTitle').textContent = titles[UI.view] || '';
    const c = $('content');
    if (UI.view === 'timetable') c.innerHTML = viewTimetable();
    else if (UI.view === 'teacher') c.innerHTML = viewTeacher();
    else if (UI.view === 'research') c.innerHTML = viewResearch();
    else if (UI.view === 'plan') c.innerHTML = viewPlan();
    else if (UI.view === 'duty') c.innerHTML = viewDuty();
    else if (UI.view === 'issues') c.innerHTML = viewIssues();
    else if (UI.view === 'data') c.innerHTML = viewData();

    if (UI.view === 'timetable') { renderStats(); renderTT(); }
    if (UI.view === 'teacher') bindTeacher();
    if (UI.view === 'research') bindResearch();
    if (UI.view === 'plan') bindPlan();
    if (UI.view === 'duty') bindDuty();
    if (UI.view === 'issues') bindIssues();
    if (UI.view === 'data') bindData();
  }

  function bindDuty() {
    const sel = $('ovClass');
    if (sel) {
      if (!UI.ovClass) UI.ovClass = UI.curClass;
      sel.value = UI.ovClass;
      sel.onchange = () => { UI.ovClass = sel.value; render(); };
    }
    document.querySelectorAll('[data-ov]').forEach(s => {
      s.onchange = () => {
        Store.setOverride(UI.ovClass, s.dataset.ov, s.value);
        Store.save();
        toast(s.value ? '已指定 ' + s.dataset.ov + ' 由 ' + s.value + ' 承担' : '已恢复默认', 'ok');
        render();
      };
    });
    document.querySelectorAll('[data-nt]').forEach(b => {
      b.onclick = () => {
        const t = Store.teacherByName(b.dataset.nt);
        if (!t) return;
        t.nonTeaching = false;
        Store.reindex(); Store.save(); render();
        toast(t.name + ' 已恢复为可排课', 'ok');
      };
    });
    // 缺教师科目的一键指定
    document.querySelectorAll('[data-quick]').forEach(sel => {
      sel.onchange = () => {
        if (!sel.value) return;
        const parts = sel.dataset.quick.split('|');
        Store.setOverride(parts[0], parts[1], sel.value);
        Store.save(); render();
        toast('已指定「' + parts[1] + '」由 ' + sel.value + ' 承担，请重新自动排课', 'ok');
      };
    });
  }

  function bindTeacher() {
    const load = $('tLoad');
    if (load && UI.curTeacher) {
      const t = Store.teacherByName(UI.curTeacher);
      load.innerHTML = '本周已排 <b>' + Store.teacherLoad(UI.curTeacher) + '</b> 节（教研时间不计课时）' +
        (t && t.declared ? '，表内 ' + t.declared + ' 节' : '');
    }
    document.querySelectorAll('[data-t]').forEach(b => {
      b.onclick = () => { UI.curTeacher = b.dataset.t; render(); };
    });
    document.querySelectorAll('[data-jump]').forEach(b => {
      b.onclick = () => {
        UI.curClass = b.dataset.jump; UI.curGrade = Store.classById(b.dataset.jump).grade;
        UI.focusType = 'class'; UI.view = 'timetable'; bindNav(); render();
      };
    });
    const f = $('tFilter');
    if (f) f.oninput = () => { UI.teacherFilter = f.value.trim(); render(); const n = $('tFilter'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } };
  }

  function bindResearch() {
    document.querySelectorAll('[data-ri]').forEach(el => {
      el.onclick = () => {
        const ri = +el.dataset.ri, d = +el.dataset.d, p = +el.dataset.p;
        const r = Store.state.research[ri];
        const k = slotKey(d, p);
        const i = r.slots.indexOf(k);
        if (i >= 0) r.slots.splice(i, 1); else r.slots.push(k);
        r.slots.sort((a, b) => {
          const [ad, ap] = a.split('-').map(Number), [bd, bp] = b.split('-').map(Number);
          return (ad - bd) || (ap - bp);
        });
        r.note = r.slots.map(k => {
          const [dd, pp] = k.split('-').map(Number);
          return '星期' + global.cnNum(dd) + '第' + pp + '节';
        }).join('、');
        Store.reindex(); Store.save(); render();
      };
    });
  }

  function bindPlan() {
    document.querySelectorAll('input[data-g]').forEach(inp => {
      inp.onchange = () => {
        const g = +inp.dataset.g, s = inp.dataset.s;
        let v = parseInt(inp.value, 10); if (isNaN(v) || v < 0) v = 0;
        Store.state.plan[g] = Store.state.plan[g] || {};
        if (v === 0) delete Store.state.plan[g][s]; else Store.state.plan[g][s] = v;
        Store.save(); render();
      };
    });
    const re = $('btnPlanRe');
    if (re) re.onclick = () => {
      Store.state.plan = JSON.parse(JSON.stringify(global.SCHOOL_DATA.LESSON_PLAN));
      Store.save(); render(); toast('已恢复默认课时方案', 'ok');
    };
  }

  function bindIssues() {
    document.querySelectorAll('[data-if]').forEach(b => {
      b.onclick = () => { UI.issueFilter = b.dataset.if; render(); };
    });
  }

  function bindData() {
    document.querySelectorAll('[data-exp]').forEach(b => {
      b.onclick = () => {
        const t = b.dataset.exp;
        if (t === 'classes') exportClasses();
        else if (t === 'teachers') exportTeachers();
        else if (t === 'duty') exportDuty();
        else if (t === 'all') exportAll();
        else if (t === 'json') exportJson();
      };
    });
    const imp = $('btnImport'), fi = $('fileImport');
    if (imp) imp.onclick = () => fi.click();
    if (fi) fi.onchange = () => {
      const file = fi.files[0]; if (!file) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const data = JSON.parse(fr.result);
          if (!data.classes || !data.schedule) throw new Error('格式不正确');
          Store.state = data; Store.save(); render(); toast('已恢复备份', 'ok');
        } catch (e) { toast('恢复失败：' + e.message, 'err'); }
      };
      fr.readAsText(file); fi.value = '';
    };
    const cl = $('btnClearSchedule');
    if (cl) cl.onclick = () => {
      modal('确认清空', '<div class="hint">将清空全部 <b>' + Store.state.classes.length +
        '</b> 个班级的课表（教师、科目、教研时间、课时方案均保留）。此操作不可撤销，建议先导出备份。</div>',
        [{ text: '取消', cls: 'btn', fn: closeModal },
         { text: '确认清空', cls: 'btn dg', fn: () => { Store.clearSchedule(); Store.save(); closeModal(); render(); toast('已清空课表'); } }]);
    };
    const rs = $('btnResetAll');
    if (rs) rs.onclick = () => {
      modal('确认重置', '<div class="hint">将丢弃全部改动，恢复到从两份 Excel 解析出的初始状态。</div>',
        [{ text: '取消', cls: 'btn', fn: closeModal },
         { text: '确认重置', cls: 'btn dg', fn: () => { Store.reset(); closeModal(); render(); toast('已恢复初始数据'); } }]);
    };
    const bo = $('btnOptSave');
    if (bo) bo.onclick = () => {
      Store.state.options.maxLessonsPerDay = +$('optMax').value || 3;
      Store.state.options.maxSameSubjectPerDay = +$('optSame').value || 2;
      Store.save(); toast('设置已保存', 'ok');
    };
    // 功能室开关与容量
    document.querySelectorAll('[data-room-on]').forEach(cb => {
      cb.onchange = () => {
        const r = Store.roomById(cb.dataset.roomOn);
        if (r) { r.enabled = cb.checked; Store.reindex(); Store.save(); toast(r.name + (cb.checked ? ' 已启用' : ' 已停用'), 'ok'); }
      };
    });
    document.querySelectorAll('[data-room-cap]').forEach(inp => {
      inp.onchange = () => {
        const r = Store.roomById(inp.dataset.roomCap);
        if (r) { r.capacity = Math.max(1, +inp.value || 1); Store.save(); }
      };
    });
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(Store.state, null, 1)], { type: 'application/json' });
    Xlsx.download(blob, '排课系统备份_' + new Date().toISOString().slice(0, 10) + '.json');
    toast('备份已导出');
  }

  function bindNav() {
    document.querySelectorAll('#nav button').forEach(b => {
      b.classList.toggle('on', b.dataset.view === UI.view);
      b.onclick = () => { UI.view = b.dataset.view; bindNav(); render(); };
    });
  }

  /* ============================================================
   *  自动排课 / 检查 / 保存
   * ============================================================ */
  function runAuto() {
    const st = Store.state;
    const inTT = UI.view === 'timetable';

    modal('自动排课',
      '<div class="fld"><label>排课范围</label>' +
      '<label style="display:block;margin-bottom:7px"><input type="radio" name="ascope" value="all" checked> ' +
      '<b>全校 ' + st.classes.length + ' 个班</b>（推荐，可避免教师跨班冲突）</label>' +
      '<label style="display:block"><input type="radio" name="ascope" value="current"' + (inTT ? '' : ' disabled') + '> ' +
      '<b>仅当前班级</b>' + (inTT ? '（' + esc(Store.classById(UI.curClass).name) + '）' : '（需先在班级课表页选班）') + '</label></div>' +
      '<div class="fld"><label>排课方式</label>' +
      '<label style="display:block;margin-bottom:7px"><input type="radio" name="amode" value="all" checked> ' +
      '<b>全部重排</b>　清空重排，仅保留「已锁定」的格子</label>' +
      '<label style="display:block"><input type="radio" name="amode" value="fill"> ' +
      '<b>只补空节</b>　保留现有安排，仅补空白格</label></div>' +
      '<div class="hint" style="background:#f8fafc;border-radius:8px;padding:10px 12px">' +
      '· 自动避开各科组<b>集体教研时间</b>与<b>功能室</b>占用<br>' +
      '· 同一教师同一时段只会排一个班（全校统一防冲突）<br>' +
      '· 星期一第6节固定<b>班会</b>，星期三第4节固定<b>大阅读</b><br>' +
      '· 排不进去的课会留在<b>候选区</b>，可手动拖拽调整' +
      '</div>',
      [{ text: '取消', cls: 'btn', fn: closeModal },
       { text: '开始排课', cls: 'btn pri', fn: () => {
           const scope = (document.querySelector('input[name=ascope]:checked') || {}).value || 'all';
           const mode = (document.querySelector('input[name=amode]:checked') || {}).value || 'all';
           closeModal();
           toast('正在排课，请稍候…');
           setTimeout(() => {
             try {
               const t0 = performance.now();
               const r = Engine.autoSchedule({
                 scope, mode, rounds: 20,   // 轮数提高：半天/连堂等约束下保证排满（随机多轮取最优）
                 classIds: scope === 'current' ? [UI.curClass] : undefined
               });
               Store.save();
               render();
               const ms = Math.round(performance.now() - t0);
               let msg = (scope === 'all' ? '全校' : '本班') + '排课完成（' + (ms / 1000).toFixed(1) + 's）';
               if (r.unfilled) msg += '，' + r.unfilled + ' 节留在候选区';
               if (r.conflicts) msg += '，' + r.conflicts + ' 处待处理';
               toast(msg, (r.unfilled || r.conflicts) ? 'warn' : 'ok');
             } catch (e) {
               console.error(e);
               toast('排课出错：' + e.message, 'err');
             }
           }, 40);
         } }]);
  }

  function runCheck() {
    const issues = Engine.countConflicts();
    const err = issues.filter(i => i.level === 'error').length;
    const warn = issues.filter(i => i.level === 'warn').length;
    modal('冲突检查结果',
      '<div class="stats" style="margin-bottom:6px">' +
      stat(err, '硬性冲突', err ? 'r' : 'g') + stat(warn, '提醒项', warn ? 'o' : 'g') + '</div>' +
      (issues.length
        ? '<div class="hint">前 20 条：</div>' + issues.slice(0, 20).map(i =>
            '<div class="issue ' + i.level + '"><span class="tag">' +
            (i.level === 'error' ? '冲突' : '提醒') + '</span><span class="txt">' + esc(i.text) + '</span></div>').join('')
        : '<div class="empty-tip">✓ 没有发现问题</div>'),
      [{ text: '关闭', cls: 'btn', fn: closeModal },
       { text: '查看详情', cls: 'btn pri', fn: () => { closeModal(); UI.view = 'issues'; bindNav(); render(); } }]);
  }

  /* 一键清零：清空全部班级课表（保留合堂固定格、教研、课时方案与教师数据） */
  function clearAll() {
    const st = Store.state;
    modal('确认清零', '<div class="hint">将清空全部 <b>' + st.classes.length +
      '</b> 个班级已排的课程，回到空白课表（合堂固定格、教研时间、教师与课时方案均保留）。' +
      '此操作不可撤销，建议先导出备份，或清完后重新点「⚡ 一键排全校」。</div>',
      [{ text: '取消', cls: 'btn', fn: closeModal },
       { text: '确认清零', cls: 'btn dg', fn: () => {
           Store.clearSchedule(); Store.save(); closeModal(); render();
           toast('已清零，可重新排课', 'ok');
         } }]);
  }

  global.UI = UI;
  global.UIAPI = { render, bindNav, runAuto, runCheck, clearAll, toast };
})(window);
