/**
 * 安全相关工具函数
 */

/**
 * 隐藏 token，只显示前 8 个字符和后 4 个字符
 * @param {string} token - 完整 token
 * @returns {string} - 部分隐藏的 token
 */
function maskToken(token) {
  if (!token || token.length <= 12) return token;
  return token.substring(0, 8) + '...' + token.substring(token.length - 4);
}

/**
 * 格式化应用响应，可选择是否显示完整 token
 * @param {object} app - 应用对象
 * @param {boolean} showFullToken - 是否显示完整 token（仅在创建时使用）
 * @returns {object} - 格式化后的应用对象
 */
function formatAppResponse(app, showFullToken = false) {
  if (!app) return null;
  return {
    ...app,
    token: showFullToken ? app.token : maskToken(app.token),
  };
}

module.exports = {
  maskToken,
  formatAppResponse,
};