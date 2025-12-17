const endpointModel = require('../models/endpoint.model');
const latencyRunModel = require('../models/latencyRun.model');
const logger = require('../utils/logger');

class LatencyService {
  /**
   * Process and store latency data from monitoring script
   */
  async processLatencyData(region, endpoints, timestamp) {
    try {
      const results = {
        inserted: 0,
        errors: [],
        region
      };

      for (const endpoint of endpoints) {
        try {
          // Normalize endpoint data
          const chain = endpoint.chain || 'celestia';
          const kind = endpoint.type || endpoint.kind;
          const url = this.normalizeUrl(endpoint.endpoint || endpoint.url);

          // Find or create endpoint
          const endpointRecord = await endpointModel.findOrCreate(
            chain,
            kind,
            url
          );

          // Update archival status if this is gRPC
          if (kind === 'grpc' && endpoint.block1_status) {
            await endpointModel.updateArchivalStatus(
              endpointRecord.id,
              endpoint.block1_status
            );
          }

          // Create latency run record
          await latencyRunModel.create({
            endpointId: endpointRecord.id,
            region: region,
            reachable: endpoint.reachable === true || endpoint.reachable === 'true',
            timeout: endpoint.timeout === true || endpoint.timeout === 'true',
            latestHeight: this.parseHeight(endpoint.latest_height),
            block1Status: endpoint.block1_status,
            latencyMs: parseInt(endpoint.latency_ms, 10) || -1,
            error: endpoint.error || '',
            httpStatus: endpoint.http_status || null
          });

          results.inserted++;
        } catch (error) {
          logger.error('Error processing endpoint:', {
            endpoint: endpoint.endpoint || endpoint.url,
            error: error.message
          });
          results.errors.push({
            endpoint: endpoint.endpoint || endpoint.url,
            error: error.message
          });
        }
      }

      logger.info('Latency data processed', {
        region,
        inserted: results.inserted,
        errors: results.errors.length
      });

      return results;
    } catch (error) {
      logger.error('Error in processLatencyData:', error);
      throw error;
    }
  }

  /**
   * Normalize endpoint URL
   */
  normalizeUrl(url) {
    if (!url) return '';
    
    // Remove trailing slashes
    url = url.trim().replace(/\/+$/, '');
    
    // Remove protocol prefixes for consistency
    url = url.replace(/^(https?|grpc):\/\//, '');
    
    return url;
  }

  /**
   * Parse height value (handle string "-" and numbers)
   */
  parseHeight(height) {
    if (height === null || height === undefined || height === '-' || height === '') {
      return null;
    }
    const parsed = parseInt(height, 10);
    return isNaN(parsed) ? null : parsed;
  }
}

module.exports = new LatencyService();
