require('dotenv').config();
const app = require('./src/app');
const logger = require('./src/utils/logger');
const config = require('./src/config/app.config');
const db = require('./src/config/database');

const PORT = config.port;

// Initialize database and start server
db.initialize()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${config.nodeEnv}`);
      logger.info(`🗄️  Database: ${config.dbPath}`);
      logger.info(`✅ Server ready to accept connections`);
    });
  })
  .catch((err) => {
    logger.error('Failed to initialize database:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  db.close();
  process.exit(0);
});
