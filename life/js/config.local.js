/* 线上版：不内置任何 Key。
 * 想用 AI 审核/生成剧情：打开游戏 → 设置 → 填自己的 DeepSeek Key（只存本机浏览器）。
 */
window.LS = window.LS || {};
LS.LOCAL_CONFIG = {
  base: 'https://api.deepseek.com',
  model: 'deepseek-flash',
  key: '',
  proxy: '',
  thinking: 'disabled',
  jsonMode: true,
  temp: 0.95,
  mode: 'auto',
  budget: 60
};
