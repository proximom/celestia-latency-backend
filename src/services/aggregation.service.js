const db = require('../config/database');
const config = require('../config/app.config');
const logger = require('../utils/logger');

class AggregationService {
  /**
   * Get comprehensive summary of latency data
   */
  async getSummary() {
    try {
      const freshness = config.dataFreshnessMinutes;

      const [global, regions, top10Fastest, archivalGrpc] = await Promise.all([
        this.getGlobalStats(freshness),
        this.getRegionStats(freshness),
        this.getTop10Fastest(freshness),
        this.getArchivalGrpcStats(freshness)
      ]);

      return {
        generated_at: new Date().toISOString(),
        data_freshness_minutes: freshness,
        global: {
          ...global,
          archival_grpc_online: archivalGrpc.online,
          archival_grpc_total: archivalGrpc.total
        },
        regions,
        top_10_fastest: top10Fastest
      };
    } catch (error) {
      logger.error('Error generating summary:', error);
      throw error;
    }
  }

  /**
   * Get global statistics
   */
  async getGlobalStats(minutesAgo) {
    const stats = await db.get(
      `SELECT 
        COUNT(DISTINCT e.id) as total_endpoints,
        COUNT(DISTINCT CASE WHEN lr.reachable = 1 THEN e.id END) as online_endpoints,
        AVG(CASE WHEN lr.reachable = 1 AND lr.latency_ms >= 0 THEN lr.latency_ms END) as avg_latency_ms,
        CAST(SUM(lr.reachable) AS FLOAT) / COUNT(*) as success_rate,
        COUNT(*) as total_tests,
        SUM(lr.reachable) as successful_tests,
        MIN(CASE WHEN lr.reachable = 1 AND lr.latency_ms >= 0 THEN lr.latency_ms END) as min_latency_ms,
        MAX(CASE WHEN lr.reachable = 1 AND lr.latency_ms >= 0 THEN lr.latency_ms END) as max_latency_ms
       FROM (
         SELECT endpoint_id, region, MAX(id) as max_id
         FROM latency_runs
         WHERE ts >= NOW() - INTERVAL '${minutesAgo} minutes'
         GROUP BY endpoint_id, region
       ) latest
       JOIN latency_runs lr ON lr.id = latest.max_id
       JOIN endpoints e ON lr.endpoint_id = e.id`
    );

    return {
      total_endpoints: stats.total_endpoints || 0,
      online: stats.online_endpoints || 0,
      offline: (stats.total_endpoints || 0) - (stats.online_endpoints || 0),
      avg_latency_ms: Math.round(stats.avg_latency_ms || 0),
      min_latency_ms: stats.min_latency_ms || null,
      max_latency_ms: stats.max_latency_ms || null,
      success_rate: parseFloat((stats.success_rate || 0).toFixed(4)),
      total_tests: stats.total_tests || 0,
      successful_tests: stats.successful_tests || 0
    };
  }

  /**
   * Get per-region statistics
   */
  async getRegionStats(minutesAgo) {
    const regions = await db.all(
      `SELECT 
        lr.region,
        COUNT(DISTINCT e.id) as total_endpoints,
        COUNT(DISTINCT CASE WHEN lr.reachable = 1 THEN e.id END) as online_endpoints,
        AVG(CASE WHEN lr.reachable = 1 AND lr.latency_ms >= 0 THEN lr.latency_ms END) as avg_latency_ms,
        CAST(SUM(lr.reachable) AS FLOAT) / COUNT(*) as success_rate,
        COUNT(*) as total_tests,
        MIN(CASE WHEN lr.reachable = 1 AND lr.latency_ms >= 0 THEN lr

.latency_ms END) as min_latency_ms,
        MAX(CASE WHEN lr.reachable = 1 AND lr.latency_ms >= 0 THEN lr.latency_ms END) as max_latency_ms
       FROM (
         SELECT endpoint_id, region, MAX(id) as max_id
         FROM latency_runs
         WHERE ts >= NOW() - INTERVAL '${minutesAgo} minutes'
         GROUP BY endpoint_id, region
       ) latest
       JOIN latency_runs lr ON lr.id = latest.max_id
       JOIN endpoints e ON lr.endpoint_id = e.id
       GROUP BY lr.region
       ORDER BY lr.region`
    );

    return regions.map(r => ({
      region: r.region,
      total_endpoints: r.total_endpoints || 0,
      online: r.online_endpoints || 0,
      offline: (r.total_endpoints || 0) - (r.online_endpoints || 0),
      avg_latency_ms: Math.round(r.avg_latency_ms || 0),
      min_latency_ms: r.min_latency_ms || null,
      max_latency_ms: r.max_latency_ms || null,
      success_rate: parseFloat((r.success_rate || 0).toFixed(4)),
      total_tests: r.total_tests || 0
    }));
  }

