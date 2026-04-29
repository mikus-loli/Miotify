export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  try {
    const date = new Date(timeStr + 'Z');
    if (isNaN(date.getTime())) {
      return timeStr;
    }
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return timeStr;
  }
}
