/* AI 作文批改助手 v1.0 · jsdom 冒烟测试
   运行：node _test.js  （在当前目录） */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('C:/Users/tanc/.workbuddy/binaries/node/workspace/node_modules/jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const DEMO = '星期天，妈妈带我去公园玩，我高兴极了。公园里的花开得很漂亮，红的、黄的、紫的，像一张彩色的大地毯。\n' +
  '我先玩滑梯。滑梯很高很高，我站在上面腿都发抖了，但是我闭上眼睛，还是永敢地滑了下去，风在耳边呼呼的响，真刺激呀！\n' +
  '后来我们又去划船，小船摇呀摇，湖水清清亮亮的，我看见自己的影子在水里荡来荡去，好像在对我笑，我心里美滋滋的，真舍不得离开。\n' +
  '那天我玩得真高兴。回家的路上，我一直跟妈妈说：下次还要来！';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  —— ' + extra : '')); }
}

(async function () {
  console.log('▶ 启动 jsdom…');
  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/zuowen/',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.scrollTo = function () {};
      window.confirm = function () { return true; };
      window.HTMLElement.prototype.scrollIntoView = function () {};
      window.addEventListener('error', e => errors.push(e.message || String(e)));
    }
  });
  await new Promise(res => { dom.window.addEventListener('load', res); });
  await new Promise(res => setTimeout(res, 50));
  const w = dom.window, d = w.document;

  console.log('▶ 1. 页面加载');
  ok('无 JS 运行时报错', errors.length === 0, errors.join(' | '));
  ok('标题正确', /AI 作文批改助手/.test(d.title));
  ok('boot 后 S 已加载', w.S !== null && typeof w.S === 'object');
  ok('存储键隔离 zuowen_v1', w.STORE_KEY === 'zuowen_v1');
  ok('localStorage 已初始化', !!w.localStorage.getItem('zuowen_v1'));
  ok('初始评语库已渲染', d.querySelectorAll('#phraseBox .chip').length >= 3, 'chips=' + d.querySelectorAll('#phraseBox .chip').length);
  ok('默认等第「良」高亮', d.querySelector('#chipVerdict .chip.on') && d.querySelector('#chipVerdict .chip.on').textContent === '良');

  console.log('▶ 2. 本地体检引擎 scan()');
  const issues = w.scan(DEMO);
  const word1 = issues.find(i => i.type === '错别字' && i.quote === '永敢');
  ok('错别字：永敢→勇敢', !!word1 && word1.fix === '勇敢');
  const de = issues.find(i => i.type === '表达' && i.fix === '呼呼地');
  ok('的/地：呼呼的响→呼呼地', !!de);
  ok('长句串（一逗到底）至少 1 条', issues.filter(i => i.type === '标点').length >= 1);
  ok('亮点候选至少 1 条', issues.filter(i => i.type === '亮点').length >= 1);
  ok('编号连续且从 1 开始', issues[0].id === 1 && issues[issues.length - 1].id === issues.length);
  const st = w.stats(DEMO);
  ok('字数统计 > 100', st.chars > 100, '实际 ' + st.chars);

  console.log('▶ 3. 批改流程 runCheck()');
  d.getElementById('inText').value = DEMO;
  d.getElementById('inTitle').value = '那次玩得真高兴';
  d.getElementById('inStudent').value = '测试生';
  d.getElementById('inGrade').value = '四年级';
  w.runCheck();
  ok('结果卡显示', d.getElementById('resCard').style.display === 'block');
  ok('概览条含字数', d.getElementById('ovBar').textContent.indexOf('字数') >= 0);
  ok('正文渲染出标注 span', d.querySelectorAll('#paperBox .flag-word').length >= 1, 'flag-word=' + d.querySelectorAll('#paperBox .flag-word').length);
  ok('建议列表渲染', d.querySelectorAll('#issueBox .issue').length >= 4);
  ok('切到「错字」tab 只显示错字', (w.renderIssues('错字'), d.querySelectorAll('#issueBox .issue').length === issues.filter(i => i.type === '错别字').length));
  ok('切回「全部」正常', (w.renderIssues('全部'), d.querySelectorAll('#issueBox .issue').length === issues.length));

  console.log('▶ 4. 评语与存档');
  d.getElementById('inComment').value = '写得真棒，细节生动。';
  w.saveRecord();
  ok('档案 +1 条', w.S.records.length === 1);
  ok('localStorage 已写回', JSON.parse(w.localStorage.getItem('zuowen_v1')).records.length === 1);
  ok('等第默认良入库', w.S.records[0].verdict === '良');
  w.renderRecs();
  ok('档案列表渲染', d.querySelectorAll('#recList .rec').length === 1);
  ok('页签计数显示', d.getElementById('cntRec').textContent === '(1)');

  console.log('▶ 5. 讲评统计');
  w.runStats();
  ok('统计区有内容', d.getElementById('statBody').textContent.indexOf('高频疑似错词') >= 0);
  ok('一页纸文本生成', d.getElementById('txtOut').style.display === 'block' && d.getElementById('txtOut').textContent.indexOf('讲评课一页纸') >= 0);

  console.log('▶ 6. 拍照识别模块');
  ok('OCR 函数已挂载', typeof w.ocrRun === 'function' && typeof w.compressImg === 'function' && typeof w.renderUnsure === 'function' && typeof w.ocrClear === 'function');
  ok('初始「开始识别」按钮禁用', d.getElementById('btnOCR').disabled === true);
  ok('读图模型预设存在', w.PROVIDERS.zhipu.vision === 'glm-4v-flash' && ('vision' in w.S.settings));
  ok('提示词要求照抄错字', w.OCR_PROMPT.indexOf('照原样') >= 0 && w.OCR_PROMPT.indexOf('〖？〗') >= 0);

  const unsIssues = w.scan('今天真高兴〖？〗我玩得很开心，心里美滋滋的。');
  ok('〖？〗被识别为待核对', unsIssues.some(i => i.type === '待核对'));
  d.getElementById('inText').value = DEMO + '〖？〗';
  w.runCheck();
  const chips = Array.prototype.slice.call(d.querySelectorAll('#issueWrap .chip')).map(c => c.textContent);
  ok('出现「待核对」tab', chips.indexOf('待核对') >= 0, 'chips=' + chips.join('/'));
  ok('正文渲染待核对标注', d.querySelectorAll('#paperBox .flag-uns').length >= 1);
  w.renderIssues('待核对');
  ok('筛选后只显示待核对', d.querySelectorAll('#issueBox .issue').length === 1);
  w.renderIssues('全部');
  d.getElementById('inText').value = DEMO;
  w.runCheck();
  const chips2 = Array.prototype.slice.call(d.querySelectorAll('#issueWrap .chip')).map(c => c.textContent);
  ok('无待核对时不显示该 tab', chips2.indexOf('待核对') < 0);

  w.renderUnsure([{ at: '公园', guess: '圆', why: '笔画不清' }]);
  ok('待核对清单渲染', d.getElementById('ocrUn').textContent.indexOf('圆') >= 0);
  w.renderUnsure([]);
  ok('无待核对时提示干净', d.getElementById('ocrUn').textContent.indexOf('没有拿不准') >= 0);

  let captured = null;
  w.fetch = function (url, opt) { captured = { url: url, body: JSON.parse(opt.body) }; return Promise.resolve({ ok: true, json: () => Promise.resolve({ choices: [{ message: { content: '{"text":"好的","unsure":[]}' } }] }) }); };
  await new Promise(res => { w.fetchChat('sys', 'user', function () { res(); }, { image: 'data:image/jpeg;base64,AAA', model: 'glm-4v-flash' }); });
  const mc = captured.body.messages[1].content;
  ok('图片请求为多模态数组', Array.isArray(mc) && mc[0].type === 'text' && mc[1].type === 'image_url' && mc[1].image_url.url.indexOf('data:image') === 0);
  ok('图片请求用读图模型', captured.body.model === 'glm-4v-flash');
  await new Promise(res => { w.fetchChat('sys', 'user', function () { res(); }, {}); });
  ok('纯文本请求仍为字符串', typeof captured.body.messages[1].content === 'string');

  d.getElementById('setVision').value = 'glm-4v-flash';
  w.saveSettings();
  ok('读图模型已持久化', w.S.settings.vision === 'glm-4v-flash');

  w.localStorage.setItem('zuowen_v1', JSON.stringify({ settings: { provider: 'deepseek', model: 'deepseek-chat', apiKey: '', baseURL: '', defStudent: '', defGrade: '', words: '' }, records: [{ a: 1 }], last: { title: '旧' } }));
  w.load();
  ok('旧版数据升级后补上 vision', ('vision' in w.S.settings) && w.S.settings.vision === '');
  ok('旧版数据记录未丢失', w.S.records.length === 1 && w.S.last.title === '旧');

  console.log('▶ 7. 页面切换与杂项');
  ok('切档案页无错', (w.goTab('files'), d.getElementById('page-files').classList.contains('on')));
  ok('切设置页无错', (w.goTab('set'), true));
  ok('设置回填无错', (w.loadSettingsUI(), d.getElementById('setProvider').value === 'deepseek'));
  ok('切回批改页无错', (w.goTab('batch'), true));
  w.fillDemo();
  ok('示例作文填入', d.getElementById('inText').value.length > 50);
  ok('重跑一次体检仍正常', (w.runCheck(), d.querySelectorAll('#paperBox .flag-word').length >= 1));
  ok('清空后结果卡隐藏', (w.clearText(), d.getElementById('resCard').style.display === 'none'));
  w.resetAll();
  ok('清空后档案为 0', w.S.records.length === 0);
  ok('全程仍无运行时报错', errors.length === 0, errors.join(' | '));

  console.log('\n════════ 结果：' + pass + ' 通过 / ' + fail + ' 失败 ════════');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试崩溃:', e); process.exit(1); });