  /**
   * Get top 10 fastest endpoints (global average)
   */
  async getTop10Fastest(minutesAgo) {
    const minRegions = config.minRegionsForTop10;

    const top10 = await db.all(
      `SELECT 
        e.url,
        e.chain,
        e.kind,
        e.is_archival,
        COUNT(DISTINCT lr.region) as regions_tested,
        AVG(CASE WHEN lr.reachable = 1 AND lr.latency_ms >= 0 THEN lr.latency_ms END) as avg_latency_global,
        MIN(CASE WHEN lr.reachable = 1 AND lr.latency_ms >= 0 THEN lr.latency_ms END) as min_latency,
        MAX(CASE WHEN lr.reachable = 1 AND lr.latency_ms >= 0 THEN lr.latency_ms END) as max_latency,
        SUM(lr.reachable) as times_reachable,
        COUNT(*) as total_tests,
        CAST(SUM(lr.reachable) AS FLOAT) / COUNT(*) as success_rate,
        STRING_AGG(DISTINCT lr.region, ',') as regions
       FROM (
         SELECT endpoint_id, region, MAX(id) as max_id
         FROM latency_runs
         WHERE ts >= NOW() - INTERVAL '${minutesAgo} minutes'
         GROUP BY endpoint_id, region
       ) latest
       JOIN latency_runs lr ON lr.id = latest.max_id
       JOIN endpoints e ON lr.endpoint_id = e.id
       WHERE lr.reachable = 1
       GROUP BY e.id, e.url, e.chain, e.kind, e.is_archival
       HAVING COUNT(DISTINCT lr.region) >= ${minRegions}
       ORDER BY avg_latency_global ASC
       LIMIT 10`
    );

    return top10.map(item => ({
      endpoint: item.url,
      chain: item.chain,
      kind: item.kind,
      is_archival: item.is_archival === 1,
      avg_latency_global: Math.round(item.avg_latency_global || 0),
      min_latency: item.min_latency || null,
      max_latency: item.max_latency || null,
      regions_tested: item.regions_tested,
      times_reachable: item.times_reachable,
      success_rate: parseFloat((item.success_rate || 0).toFixed(4)),
      regions: item.regions ? item.regions.split(',') : []
    }));
  }

  /**
   * Get archival gRPC endpoint statistics
   */
  async getArchivalGrpcStats(minutesAgo) {
    const stats = await db.get(
      `SELECT 
        COUNT(DISTINCT e.id) as total,
        COUNT(DISTINCT CASE WHEN lr.reachable = 1 THEN e.id END) as online
       FROM (
         SELECT endpoint_id, region, MAX(id) as max_id
         FROM latency_runs
         WHERE ts >= NOW() - INTERVAL '${minutesAgo} minutes'
         GROUP BY endpoint_id, region
       ) latest
       JOIN latency_runs lr ON lr.id = latest.max_id
       JOIN endpoints e ON lr.endpoint_id = e.id
       WHERE e.kind = 'grpc' 
       AND lr.block1_status = 'Has block 1'`
    );

    return {
      total: stats.total || 0,
      online: stats.online || 0
    };
  }

  /**
   * Get detailed endpoint performance by region
   */
  async getEndpointDetails(endpointUrl, minutesAgo = 60) {
    const endpoint = await db.get(
      'SELECT * FROM endpoints WHERE url = ?',
      [endpointUrl]
    );

    if (!endpoint) {
      return null;
    }

    const regionalData = await db.all(
      `SELECT 
        lr.region,
        lr.reachable,
        lr.latency_ms,
        lr.block1_status,
        lr.latest_height,
        lr.timeout,
        lr.ts
       FROM latency_runs lr
       WHERE lr.endpoint_id = ?
       AND lr.ts >= NOW() - INTERVAL '${minutesAgo} minutes'
       ORDER BY lr.ts DESC`,
      [endpoint.id]
    );

    return {
      endpoint: endpoint.url,
      chain: endpoint.chain,
      kind: endpoint.kind,
      is_archival: endpoint.is_archival === 1,
      regional_performance: regionalData
    };
  }
}

module.exports = new AggregationService();