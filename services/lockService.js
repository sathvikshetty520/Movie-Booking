const redis = require('../config/redis');
const AppError = require('../utils/AppError');

const LOCK_TTL = parseInt(process.env.SEAT_LOCK_TTL_SECONDS || '120', 10);

const lockKey = (showId, seatId) => `lock:show:${showId}:seat:${seatId}`;

/**
 * Atomically attempts to lock a set of seats for a user.
 * Uses SET key value NX EX ttl per seat -> atomic at the seat level.
 * If ANY seat is already locked by someone else, all newly-acquired locks
 * in this call are rolled back (all-or-nothing) to avoid partial locks.
 */
async function lockSeats(showId, seatIds, userId) {
  const acquired = [];

  for (const seatId of seatIds) {
    const key = lockKey(showId, seatId);
    // NX = only set if not exists, EX = expiry in seconds -> atomic test-and-set
    const result = await redis.set(key, userId, 'EX', LOCK_TTL, 'NX');

    if (result === 'OK') {
      acquired.push(seatId);
    } else {
      // Someone else holds the lock (or it's the same user retrying) -> check owner
      const owner = await redis.get(key);
      if (owner === String(userId)) {
        acquired.push(seatId); // idempotent: same user re-locking
      } else {
        // Rollback everything acquired so far in this call
        await releaseSeats(showId, acquired, userId, true);
        throw new AppError(`Seat ${seatId} is already locked by another user`, 409);
      }
    }
  }

  return { showId, seatIds: acquired, lockedBy: userId, ttlSeconds: LOCK_TTL };
}

/**
 * Releases locks. If force=true, releases regardless of owner (used for rollback).
 * Otherwise only releases locks owned by userId.
 */
async function releaseSeats(showId, seatIds, userId, force = false) {
  for (const seatId of seatIds) {
    const key = lockKey(showId, seatId);
    if (force) {
      await redis.del(key);
      continue;
    }
    const owner = await redis.get(key);
    if (owner === String(userId)) {
      await redis.del(key);
    }
  }
}

/**
 * Validates that all given seats are currently locked by userId.
 * Used before confirming a booking.
 */
async function validateLocks(showId, seatIds, userId) {
  for (const seatId of seatIds) {
    const key = lockKey(showId, seatId);
    const owner = await redis.get(key);
    if (!owner) {
      throw new AppError(`Lock for seat ${seatId} has expired. Please re-lock the seat.`, 409);
    }
    if (owner !== String(userId)) {
      throw new AppError(`Seat ${seatId} is locked by another user`, 409);
    }
  }
  return true;
}

module.exports = { lockSeats, releaseSeats, validateLocks, LOCK_TTL };
