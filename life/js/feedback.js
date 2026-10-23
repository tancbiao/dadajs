/* 玩家反馈：本地收集 + 导出 + 一键发邮件（不依赖后端） */
window.LS = window.LS || {};

LS.Feedback = (function(){
  const KEY = 'ls.feedback.v1';

  function all(){
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch(e){ return []; }
  }
  function save(item){
    const list = all();
    list.push(item);
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(-300))); } catch(e){}
    return list.length;
  }
  function count(){ return all().length; }

  function summary(){
    const list = all();
    if (!list.length) return '还没有反馈。';
    const avg = list.reduce(function(a,b){ return a + (b.stars||0); }, 0) / list.length;
    const words = {};
    list.forEach(function(f){
      (f.tags||[]).forEach(function(t){ words[t] = (words[t]||0) + 1; });
    });
    const top = Object.keys(words).sort(function(a,b){ return words[b]-words[a]; }).slice(0,6)
      .map(function(k){ return k + ' ×' + words[k]; }).join('、');
    return '共 ' + list.length + ' 条 · 平均 ' + avg.toFixed(1) + ' 星' + (top ? ' · 高频：' + top : '');
  }

  function toText(){
    const list = all();
    if (!list.length) return '（暂无反馈）';
    return list.map(function(f, i){
      return [
        '#' + (i+1) + ' ' + new Date(f.at).toLocaleString('zh-CN'),
        '评分：' + '★'.repeat(f.stars||0) + '☆'.repeat(5-(f.stars||0)),
        '进度：' + (f.age ? f.age + '岁' : '—') + ' / ' + (f.world||'—') + ' / ' + (f.mbti||'—'),
        f.tags && f.tags.length ? '关键词：' + f.tags.join('、') : '',
        f.good ? '最爽：' + f.good : '',
        f.bored ? '最闷：' + f.bored : '',
        f.want ? '最想改：' + f.want : '',
        f.contact ? '联系：' + f.contact : ''
      ].filter(Boolean).join('\n');
    }).join('\n\n---\n\n');
  }

  function download(){
    const blob = new Blob([JSON.stringify(all(), null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'life-feedback-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  }

  function copy(){
    const t = toText();
    if (navigator.clipboard) return navigator.clipboard.writeText(t);
    return Promise.reject(new Error('当前环境不支持复制'));
  }

  function mailto(){
    const subject = '《人生模拟器》玩家反馈（' + count() + ' 条）';
    const body = toText().slice(0, 6000);
    return 'mailto:1572403714@qq.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  return { all: all, save: save, count: count, summary: summary, toText: toText, download: download, copy: copy, mailto: mailto };
})();
