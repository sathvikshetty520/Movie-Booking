const redis = require('../config/redis');
const logger = require('../utils/logger');

const DEFAULT_TTL = 60; // seconds

/**
 * Read-through cache: try Redis first, fall back to fetchFn, then populate cache.
 */
async function getOrSetCache(key, fetchFn, ttlSeconds = DEFAULT_TTL) {
  const cached = await redis.get(key);
  if (cached) {
    logger.info(`Cache HIT: ${key}`);
    return JSON.parse(cached);
  }

  logger.info(`Cache MISS: ${key}`);
  const data = await fetchFn();
  await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  return data;
}

async function invalidate(key) {
  await redis.del(key);
}

module.exports = { getOrSetCache, invalidate };
