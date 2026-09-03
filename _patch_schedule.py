# -*- coding: utf-8 -*-
"""
课程表「作息可编辑」改造
把硬编码的 CLS_DAYS / CLS_PERIODS / CLS_TIMES 改成读 S.class.cfg，
并新增「⚙ 作息时间」设置弹窗。四个工作台统一处理。

⚠ 函数不能叫 CD/CP/CT —— CD 已被倒计时模块占用（let CD = {totalSeconds:...}）。
   故用 clsDays() / clsPeriods() / clsTimes()。
"""
import re, pathlib

FILES = ['dada/index.html', 'yuwen/index.html', 'yingyu/index.html', 'kexue/index.html']

# 容错换行：容忍 kexue 那份被格式化后行间的空行
NL = r"[ \t]*\n(?:[ \t]*\n)*"

# ---------- 1. 常量块 → 动态配置（沿用各文件原有默认值） ----------
CFG_TPL = """/* ── 作息配置：点「⚙ 作息时间」可自定义，存在本机 ── */
const CLS_DEF = { days: %(days)s, periods: %(periods)s, times: %(times)s };
function clsCfg(){
  var c = S.class.cfg;
  if(!c || !c.periods || !c.periods.length) c = S.class.cfg = {days:CLS_DEF.days.slice(), periods:CLS_DEF.periods.slice(), times:CLS_DEF.times.slice()};
  if(!c.days || !c.days.length) c.days = CLS_DEF.days.slice();
  if(!c.times) c.times = [];
  while(c.times.length < c.periods.length) c.times.push('');
  return c;
}
function clsDays(){ return clsCfg().days; }
function clsPeriods(){ return clsCfg().periods; }
function clsTimes(){ return clsCfg().times; }"""

CONST_RE = re.compile(
    r"const CLS_DAYS = (\[[^\]]*\]);" + NL +
    r"const CLS_PERIODS = (\[[^\]]*\]);" + NL +
    r"const CLS_TIMES = (\[[^\]]*\]);")

# ---------- 2. 「⚙ 作息时间」按钮 ----------
BTN_RE = re.compile(
    r"( *)<button class=\"btn sm b-ghost\" onclick=\"openEdit\('classMulti',null\)\">⚡ 批量粘贴</button>")

def btn_sub(m):
    ind = m.group(1)
    return (m.group(0) + "\n" + ind
            + "<button class=\"btn sm b-blue\" onclick=\"openEdit('classCfg',null)\">⚙ 作息时间</button>")

# ---------- 3. 作息设置弹窗（插在 class 编辑分支与 classMulti 分支之间） ----------
# 原：<button…保存</button> / </div>` / }); / } else if(type==='classMulti'){
# 新分支末尾不写 }; —— 复用原有的 });
ANCHOR_RE = re.compile(
    r"( *)<button class=\"btn b-blue\" onclick=\"saveCls\([^)]*\)\">保存</button>" + NL +
    r"( *)</div>`" + NL +
    r"    \}\);" + NL +
    r"  \} else if\(type==='classMulti'\)\{")

BRANCH = (
    "\n    });\n"
    "  } else if(type==='classCfg'){\n"
    "    const c = clsCfg();\n"
    "    const WEEK = ['一','二','三','四','五','六','日'];\n"
    "    showModal({\n"
    "      title: '⚙ 作息时间设置',\n"
    "      bodyHtml: `\n"
    "        <p style=\"color:var(--ink-l);font-size:.85rem;margin:0 0 12px\">改节次名称和上课时间。已排的课会自动跟着平移，不会丢。</p>\n"
    "        <label class=\"lbl\">上课日</label>\n"
    "        <div id=\"cfgDays\" style=\"display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px\">\n"
    "          ${WEEK.map((d,i)=>`<label style=\"display:inline-flex;align-items:center;gap:4px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:5px 12px;font-size:.85rem;cursor:pointer\"><input type=\"checkbox\" value=\"${i}\" ${c.days.indexOf(d)>=0?'checked':''}> 周${d}</label>`).join('')}\n"
    "        </div>\n"
    "        <label class=\"lbl\">节次与时间</label>\n"
    "        <div id=\"cfgRows\" style=\"display:flex;flex-direction:column;gap:6px\">\n"
    "          ${c.periods.map((p,i)=>`<div style=\"display:flex;gap:6px;align-items:center\">\n"
    "            <input class=\"inp\" data-pname value=\"${escapeHtml(p)}\" placeholder=\"节次名称\" style=\"flex:1\">\n"
    "            <input class=\"inp\" data-ptime type=\"time\" value=\"${escapeHtml(c.times[i]||'')}\" style=\"width:112px\">\n"
    "            <button class=\"btn xs b-ghost\" onclick=\"this.parentNode.remove()\">✕</button>\n"
    "          </div>`).join('')}\n"
    "        </div>\n"
    "        <div style=\"margin:10px 0;display:flex;gap:8px;flex-wrap:wrap\">\n"
    "          <button class=\"btn sm b-mint\" onclick=\"addCfgRow()\">+ 加一节</button>\n"
    "          <button class=\"btn sm b-ghost\" onclick=\"resetCfg()\">↺ 恢复默认</button>\n"
    "        </div>\n"
    "        <div style=\"margin-top:14px;display:flex;gap:8px;justify-content:flex-end\">\n"
    "          <button class=\"btn b-ghost\" onclick=\"closeModal()\">取消</button>\n"
    "          <button class=\"btn b-blue\" onclick=\"saveClsCfg()\">保存</button>\n"
    "        </div>`")

