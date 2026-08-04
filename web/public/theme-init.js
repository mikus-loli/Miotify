// 主题初始化：在 React 渲染前尽早应用主题，避免闪烁
(function () {
  try {
    var stored = localStorage.getItem('miotify_theme');
    var theme = stored || 'system';
    var resolved = theme;
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.classList.add(resolved);
    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', resolved === 'dark' ? '#0f1117' : '#ffffff');
    }
  } catch (e) {}
})();
