module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiKey: process.env.API_KEY || 'default-insecure-key',
  dbPath: process.env.DB_PATH || './data/latency.db',
  logLevel: process.env.LOG_LEVEL || 'info',
  logFile: process.env.LOG_FILE || './logs/app.log',
  dataFreshnessMinutes: parseInt(process.env.DATA_FRESHNESS_MINUTES, 10) || 60,
  minRegionsForTop10: parseInt(process.env.MIN_REGIONS_FOR_TOP10, 10) || 2
};
