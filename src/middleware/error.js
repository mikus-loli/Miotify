function errorHandler(err, req, res, _next) {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);
  const status = err.status || 500;
  const message = status === 500 ? 'Internal Server Error' : err.message;
  res.status(status).json({ error: message });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not Found' });
}

class AppError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status || 400;
  }
}

module.exports = { errorHandler, notFoundHandler, AppError };
