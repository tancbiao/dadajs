// 课程表改造后的检查：1)残留硬编码 2)JS 语法 3)关键函数存在
const fs = require('fs');
const vm = require('vm');

const FILES = ['dada/index.html', 'yuwen/index.html', 'yingyu/index.html', 'kexue/index.html'];
let bad = 0;

for (const f of FILES) {
  const h = fs.readFileSync(f, 'utf8');
  console.log(`\n===== ${f} =====`);

  // 1. 残留硬编码
  const leftovers = [];
  if (/\bCLS_DAYS\b|\bCLS_PERIODS\b|\bCLS_TIMES\b/.test(h)) {
    (h.match(/.{0,50}\bCLS_(DAYS|PERIODS|TIMES)\b.{0,50}/g) || []).forEach(m => leftovers.push(m.trim()));
  }
  const hardBounds = [];
  if (/day>4|day>=5\b/.test(h)) hardBounds.push((h.match(/.{0,40}day>4.{0,20}/g) || [])[0]);
  if (/d<5;d\+\+/.test(h)) hardBounds.push('for(let d=0;d<5;d++)');
  if (/curDay>5/.test(h)) hardBounds.push('curDay>5');
  if (/period>7/.test(h)) hardBounds.push((h.match(/.{0,40}period>7.{0,20}/g) || [])[0]);

  if (leftovers.length) { console.log('  ✗ 残留 CLS_ 常量:'); leftovers.forEach(l => console.log('      ' + l)); bad++; }
  else console.log('  ✓ 无 CLS_ 常量残留');
  if (hardBounds.length) { console.log('  ✗ 残留硬编码边界: ' + hardBounds.join(' | ')); bad++; }
  else console.log('  ✓ 边界已全部动态化');

  // 2. 关键函数
  const need = ['function clsCfg', 'function clsDays', 'function clsPeriods', 'function clsTimes',
                'window.saveClsCfg', 'window.addCfgRow', 'window.resetCfg',
                "type==='classCfg'", "openEdit('classCfg',null)"];
  const miss = need.filter(n => !h.includes(n));
  if (miss.length) { console.log('  ✗ 缺失: ' + miss.join(', ')); bad++; }
  else console.log('  ✓ 9 个关键符号齐全');

  // 3. JS 语法检查（逐段提取 <script>，跳过带 src 的）
  const scripts = [...h.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(m => !/\bsrc=/i.test(m[1]))
    .map(m => m[2]);
  let synErr = 0;
  scripts.forEach((code, i) => {
    try { new vm.Script(code, { filename: `${f}#script${i}` }); }
    catch (e) {
      // 跳过非语法类（如顶层 return / 未定义变量在语法阶段不会报）
      if (e instanceof SyntaxError) {
        console.log(`  ✗ script#${i} 语法错误: ${e.message}`);
        synErr++; bad++;
      }
    }
  });
  if (!synErr) console.log(`  ✓ ${scripts.length} 段 script 语法全部通过`);
}

console.log(`\n总问题数: ${bad}`);
process.exit(bad ? 1 : 0);
