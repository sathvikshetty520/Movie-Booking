require('dotenv').config();
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const routes = require('./routes/index');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

if (!fs.existsSync('logs')) fs.mkdirSync('logs');

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api', routes);

app.use((req, res) => res.status(404).json({ success: false, error: 'Route not found' }));

app.use(errorHandler);

module.exports = app;