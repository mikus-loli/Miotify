// 时区工具：Miotify 默认使用中国时区（Asia/Shanghai, UTC+8），不依赖容器/进程 TZ 环境变量。
// 如需其他时区，通过环境变量 MIOTIFY_TZ 显式覆盖（如 MIOTIFY_TZ=UTC）。
const config = require('./config');

// 根据配置时区计算 UTC 偏移小时数（Asia/Shanghai → 8，UTC → 0）
function utcOffsetHours(timeZone = config.timezone) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' });
    const name = dtf.formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || '';
    // 兼容 "GMT+08:00" / "GMT+8" / "GMT+8:00" / "GMT-05:30" 等格式
    const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) return 0;
    const sign = m[1] === '+' ? 1 : -1;
    return sign * (parseInt(m[2], 10) + (m[3] ? parseInt(m[3], 10) / 60 : 0));
  } catch {
    return 0;
  }
}

// SQLite date() 修饰符：如 '+8 hours' / '+0 hours' / '-5 hours'
function tzModifier() {
  const h = utcOffsetHours();
  if (h === 0) return '+0 hours';
  return h > 0 ? `+${h} hours` : `${h} hours`;
}

// SQLite UTC 时间字符串（'YYYY-MM-DD HH:MM:SS'）→ 配置时区格式化显示
function formatLocalTime(utcStr) {
  if (!utcStr) return '';
  try {
    return new Date(String(utcStr).replace(' ', 'T') + 'Z')
      .toLocaleString('zh-CN', { hour12: false, timeZone: config.timezone });
  } catch {
    return utcStr;
  }
}

module.exports = { utcOffsetHours, tzModifier, formatLocalTime };
