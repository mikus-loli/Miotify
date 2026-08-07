// qq-image-notify 渲染模块：Miotify 通知文本 → macOS 风格精致卡片 PNG
// 用 playwright-core + 系统 Chromium 无头渲染 HTML/CSS 模板
// 设计语言：现代化 / 二次元配色 / 大圆角 / macOS 磨砂玻璃质感

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

// Chromium 路径：默认容器内 /usr/bin/chromium（Dockerfile 已安装），可用 QQ_CARD_CHROMIUM 覆盖
const CHROMIUM_PATH = process.env.QQ_CARD_CHROMIUM
  || '/usr/bin/chromium';

// 应用主题色（按应用名匹配，取不到用默认）
// 每个主题：主渐变（深→亮）+ 强调色 + 图标 + 光晕色
const APP_THEMES = {
  // 默认：二次元紫粉渐变（macOS 磨砂深蓝紫底 + 紫粉光晕）
  default: { from: '#4a3f8a', mid: '#7c5cbf', to: '#b388ff', accent: '#e1bee7', icon: '📬', glow1: 'rgba(179,136,255,0.35)', glow2: 'rgba(255,138,217,0.22)' },
  // 崩铁：深空蓝 → 星辉蓝
  '崩坏星穹铁道': { from: '#1b2a5e', mid: '#2f4bc4', to: '#5b8cff', accent: '#9ac7ff', icon: '🚄', glow1: 'rgba(91,140,255,0.35)', glow2: 'rgba(154,199,255,0.18)' },
  starrail: { from: '#1b2a5e', mid: '#2f4bc4', to: '#5b8cff', accent: '#9ac7ff', icon: '🚄', glow1: 'rgba(91,140,255,0.35)', glow2: 'rgba(154,199,255,0.18)' },
  // 原神：清新草绿
  '原神': { from: '#1d4a3a', mid: '#2e8b5e', to: '#58c896', accent: '#a8f0c8', icon: '🧭', glow1: 'rgba(88,200,150,0.30)', glow2: 'rgba(168,240,200,0.16)' },
  genshin: { from: '#1d4a3a', mid: '#2e8b5e', to: '#58c896', accent: '#a8f0c8', icon: '🧭', glow1: 'rgba(88,200,150,0.30)', glow2: 'rgba(168,240,200,0.16)' },
  // 服务器：科技青蓝
  server: { from: '#16324a', mid: '#1e5f8a', to: '#3aa8d8', accent: '#9adcf5', icon: '🖥️', glow1: 'rgba(58,168,216,0.30)', glow2: 'rgba(154,220,245,0.16)' },
  '服务器': { from: '#16324a', mid: '#1e5f8a', to: '#3aa8d8', accent: '#9adcf5', icon: '🖥️', glow1: 'rgba(58,168,216,0.30)', glow2: 'rgba(154,220,245,0.16)' },
  // 邮件：知性蓝
  '邮件': { from: '#1a3a66', mid: '#2a63b8', to: '#4f9cf5', accent: '#b4d8ff', icon: '✉️', glow1: 'rgba(79,156,245,0.32)', glow2: 'rgba(180,216,255,0.16)' },
  mail: { from: '#1a3a66', mid: '#2a63b8', to: '#4f9cf5', accent: '#b4d8ff', icon: '✉️', glow1: 'rgba(79,156,245,0.32)', glow2: 'rgba(180,216,255,0.16)' },
  // 媒体：影视紫
  emby: { from: '#33265e', mid: '#5c3bb8', to: '#8f6bff', accent: '#d0bcff', icon: '🎬', glow1: 'rgba(143,107,255,0.32)', glow2: 'rgba(208,188,255,0.18)' },
  jellyfin: { from: '#1d4a47', mid: '#2e8b84', to: '#58c8be', accent: '#a8f0ea', icon: '🎬', glow1: 'rgba(88,200,190,0.30)', glow2: 'rgba(168,240,234,0.16)' },
};

