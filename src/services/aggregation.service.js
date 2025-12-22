const db = require('../config/database');
const config = require('../config/app.config');
const logger = require('../utils/logger');

class AggregationService {
  /**
   * Get comprehensive summary of latency data.
   */
  async getSummary() {
    try {
      const freshness = config.dataFreshnessMinutes;

      const [
        global,
        regionStats,
        top15Fastest,
        archivalGrpc,
        top3Latest,
        bestRpcPerRegion,
        rpcStats,
        grpcStats
      ] = await Promise.all([
        this.getGlobalStats(freshness),
        this.getRegionStats(freshness),
        this.getTop15Fastest(freshness),
        this.getArchivalGrpcStats(freshness),
        this.getTop3Latest(freshness),
        this.getBestRpcPerRegion(freshness),
        this.getKindStats('rpc', freshness),
        this.getKindStats('grpc', freshness)
      ]);

      const bestRpcMap = new Map(bestRpcPerRegion.map(r => [r.region, r]));
      const enrichedRegions = regionStats.map(region => ({
        ...region,
        bestRpc: bestRpcMap.get(region.region) || null
      }));

      return {
        generated_at: new Date().toISOString(),
        data_freshness_minutes: freshness,
        global: {
          ...global,
          archival_grpc_total: archivalGrpc.total,
          rpc_total: rpcStats.total,
          rpc_online: rpcStats.online,
          grpc_total: grpcStats.total,
          grpc_online: grpcStats.online
        },
        regions: enrichedRegions,
        top_15_fastest: top15Fastest,
        top_3_latest: top3Latest
      };
    } catch (error) {
      logger.error('Error generating summary:', error);
      throw error;
    }
  }

  /**
   * Get global statistics.
   */
  async getGlobalStats(minutesAgo) {
    const stats = await db.get(
      `SELECT 
        COUNT(DISTINCT e.id) as total_endpoints,
        COUNT(DISTINCT CASE WHEN lr.reachable = 1 THEN e.id END) as online_endpoints,
        AVG(CASE WHEN lr.reachable = 1 AND lr.latency_ms >= 0 THEN lr.latency_ms END) as avg_latency_ms,
        CAST(SUM(lr.reachable) AS FLOAT) / COUNT(*) as success_rate,
        COUNT(*) as total_tests,
        SUM(lr.reachable) as successful_tests
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
      total_endpoints: parseInt(stats.total_endpoints) || 0,
      online: parseInt(stats.online_endpoints) || 0,
      offline: (parseInt(stats.total_endpoints) || 0) - (parseInt(stats.online_endpoints) || 0),
      avg_latency_ms: Math.round(stats.avg_latency_ms || 0),
      success_rate: parseFloat((stats.success_rate || 0).toFixed(4)),
      total_tests: parseInt(stats.total_tests) || 0,
      successful_tests: parseInt(stats.successful_tests) || 0
    };
  }

  /**
   * Get total and online counts for a specific kind (rpc/grpc).
   */
  async getKindStats(kind, minutesAgo) {
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
      WHERE e.kind = $1`,
      [kind]
    );
    return {
      total: parseInt(stats.total) || 0,
      online: parseInt(stats.online) || 0,
    };
  }
  
