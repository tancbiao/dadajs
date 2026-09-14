"use strict";
/* 城西小学社团选课系统 - 服务端（纯 Node，无第三方依赖）
   启动：node server.js   端口默认 3210，可用环境变量 PORT 覆盖 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { GROUPS, CN, TYPES, gradeToGroup } = require("./clubs");

const PORT = parseInt(process.env.PORT || "3210", 10);
const DATA_FILE = path.join(__dirname, "data.json");

const DEFAULT_STATE = {
  open: true,
  adminPw: "cx2026",
  classCounts: { 1: 5, 2: 5, 3: 5, 4: 8, 5: 8, 6: 8 },
  quotaOverrides: {},
  selections: {},
  releaseLog: [],         /* 退课日志（可追溯 + 可一键恢复），最多保留 500 条 */
  openAt: null,           /* 定时开放时间（毫秒时间戳，null = 不限制） */
  closeAt: null,          /* 定时截止时间（毫秒时间戳，null = 不限制） */
  lastResetBackup: null,  /* 最近一次「清空全部」前的快照，供 undoReset 一键还原 */
  lastResetAt: null,
  lastResetCount: 0
};

/* 退课冷静期：刚选好的社团在 10 分钟内不允许取消，防误触与恶意刷 */
const COOL_MS = 10 * 60 * 1000;
/* 退课日志上限 */
const RELEASE_LOG_MAX = 500;

/* 选课是否开放：时间窗口优先于手动开关。
   时间戳是绝对值（客户端按本地时区换算后传上来），因此**不受服务器时区影响**。
   · 未到开放时间 → 关闭（即使手动开关开着）
   · 已过截止时间 → 关闭
   · 处于窗口内 → 由手动开关 open 决定（默认 true） */
function isOpenNow() {
  const t = Date.now();
  if (state.openAt && t < state.openAt) return false;
  if (state.closeAt && t >= state.closeAt) return false;
  return !!state.open;
}
/* 未开放的原因，供前端显示精确文案 */
function closedReason() {
  const t = Date.now();
  if (state.openAt && t < state.openAt) return "before";
  if (state.closeAt && t >= state.closeAt) return "after";
  return state.open ? "" : "manual";
}

/* ---- 全校学生名单（roster.json，来自《在校生名单.xls》在校生花名册） ---- */
const ROSTER_FILE = path.join(__dirname, "roster.json");
const PREFILL_FILE = path.join(__dirname, "prefill_guhao.json");
let roster = {};
try { roster = JSON.parse(fs.readFileSync(ROSTER_FILE, "utf8")); } catch (e) { roster = {}; }

/* ---- 借读 / 插班生补充名单（extra_students.json） ----
   背景：插班借读学生的学籍不在本校学籍系统里，花名册（roster.json）自然没有他们，
   会导致 /api/my 校验失败、家长无法进入选课页。
   解决：单独放一个补充名单，与花名册**取并集**校验；
   setRosterClass（重置某班名单）只改 roster.json，**不会冲掉**这份补充名单。
   格式：{ "3": { "2": ["谭茗兮"] } }  —— 与 roster.json 同构，便于理解。 */
const EXTRA_FILE = path.join(__dirname, "extra_students.json");
let extra = {};
try { extra = JSON.parse(fs.readFileSync(EXTRA_FILE, "utf8")); } catch (e) { extra = {}; }
function extraClassNames(grade, cls) {
  return (extra[String(grade)] && extra[String(grade)][String(cls)]) || [];
}
function saveExtra() { fs.writeFileSync(EXTRA_FILE, JSON.stringify(extra, null, 1), "utf8"); }

function rosterClassNames(grade, cls) {
  const a = (roster[String(grade)] && roster[String(grade)][String(cls)]) || [];
  const b = extraClassNames(grade, cls);
  if (!b.length) return a;
  /* 并集且去重（借读生可能同时也在花名册里，不去重会导致重复） */
  const seen = {};
  return a.concat(b).filter(n => (seen[n] ? false : (seen[n] = 1)));
}
/* 只统计花名册（不含借读生），用于后台「名单核对」表，避免把借读生算进学籍数 */
function rosterStats() {
  const out = {};
  Object.keys(roster).forEach(g => {
    out[g] = {};
    Object.keys(roster[g]).forEach(c => { out[g][c] = roster[g][c].length; });
  });
  return out;
}

