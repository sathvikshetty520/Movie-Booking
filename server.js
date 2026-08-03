require('dotenv').config();
console.log('GROQ_API_KEY loaded:', process.env.GROQ_API_KEY ? 'YES' : 'NO');
const fs = require('fs');
const express = require('express');
const cors = require('cors'); 
const http = require('http');
const { Server } = require('socket.io');

const routes = require('./routes/index');
const errorHandler = require('./middleware/errorHandler');
const { initEvents } = require('./services/eventService');
const logger = require('./utils/logger');

if (!fs.existsSync('logs')) fs.mkdirSync('logs');

const app = express();
app.use(cors());      
app.use(express.json());

// Simple request logger
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api', routes);

// 404 handler
app.use((req, res) => res.status(404).json({ success: false, error: 'Route not found' }));

// Central error handler (must be last)
app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
initEvents(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Movie ticket booking backend running on port ${PORT}`);
});

module.exports = { app, server };
