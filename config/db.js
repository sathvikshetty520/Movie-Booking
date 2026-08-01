const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  logger.error(`Unexpected PG pool error: ${err.message}`);
});

module.exports = pool;