  /**
   * Get per-region statistics.
   */
  async getRegionStats(minutesAgo) {
    const regions = await db.all(
      `SELECT 
        lr.region,
        COUNT(DISTINCT e.id) as total_endpoints,
        COUNT(DISTINCT CASE WHEN lr.reachable = 1 THEN e.id END) as online_endpoints,
        AVG(CASE WHEN lr.reachable = 1 AND lr.latency_ms >= 0 THEN lr.latency_ms END) as avg_latency_ms,
        CAST(SUM(lr.reachable) AS FLOAT) / COUNT(*) as success_rate,
        COUNT(*) as total_tests
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
      total_endpoints: parseInt(r.total_endpoints) || 0,
      online: parseInt(r.online_endpoints) || 0,
      offline: (parseInt(r.total_endpoints) || 0) - (parseInt(r.online_endpoints) || 0),
      avg_latency_ms: Math.round(r.avg_latency_ms || 0),
      success_rate: parseFloat((r.success_rate || 0).toFixed(4)),
      total_tests: parseInt(r.total_tests) || 0
    }));
  }

  /**
   * Get top 15 fastest endpoints (global average).
   */
  async getTop15Fastest(minutesAgo) {
    const minRegions = config.minRegionsForTop10;
    const top15 = await db.all(
      `SELECT 
        e.url,
        e.kind,
        e.is_archival,
        COUNT(DISTINCT lr.region) as regions_tested,
        AVG(CASE WHEN lr.reachable = 1 AND lr.latency_ms >= 0 THEN lr.latency_ms END) as avg_latency_global,
        STRING_AGG(DISTINCT lr.region, ',') as regions
       FROM (
         SELECT endpoint_id, region, MAX(id) as max_id
         FROM latency_runs
         WHERE ts >= NOW() - INTERVAL '${minutesAgo} minutes'
         GROUP BY endpoint_id, region
       ) latest
       JOIN latency_runs lr ON lr.id = latest.max_id
       JOIN endpoints e ON lr.endpoint_id = e.id
       WHERE lr.reachable = 1 AND lr.latency_ms >= 0
       GROUP BY e.id, e.url, e.chain, e.kind, e.is_archival
       HAVING COUNT(DISTINCT lr.region) >= ${minRegions}
       ORDER BY avg_latency_global ASC
       LIMIT 15`
    );
    return top15.map(item => ({
      endpoint: item.url,
      kind: item.kind,
      is_archival: item.is_archival === 1,
      avg_latency_global: Math.round(item.avg_latency_global || 0),
      regions_tested: parseInt(item.regions_tested) || 0,
      regions: item.regions ? item.regions.split(',') : []
    }));
  }

  /**
   * Get archival gRPC endpoint statistics.
   */
  async getArchivalGrpcStats(minutesAgo) {
    const stats = await db.get(
      `SELECT 
        COUNT(DISTINCT e.id) as total
       FROM latency_runs lr
       JOIN endpoints e ON lr.endpoint_id = e.id
       WHERE e.kind = 'grpc' AND e.is_archival = 1 AND lr.ts >= NOW() - INTERVAL '${minutesAgo} minutes'`
    );
    return { total: parseInt(stats.total) || 0 };
  }

  /**
   * Get the top 3 fastest RPC endpoints that are close to the max block height.
   */
  async getTop3Latest(minutesAgo, blockDiff = 5) {
    const maxHeightResult = await db.get(
      `SELECT MAX(latest_height) as max_height
       FROM latency_runs
       WHERE reachable = 1 AND latest_height IS NOT NULL AND ts >= NOW() - INTERVAL '${minutesAgo} minutes'`
    );
    const max_height = maxHeightResult ? parseInt(maxHeightResult.max_height) : 0;
    if (max_height === 0) return [];

    const top3 = await db.all(
      `SELECT 
          e.url,
          lr.region,
          lr.latency_ms
       FROM (
         SELECT endpoint_id, region, MAX(id) as max_id
         FROM latency_runs
         WHERE ts >= NOW() - INTERVAL '${minutesAgo} minutes'
         GROUP BY endpoint_id, region
       ) latest
       JOIN latency_runs lr ON lr.id = latest.max_id
       JOIN endpoints e ON lr.endpoint_id = e.id
       WHERE lr.reachable = 1 
         AND e.kind = 'rpc'
         AND lr.latest_height >= (${max_height} - ${blockDiff})
       ORDER BY lr.latency_ms ASC
       LIMIT 3`
    );
    return top3;
  }

  /**
   * Get the single best performing RPC for each region.
   */
  async getBestRpcPerRegion(minutesAgo) {
    const bests = await db.all(
      `WITH RankedRuns AS (
        SELECT
          lr.region,
          e.url,
          lr.latency_ms,
          ROW_NUMBER() OVER(PARTITION BY lr.region ORDER BY lr.latency_ms ASC) as rn
        FROM (
          SELECT endpoint_id, region, MAX(id) as max_id
          FROM latency_runs
          WHERE ts >= NOW() - INTERVAL '${minutesAgo} minutes'
          GROUP BY endpoint_id, region
        ) latest
        JOIN latency_runs lr ON lr.id = latest.max_id
        JOIN endpoints e ON lr.endpoint_id = e.id
        WHERE lr.reachable = 1 AND lr.latency_ms >= 0 AND e.kind = 'rpc'
      )
      SELECT region, url, latency_ms FROM RankedRuns WHERE rn = 1`
    );
    return bests;
  }

  /**
   * Get detailed endpoint performance by region.
   */
  async getEndpointDetails(endpointUrl, minutesAgo = 60) {
    const endpoint = await db.get('SELECT * FROM endpoints WHERE url = $1', [endpointUrl]);
    if (!endpoint) return null;

    const regionalData = await db.all(
      `SELECT 
        lr.region, lr.reachable, lr.latency_ms, lr.block1_status, lr.latest_height, lr.ts
       FROM latency_runs lr
       WHERE lr.endpoint_id = $1 AND lr.ts >= NOW() - INTERVAL '${minutesAgo} minutes'
       ORDER BY lr.ts DESC`,
      [endpoint.id]
    );

    return {
      endpoint: endpoint.url,
      kind: endpoint.kind,
      is_archival: endpoint.is_archival === 1,
      regional_performance: regionalData
    };
  }
}

module.exports = new AggregationService();