function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), s);
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}
let state = loadState();
/* 用全校名单修正班级数（只增不减，避免覆盖管理员手动调整） */
(function fixClassCounts() {
  let changed = false;
  Object.keys(roster).forEach(g => {
    const n = Math.max.apply(null, Object.keys(roster[g]).map(Number));
    if (state.classCounts[g] === undefined || n > state.classCounts[g]) {
      state.classCounts[g] = n; changed = true;
    }
  });
  if (changed) saveState();
})();
/* 鼓号队内定名单预置（仅首次）：队员加入 clubs 数组，五年级队员仍可另报一个五年级社团 */
(function prefill() {
  if (state.prefillApplied) return;
  try {
    const list = JSON.parse(fs.readFileSync(PREFILL_FILE, "utf8"));
    let n = 0;
    list.forEach(m => {
      const arr = selList(m.g, m.c);
      let hit = arr.find(s => s.n === m.n);
      if (!hit) { hit = { n: m.n, clubs: [], t: Date.now() }; arr.push(hit); }
      if (!Array.isArray(hit.clubs)) hit.clubs = [];
      if (!hit.clubs.some(c => c.n === "鼓号队社团")) hit.clubs.push({ n: "鼓号队社团", fixed: true });
      delete hit.c; delete hit.fixed;
      n++;
    });
    state.prefillApplied = true;
    saveState();
    console.log("鼓号队内定名单已预置:", n, "人");
  } catch (e) { console.log("鼓号队预置跳过:", e.message); }
})();
function saveState() {
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, DATA_FILE);
}

function effQ(group, club, grade) {
  const k = group.id + "||" + club.n + "||" + grade;
  if (state.quotaOverrides[k] !== undefined) return state.quotaOverrides[k];
  const v = club.q && club.q[grade];
  return v === undefined ? null : v;
}
/* 鼓号队为跨年级特殊社团：五、六年级不同天开课，故五年级队员报名后不占五年级名额
   （注意：鼓号队本身是内定社团，家长不能自选，这个标记只用于判断"是否占本年级名额"） */
const CROSS_GRADE_CLUBS = ["鼓号队社团"];
function isCrossGradeClub(n) { return CROSS_GRADE_CLUBS.indexOf(n) >= 0; }

function selList(grade, cls) {
  const k = "g" + grade + "c" + cls;
  if (!state.selections[k]) state.selections[k] = [];
  return state.selections[k];
}
/* 由 "g6c3" 解析出 { grade:6, cls:3 } */
function parseKey(k) {
  const m = /^g(\d+)c(\d+)$/.exec(String(k || ""));
  return m ? { grade: parseInt(m[1], 10), cls: parseInt(m[2], 10) } : null;
}
/* 该班某社团已用名额（含跨年级社团借用的名额） */
function usedInClass(grade, cls, clubName) {
  return selList(grade, cls).filter(s => s.c === clubName).length;
}
/* 学生名下的社团列表：兼容旧数据结构（c 字段）与新结构（clubs 数组） */
function studentClubs(s) {
  if (Array.isArray(s.clubs)) return s.clubs;
  return s.c ? [{ n: s.c, fixed: !!s.fixed }] : [];
}
/* 某社团是否属于该学生所在年级段
   注意：社团重名很常见（绘画社团一二年级/三四年级都有），
   所以必须按"我这个年级段里有没有开设这个名字"判断，不能按名字全局找 */