def anchor_sub(m):
    ind_btn, ind_div = m.group(1), m.group(2)
    return (ind_btn + "<button class=\"btn b-blue\" onclick=\"saveCls('${item?item.id:''}')\">保存</button>\n"
            + ind_div + "</div>`" + BRANCH
            + "\n    });\n  } else if(type==='classMulti'){")

# ---------- 4. 处理函数（插在 bulkImportCls 之后） ----------
ANCHOR2_RE = re.compile(
    r"[ \t]*save\(\);" + NL + r"[ \t]*closeModal\(\);" + NL + r"[ \t]*drawClsGrid\(\);" + NL
    + r"[ \t]*toast\('✅ 已导入'\);" + NL + r"\};")

NEW_FUNCS = """

window.addCfgRow = function(){
  const box = document.getElementById('cfgRows');
  if(!box) return;
  const d = document.createElement('div');
  d.style.cssText = 'display:flex;gap:6px;align-items:center';
  d.innerHTML = '<input class="inp" data-pname placeholder="节次名称" style="flex:1">'
    + '<input class="inp" data-ptime type="time" style="width:112px">'
    + '<button class="btn xs b-ghost" onclick="this.parentNode.remove()">✕</button>';
  box.appendChild(d);
};

window.resetCfg = function(){
  S.class.cfg = {days:CLS_DEF.days.slice(), periods:CLS_DEF.periods.slice(), times:CLS_DEF.times.slice()};
  save(); closeModal(); drawClsGrid();
  toast('↺ 已恢复默认作息（课程安排保留）');
};

window.saveClsCfg = function(){
  const WEEK = ['一','二','三','四','五','六','日'];
  const dayBox = document.getElementById('cfgDays');
  const rowBox = document.getElementById('cfgRows');
  if(!dayBox || !rowBox) return;
  const days = Array.prototype.slice.call(dayBox.querySelectorAll('input:checked')).map(function(x){ return +x.value; });
  const names = Array.prototype.slice.call(rowBox.querySelectorAll('[data-pname]')).map(function(x){ return x.value.trim(); });
  const times = Array.prototype.slice.call(rowBox.querySelectorAll('[data-ptime]')).map(function(x){ return x.value; });
  if(!days.length) return toast('至少选一个上课日');
  const keep = [];
  names.forEach(function(n,i){ if(n) keep.push({n:n, t:times[i]||''}); });
  if(!keep.length) return toast('至少保留一个节次');
  days.sort(function(a,b){ return a-b; });
  const oldP = clsPeriods().slice();
  const oldD = clsDays().slice();
  const newDays = days.map(function(i){ return WEEK[i]; });
  // 已排的课按「星期名 / 节次名」重新映射，对不上就夹到最接近的一格
  S.class.items.forEach(function(it){
    const di = newDays.indexOf(oldD[it.day]);
    it.day = di>=0 ? di : Math.min(it.day, newDays.length-1);
    const pi = keep.findIndex(function(k){ return k.n===oldP[it.period]; });
    it.period = pi>=0 ? pi : Math.min(it.period, keep.length-1);
  });
  S.class.items = S.class.items.filter(function(it){ return it.day < newDays.length && it.period < keep.length; });
  S.class.cfg = {days:newDays, periods:keep.map(function(k){return k.n;}), times:keep.map(function(k){return k.t;})};
  save(); closeModal(); drawClsGrid();
  toast('✅ 作息已更新');
};"""

