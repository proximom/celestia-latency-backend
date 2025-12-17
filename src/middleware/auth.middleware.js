const logger = require('../utils/logger');
const config = require('../config/app.config');

const authMiddleware = (req, res, next) => {
  const apiKey = req.header('X-API-KEY') || req.header('x-api-key');

  if (!apiKey) {
    logger.warn('Authentication failed: No API key provided', {
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Provide X-API-KEY header.'
    });
  }

  if (apiKey !== config.apiKey) {
    logger.warn('Authentication failed: Invalid API key', {
      ip: req.ip,
      path: req.path
    });
    return res.status(403).json({
      success: false,
      error: 'Invalid API key'
    });
  }

  logger.debug('Authentication successful', { path: req.path });
  next();
};

module.exports = authMiddleware;
