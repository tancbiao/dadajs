// 课程表「作息可编辑」功能冒烟测试（jsdom）v3
// 等 DOMContentLoaded → 开弹窗 → 改 → 保存 → 重开验证 → 重置
const fs = require('fs');
const { JSDOM } = require('jsdom');

const FILES = ['dada/index.html', 'yuwen/index.html', 'yingyu/index.html', 'kexue/index.html'];
const tick = () => new Promise(r => setTimeout(r, 30));

function openCfg(w) {
  w.openEdit('classCfg', null);
  const d = w.document.getElementById('cfgDays');
  const r = w.document.getElementById('cfgRows');
  if (!d || !r) return null;
  return {
    days: [...d.querySelectorAll('input[type=checkbox]')],
    names: [...r.querySelectorAll('[data-pname]')],
    times: [...r.querySelectorAll('[data-ptime]')],
    rowCount: r.querySelectorAll('[data-pname]').length,
  };
}
const firstRow = v => ({ name: v.names[0].value, time: v.times[0].value, days: v.days.filter(x => x.checked).length });

async function run() {
  let bad = 0;
  for (const f of FILES) {
    console.log(`\n===== ${f} =====`);
    const html = fs.readFileSync(f, 'utf8');
    const dom = new JSDOM(html, {
      runScripts: 'dangerously', pretendToBeVisual: true,
      url: 'https://dadajs.cn/' + f.replace('/index.html', '/'),
    });
    const w = dom.window;
    try {
      await tick(); // 等 DOMContentLoaded → load()
      if (typeof w.openEdit !== 'function' || typeof w.saveClsCfg !== 'function') {
        console.log('  ✗ openEdit/saveClsCfg 不在 window'); bad++; continue;
      }
      // 切到课程表页（真实场景按钮只在此页出现，网格才存在）
      if (typeof w.switchPage === 'function') w.switchPage('schedule');
      await tick();
      const v0 = openCfg(w);
      if (!v0) { console.log('  ✗ 弹窗未渲染'); bad++; continue; }
      const before = firstRow(v0);
      console.log(`  ✓ 弹窗开：勾选 ${before.days} 天 / ${v0.rowCount} 节行，首行 "${before.name}" @ ${before.time || '(空)'}`);
      if (before.days < 4) { console.log('  ✗ 默认上课日异常'); bad++; }

      // 修改：去周三 / 首节改「晨读」07:50 / 删末节
      v0.days[2].checked = false;
      v0.names[0].value = '晨读';
      v0.times[0].value = '07:50';
      if (v0.rowCount > 2) v0.names[v0.rowCount - 1].parentNode.remove();
      w.saveClsCfg();

      // 网格列数应跟着天数变（8节→7节、5天→6天？不——去周三后仍5天内的6天…这里验证网格重绘不崩即可）
      const gridEl = w.document.getElementById('clsGrid');
      const colTpl = gridEl ? gridEl.style.gridTemplateColumns : '(无网格)';
      console.log(`  ✓ 保存后网格列模板: ${colTpl}`);

      const v1 = openCfg(w);
      const after = firstRow(v1);
      console.log(`  ✓ 保存后：勾选 ${after.days} 天 / ${v1.rowCount} 节，首行 "${after.name}" @ ${after.time}`);
      const ok1 = after.days === 4 && !v1.days[2].checked
        && after.name === '晨读' && after.time === '07:50' && v1.rowCount === v0.rowCount - 1;
      console.log(`  ${ok1 ? '✓' : '✗'} 保存生效（去周三/晨读@07:50/减一节）`);
      if (!ok1) bad++;

      w.resetCfg();
      const v2 = openCfg(w);
      const back = firstRow(v2);
      const ok2 = back.name === before.name && back.days === before.days && v2.rowCount === v0.rowCount;
      console.log(`  ✓ 重置后：勾选 ${back.days} 天 / ${v2.rowCount} 节，首行 "${back.name}"`);
      console.log(`  ${ok2 ? '✓' : '✗'} 重置成功`);
      if (!ok2) bad++;
    } catch (e) {
      console.log('  ✗ 运行异常: ' + e.message);
      bad++;
    } finally {
      dom.window.close();
    }
  }
  console.log(`\n总问题数: ${bad}`);
  process.exit(bad ? 1 : 0);
}
run();