# ---------- 5. 逐项替换（纯字符串） ----------
REPLACES = [
    # 表格列数跟着天数变（g 在函数开头已声明，不能重复 const）
    ("""  let html = '<div class="h">节次</div>';""",
     """  g.style.gridTemplateColumns = '70px repeat(' + clsDays().length + ',1fr)';
  let html = '<div class="h">节次</div>';"""),
    ("""    for(let d=0;d<5;d++){""",
     """    for(let d=0;d<clsDays().length;d++){"""),
    ("""  if(curDay<1 || curDay>5){""",
     """  if(curDay<1 || curDay>clsDays().length){"""),
    ("""    if(day<0||day>4||period<0||period>7) continue;""",
     """    if(day<0||day>=clsDays().length||period<0||period>=clsPeriods().length) continue;"""),
    ("""  const dayName = ['一','二','三','四','五'];""",
     """  const dayName = clsDays();"""),
    # yuwen 特有：抽签里取上课时间（注意：此刻 CLS_TIMES 已被全局替换成 clsTimes()，匹配替换后形态）
    ("""time: (typeof clsTimes() !== 'undefined' && clsTimes()[p]) ? clsTimes()[p] : '',""",
     """time: (clsTimes()[p] || ''),"""),
    # yuwen 特有：jsdom 调试探针（对象属性语法，全局替换后变成 clsTimes(): 会语法错误，必须还原为属性）
    ("""    clsTimes(): (typeof clsTimes() !== 'undefined') ? clsTimes() : null,
    clsPeriods(): (typeof clsPeriods() !== 'undefined') ? clsPeriods() : null""",
     """    clsTimes: clsTimes(),
    clsPeriods: clsPeriods()"""),
]

# ---------- 6. 边界替换（正则，容忍空行与缩进） ----------
BOUND_RE = re.compile(
    r"[ \t]*if\(day<0 \|\| day>4\) continue;" + NL + r"[ \t]*if\(period<0 \|\| period>7\) continue;")
BOUND_NEW = ("if(day<0 || day>=clsDays().length) continue;\n"
             "    if(period<0 || period>=clsPeriods().length) continue;")


def patch(path):
    p = pathlib.Path(path)
    h = p.read_text(encoding='utf-8')
    log, errs = [], []

    m = CONST_RE.search(h)
    if not m:
        return log, ['未找到 CLS_ 常量定义块']
    days, periods, times = m.group(1), m.group(2), m.group(3)
    h = h[:m.start()] + (CFG_TPL % {'days': days, 'periods': periods, 'times': times}) + h[m.end():]
    log.append(f'  常量块 → 动态配置（沿用原 {len(re.findall(chr(39)+"[^"+chr(39)+"]*"+chr(39), times))} 个时间点）')

    n = 0
    for a, b in [('CLS_DAYS', 'clsDays()'), ('CLS_PERIODS', 'clsPeriods()'), ('CLS_TIMES', 'clsTimes()')]:
        n += h.count(a); h = h.replace(a, b)
    log.append(f'  引用改写 {n} 处 → clsDays()/clsPeriods()/clsTimes()')

    for old, new in REPLACES:
        c = h.count(old)
        if c: h = h.replace(old, new); log.append(f'  ✓ {old.strip()[:50]}… ({c}处)')

    if BOUND_RE.search(h):
        h, c = BOUND_RE.subn(BOUND_NEW, h, count=1)
        log.append('  ✓ 批量粘贴边界动态化')

    if "openEdit('classCfg',null)" in h:
        log.append('  · 作息按钮已存在，跳过')
    elif BTN_RE.search(h):
        h, _ = BTN_RE.subn(btn_sub, h, count=1); log.append('  ✓ 已加「⚙ 作息时间」按钮')
    else:
        errs.append('未匹配到批量粘贴按钮区（作息按钮未加）')

    if "type==='classCfg'" in h:
        log.append('  · 作息弹窗已存在，跳过')
    elif ANCHOR_RE.search(h):
        h, _ = ANCHOR_RE.subn(anchor_sub, h, count=1); log.append('  ✓ 已加作息设置弹窗')
    else:
        errs.append('未找到 class 编辑分支锚点（弹窗未加）')

    if 'window.saveClsCfg' in h:
        log.append('  · 保存函数已存在，跳过')
    elif ANCHOR2_RE.search(h):
        h, _ = ANCHOR2_RE.subn(lambda mm: mm.group(0) + NEW_FUNCS, h, count=1)
        log.append('  ✓ 已加 addCfgRow / resetCfg / saveClsCfg')
    else:
        errs.append('未找到 bulkImportCls 锚点（处理函数未加）')

    p.write_text(h, encoding='utf-8')
    return log, errs


if __name__ == '__main__':
    total = 0
    for f in FILES:
        print(f'\n===== {f} =====')
        if not pathlib.Path(f).exists():
            print('  ✗ 文件不存在'); total += 1; continue
        log, errs = patch(f)
        for l in log: print(l)
        for e in errs: print('  ✗ ' + e); total += 1
    print(f'\n完成，错误 {total} 项')
