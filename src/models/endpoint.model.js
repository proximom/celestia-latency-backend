const db = require('../config/database');
const logger = require('../utils/logger');

class EndpointModel {
  /**
   * Find or create an endpoint
   */
  async findOrCreate(chain, kind, url) {
    try {
      // Try to find existing endpoint
      let endpoint = await db.get(
        'SELECT * FROM endpoints WHERE chain = $1 AND kind = $2 AND url = $3',
        [chain, kind, url]
      );

      if (endpoint) {
        return endpoint;
      }

      // Create new endpoint
      const result = await db.run(
        'INSERT INTO endpoints (chain, kind, url) VALUES ($1, $2, $3) RETURNING id',
        [chain, kind, url]
      );

      endpoint = await db.get(
        'SELECT * FROM endpoints WHERE id = $1',
        [result.id]
      );

      logger.debug('Created new endpoint', { id: endpoint.id, url });
      return endpoint;
    } catch (error) {
      logger.error('Error in findOrCreate:', error);
      throw error;
    }
  }

  /**
   * Update archival status based on block1_status
   */
  async updateArchivalStatus(endpointId, block1Status) {
    try {
      const isArchival = block1Status === 'Has block 1' ? 1 : 0;
      await db.run(
        'UPDATE endpoints SET is_archival = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [isArchival, endpointId]
      );
    } catch (error) {
      logger.error('Error updating archival status:', error);
      throw error;
    }
  }

  /**
   * Get all endpoints
   */
  async getAll() {
    return db.all('SELECT * FROM endpoints ORDER BY kind, url');
  }

  /**
   * Get endpoint by ID
   */
  async getById(id) {
    return db.get('SELECT * FROM endpoints WHERE id = $1', [id]);
  }
}

module.exports = new EndpointModel();
