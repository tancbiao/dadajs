/* ============================================================
 *  store.js —— 数据建模 / 持久化 / 导入导出
 * ============================================================ */
(function (global) {
  'use strict';

  const D = global.SCHOOL_DATA;
  const KEY = 'cx_paike_v1';

  const Store = {
    state: null,

    /* ---------- 初始化：把原始表数据摊平成可计算模型 ---------- */
    build() {
      const s = {
        meta: Object.assign({}, D.SCHOOL),
        days: D.DAYS.slice(),
        periods: D.PERIODS.map(x => Object.assign({}, x)),
        subjects: D.SUBJECTS.map(x => Object.assign({}, x)),
        research: D.RESEARCH.map(x => ({ group: x.group, slots: x.slots.slice(), note: x.note })),
        fixed: D.FIXED_SLOTS.map(x => Object.assign({}, x)),
        exceptions: (D.EXCEPTIONS || []).map(x => Object.assign({}, x)),
        morningRead: D.MORNING_READ.slice(),
        rooms: (D.FUNCTION_ROOMS || []).map(x => Object.assign({}, x)),
        plan: JSON.parse(JSON.stringify(D.LESSON_PLAN)),
        overrides: JSON.parse(JSON.stringify(D.CONFIRMED_OVERRIDES || {})),
        classes: [],
        teachers: [],
        schedule: {},   // { classId: { 'day-period': {subject, teacher, locked} } }
        options: {
          maxLessonsPerDay: 3,     // 同一教师同一班级一天最多几节（分散 3 节可接受；4 节以上由引擎硬拒；连堂 3 节单独硬拒）
          maxSameSubjectPerDay: 2, // 同班同科目一天最多几节
          avoidFirstPeriodPE: true // 体育课尽量不排第1节
        }
      };

      // --- 班级 ---
      D.GRADES.forEach(g => {
        for (let i = 1; i <= g.count; i++) {
          const id = g.grade + '-' + i;
          s.classes.push({
            id, grade: g.grade, no: i,
            name: cn(g.grade) + '（' + i + '）班',
            short: cn(g.grade) + i,
            headTeacher: D.HEAD_TEACHERS[id] || '',
            cnTeacher: (D.CN_TEACHERS[g.grade] || [])[i - 1] || '',
            mathTeacher: (D.MATH_TEACHERS[g.grade] || [])[i - 1] || ''
          });
        }
      });

      // --- 教师索引 ---
      const tmap = {};
      const get = name => {
        if (!name) return null;
        if (!tmap[name]) {
          tmap[name] = {
            name, groups: [], duties: [], nonTeaching: false, assistant: false,
            maxLessons: 0, busy: {} // 手动设置的不可排课时段
          };
        }
        return tmap[name];
      };

      // 语数教师
      s.classes.forEach(c => {
        if (c.cnTeacher) {
          const t = get(c.cnTeacher);
          addGroup(t, '语文组');
          t.duties.push({ classId: c.id, subject: '语文' });
        }
        if (c.mathTeacher) {
          const t = get(c.mathTeacher);
          addGroup(t, '数学组');
          t.duties.push({ classId: c.id, subject: '数学' });
        }
        if (c.headTeacher && !tmap[c.headTeacher]) get(c.headTeacher);
      });

      // 专职教师
      D.SPECIALISTS.forEach(([name, subject, cls, total, note]) => {
        const t = get(name);
        addGroup(t, '发展组');
        cls.forEach(cid => t.duties.push({ classId: cid, subject }));
        if (note) t.note = (t.note ? t.note + '；' : '') + note;
        t.declared = (t.declared || 0) + (total || 0);
      });

      // 兼科：梁秋维四3数学已在数学表内；黄凤华五4语文已在语文表内
      // 教导主任已确认的任课指定：补 duties 并作为默认 overrides
      const defOv = D.CONFIRMED_OVERRIDES || {};
      Object.keys(defOv).forEach(cid => {
        Object.keys(defOv[cid]).forEach(subj => {
          const t = tmap[defOv[cid][subj]];
          if (t && !t.duties.some(d => d.classId === cid && d.subject === subj)) {
            t.duties.push({ classId: cid, subject: subj });
          }
        });
      });
      // 标记
      D.NON_TEACHING.forEach(n => { if (tmap[n]) tmap[n].nonTeaching = true; });
      D.ASSISTANTS.forEach(n => { if (tmap[n]) tmap[n].assistant = true; });

      s.teachers = Object.values(tmap).sort((a, b) => a.name.localeCompare(b.name, 'zh'));

      // 空课表
      s.classes.forEach(c => { s.schedule[c.id] = {}; });

      // 异常课（合堂）：预填为 locked+kind='merge' 固定格；不参与普通冲突检查
      // 课时统计：teacherLoad 把合堂 cell 不计入，每条 ex 算 1 课时
      this.applyExceptions(s, tmap);

      this.state = s;
      this.reindex();
      return s;
    },

    /* 把异常课（合堂）预填进 schedule；build/load 共用，防止旧存档恢复后合堂丢失 */
    applyExceptions(s, tmap) {
      if (!s.exceptions) return;
      s.exceptions.forEach(ex => {
        const k = ex.day + '-' + ex.period;
        const label = ex.classIds.map(id => {
          const sp = String(id).split('-');
          return (['一', '二', '三', '四', '五', '六'][(+sp[0]) - 1] || sp[0]) + sp[1];
        }).join(' ');
        ex.classIds.forEach(cid => {
          if (!s.schedule[cid]) s.schedule[cid] = {};
          // 覆盖该槽位：确保六年级大阅读一定是合堂教师（赵志良），不是数学老师
          s.schedule[cid][k] = { subject: ex.subject, teacher: ex.teacher, locked: true, kind: 'merge', exceptionId: ex.id, classIdsLabel: label };
        });
        if (ex.teacher) {
          const t = tmap ? tmap[ex.teacher] : s.teachers.find(x => x.name === ex.teacher);
          ex.classIds.forEach(cid => {
            if (t && !t.duties.some(d => d.classId === cid && d.subject === ex.subject)) {
              t.duties.push({ classId: cid, subject: ex.subject });
            }
          });
        }
      });
    },

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const s = JSON.parse(raw);
          if (s && s.classes && s.schedule) {
            this.state = s;
            if (!s.overrides) s.overrides = {};
            if (!s.options) s.options = { maxLessonsPerDay: 3, maxSameSubjectPerDay: 2 };
            if (!s.fixed) s.fixed = [];
            if (!s.morningRead) s.morningRead = global.SCHOOL_DATA.MORNING_READ.slice();
            if (!s.rooms) s.rooms = (global.SCHOOL_DATA.FUNCTION_ROOMS || []).map(x => Object.assign({}, x));
            // 迁移：补上教导主任已确认的任课指定（不覆盖用户手动改过的）
            const defOv = global.SCHOOL_DATA.CONFIRMED_OVERRIDES || {};
            Object.keys(defOv).forEach(cid => {
              Object.keys(defOv[cid]).forEach(subj => {
                if (!s.overrides[cid]) s.overrides[cid] = {};
                if (!s.overrides[cid][subj]) s.overrides[cid][subj] = defOv[cid][subj];
              });
            });
            // 迁移：不排课名单以当前 data.js 为准（例如农丽春已恢复任教）
            const nonT = global.SCHOOL_DATA.NON_TEACHING || [];
            s.teachers.forEach(t => { t.nonTeaching = nonT.indexOf(t.name) >= 0; });
            // 迁移：异常课（合堂）以当前 data.js 为准；旧存档无 exceptions 或合堂格被覆盖时重新应用
            if (!s.exceptions || !s.exceptions.length) {
              s.exceptions = (global.SCHOOL_DATA.EXCEPTIONS || []).map(x => Object.assign({}, x));
            }
            this.applyExceptions(s, null);
            // 迁移：确认任课补充 duties（便于教师课表展示）
            if (s.teachers.every(t => t.duties && t.duties.length)) {
              Object.keys(defOv).forEach(cid => {
                Object.keys(defOv[cid]).forEach(subj => {
                  const t = s.teachers.find(x => x.name === defOv[cid][subj]);
                  if (t && !t.duties.some(d => d.classId === cid && d.subject === subj)) {
                    t.duties.push({ classId: cid, subject: subj });
                  }
                });
              });
            }
            this.reindex();
            return s;
          }
        }
      } catch (e) { console.warn('读取本地存档失败', e); }
      this.state = this.build();
      return this.state;
    },

    save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.state));
        return true;
      } catch (e) { console.warn('保存失败', e); return false; }
    },

    reset() { this.state = this.build(); this.save(); return this.state; },

    /* ---------- 索引（性能） ---------- */
    reindex() {
      this._tIndex = {};
      this.state.teachers.forEach(t => { this._tIndex[t.name] = t; });
      this._cIndex = {};
      this.state.classes.forEach(c => { this._cIndex[c.id] = c; });
      this._sIndex = {};
      this.state.subjects.forEach(s => { this._sIndex[s.name] = s; });
      this._rsSet = {};
      this.state.research.forEach(r => {
        r.slots.forEach(k => { this._rsSet[r.group + '|' + k] = true; });
      });
      this._roomSubj = {};   // subject -> room（仅启用中的功能室）
      (this.state.rooms || []).forEach(r => {
        if (!r.enabled) return;
        r.subjects.forEach(s => { this._roomSubj[s] = r; });
      });
      this._roomById = {};
      (this.state.rooms || []).forEach(r => { this._roomById[r.id] = r; });
      this._candCache = {};
    },

    /* ---------- 查询辅助 ---------- */
    classById(id) {
      if (!this._cIndex) this.reindex();
      return this._cIndex[id];
    },
    teacherByName(n) {
      if (!this._tIndex) this.reindex();
      return this._tIndex[n];
    },
    subjectByName(n) {
      if (!this._sIndex) this.reindex();
      return this._sIndex[n];
    },

    // 科目对应的启用中功能室（无则返回 null）
    roomForSubject(subject) {
      if (!this._roomSubj) this.reindex();
      return this._roomSubj[subject] || null;
    },
    roomById(id) {
      if (!this._roomById) this.reindex();
      return this._roomById[id];
    },

    slotKey(day, period) { return day + '-' + period; },

    isResearchSlot(group, day, period) {
      if (!this._rsSet) this.reindex();
      return !!this._rsSet[group + '|' + day + '-' + period];
    },

    researchSlotsOfGroup(group) {
      const r = this.state.research.find(x => x.group === group);
      return r ? r.slots : [];
    },

    // 某教师是否在该时段参加教研
    teacherBusyForResearch(teacherName, day, period) {
      const t = this.teacherByName(teacherName);
      if (!t) return false;
      if (t.busy && t.busy[this.slotKey(day, period)]) return true;
      return t.groups.some(g => this.isResearchSlot(g, day, period));
    },

    // 某班级某年级的科目周课时
    weeklyCount(classId, subject) {
      const c = this.classById(classId);
      if (!c) return 0;
      const p = this.state.plan[c.grade] || {};
      return p[subject] || 0;
    },

    // 班级课表统计 {subject: 已排节数}
    classCount(classId) {
      const sch = this.state.schedule[classId] || {};
      const m = {};
      Object.keys(sch).forEach(k => {
        const cell = sch[k];
        if (cell && cell.subject) m[cell.subject] = (m[cell.subject] || 0) + 1;
      });
      return m;
    },

    // 教师已排节数（合堂 cell 不计入，按 exception 数计 1 课时）
    teacherLoad(teacherName) {
      let n = 0;
      const sch = this.state.schedule;
      Object.keys(sch).forEach(cid => {
        const row = sch[cid];
        Object.keys(row).forEach(k => {
          const cell = row[k];
          if (cell && cell.teacher === teacherName && cell.kind !== 'merge') n++;
        });
      });
      (this.state.exceptions || []).forEach(ex => {
        if (ex.teacher === teacherName) n++;
      });
      return n;
    },

    // 教师"应排"节数：把他实际承担的所有班级科目（含班会/大阅读/道法等由本班老师兼的）
    // 按课时方案合计。教研时间不在课时方案里，自然不计入。
    // 合堂减免：每条 exception 覆盖的班数 -1 不需额外课时（例如赵志良 8 班大阅读只算 1 课时）
    expectedLoad(teacherName) {
      let n = 0;
      this.state.classes.forEach(c => {
        const plan = this.state.plan[c.grade] || {};
        Object.keys(plan).forEach(s => {
          if (!plan[s]) return;
          if (this.candidatesFor(c.id, s).indexOf(teacherName) >= 0) n += plan[s];
        });
      });
      (this.state.exceptions || []).forEach(ex => {
        if (ex.teacher === teacherName) n -= Math.max(0, ex.classIds.length - 1);
      });
      return n;
    },

    // 教师某时段是否已排课 -> 返回班级id（合堂 cell 豁免：同时段教多个班不算冲突）
    teacherAt(teacherName, day, period) {
      const k = this.slotKey(day, period);
      const sch = this.state.schedule;
      for (const cid of Object.keys(sch)) {
        const cell = sch[cid][k];
        if (cell && cell.teacher === teacherName) {
          if (cell.kind === 'merge') continue;
          return cid;
        }
      }
      return null;
    },

    /* 一、二年级固定空槽：星期二~星期五最后一节（第6节）为大课间（不指定教师，谁有空谁上） */
    isFixedEmpty(classId, day, period) {
      const c = this.classById(classId);
      return !!(c && c.grade <= 2 && day >= 2 && period === 6);
    },

    // 班级某科目可选的教师列表
    candidatesFor(classId, subject) {
      if (!this._candCache) this.reindex();
      const ck = classId + '|' + subject;
      if (this._candCache[ck]) return this._candCache[ck];

      const c = this.classById(classId);
      if (!c) return [];
      const subj = this.subjectByName(subject);
      const mode = subj ? subj.mode : 'auto';
      const ov = (this.state.overrides[classId] || {})[subject];
      if (ov) return (this._candCache[ck] = [ov]);

      const spec = this.state.teachers.filter(t =>
        !t.nonTeaching && t.duties.some(d => d.classId === classId && d.subject === subject)
      ).map(t => t.name);

      let res;
      if (mode === 'specialist') res = spec;
      else if (mode === 'headTeacher') res = c.headTeacher ? [c.headTeacher] : [];
      else if (mode === 'classChinese') res = c.cnTeacher ? [c.cnTeacher] : [];
      else if (mode === 'classMath') res = c.mathTeacher ? [c.mathTeacher] : [];
      else if (spec.length) res = spec;                       // auto：专职优先
      else if (c.cnTeacher) res = [c.cnTeacher];
      else if (c.mathTeacher) res = [c.mathTeacher];
      else res = [];
      return (this._candCache[ck] = res);
    },

    teacherGroupOf(name) {
      const t = this.teacherByName(name);
      return t ? t.groups : [];
    },

    // 找出「课时方案里有、但找不到人上」的班级科目
    noTeacherReport() {
      const out = [];
      this.state.classes.forEach(c => {
        const plan = this.state.plan[c.grade] || {};
        Object.keys(plan).forEach(s => {
          if (!plan[s]) return;
          const cands = this.candidatesFor(c.id, s).filter(n => {
            const t = this.teacherByName(n);
            return t && !t.nonTeaching;
          });
          if (!cands.length) {
            out.push({ classId: c.id, name: c.name, subject: s, count: plan[s] });
          }
        });
      });
      return out;
    },

    setOverride(classId, subject, teacher) {
      this.state.overrides[classId] = this.state.overrides[classId] || {};
      if (teacher) this.state.overrides[classId][subject] = teacher;
      else delete this.state.overrides[classId][subject];
      this._candCache = {};   // 指定人变更 -> 候选缓存失效
    },

    clearSchedule() {
      this.state.classes.forEach(c => { this.state.schedule[c.id] = {}; });
      // 清零后重新套用异常课（合堂）固定格，避免合堂格被清掉
      this.applyExceptions(this.state, null);
    }
  };

  function addGroup(t, g) { if (t.groups.indexOf(g) < 0) t.groups.push(g); }
  function cn(n) { return ['一', '二', '三', '四', '五', '六'][n - 1] || n; }

  global.Store = Store;
  global.cnNum = cn;
})(window);
