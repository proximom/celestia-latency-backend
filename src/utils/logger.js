const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/app.config');

// Ensure logs directory exists
const logDir = path.dirname(config.logFile);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'celestia-latency-backend' },
  transports: [
    // Write all logs to file
    new winston.transports.File({ 
      filename: config.logFile,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // Write errors to separate file
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

// Also log to console in development
if (config.nodeEnv === 'development') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
