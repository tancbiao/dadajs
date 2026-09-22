/* ============================================================
 *  app.js —— 启动
 * ============================================================ */
(function (global) {
  'use strict';
  const Store = global.Store, UI = global.UI, API = global.UIAPI;

  let booted = false;
  document.addEventListener('DOMContentLoaded', function () {
    if (booted) return;      // 防止重复初始化导致课表被重置
    booted = true;
    Store.load();
    // 若存档中教师表为空（旧版本），重建
    if (!Store.state.teachers || !Store.state.teachers.length) Store.reset();

    API.bindNav();
    API.render();

    document.getElementById('btnAuto').onclick = API.runAuto;
    document.getElementById('btnClearAll').onclick = API.clearAll;
    document.getElementById('btnCheck').onclick = API.runCheck;
    document.getElementById('btnSave').onclick = () => {
      if (Store.save()) API.toast('已保存到本机', 'ok');
      else API.toast('保存失败（浏览器存储不可用，请导出备份）', 'err');
    };

    // 关闭前自动保存
    window.addEventListener('beforeunload', () => { try { Store.save(); } catch (e) {} });

    // 快捷键
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { const m = document.getElementById('modalRoot'); if (m) m.innerHTML = ''; }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); Store.save(); API.toast('已保存', 'ok'); }
    });
  });
})(window);
