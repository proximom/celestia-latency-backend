const db = require('../config/database');
const logger = require('../utils/logger');

class LatencyRunModel {
  /**
   * Create a new latency run record
   */
  async create(data) {
    try {
      const {
        endpointId,
        region,
        reachable,
        timeout,
        latestHeight,
        block1Status,
        latencyMs,
        error,
        httpStatus
      } = data;

      const result = await db.run(
        `INSERT INTO latency_runs 
        (endpoint_id, region, reachable, timeout, latest_height, block1_status, latency_ms, error, http_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          endpointId,
          region,
          reachable ? 1 : 0,
          timeout ? 1 : 0,
          latestHeight || null,
          block1Status || null,
          latencyMs >= 0 ? latencyMs : null,
          error || null,
          httpStatus || null
        ]
      );

      logger.debug('Created latency run', { 
        id: result.id, 
        endpointId, 
        region 
      });

      return result;
    } catch (error) {
      logger.error('Error creating latency run:', error);
      throw error;
    }
  }

  /**
   * Get latest runs within time window
   */
  async getRecentRuns(minutesAgo = 60) {
    return db.all(
      `SELECT lr.*, e.url, e.kind, e.chain, e.is_archival
       FROM latency_runs lr
       JOIN endpoints e ON lr.endpoint_id = e.id
       WHERE lr.ts >= NOW() - INTERVAL '${minutesAgo} minutes'
       ORDER BY lr.ts DESC`
    );
  }

  /**
   * Get latest run per endpoint per region
   */
  async getLatestPerEndpointRegion(minutesAgo = 60) {
    return db.all(
      `SELECT lr.*, e.url, e.kind, e.chain, e.is_archival
       FROM latency_runs lr
       JOIN endpoints e ON lr.endpoint_id = e.id
       WHERE lr.id IN (
         SELECT MAX(id)
         FROM latency_runs
         WHERE ts >= NOW() - INTERVAL '${minutesAgo} minutes'
         GROUP BY endpoint_id, region
       )
       ORDER BY lr.ts DESC`
    );
  }

  /**
   * Clean old data (optional maintenance)
   */
  async cleanOldData(daysToKeep = 30) {
    const result = await db.run(
      `DELETE FROM latency_runs 
       WHERE ts < NOW() - INTERVAL '${daysToKeep} days'`
    );
    logger.info(`Cleaned ${result.changes} old latency runs`);
    return result.changes;
  }
}

module.exports = new LatencyRunModel();
