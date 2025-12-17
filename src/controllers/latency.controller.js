const latencyService = require('../services/latency.service');
const aggregationService = require('../services/aggregation.service');
const logger = require('../utils/logger');

class LatencyController {
  /**
   * POST /api/upload-latency
   * Upload latency test results from regional servers
   */
  async uploadLatency(req, res, next) {
    try {
      const { region, timestamp, endpoints } = req.body;

      logger.info('Received latency upload', {
        region,
        endpointCount: endpoints.length,
        timestamp
      });

      const result = await latencyService.processLatencyData(
        region,
        endpoints,
        timestamp
      );

      res.status(200).json({
        success: true,
        message: 'Latency data stored successfully',
        data: {
          region: result.region,
          inserted: result.inserted,
          errors: result.errors.length,
          error_details: result.errors.length > 0 ? result.errors : undefined
        }
      });
    } catch (error) {
      logger.error('Error in uploadLatency:', error);
      next(error);
    }
  }

  /**
   * POST /api/upload-monitoring
   * Alternative endpoint for direct monitor_endpoints.sh output
   * (accepts array of endpoints without wrapper)
   */
  async uploadMonitoring(req, res, next) {
    try {
      const endpoints = req.body;
      const region = req.query.region || req.header('X-Region') || 'unknown';

      logger.info('Received monitoring upload', {
        region,
        endpointCount: endpoints.length
      });

      const result = await latencyService.processLatencyData(
        region,
        endpoints,
        new Date().toISOString()
      );

      res.status(200).json({
        success: true,
        message: 'Monitoring data stored successfully',
        data: {
          region: result.region,
          inserted: result.inserted,
          errors: result.errors.length,
          error_details: result.errors.length > 0 ? result.errors : undefined
        }
      });
    } catch (error) {
      logger.error('Error in uploadMonitoring:', error);
      next(error);
    }
  }

  /**
   * GET /api/latency/summary
   * Get aggregated latency statistics
   */
  async getSummary(req, res, next) {
    try {
      logger.info('Generating latency summary');

      const summary = await aggregationService.getSummary();

      res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error in getSummary:', error);
      next(error);
    }
  }

  /**
   * GET /api/latency/endpoint/:url
   * Get detailed stats for specific endpoint
   */
  async getEndpointDetails(req, res, next) {
    try {
      const url = decodeURIComponent(req.params.url);
      
      logger.info('Fetching endpoint details', { url });

      const details = await aggregationService.getEndpointDetails(url);

      if (!details) {
        return res.status(404).json({
          success: false,
          error: 'Endpoint not found'
        });
      }

      res.status(200).json({
        success: true,
        data: details
      });
    } catch (error) {
      logger.error('Error in getEndpointDetails:', error);
      next(error);
    }
  }
}

module.exports = new LatencyController();