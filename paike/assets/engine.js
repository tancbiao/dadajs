/* ============================================================
 *  engine.js —— 自动排课引擎 + 冲突检测
 *  设计要点：
 *   · 教师 / 功能室占用统一由 env（busy / roomBusy）维护，且基于「全校」课程
 *   · 多轮随机重启贪心 + 只对最优解做 polish（班内两两交换）
 *   · 全校固定格（班会/大阅读）优先占位并打 pinned，不被交换
 * ============================================================ */
(function (global) {
  'use strict';

  const Store = global.Store;

  const Engine = {

    /* ================= 自动排课 ================= */
    /**
     * opt.scope    'all'（默认，全校）| 'current'（仅 opt.classIds）
     * opt.mode     'all'（全部重排，保留锁定格）| 'fill'（只补空节）
     * opt.classIds 要排的班级（scope=current 时使用）
     */
    autoSchedule(opt) {
      opt = opt || {};
      const st = Store.state;
      const rounds = opt.rounds || 5;
      const scope = opt.scope || 'all';
      const classIds = scope === 'all'
        ? st.classes.map(c => c.id)
        : (opt.classIds || st.classes.map(c => c.id));
      const mode = opt.mode || 'all';

      let best = null;
      for (let r = 0; r < rounds; r++) {
        const draft = this._oneRound(classIds, mode, r);
        if (!best || draft.cost < best.cost) best = draft;
        if (best.unfilled === 0 && best.conflicts === 0) break;
      }

      // 只对最优方案做后处理（polish 开销较大）。
      // env 必须基于「重排后的 best.schedule（scope 内）+ 其他班现状（scope 外）」，
      // 否则 polish 会拿着旧占用表交换，反而引入撞课/功能室超载。
      const env = buildEnv(st, best.schedule, {}, classIds, mode);
      this._polish(best.schedule, env, st);
      best.conflicts = this.countConflicts(best.schedule).length;

      classIds.forEach(cid => { st.schedule[cid] = best.schedule[cid]; });
      return {
        unfilled: best.unfilled,
        conflicts: best.conflicts,
        rounds: best.round + 1,
        details: best.details,
        classCount: classIds.length
      };
    },

    _oneRound(classIds, mode, round) {
      const st = Store.state;
      const schedule = {};
      const details = [];
      let unfilled = 0;

      // 1) 保留格：fill=全部保留；all=只保留锁定格
      classIds.forEach(cid => {
        schedule[cid] = {};
        const old = st.schedule[cid] || {};
        Object.keys(old).forEach(k => {
          const cell = old[k];
          if (!cell || !cell.subject) return;
          const keep = (mode === 'fill') || cell.locked;
          if (keep) schedule[cid][k] = {
            subject: cell.subject, teacher: cell.teacher, locked: !!cell.locked,
            kind: cell.kind, exceptionId: cell.exceptionId, classIdsLabel: cell.classIdsLabel
          };
        });
      });

      // 2) env：busy / roomBusy / load 基于「全校已有课程」初始化，
      //    这样即使用户只排一个班，也不会和别班的教师 / 功能室撞。
      const env = buildEnv(st, schedule, {}, classIds, mode);
      env.rand = mulberry(1000 + round * 7919);
      env.sched = schedule;

      // 班级排课顺序：一半轮次按"共享资源多的班优先"，另一半完全随机，
      // 让不同轮次探索不同的资源分配（否则电脑室等共享时段会被前面的班占光）
      const order = classIds.slice().sort((a, b) => {
        if (round % 2 === 0) return env.rand() - 0.5;   // 随机探索
        const ca = Store.classById(a), cb = Store.classById(b);
        const sa = sharedScore(ca), sb = sharedScore(cb);
        if (sa !== sb) return sb - sa;
        return (ca.grade * 100 + ca.no) - (cb.grade * 100 + cb.no);
      });

      order.forEach(cid => {
        const c = Store.classById(cid);
        const plan = st.plan[c.grade] || {};

        const remain = {};
        Object.keys(plan).forEach(s => { if (plan[s] > 0) remain[s] = plan[s]; });
        Object.keys(schedule[cid]).forEach(k => {
          const cell = schedule[cid][k];
          if (cell && cell.subject && remain[cell.subject] !== undefined) remain[cell.subject]--;
        });
        Object.keys(remain).forEach(s => { if (remain[s] < 0) remain[s] = 0; });

        // 全校固定格（班会 / 大阅读）优先占位
        st.fixed.forEach(f => {
          if (!remain[f.subject] || remain[f.subject] <= 0) return;
          const ex = schedule[cid][f.slot];
          if (ex && ex.subject) return;
          const sp = f.slot.split('-');
          const sl = { d: +sp[0], p: +sp[1], k: f.slot };
          // relaxed=true：固定格是硬性要求，首选教师即使当日课时已多也应优先安排
          // （兜底教师会在 _pick 内被重罚，保证班主任/语文老师优先）
          const picked = this._pick(env, remain, cid, sl, true, f.subject, true);
          if (picked) {
            schedule[cid][f.slot] = { subject: picked.subject, teacher: picked.teacher, pinned: true };
            mark(env, schedule[cid][f.slot], f.slot, cid);
            remain[picked.subject]--;
          }
        });

        // ============ 阶段一：专职/功能室科目先占槽 ============
        // 信息、科学、音乐等科目由共享教师上、可能占功能室，对时段是硬约束，
        // 必须先占好槽位，否则会被语文/数学等"剩余多"的科目抢光可用时段。
        // 科学二/科学三也在此阶段先占槽：数学老师兼课，先占一天 → 数学课自动避让到其他天，
        // 实现「科学二/科学三不与数学同天」且「数学老师每天在该班约1节课」。
        const specs = Object.keys(remain).filter(s => remain[s] > 0 && (isSpecSubject(cid, s) || s === '科学二' || s === '科学三'));
        specs.sort((a, b) => specWeight(b) - specWeight(a));
        specs.forEach(s => {
          while (remain[s] > 0) {
            const picked = this._pickForSubject(env, remain, cid, s, false);
            if (!picked) break;                       // 排不下留候选区
            schedule[cid][picked.k] = { subject: s, teacher: picked.teacher };
            mark(env, schedule[cid][picked.k], picked.k, cid);
            remain[s]--;
          }
        });

        // ============ 阶段二：剩余空格排本班科目 ============
        // 大课间槽（一、二年级周二~周五第6节）不排除，但 _pick 里会给它重罚，
        // 课程优先排正常槽；26 节实在放不下时才会占用大课间槽（"实在没办法再往上塞"）
        // 第一步：只用正常槽（不含大课间槽 一二年级周二~周五第6节）；
        // 第二步：正常槽排不满才用大课间槽兜底，周五优先被占、周二~四尽量留大课间
        const isFE = sl => Store.isFixedEmpty(cid, sl.d, sl.p);
        const buildFree = () => {
          const f = [];
          for (let d = 1; d <= 5; d++) {
            for (let p = 1; p <= 6; p++) {
              const k = d + '-' + p;
              const cell = schedule[cid][k];
              if (!cell || !cell.subject) f.push({ d, p, k });
            }
          }
          return f;
        };
        let free = buildFree().filter(sl => !isFE(sl));
        const feSlots = buildFree().filter(isFE);
        feSlots.sort((a, b) => (b.d === 5 ? 1 : 0) - (a.d === 5 ? 1 : 0) || b.d - a.d); // 周五→四→三→二
        free.sort((a, b) => {
          const pa = slotPressure(a.d, a.p), pb = slotPressure(b.d, b.p);
          if (pa !== pb) return pb - pa;
          return (a.d * 10 + a.p) - (b.d * 10 + b.p);
        });
        const fillFree = (slots) => {
          slots.forEach(sl => {
            let picked = this._pick(env, remain, cid, sl, false, null, false);
            if (!picked) picked = this._pick(env, remain, cid, sl, false, null, true); // 放宽
            if (!picked) {
              delete schedule[cid][sl.k];
              return;
            }
            schedule[cid][sl.k] = { subject: picked.subject, teacher: picked.teacher };
            mark(env, schedule[cid][sl.k], sl.k, cid);
            if (remain[picked.subject] !== undefined) remain[picked.subject]--;
          });
        };
        fillFree(free);
        // 第二步：正常槽排不满才占用大课间槽（大课间让位给课程）
        if (Object.keys(remain).some(s => remain[s] > 0)) fillFree(feSlots);
        // 只有最终仍没排完才算「未排满」（中间某格失败但后续补上不算）
        if (Object.keys(remain).some(s => remain[s] > 0)) unfilled++;

        const left = Object.keys(remain).filter(s => remain[s] > 0);
        if (left.length) details.push({ classId: cid, name: c.name, missing: left.map(s => s + '×' + remain[s]) });
      });

      const conflicts = this.countConflicts(schedule);
      const err = conflicts.filter(c => c.level === 'error').length;
      const warn = conflicts.filter(c => c.level === 'warn').length;
      return {
        schedule, unfilled, round, details,
        conflicts: conflicts.length,
        cost: unfilled * 1000 + err * 100 + warn * 3 + (round === 0 ? -1 : 0)
      };
    },

    /* 在某一格挑选 (科目, 教师) */
    _pick(env, remain, cid, sl, forcePinned, pinnedSubj, relaxed) {
      const { busy, roomBusy, load, tLoad, expLoad, rand, st, sched } = env;
      const d = sl.d, p = sl.p, maxPerDay = st.options.maxLessonsPerDay || 3;
      const mainCap = st.options.maxSameSubjectPerDay || 2;
      const subjects = forcePinned ? [pinnedSubj] : Object.keys(remain);

      let best = null, bestScore = -1e9;
      for (const subject of subjects) {
        if (!forcePinned && (remain[subject] || 0) <= 0) continue;

        const cap = (subject === '语文' || subject === '数学') ? mainCap : 1;
        if (!relaxed && this._subjOnDay(sched, cid, d, subject) >= cap) continue;

        // 功能室是硬约束（不随降级放宽）：同一时段使用该功能室的班数已达容量则跳过
        const room = Store.roomForSubject(subject);
        if (room && (roomBusy[room.id + '|' + sl.k] || 0) >= room.capacity) continue;

        // 复制数组，绝不修改 candidatesFor 的缓存（否则污染 _candCache，虚增应排课时统计）
        let cands = Store.candidatesFor(cid, subject).slice();
        let fbSet = null;
        if (forcePinned) {
          // 固定格科目（班会/大阅读）：专职教师放不进时，兜底由本班班主任/语文/数学老师承担，
          // 保证「星期三第4节大阅读」等全校固定格每个班都能排上（例如大阅读专职仅1人，无法同时覆盖多个班）
          const c = Store.classById(cid);
          const backup = [];
          [c && c.headTeacher, c && c.cnTeacher, c && c.mathTeacher].forEach(n => {
            if (n && cands.indexOf(n) < 0 && backup.indexOf(n) < 0) backup.push(n);
          });
          cands = cands.concat(backup);
          fbSet = backup;
        }
        for (const teacher of cands) {
          if (!teacher) continue;
          const t = Store.teacherByName(teacher);
          if (!t || t.nonTeaching) continue;
          if (Store.teacherBusyForResearch(teacher, d, p)) continue;   // 教研
          if (busy[teacher + '|' + sl.k]) continue;                     // 撞课（含全校其他班）
          if (!relaxed && this._teacherOnDay(sched, cid, d, teacher) >= maxPerDay) continue;
          // 同班日课时硬上限 4 节：任何模式都不允许同一教师在同一班一天超 3 节
          // （语文老师兼任多科，固定格挤压时某天 3 节是允许的；4 节以上拒绝，张秀芝问题）
          if (this._teacherOnDay(sched, cid, d, teacher) >= 4) continue;
          // 半天约束（全局跨班）+ 周课时分级：
          //   周课时 ≤13 的老师：上午/下午各 ≤2 节（硬性，第 3 节拒绝）
          //   周课时 ≥14 的老师：尽量满足（第 3 节重罚但不硬拒）
          const isAm = p <= 3;
          let gHalf = 0;
          for (let pp = (isAm ? 1 : 4); pp <= (isAm ? 3 : 6); pp++) {
            if (busy[teacher + '|' + d + '-' + pp]) gHalf++;
          }
          const weekL = expLoad[teacher] || 0;
          const gHard = weekL <= 13;
          if (gHard && gHalf >= 3) continue;

          let sc = 0;
          if (gHalf >= 3) sc -= 80;        // 14+ 节老师半天第 3 节尽量不排
          else if (gHalf === 2) sc -= 25;
          if (Store.isFixedEmpty(cid, d, p)) sc -= 80;   // 大课间槽重罚：课程尽量不占用
          sc += (remain[subject] || 1) * 3;
          sc += (5 - this._daysUsed(sched, cid, subject)) * 3.5;
          if (p <= 3 && isMain(subject)) sc += 4;
          if (p === 1 && (subject === '体育一' || subject === '体育二' || subject === '音乐一' || subject === '音乐二')) sc -= 6;
          if (p >= 5 && isMain(subject)) sc -= 2;
          if (t.assistant) sc -= 1;
          // 教师全局日课时（跨班累计）+ 周课时分级：
          //   所有老师每天 ≤4 节（兜底）；≤13 节的老师每天 ≤3 节（硬）；≥14 节老师第 4 节尽量不排
          const gDay = load[teacher + '|' + d] || 0;
          if (gDay >= 4) continue;
          if (gHard && gDay >= 3) continue;
          if (gDay >= 3) sc -= 60;
          sc -= gDay * 0.7;
          // 教师连堂惩罚：第 2 节连排重罚，第 3 节连排硬拒绝（3 节联堂问题）
          let streak = 0;
          if (busy[teacher + '|' + d + '-' + (p - 1)]) streak = 1;
          if (streak && busy[teacher + '|' + d + '-' + (p - 2)]) streak = 2;
          if (streak === 2) continue;
          if (streak === 1) sc -= 15;
          // 科学二/科学三不与该数学老师当天在本班的数学课同一天（教导处确认的排课规则）
          if ((subject === '科学二' && this._hasSubjOnDayBy(sched, cid, d, teacher, '数学')) ||
              (subject === '科学三' && this._hasSubjOnDayBy(sched, cid, d, teacher, '数学')) ||
              (subject === '数学' && (this._hasSubjOnDayBy(sched, cid, d, teacher, '科学二') || this._hasSubjOnDayBy(sched, cid, d, teacher, '科学三')))) sc -= 60;
          // 主科尽量让老师每天在班里只露一次面（语文/数学/英语分散到不同天）
          if (isMain(subject) && this._hasSubjOnDayBy(sched, cid, d, teacher, subject)) sc -= 12;
          if (forcePinned && fbSet && fbSet.indexOf(teacher) >= 0) sc -= 200;   // 兜底教师重罚：首选优先
          if (relaxed) {
            sc -= 50;
            // 放宽模式下仍尽量不突破上限：超限教师/同科给重罚（而非完全放行）
            const dayT = this._teacherOnDay(sched, cid, d, teacher);
            if (dayT >= maxPerDay) sc -= 25 * (dayT - maxPerDay + 1);
            const dayS = this._subjOnDay(sched, cid, d, subject);
            if (dayS >= cap) sc -= 15 * (dayS - cap + 1);
          }
          sc += rand() * 4;

          if (sc > bestScore) { bestScore = sc; best = { subject, teacher }; }
        }
      }
      return best;
    },

    /* 固定科目、选择槽位（专职/功能室科目阶段一用） */
    _pickForSubject(env, remain, cid, subject, relaxed) {
      const { roomBusy, load, tLoad, expLoad, rand, st, sched } = env;
      const mainCap = st.options.maxSameSubjectPerDay || 2;
      const maxPerDay = st.options.maxLessonsPerDay || 3;
      const cap = (subject === '语文' || subject === '数学') ? mainCap : 1;
      const cands = Store.candidatesFor(cid, subject);

      let best = null, bestScore = -1e9;
      for (let dd = 1; dd <= 5; dd++) {
        for (let pp = 1; pp <= 6; pp++) {
          const k = dd + '-' + pp;
          const sl = { d: dd, p: pp, k };
          if (sched[cid][k] && sched[cid][k].subject) continue;         // 已有课
          if (!relaxed && this._subjOnDay(sched, cid, dd, subject) >= cap) continue;

          const room = Store.roomForSubject(subject);
          if (room && (roomBusy[room.id + '|' + k] || 0) >= room.capacity) continue;

          for (const teacher of cands) {
            if (!teacher) continue;
            const t = Store.teacherByName(teacher);
            if (!t || t.nonTeaching) continue;
            if (Store.teacherBusyForResearch(teacher, dd, pp)) continue;
            if (env.busy[teacher + '|' + k]) continue;
            if (!relaxed && this._teacherOnDay(sched, cid, dd, teacher) >= maxPerDay) continue;
            // 同班日课时硬上限 3 节
            if (this._teacherOnDay(sched, cid, dd, teacher) >= 3) continue;
            // 半天约束（全局跨班）+ 周课时分级：≤13 节硬、≥14 节尽量
            let gHalf = 0;
            const hAm = pp <= 3;
            for (let q = (hAm ? 1 : 4); q <= (hAm ? 3 : 6); q++) {
              if (env.busy[teacher + '|' + dd + '-' + q]) gHalf++;
            }
            const weekL2 = expLoad[teacher] || 0;
            const gHard2 = weekL2 <= 13;
            if (gHard2 && gHalf >= 3) continue;

            let sc = 0;
            if (gHalf >= 3) sc -= 80;
            else if (gHalf === 2) sc -= 25;
            if (Store.isFixedEmpty(cid, dd, pp)) sc -= 80;   // 大课间槽重罚：课程尽量不占用
            sc += (5 - this._daysUsed(sched, cid, subject)) * 3.5;        // 分散到不同天
            if (pp <= 3 && isMain(subject)) sc += 3;
            if (pp >= 5 && isMain(subject)) sc -= 1.5;
            // 教师全局日课时（跨班累计）：≤13 节每天 ≤3（硬）、≥14 节第 4 节尽量不排、所有人 ≤4
            const gDay = load[teacher + '|' + dd] || 0;
            if (gDay >= 4) continue;
            if (gHard2 && gDay >= 3) continue;
            if (gDay >= 3) sc -= 60;
            sc -= gDay * 0.7;                                            // 教师日课时均衡
            // 连堂：第 2 节轻罚，第 3 节拒绝
            let st2 = 0;
            if (env.busy[teacher + '|' + dd + '-' + (pp - 1)]) st2 = 1;
            if (st2 && env.busy[teacher + '|' + dd + '-' + (pp - 2)]) st2 = 2;
            if (st2 === 2) continue;
            if (st2 === 1) sc -= 12;
            sc -= (tLoad[teacher] || 0) * 0.05;                           // 教师周总负载均衡
            sc += rand() * 4;
            if (sc > bestScore) { bestScore = sc; best = { d: dd, p: pp, k, teacher }; }
          }
        }
      }
      return best;
    },

    /* ---------- 后处理：班内两两交换 ---------- */
    _polish(sched, env, st) {
      const maxPerDay = st.options.maxLessonsPerDay || 3;
      for (let iter = 0; iter < 4; iter++) {
        let improved = false;
        for (const c of st.classes) {
          const row = sched[c.id]; if (!row) continue;
          const keys = Object.keys(row).filter(k =>
            row[k] && row[k].subject && !row[k].locked && !row[k].pinned);
          for (let i = 0; i < keys.length; i++) {
            for (let j = i + 1; j < keys.length; j++) {
              const a = keys[i], b = keys[j], ca = row[a], cb = row[b];
              if (!ca || !cb || ca.subject === cb.subject) continue;

              const before = this._localCost(sched, c.id, [a, b], env, st, maxPerDay);
              unmark(env, ca, a, c.id); unmark(env, cb, b, c.id);
              row[a] = cb; row[b] = ca;
              mark(env, cb, a, c.id); mark(env, ca, b, c.id);
              const after = this._localCost(sched, c.id, [a, b], env, st, maxPerDay);

              if (after < before) improved = true;
              else {
                unmark(env, cb, a, c.id); unmark(env, ca, b, c.id);
                row[a] = ca; row[b] = cb;
                mark(env, ca, a, c.id); mark(env, cb, b, c.id);
              }
            }
          }
        }
        if (!improved) break;
      }
    },

    _localCost(sched, cid, slots, env, st, maxPerDay) {
      let cost = 0;
      const row = sched[cid] || {};
      const days = {};
      const mainCap = st.options.maxSameSubjectPerDay || 2;

      slots.forEach(k => {
        const cell = row[k];
        if (!cell || !cell.subject) return;
        const sp = k.split('-'); const d = +sp[0], p = +sp[1];
        days[d] = 1;
        if (cell.teacher) {
          if (Store.teacherBusyForResearch(cell.teacher, d, p)) cost += 100;
          const b = env.busy[cell.teacher + '|' + k];
          if (b && Object.keys(b).length > 1) cost += 100;
          // 全局日课时/半天约束（防止 _polish 交换引入"≤13节老师超3节/天、半天超2节"）
          const gd = env.load[cell.teacher + '|' + d] || 0;
          const wl = env.expLoad[cell.teacher] || 0;
          const hd = wl <= 13;
          if (gd > 4) cost += 100;
          if (hd && gd > 3) cost += 50;
          let gh = 0;
          const hAmL = p <= 3;
          for (let q = (hAmL ? 1 : 4); q <= (hAmL ? 3 : 6); q++) {
            if (env.busy[cell.teacher + '|' + d + '-' + q]) gh++;
          }
          if (gh > 3) cost += 100;
          if (hd && gh > 2) cost += 50;
        }
        const room = Store.roomForSubject(cell.subject);
        if (room) {
          const used = env.roomBusy[room.id + '|' + k] || 0;
          if (used > room.capacity) cost += 60;
        }
        // 科学二/科学三不与该数学老师当天在本班的数学课同一天（交换时同样遵守）
        if (cell.subject === '科学二' || cell.subject === '科学三' || cell.subject === '数学') {
          const peers = cell.subject === '数学' ? ['科学二', '科学三'] : ['数学'];
          for (let pp = 1; pp <= 6; pp++) {
            const c2 = row[d + '-' + pp];
            if (c2 && c2 !== cell && peers.indexOf(c2.subject) >= 0 && c2.teacher === cell.teacher) cost += 60;
          }
        }
      });

      for (const dk of Object.keys(days)) {
        const d = +dk;
        const sc = {}, tc = {};
        // 连堂检测：同班同教师连续节次，3 连堂重罚（避免 _polish 交换引入联堂）
        let seq = 0, lastT = null;
        for (let p = 1; p <= 6; p++) {
          const cell = row[d + '-' + p];
          if (!cell || !cell.subject) { seq = 0; lastT = null; continue; }
          if (cell.teacher && cell.teacher === lastT) {
            seq++;
            if (seq >= 3) cost += 40;     // 连续第 3 节起重罚
            else if (seq === 2) cost += 4; // 连续第 2 节轻罚
          } else seq = 0;
          lastT = cell.teacher || null;
        }
        for (let p = 1; p <= 6; p++) {
          const cell = row[d + '-' + p];
          if (!cell || !cell.subject) continue;
          sc[cell.subject] = (sc[cell.subject] || 0) + 1;
          if (cell.teacher) tc[cell.teacher] = (tc[cell.teacher] || 0) + 1;
          if (p >= 5 && isMain(cell.subject)) cost += 0.3;
          if (p === 1 && (cell.subject === '体育一' || cell.subject === '体育二' || cell.subject === '音乐一' || cell.subject === '音乐二')) cost += 0.6;
        }
        for (const s of Object.keys(sc)) {
          const cap = (s === '语文' || s === '数学') ? mainCap : 1;
          if (sc[s] > cap) cost += (sc[s] - cap) * 10;
        }
        for (const t of Object.keys(tc)) {
          if (tc[t] > maxPerDay) cost += (tc[t] - maxPerDay) * 8;
        }
      }
      return cost;
    },

    /* ---------- 计数辅助（基于传入 draft） ---------- */
    _subjOnDay(sched, cid, day, subject) {
      const row = sched[cid] || {}; let n = 0;
      for (let p = 1; p <= 6; p++) {
        const cell = row[day + '-' + p];
        if (cell && cell.subject === subject) n++;
      }
      return n;
    },
    _teacherOnDay(sched, cid, day, teacher) {
      const row = sched[cid] || {}; let n = 0;
      for (let p = 1; p <= 6; p++) {
        const cell = row[day + '-' + p];
        if (cell && cell.teacher === teacher) n++;
      }
      return n;
    },
    // 某教师某班某天上午(1-3)/下午(4-6)节数（用于"上午/下午各最多2节"约束）
    _teacherHalfDay(sched, cid, day, teacher, isAm) {
      const row = sched[cid] || {}; let n = 0;
      const from = isAm ? 1 : 4, to = isAm ? 3 : 6;
      for (let p = from; p <= to; p++) {
        const cell = row[day + '-' + p];
        if (cell && cell.teacher === teacher) n++;
      }
      return n;
    },
    _daysUsed(sched, cid, subject) {
      const row = sched[cid] || {}; const days = {};
      Object.keys(row).forEach(k => {
        if (row[k] && row[k].subject === subject) days[k.split('-')[0]] = 1;
      });
      return Object.keys(days).length;
    },
    // 某教师在某班某天是否已上某科目（用于"科学二不与数学同天"等约束）
    _hasSubjOnDayBy(sched, cid, day, teacher, subject) {
      const row = sched[cid] || {};
      for (let p = 1; p <= 6; p++) {
        const cell = row[day + '-' + p];
        if (cell && cell.subject === subject && cell.teacher === teacher) return true;
      }
      return false;
    },

    /* ================= 冲突检测 ================= */
    countConflicts(schedule) {
      schedule = schedule || Store.state.schedule;
      const st = Store.state;
      const out = [];
      const teacherSlot = {};
      const roomSlot = {};

      st.classes.forEach(c => {
        const row = schedule[c.id] || {};

        for (let d = 1; d <= 5; d++) {
          for (let p = 1; p <= 6; p++) {
            const k = d + '-' + p;
            const cell = row[k];
            if (!cell || !cell.subject) continue;

            if (cell.teacher && cell.kind !== 'merge') {
              (teacherSlot[cell.teacher + '|' + k] = teacherSlot[cell.teacher + '|' + k] || []).push(c.name);
              if (Store.teacherBusyForResearch(cell.teacher, d, p)) {
                out.push({
                  type: 'research', level: 'error',
                  text: `${c.name} 星期${global.cnNum(d)}第${p}节「${cell.subject}」由 ${cell.teacher} 任课，但其科组此时段为集体教研时间`
                });
              }
            }
            const room = Store.roomForSubject(cell.subject);
            if (room) {
              (roomSlot[room.id + '|' + k] = roomSlot[room.id + '|' + k] || []).push(c.name);
            }
          }
        }

        const plan = st.plan[c.grade] || {};
        const cnt = {};
        Object.keys(row).forEach(k => {
          if (row[k] && row[k].subject) cnt[row[k].subject] = (cnt[row[k].subject] || 0) + 1;
        });
        Object.keys(plan).forEach(s => {
          const diff = (cnt[s] || 0) - plan[s];
          if (diff !== 0) {
            out.push({
              type: 'quota', level: diff > 0 ? 'warn' : 'error',
              text: `${c.name}「${s}」应排 ${plan[s]} 节，实排 ${cnt[s] || 0} 节（${diff > 0 ? '多' : '少'} ${Math.abs(diff)} 节）`
            });
          }
        });
        Object.keys(cnt).forEach(s => {
          if (!plan[s]) {
            out.push({ type: 'quota', level: 'warn', text: `${c.name}「${s}」不在${global.cnNum(c.grade)}年级课时方案中，却排了 ${cnt[s]} 节` });
          }
        });

        let empty = 0;
        for (let d = 1; d <= 5; d++) for (let p = 1; p <= 6; p++) if (!row[d + '-' + p]) empty++;
        // 允许「课时方案没覆盖」的空节（如已确认不开设道法/劳动教育的年级），只报超出方案的空节
        const planTotal = Object.values(plan).reduce((a, b) => a + (b || 0), 0);
        const overEmpty = empty - (30 - planTotal);
        if (overEmpty > 0) out.push({ type: 'empty', level: 'error', text: `${c.name} 课时方案共 ${planTotal} 节，却还有 ${empty} 个空节（多 ${overEmpty} 个未排）` });

        // 全校固定格（班会 / 大阅读）：课时方案里有该科目的班必须排在指定槽位
        st.fixed.forEach(f => {
          if ((plan[f.subject] || 0) <= 0) return;
          const cell = row[f.slot];
          if (!cell || cell.subject !== f.subject) {
            const fsp = f.slot.split('-');
            out.push({
              type: 'fixed', level: 'error',
              text: `${c.name} 星期${global.cnNum(+fsp[0])}第${fsp[1]}节应为全校固定「${f.subject}」（${f.note}），当前` +
                (cell && cell.subject ? '排了「' + cell.subject + '」' : '为空')
            });
          }
        });

        const maxPerDay = st.options.maxLessonsPerDay || 3;
        const mainCap = st.options.maxSameSubjectPerDay || 2;
        for (let d = 1; d <= 5; d++) {
          const dayCnt = {}, tCnt = {};
          for (let p = 1; p <= 6; p++) {
            const cell = row[d + '-' + p];
            if (!cell || !cell.subject) continue;
            dayCnt[cell.subject] = (dayCnt[cell.subject] || 0) + 1;
            if (cell.teacher) tCnt[cell.teacher] = (tCnt[cell.teacher] || 0) + 1;
          }
          Object.keys(dayCnt).forEach(s => {
            const cap = (s === '语文' || s === '数学') ? mainCap : 1;
            if (dayCnt[s] > cap) {
              out.push({ type: 'sameday', level: 'warn', text: `${c.name} 星期${global.cnNum(d)}「${s}」排了 ${dayCnt[s]} 节（建议不超过 ${cap} 节）` });
            }
          });
          Object.keys(tCnt).forEach(t => {
            if (tCnt[t] > maxPerDay) {
              out.push({ type: 'sameday', level: 'warn', text: `${c.name} 星期${global.cnNum(d)} ${t} 在本班上了 ${tCnt[t]} 节（上限 ${maxPerDay} 节）` });
            }
          });
        }
      });

      Object.keys(teacherSlot).forEach(tk => {
        const arr = teacherSlot[tk];
        if (arr.length > 1) {
          const parts = tk.split('|');
          const sp = parts[1].split('-');
          out.push({
            type: 'clash', level: 'error',
            text: `${parts[0]} 在 星期${global.cnNum(+sp[0])}第${sp[1]}节 同时被 ${arr.length} 个班占用：${arr.join('、')}`
          });
        }
      });

      Object.keys(roomSlot).forEach(rk => {
        const arr = roomSlot[rk];
        const room = Store.roomById(rk.split('|')[0]);
        if (room && arr.length > room.capacity) {
          const sp = rk.split('|')[1].split('-');
          out.push({
            type: 'room', level: 'error',
            text: `${room.name} 在 星期${global.cnNum(+sp[0])}第${sp[1]}节 同时有 ${arr.length} 个班使用（容量 ${room.capacity}）：${arr.join('、')}`
          });
        }
      });

      return out;
    },

    /* 教研时段占用统计 */
    researchReport() {
      const st = Store.state;
      const rows = [];
      st.research.forEach(r => {
        r.slots.forEach(k => {
          const sp = k.split('-'); const d = +sp[0], p = +sp[1];
          const teachers = st.teachers.filter(t => t.groups.indexOf(r.group) >= 0 && !t.nonTeaching);
          let assigned = 0;
          st.classes.forEach(c => {
            const cell = (st.schedule[c.id] || {})[k];
            if (cell && cell.teacher) {
              const t = Store.teacherByName(cell.teacher);
              if (t && t.groups.indexOf(r.group) >= 0) assigned++;
            }
          });
          rows.push({ group: r.group, day: d, period: p, slot: k, teachers: teachers.length, assigned });
        });
      });
      return rows;
    },

    /* 某班某格能否放置某科目（供 UI 拖拽/候选区用）
     * exclude: { "classId|day-period": true } 这些槽位不计入占用（交换时用）
     */
    canPlace(classId, day, period, subject, exclude) {
      exclude = exclude || {};
      const st = Store.state;
      const k = day + '-' + period;
      // 一年级固定空槽（周二~周五第6节放学）不可排课
      if (Store.isFixedEmpty(classId, day, period)) {
        return { ok: false, reason: '一年级最后两节固定放学，不排课' };
      }
      // 本格自身不计入占用（我们要放的就是这一格，它现有的内容是要被替换的）
      exclude[classId + '|' + k] = true;
      const cands = Store.candidatesFor(classId, subject).filter(n => {
        const t = Store.teacherByName(n);
        return t && !t.nonTeaching;
      });
      if (!cands.length) return { ok: false, reason: '找不到任课教师' };

      let lastReason = '';
      for (const t of cands) {
        if (Store.teacherBusyForResearch(t, day, period)) { lastReason = t + ' 科组此时段教研'; continue; }
        const r = this._teacherOk(classId, day, period, subject, t, exclude);
        if (r.ok) return r;
        lastReason = r.reason;
      }
      return { ok: false, reason: lastReason || '该时段所有候选教师都不可用' };
    },
    _teacherOk(classId, day, period, subject, teacher, exclude) {
      const st = Store.state;
      const k = day + '-' + period;
      // 撞课（排除被移动的格子）
      let clash = null;
      for (const c of st.classes) {
        if (exclude[c.id + '|' + k]) continue;
        const cell = (st.schedule[c.id] || {})[k];
        if (cell && cell.teacher === teacher) { clash = c; break; }
      }
      if (clash) return { ok: false, reason: teacher + ' 此时段已排 ' + clash.short };
      // 功能室（排除被移动的格子）
      const room = Store.roomForSubject(subject);
      if (room) {
        let used = 0;
        for (const c of st.classes) {
          if (exclude[c.id + '|' + k]) continue;
          const cell = (st.schedule[c.id] || {})[k];
          if (cell && cell.subject && Store.roomForSubject(cell.subject) === room) used++;
        }
        if (used >= room.capacity) {
          return { ok: false, reason: room.name + ' 此时段已满（容量 ' + room.capacity + '）' };
        }
      }
      return { ok: true, teacher };
    }
  };

  /* ================= env（教师/功能室占用，基于全校） ================= */
  /**
   * 构建 env：busy["教师|slot"]={cid:1}、roomBusy["roomId|slot"]=n、load["教师|day"]=n
   * schedule 里是"将被重排的范围"的保留格；scope 之外的班用 st.schedule 里的现状。
   */
  function buildEnv(st, schedule, base, classIds, mode) {
    const env = {
      busy: base.busy || {},
      load: base.load || {},
      roomBusy: base.roomBusy || {},
      tLoad: base.tLoad || {},
      expLoad: {},   // 教师应排周课时（用于"≤13节每天≤3、≥14节尽量"分级）
      st
    };
    st.teachers.forEach(t => { env.expLoad[t.name] = Store.expectedLoad(t.name); });
    st.classes.forEach(c => {
      const inScope = classIds && classIds.indexOf(c.id) >= 0;
      // scope 内：schedule 里是保留格（locked/fill）；scope 外：全部现状都算占用
      const row = inScope ? (schedule[c.id] || {}) : (st.schedule[c.id] || {});
      Object.keys(row).forEach(k => mark(env, row[k], k, c.id));
    });
    return env;
  }

  function mark(env, cell, slot, cid) {
    if (!cell || !cell.subject) return;
    if (cell.teacher) {
      const k = cell.teacher + '|' + slot;
      (env.busy[k] = env.busy[k] || {})[cid] = 1;
      const dk = cell.teacher + '|' + slot.split('-')[0];
      env.load[dk] = (env.load[dk] || 0) + 1;
      env.tLoad[cell.teacher] = (env.tLoad[cell.teacher] || 0) + 1;
    }
    const room = Store.roomForSubject(cell.subject);
    if (room) env.roomBusy[room.id + '|' + slot] = (env.roomBusy[room.id + '|' + slot] || 0) + 1;
  }
  function unmark(env, cell, slot, cid) {
    if (!cell || !cell.subject) return;
    if (cell.teacher) {
      const k = cell.teacher + '|' + slot;
      if (env.busy[k]) { delete env.busy[k][cid]; if (!Object.keys(env.busy[k]).length) delete env.busy[k]; }
      const dk = cell.teacher + '|' + slot.split('-')[0];
      env.load[dk] = Math.max(0, (env.load[dk] || 0) - 1);
      env.tLoad[cell.teacher] = Math.max(0, (env.tLoad[cell.teacher] || 0) - 1);
    }
    const room = Store.roomForSubject(cell.subject);
    if (room) env.roomBusy[room.id + '|' + slot] = Math.max(0, (env.roomBusy[room.id + '|' + slot] || 0) - 1);
  }

  function slotPressure(d, p) {
    const k = d + '-' + p;
    let n = 0;
    Store.state.research.forEach(r => { if (r.slots.indexOf(k) >= 0) n++; });
    return n;
  }

  /* 该班"需要共享教师/功能室"的科目数（越多越该先排） */
  function sharedScore(c) {
    const plan = Store.state.plan[c.grade] || {};
    let score = 0;
    Object.keys(plan).forEach(s => {
      if (!plan[s]) return;
      const mode = (Store.subjectByName(s) || {}).mode;
      if (mode === 'specialist' || Store.roomForSubject(s)) score += plan[s];
    });
    return score;
  }

  /* 该科目在该班是否由"共享专职教师"任教（需要优先占槽） */
  function isSpecSubject(cid, s) {
    const mode = (Store.subjectByName(s) || {}).mode;
    if (mode === 'specialist') return true;
    if (mode === 'classChinese' || mode === 'classMath' || mode === 'headTeacher') return false;
    // auto：看该班该科是否已有专职教师（duties 匹配）
    return Store.state.teachers.some(t =>
      !t.nonTeaching && t.duties.some(d => d.classId === cid && d.subject === s));
  }
  /* 权重：占功能室 > 专职共享 */
  function specWeight(s) {
    let w = Store.roomForSubject(s) ? 10 : 5;
    return w;
  }
  function isMain(s) { return s === '语文' || s === '数学' || s === '英语'; }
  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  global.Engine = Engine;
})(window);