// HTML 转义
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 构建卡片 HTML（macOS 磨砂玻璃风格，CSS 自适应高度，Chromium 截图）
function buildCardHtml({ appName, title, content, priority, time, appImage }) {
  const theme = APP_THEMES[String(appName)] || APP_THEMES[String(appName || '').toLowerCase()] || APP_THEMES.default;

  // 优先级徽章（macOS 风格：柔和色底 + 深色文字）
  const priMeta = {
    0: { label: '消息', bg: 'rgba(255,255,255,0.14)', fg: 'rgba(255,255,255,0.92)', bar: '#9aa7ff' },
    1: { label: '提醒', bg: 'rgba(255,213,79,0.22)', fg: '#ffe28a', bar: '#ffd54f' },
    2: { label: '警告', bg: 'rgba(255,152,0,0.24)', fg: '#ffb74d', bar: '#ff9800' },
    3: { label: '严重', bg: 'rgba(255,82,82,0.26)', fg: '#ff8a80', bar: '#ff5252' },
  };
  const pri = priMeta[Number(priority)] || priMeta[0];

  // 正文截断：最多显示 MAX_CONTENT_LINES 行，超出显示「…」提示
  const MAX_CONTENT_LINES = 10;
  const contentStr = String(content || '（空消息）');
  const contentLines = contentStr.split('\n');
  let displayContent = contentStr;
  let truncated = false;
  if (contentLines.length > MAX_CONTENT_LINES) {
    displayContent = contentLines.slice(0, MAX_CONTENT_LINES).join('\n') + '\n…';
    truncated = true;
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    /* ⚠️ 不要放 -apple-system / BlinkMacSystemFont / SF Pro Text：
       Linux Chromium 里这些 macOS 字体名会破坏字体回退链，
       导致数字/ASCII 字符渲染成空白（实测踩坑） */
    font-family: 'Noto Sans CJK SC', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'Noto Color Emoji', sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    background: transparent;
    padding: 24px;
    display: flex;
  }

  /* ===== macOS 磨砂玻璃卡片 ===== */
  .card {
    width: 940px;
    border-radius: 30px;
    padding: 46px 50px 38px;
    position: relative;
    overflow: hidden;
    /* 磨砂深色底：多层渐变模拟玻璃折射 */
    background:
      linear-gradient(160deg, rgba(30,34,66,0.88) 0%, rgba(22,26,52,0.92) 45%, rgba(16,18,40,0.94) 100%);
    /* 玻璃高光边框 */
    border: 1px solid rgba(255,255,255,0.14);
    /* macOS 风格柔和多层阴影 */
    box-shadow:
      0 30px 80px rgba(0,0,0,0.45),
      0 8px 24px rgba(0,0,0,0.25),
      0 2px 8px rgba(0,0,0,0.15),
      inset 0 1px 0 rgba(255,255,255,0.12),
      inset 0 -1px 0 rgba(255,255,255,0.04);
  }

  /* 背景光斑：二次元活力的紫粉/主题色光晕 */
  .glow {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    filter: blur(2px);
  }
  .glow-1 {
    top: -140px; right: -60px;
    width: 420px; height: 420px;
    background: radial-gradient(circle, ${theme.glow1} 0%, transparent 65%);
  }
  .glow-2 {
    bottom: -160px; left: -40px;
    width: 380px; height: 380px;
    background: radial-gradient(circle, ${theme.glow2} 0%, transparent 65%);
  }
  .glow-3 {
    top: 40%; left: 55%;
    width: 260px; height: 260px;
    background: radial-gradient(circle, rgba(255,255,255,0.045) 0%, transparent 60%);
  }

  /* 顶部细光条（macOS 玻璃高光） */
  .card::before {
    content: '';
    position: absolute;
    top: 0; left: 60px; right: 60px;
    height: 1.5px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
    z-index: 3;
  }

  /* ===== 头部 ===== */
  .header {
    display: flex;
    align-items: center;
    gap: 18px;
    margin-bottom: 30px;
    position: relative;
    z-index: 2;
  }
  /* macOS 圆角方形图标 */
  .app-icon {
    width: 68px; height: 68px;
    border-radius: 20px;
    background: linear-gradient(145deg, ${theme.mid}, ${theme.to});
    border: 1px solid rgba(255,255,255,0.30);
    display: flex; align-items: center; justify-content: center;
    font-size: 40px;
    box-shadow:
      0 8px 20px rgba(0,0,0,0.30),
      inset 0 1px 0 rgba(255,255,255,0.40),
      inset 0 -2px 6px rgba(0,0,0,0.15);
    flex-shrink: 0;
    text-shadow: 0 2px 6px rgba(0,0,0,0.20);
    overflow: hidden;
  }
  /* 应用自定义图标图片 */
  .app-icon img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
    border-radius: 19px;
  }
  .app-name {
    font-size: 22px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: #ffffff;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-shadow: 0 1px 4px rgba(0,0,0,0.20);
  }
  .badge {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 1px;
    color: ${pri.fg};
    background: ${pri.bg};
    border: 1px solid rgba(255,255,255,0.22);
    border-radius: 999px;
    padding: 8px 20px;
    flex-shrink: 0;
    backdrop-filter: blur(10px);
    box-shadow: 0 3px 12px rgba(0,0,0,0.18);
  }

  /* ===== 标题 ===== */
  .title {
    font-size: 36px;
    font-weight: 800;
    color: #ffffff;
    line-height: 1.35;
    margin-bottom: 20px;
    position: relative;
    z-index: 2;
    text-shadow: 0 3px 12px rgba(0,0,0,0.30);
    word-break: break-word;
  }

  /* ===== 内容毛玻璃容器 ===== */
  .content-wrap {
    position: relative;
    z-index: 2;
    background: linear-gradient(160deg, rgba(255,255,255,0.09), rgba(255,255,255,0.05));
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 22px;
    padding: 28px 32px 28px 38px;
    backdrop-filter: blur(16px);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.10),
      0 6px 24px rgba(0,0,0,0.12);
  }
  /* 左侧优先级色条（发光） */
  .content-wrap::before {
    content: '';
    position: absolute;
    left: 15px; top: 20px; bottom: 20px;
    width: 5px;
    border-radius: 3px;
    background: linear-gradient(180deg, ${pri.bar}, ${pri.bar}44);
    box-shadow: 0 0 12px ${pri.bar}88;
  }
  .content {
    font-size: 24px;
    font-weight: 400;
    color: #ffffff;
    line-height: 1.75;
    white-space: pre-wrap;
    word-break: break-word;
    text-shadow: 0 1px 3px rgba(0,0,0,0.25);
  }
  .trunc-hint {
    margin-top: 16px;
    font-size: 16px;
    font-weight: 500;
    font-style: italic;
    color: rgba(255,255,255,0.90);
  }

  /* ===== 底部 ===== */
  .footer {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 28px;
    padding-top: 24px;
    border-top: 1px solid rgba(255,255,255,0.18);
    font-size: 18px;
    color: #ffffff;
    position: relative;
    z-index: 2;
    text-shadow: 0 1px 3px rgba(0,0,0,0.35);
  }
  .footer .time {
    letter-spacing: 0.5px;
    font-weight: 600;
    color: #ffffff;
  }
  .footer .dot {
    color: rgba(255,255,255,0.55);
    font-size: 14px;
  }
  .footer .brand {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 2px;
    color: #ffffff;
  }
  .footer .brand-mark {
    width: 10px; height: 10px;
    border-radius: 50%;
    background: linear-gradient(135deg, ${theme.to}, ${theme.accent});
    box-shadow: 0 0 10px ${theme.to}aa;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="glow glow-1"></div>
    <div class="glow glow-2"></div>
    <div class="glow glow-3"></div>
    <div class="header">
      <div class="app-icon">${appImage ? `<img src="${esc(appImage)}" alt=""/>` : theme.icon}</div>
      <div class="app-name">${esc(appName || 'Miotify')}</div>
      <div class="badge">${pri.label}</div>
    </div>
    ${title ? `<div class="title">${esc(title)}</div>` : ''}
    <div class="content-wrap">
      <div class="content">${esc(displayContent)}</div>
      ${truncated ? `<div class="trunc-hint">⋯ 内容过长已截断（完整内容见 Miotify 历史）</div>` : ''}
    </div>
    <div class="footer">
      <span class="time">🕐 ${esc(time || '')}</span>
      <span class="dot">·</span>
      <span>来自 Miotify</span>
      <span class="brand"><span class="brand-mark"></span>MIOTIFY</span>
    </div>
  </div>
</body>
</html>`;
}

// 用 Chromium 无头渲染 HTML → PNG Buffer
let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--force-color-profile=srgb',
        '--font-render-hinting=none',
      ],
    });
  }
  return browserPromise;
}

async function renderPng(html, options = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: 1040, height: 800 } });
  try {
    await page.setContent(html, { waitUntil: 'load' });
    // 等待字体加载（避免截到缺字）
    await page.evaluate(() => document.fonts.ready);
    // 等待所有图片加载完成（应用图标可能来自本地文件或远程 URL）
    await page.evaluate(() => {
      const imgs = Array.from(document.images);
      return Promise.all(imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
          // 兜底：3s 超时（图片加载失败或超时都不能让渲染卡死）
          setTimeout(resolve, 3000);
        });
      }));
    });
    // 用元素原生截图（自动精确裁剪 .card，按内容高度自适应）
    const el = await page.$('.card');
    return await el.screenshot({ omitBackground: true });
  } finally {
    await page.close();
  }
}

// 渲染通知 → PNG 文件（返回文件路径）
async function renderToFile(message, outFile) {
  const html = buildCardHtml({
    appName: message.appName,
    title: message.title,
    // 兼容两种字段名：Miotify 消息对象用 message，测试/外部调用可能用 content
    content: message.message != null ? message.message : message.content,
    priority: message.priority,
    time: message.time || message.created_at || '',
    appImage: message.appImage || '',
  });
  const png = await renderPng(html);
  fs.writeFileSync(outFile, png);
  return outFile;
}

// 关闭浏览器（插件 destroy 时调用）
async function closeBrowser() {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      await browser.close();
    } catch { /* ignore */ }
    browserPromise = null;
  }
}

module.exports = { buildCardHtml, renderPng, renderToFile, closeBrowser, APP_THEMES };
