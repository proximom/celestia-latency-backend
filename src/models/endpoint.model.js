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
        'SELECT * FROM endpoints WHERE chain = ? AND kind = ? AND url = ?',
        [chain, kind, url]
      );

      if (endpoint) {
        return endpoint;
      }

      // Create new endpoint
      const result = await db.run(
        'INSERT INTO endpoints (chain, kind, url) VALUES (?, ?, ?)',
        [chain, kind, url]
      );

      endpoint = await db.get(
        'SELECT * FROM endpoints WHERE id = ?',
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
        'UPDATE endpoints SET is_archival = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
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
    return db.get('SELECT * FROM endpoints WHERE id = ?', [id]);
  }
}

module.exports = new EndpointModel();