function clubInOwnGrade(grade, clubName) {
  const g = gradeToGroup(grade);
  return !!(g && g.clubs.some(c => c.n === clubName));
}
/* 该学生还能不能加某个社团 */
function canAddClub(grade, clubs, clubName) {
  if (clubs.some(c => c.n === clubName)) return { ok: false, why: "duplicate" };
  const hasOwn = clubs.filter(c => clubInOwnGrade(grade, c.n));
  if (hasOwn.length) return { ok: false, why: "one_normal_only", name: hasOwn[0].n };
  return { ok: true };
}
/* 输出给前端的社团信息（含该年级有效名额）；includeHidden=false 时过滤内定社团 */
function clubsForGrade(group, includeHidden) {
  return group.clubs.filter(c => includeHidden || !c.hidden).map(c => {
    const q = {};
    group.grades.forEach(gr => { q[gr] = effQ(group, c, gr); });
    return { n: c.n, t: c.t, tc: c.tc, pl: c.pl, note: c.note, hidden: !!c.hidden, q: q };
  });
}
function groupsPayload(includeHidden) {
  return GROUPS.map(g => ({
    id: g.id, name: g.name, grades: g.grades, clubs: clubsForGrade(g, includeHidden)
  }));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = "";
    req.on("data", c => { b += c; if (b.length > 1e5) req.destroy(); });
    req.on("end", () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}
function json(res, code, obj) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    /* ★ 防缓存头（2026-09-14 加固）：手机浏览器/微信 webview 会缓存 GET 响应。
       家长选过之后若被老师清退，再打开时可能吐旧缓存 → 仍显示"已入选"。
       这里三重声明 + 前端 URL 加时间戳，确保每次都是服务端实时数据。 */
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
    "Access-Control-Allow-Origin": "*"  /* 允许本地双击打开的 admin.html 直接连服务器 */
  });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  /* CORS 预检（file:// 页面 POST JSON 会先发 OPTIONS） */
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }
  const u = new URL(req.url, "http://localhost");
  const p = u.pathname;
  try {
    /* ---------- 家长端 API ---------- */
    if (p === "/api/config") {
      return json(res, 200, {
        open: isOpenNow(), closed: closedReason(),
        openAt: state.openAt, closeAt: state.closeAt, now: Date.now(),
        classCounts: state.classCounts, groups: groupsPayload(false)
      });
    }
    /* ⚠️ 名单接口已永久停用（2026-09-12）：绝不下发学生名单。
       原来这里返回全班姓名，任何人无需登录即可 curl 拿到，
       再逐个调 /api/release 就能把整班社团清空。现只回空数组，兼容旧缓存页面。 */
    if (p === "/api/roster") {
      return json(res, 200, { names: [], disabled: true });
    }
    if (p === "/api/status") {
      const grade = parseInt(u.searchParams.get("grade"), 10);
      const cls = parseInt(u.searchParams.get("cls"), 10);
      const g = gradeToGroup(grade);
      if (!g || cls < 1 || cls > (state.classCounts[grade] || 0)) return json(res, 400, { error: "班级参数不对" });
      const list = selList(grade, cls);
      /* 只列本年级段的非内定社团；内定社团（鼓号队、科创班）一律不出现，家长不能自行报名 */
      const clubs = g.clubs.filter(c => !c.hidden).map(c => ({
        n: c.n, t: c.t, tc: c.tc, pl: c.pl, note: c.note, cross: false,
        q: effQ(g, c, grade), used: list.filter(s => studentClubs(s).some(x => x.n === c.n)).length
      }));
      return json(res, 200, {
        open: isOpenNow(), closed: closedReason(),
        openAt: state.openAt, closeAt: state.closeAt, clubs: clubs
      });
    }
    if (p === "/api/my") {
      const grade = parseInt(u.searchParams.get("grade"), 10);
      const cls = parseInt(u.searchParams.get("cls"), 10);
      const name = (u.searchParams.get("name") || "").trim();
      /* 姓名必须与全校花名册**完全一致**才能进入选课（含繁简/异体字差异，
         以 roster.json 为准）。这样即使别人知道了同学姓名，也无法凭"猜"进入别人的页面。 */
      const names = rosterClassNames(grade, cls);
      if (names.length && names.indexOf(name) < 0) {
        return json(res, 400, {
          error: "本班名单里没有「" + name + "」，请核对姓名是否写错（注意同音字、繁简字）",
          notInRoster: true
        });
      }
      const hit = selList(grade, cls).find(s => s.n === name);
      const clubs = hit ? studentClubs(hit) : [];
      const detail = clubs.map(c => {
        /* ★ 先在本年级段的组里找同名社团（2026-09-14 修）：
           同名社团很常见 ——「足球」在三四年级组和六年级组各一份、
           「足球社团」在一二年级组和五年级组各一份。原来的全局 forEach 是
           "后者覆盖前者"，只是碰巧取对；改成"学生所在组优先"才是确定正确的。
           本组没有才全局找（真跨年级，如鼓号队定义在六年级组、五年级队员）。 */
        const gp0 = gradeToGroup(grade);
        let f = (gp0 && gp0.clubs.find(y => y.n === c.n)) || null;
        if (!f) GROUPS.forEach(gp => { const x = gp.clubs.find(y => y.n === c.n); if (x && !f) f = x; });
        return {
          n: c.n, fixed: !!c.fixed, cross: isCrossGradeClub(c.n),
          t: f ? f.t : "", tc: f ? f.tc : "", pl: f ? f.pl : "", note: f ? f.note : ""
        };
      });
      /* 该生是否还能再选：只有"还没占本年级段名额"的学生才行
         （五年级鼓号队队员占的是六年级的名额，所以仍可再报一个五年级社团） */
      const hasOwn = clubs.some(c => clubInOwnGrade(grade, c.n));
      return json(res, 200, {
        club: clubs.length ? clubs[clubs.length - 1].n : null,
        clubs: detail,
        locked: hasOwn,                       /* true = 社团已定，不能再选 */
        hasFixed: clubs.some(c => !!c.fixed), /* 有学校统一安排的社团 */
        canAddNormal: !hasOwn,
        at: hit ? hit.t : null
      });
    }
    if (p === "/api/select" && req.method === "POST") {
      const body = await readBody(req);
      if (!isOpenNow()) return json(res, 400, {
        error: "选课暂未开放", closed: closedReason(),
        openAt: state.openAt, closeAt: state.closeAt
      });
      const grade = parseInt(body.grade, 10), cls = parseInt(body.cls, 10);
      const name = String(body.name || "").trim();
      const club = String(body.club || "");
      if (!/^[\u4e00-\u9fa5a-zA-Z·]{2,12}$/.test(name)) return json(res, 400, { error: "请输入正确的学生姓名" });
      const g = gradeToGroup(grade);
      if (!g) return json(res, 400, { error: "年级不对" });
      if (cls < 1 || cls > (state.classCounts[grade] || 0)) return json(res, 400, { error: "班级不对" });
      /* 全校名单校验：该班名单已导入时，姓名必须真实存在 */
      const names = rosterClassNames(grade, cls);
      if (names.length && names.indexOf(name) < 0) {
        return json(res, 400, { error: "全校名单里查无此人，请核对姓名和班级是否输入正确" });
      }
      /* 定位社团：只允许选本年级段的、家长开放的社团
         内定社团（鼓号队、创客、小小科学家、人工智能）任何年级都不能自行选 */
      const clubObj = g.clubs.find(c => c.n === club);
      if (!clubObj) {
        const other = GROUPS.find(gp => gp.clubs.some(c => c.n === club));
        const oc = other && other.clubs.find(c => c.n === club);
        if (oc && oc.hidden) return json(res, 400, { error: "该社团由学校统一安排队员，不对家长开放选课" });
        return json(res, 400, { error: "社团不存在" });
      }
      if (clubObj.hidden) return json(res, 400, { error: "该社团由学校统一安排队员，不对家长开放选课" });
      const list = selList(grade, cls);
      let existing = list.find(s => s.n === name);
      if (existing && !Array.isArray(existing.clubs)) existing.clubs = studentClubs(existing).slice(); // 兼容旧数据
      const mine = existing ? studentClubs(existing) : [];
      const can = canAddClub(grade, mine, club);
      if (!can.ok) {
        if (can.why === "duplicate") return json(res, 200, { ok: true, club: club, msg: "你已选过这个社团" });
        if (can.why === "one_normal_only") return json(res, 400, { error: "每人只能报一个社团，你已选「" + can.name + "」。如需更换请先取消原社团" });
        return json(res, 400, { error: "该社团不对本年级开放" });
      }
      /* 名额校验 */
      const q = effQ(g, clubObj, grade);
      const used = list.filter(s => studentClubs(s).some(x => x.n === club)).length;
      if (q !== null && q !== undefined && used >= q) {
        return json(res, 400, { error: "手慢了，「" + club + "」名额已被抢完，换一个试试吧" });
      }
      if (!existing) { existing = { n: name, clubs: [], t: Date.now() }; list.push(existing); }
      existing.clubs.push({ n: club }); existing.t = Date.now();
      delete existing.c; delete existing.fixed;
      saveState();
      return json(res, 200, { ok: true, club: club, msg: "选课成功！" });
    }
    if (p === "/api/release" && req.method === "POST") {
      const body = await readBody(req);
      if (!isOpenNow()) return json(res, 400, {
        error: "选课暂未开放", closed: closedReason(),
        openAt: state.openAt, closeAt: state.closeAt
      });
      const grade = parseInt(body.grade, 10), cls = parseInt(body.cls, 10);
      const name = String(body.name || "").trim();
      const club = String(body.club || "");
      const k = "g" + grade + "c" + cls;
      /* 姓名必须与花名册一致，防冒用他人姓名退课 */
      const names = rosterClassNames(grade, cls);
      if (names.length && names.indexOf(name) < 0) {
        return json(res, 400, { error: "姓名与本班名单不一致，无法操作", notInRoster: true });
      }
      const hit = (state.selections[k] || []).find(s => s.n === name);
      if (!hit) return json(res, 400, { error: "没有找到该学生的选课记录" });
      if (!Array.isArray(hit.clubs)) hit.clubs = studentClubs(hit).slice();

      /* ---- 冷静期：刚选好的社团 10 分钟内不许取消（防误触、防恶意刷） ---- */
      const since = Date.now() - (hit.t || 0);
      if (since < COOL_MS) {
        const left = Math.ceil((COOL_MS - since) / 60000);
        return json(res, 400, {
          error: "刚选好的社团需要等满 10 分钟才能取消（防止误触），还需 " +
                 Math.max(1, Math.round((COOL_MS - since) / 60000)) + " 分钟",
          coolLeft: left
        });
      }

      /* ---- 先做合法性检查，再进行快照与修改 ---- */
      if (club) {
        const target = hit.clubs.find(c => c.n === club);
        if (!target) return json(res, 400, { error: "没有找到这条选课记录" });
        if (target.fixed) return json(res, 400, { error: "「" + club + "」由学校统一安排，不能自行取消，请联系老师" });
      } else {
        if (!hit.clubs.some(c => !c.fixed)) return json(res, 400, { error: "该学生的社团由学校统一安排，不能自行取消，请联系老师" });
      }

      /* ---- 修改前留快照，写入退课日志（可追溯 + 可一键恢复） ---- */
      const before = JSON.parse(JSON.stringify(hit.clubs));

      if (club) {
        hit.clubs = hit.clubs.filter(c => c.n !== club);
      } else {
        hit.clubs = hit.clubs.filter(c => c.fixed); /* 内定社团保留 */
      }
      if (!hit.clubs.length) {
        const i = state.selections[k].indexOf(hit);
        if (i >= 0) state.selections[k].splice(i, 1);
      } else { delete hit.c; delete hit.fixed; hit.t = Date.now(); }

      if (!Array.isArray(state.releaseLog)) state.releaseLog = [];
      state.releaseLog.push({
        k: k, g: grade, c: cls, n: name, club: club || "", before: before, at: Date.now()
      });
      if (state.releaseLog.length > RELEASE_LOG_MAX) {
        state.releaseLog = state.releaseLog.slice(-RELEASE_LOG_MAX);
      }

      saveState();
      return json(res, 200, { ok: true, msg: "已取消选课，可以重新选择" });
    }

    /* ---------- 管理端 API ---------- */
    if (p === "/api/admin" && req.method === "POST") {
      const body = await readBody(req);
      const pw = String(body.pw || "");
      if (body.action === "login") {
        return json(res, 200, { ok: pw === state.adminPw });
      }
      if (pw !== state.adminPw) return json(res, 401, { error: "管理密码不对" });
      switch (body.action) {
        case "all":
          return json(res, 200, {
            open: isOpenNow(), closed: closedReason(),
            openAt: state.openAt, closeAt: state.closeAt, now: Date.now(),
            classCounts: state.classCounts,
            selections: state.selections, groups: groupsPayload(true),
            rosterStats: rosterStats(),
            extraStats: (function(){ /* 借读生按班列出姓名，后台要展示具体是谁（不是只显示人数） */
              const o = {}; Object.keys(extra).forEach(g => { o[g] = {}; Object.keys(extra[g]).forEach(c => { o[g][c] = extra[g][c].slice(); }); });
              return o;
            })(),
            releaseCount: (state.releaseLog || []).length,
            canUndoReset: !!(state.lastResetBackup && Object.keys(state.lastResetBackup).length),
            lastResetCount: state.lastResetCount || 0,
            lastResetAt: state.lastResetAt || null
          });
        case "setWindow": { /* 设置定时开放/截止（毫秒时间戳，null = 不限制） */
          const oa = (body.openAt === null || body.openAt === "" || body.openAt === undefined) ? null : Number(body.openAt);
          const ca = (body.closeAt === null || body.closeAt === "" || body.closeAt === undefined) ? null : Number(body.closeAt);
          if (oa !== null && !isFinite(oa)) return json(res, 400, { error: "开放时间格式不对" });
          if (ca !== null && !isFinite(ca)) return json(res, 400, { error: "截止时间格式不对" });
          if (oa !== null && ca !== null && ca <= oa) return json(res, 400, { error: "截止时间必须晚于开放时间" });
          state.openAt = oa; state.closeAt = ca;
          /* 设定时间窗口时顺手打开总开关，否则窗口内也会一直是关闭状态 */
          if (oa !== null || ca !== null) state.open = true;
          saveState();
          return json(res, 200, {
            ok: true, openAt: state.openAt, closeAt: state.closeAt, open: isOpenNow(), closed: closedReason()
          });
        }
        case "log":   /* 退课日志（倒序，最新在前） */
          return json(res, 200, { log: (state.releaseLog || []).slice().reverse() });
        case "restore": { /* 一键恢复某次退课：还原成退课前的社团快照 */
          const at = Number(body.at);
          const log = state.releaseLog || [];
          const idx = log.findIndex(x => x.at === at);
          if (idx < 0) return json(res, 400, { error: "找不到这条退课记录（可能已恢复或已超出保留上限）" });
          const rec = log[idx];
          const pk = parseKey(rec.k);
          if (!pk) return json(res, 400, { error: "日志记录格式异常，无法恢复" });
          const list = selList(pk.grade, pk.cls);
          let hit = list.find(s => s.n === rec.n);
          if (!hit) { hit = { n: rec.n, clubs: [], t: Date.now() }; list.push(hit); }
          hit.clubs = JSON.parse(JSON.stringify(rec.before));  /* 还原退课前快照 */
          delete hit.c; delete hit.fixed;
          hit.t = Date.now();
          log.splice(idx, 1);                                  /* 已恢复 → 从待恢复列表移除 */
          saveState();
          return json(res, 200, { ok: true, name: rec.n, grade: pk.grade, cls: pk.cls,
                                  clubs: hit.clubs.map(c => c.n) });
        }
        case "restoreAll": { /* 批量恢复全部退课记录 */
          const log = state.releaseLog || [];
          const n = log.length;
          log.forEach(rec => {
            const pk = parseKey(rec.k); if (!pk) return;
            const list = selList(pk.grade, pk.cls);
            let hit = list.find(s => s.n === rec.n);
            if (!hit) { hit = { n: rec.n, clubs: [], t: Date.now() }; list.push(hit); }
            hit.clubs = JSON.parse(JSON.stringify(rec.before));
            delete hit.c; delete hit.fixed;
            hit.t = Date.now();
          });
          state.releaseLog = [];
          saveState();
          return json(res, 200, { ok: true, count: n });
        }
        case "toggle": {
          /* 手动开关。若当前正处于「还没到开放时间」或「已过截止时间」的定时窗口外，
             单纯翻转 state.open 不会改变家长端可见状态（isOpenNow 仍为 false），
             管理员会看到「点了但没反应」。
             因此这里支持 force 模式：调用方传 force=true 时，连时间窗口一起清掉，
             实现「我要立刻开放/立刻关闭」——测试和临时调整都用它。 */
          if (body.force === true) { state.openAt = null; state.closeAt = null; }
          state.open = !state.open;
          saveState();
          return json(res, 200, {
            ok: true, open: isOpenNow(), rawOpen: state.open,
            closed: closedReason(), openAt: state.openAt, closeAt: state.closeAt,
            forced: body.force === true
          });
        }
        case "remove": {
          const grade = parseInt(body.grade, 10), cls = parseInt(body.cls, 10);
          const name = String(body.name || "").trim();
          const k = "g" + grade + "c" + cls;
          state.selections[k] = (state.selections[k] || []).filter(s => s.n !== name);
          saveState();
          return json(res, 200, { ok: true });
        }
        case "move": { // 管理员代填/内定（可填内定社团，不受名额限制；普通社团替换，跨年级社团追加）
          const grade = parseInt(body.grade, 10), cls = parseInt(body.cls, 10);
          const name = String(body.name || "").trim();
          const club = String(body.club || "");
          const g = gradeToGroup(grade);
          let clubObj = g && g.clubs.find(c => c.n === club);
          if (!clubObj) {
            const crossHome = GROUPS.find(gp => gp.clubs.some(c => c.n === club && isCrossGradeClub(c.n)));
            if (!crossHome) return json(res, 400, { error: "社团不存在" });
            clubObj = crossHome.clubs.find(c => c.n === club);
          }
          const list = selList(grade, cls);
          let hit = list.find(s => s.n === name);
          if (hit && !Array.isArray(hit.clubs)) { hit.clubs = studentClubs(hit).slice(); delete hit.c; delete hit.fixed; }
          if (!hit) { hit = { n: name, clubs: [], t: Date.now() }; list.push(hit); }
          const ownGrade = clubInOwnGrade(grade, club); /* 该社团是否属于学生自己年级段 */
          if (hit.clubs.some(c => c.n === club)) {
            hit.clubs.forEach(c => { if (c.n === club) c.fixed = true; }); /* 已有 → 只补内定标记 */
          } else if (!ownGrade) {
            hit.clubs.push({ n: club, fixed: true });                     /* 跨年级社团（五年级鼓号队）→ 追加 */
          } else {
            /* 本年级段社团：替换掉原有的本年级段社团，保证每人只有一个；
               但跨年级社团（鼓号队）独立保留，不被本年级内定顶掉 */
            hit.clubs = hit.clubs.filter(c => !clubInOwnGrade(grade, c.n) || isCrossGradeClub(c.n));
            hit.clubs.push({ n: club, fixed: true });
          }
          hit.t = Date.now();
          saveState();
          return json(res, 200, { ok: true });
        }
        case "unfix": { // 移出内定（等于删除该社团记录）
          const grade = parseInt(body.grade, 10), cls = parseInt(body.cls, 10);
          const name = String(body.name || "").trim();
          const club = String(body.club || "");
          const list = selList(grade, cls);
          const hit = list.find(s => s.n === name);
          if (hit) {
            const cl = studentClubs(hit);
            const keep = club ? cl.filter(c => c.n !== club) : [];
            if (keep.length) { hit.clubs = keep; delete hit.c; delete hit.fixed; }
            else { const i = list.indexOf(hit); if (i >= 0) list.splice(i, 1); }
            saveState();
          }
          return json(res, 200, { ok: true });
        }
        case "dropLoose": {
          /* 管理员批量撤销「非内定」选课（家长自选）。
             与 unfix 的区别：**拒绝删带 fixed 标记的记录**，
             防止批量脚本误伤内定名单。也可以不传 club，清掉该生的所有非内定社团。 */
          const grade = parseInt(body.grade, 10), cls = parseInt(body.cls, 10);
          const name = String(body.name || "").trim();
          const club = String(body.club || "");
          const list = selList(grade, cls);
          const hit = list.find(s => s.n === name);
          if (!hit) return json(res, 200, { ok: true, removed: 0, msg: "该生无选课记录" });
          const cl = studentClubs(hit);
          /* 只删"非内定"的：有 fixed 标记的一律留下 */
          const target = cl.filter(c => !c.fixed && (!club || c.n === club));
          if (!target.length) {
            return json(res, 400, {
              error: "没有可撤销的记录（该社团是内定，或不存在）",
              protected: cl.filter(c => c.fixed).map(c => c.n)
            });
          }
          const removed = target.map(c => c.n);
          const keep = cl.filter(c => removed.indexOf(c.n) < 0);
          if (keep.length) { hit.clubs = keep; delete hit.c; delete hit.fixed; }
          else { const i = list.indexOf(hit); if (i >= 0) list.splice(i, 1); }
          hit.t = Date.now();
          saveState();
          return json(res, 200, { ok: true, removed: removed, count: removed.length, keep: keep.map(c => c.n) });
        }
        case "setRosterClass": { // 替换某班全校名单（一行一个姓名）
          const grade = parseInt(body.grade, 10), cls = parseInt(body.cls, 10);
          const text = String(body.text || "");
          const names = text.split(/[\n,，、;；\t]+/).map(x => x.trim()).filter(Boolean);
          roster[String(grade)] = roster[String(grade)] || {};
          roster[String(grade)][String(cls)] = names;
          fs.writeFileSync(ROSTER_FILE, JSON.stringify(roster, null, 1), "utf8");
          const n = Math.max.apply(null, Object.keys(roster[String(grade)]).map(Number));
          if (n > state.classCounts[grade]) { state.classCounts[grade] = n; }
          saveState();
          return json(res, 200, { ok: true, count: names.length });
        }
        /* ---- 借读 / 插班生补充名单 ---- */
        case "listExtra": {
          return json(res, 200, { extra: extra });
        }
        case "addExtra": { /* {grade, cls, names:"谭茗兮,张三"} —— 追加，已存在则忽略 */
          const grade = parseInt(body.grade, 10), cls = parseInt(body.cls, 10);
          if (!(grade >= 1 && grade <= 6) || !(cls >= 1)) return json(res, 400, { error: "年级或班级不对" });
          const names = String(body.names || body.name || "")
            .split(/[\n,，、;；\t]+/).map(x => x.trim()).filter(Boolean);
          if (!names.length) return json(res, 400, { error: "没有要添加的姓名" });
          const cur = extraClassNames(grade, cls).slice();
          const added = [];
          names.forEach(n => { if (cur.indexOf(n) < 0) { cur.push(n); added.push(n); } });
          extra[String(grade)] = extra[String(grade)] || {};
          extra[String(grade)][String(cls)] = cur;
          saveExtra();
          return json(res, 200, { ok: true, added: added, addedCount: added.length,
            skipped: names.length - added.length, list: cur });
        }
        case "removeExtra": { /* {grade, cls, names:"谭茗兮"} */
          const grade = parseInt(body.grade, 10), cls = parseInt(body.cls, 10);
          const names = String(body.names || body.name || "")
            .split(/[\n,，、;；\t]+/).map(x => x.trim()).filter(Boolean);
          const before = extraClassNames(grade, cls);
          const cur = before.filter(n => names.indexOf(n) < 0);
          if (extra[String(grade)]) extra[String(grade)][String(cls)] = cur;
          saveExtra();
          return json(res, 200, { ok: true, removed: before.length - cur.length, list: cur });
        }
        case "setQuota": {
          const k = String(body.groupId) + "||" + String(body.club) + "||" + parseInt(body.grade, 10);
          state.quotaOverrides[k] = body.q === null || body.q === "" ? null : Math.max(0, parseInt(body.q, 10) || 0);
          saveState();
          return json(res, 200, { ok: true });
        }
        case "setClsCount": {
          const grade = parseInt(body.grade, 10);
          state.classCounts[grade] = Math.max(1, Math.min(20, parseInt(body.n, 10) || 5));
          saveState();
          return json(res, 200, { ok: true });
        }
        case "setPw": {
          const np = String(body.newPw || "").trim();
          if (np.length < 4) return json(res, 400, { error: "密码至少 4 位" });
          state.adminPw = np; saveState();
          return json(res, 200, { ok: true });
        }
        case "reset": { /* 清空全部选课记录 —— 会自动留一份可撤销的快照 */
          const backup = JSON.parse(JSON.stringify(state.selections || {}));
          const cnt = Object.keys(backup).reduce((a, k) => a + (backup[k] || []).length, 0);
          /* 写磁盘快照（带时间戳），并把"最近一次"记在 state 里供一键撤销 */
          const stamp = new Date().toISOString().replace(/[:.]/g, "-");
          const bdir = path.join(__dirname, "_backups");
          try { fs.mkdirSync(bdir, { recursive: true }); } catch (e) { }
          const bfile = path.join(bdir, "reset_" + stamp + ".json");
          try { fs.writeFileSync(bfile, JSON.stringify(backup, null, 1), "utf8"); } catch (e) { }
          state.lastResetBackup = backup;
          state.lastResetAt = Date.now();
          state.lastResetCount = cnt;
          state.selections = {};
          saveState();
          return json(res, 200, {
            ok: true, msg: "已清空全部选课记录", count: cnt, canUndo: cnt > 0, at: state.lastResetAt
          });
        }
        case "undoReset": { /* 撤销最近一次清空，恢复清空前的全部选课记录 */
          const b = state.lastResetBackup;
          if (!b || !Object.keys(b).length) {
            return json(res, 400, { error: "没有可恢复的清空记录（只支持撤销最近一次）" });
          }
          const cnt = Object.keys(b).reduce((a, k) => a + (b[k] || []).length, 0);
          state.selections = JSON.parse(JSON.stringify(b));
          state.lastResetBackup = null;
          state.lastResetCount = 0;
          saveState();
          return json(res, 200, { ok: true, count: cnt, msg: "已恢复清空前的 " + cnt + " 条选课记录" });
        }
        default:
          return json(res, 400, { error: "未知操作" });
      }
    }

    /* ---------- 静态文件 ---------- */
    let f = p === "/" ? "/index.html" : p;
    const pubDir = path.join(__dirname, "public");
    const fp = path.join(pubDir, path.normalize(f).replace(/^([.][.][\\\/])+/, ""));
    if (!fp.startsWith(pubDir)) return json(res, 403, { error: "forbidden" });
    fs.readFile(fp, (e, buf) => {
      if (e) { res.writeHead(404); return res.end("Not Found"); }
      const MIME = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".txt": "text/plain; charset=utf-8"
      };
      const mime = MIME[path.extname(f).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" });
      res.end(buf);
    });
  } catch (e) {
    json(res, 500, { error: "服务器开小差了：" + e.message });
  }
});

server.listen(PORT, () => {
  console.log("城西社团选课系统已启动: http://localhost:" + PORT);
  console.log("家长端: http://localhost:" + PORT + "/   管理端: http://localhost:" + PORT + "/admin.html");
});
