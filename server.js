const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { initEvents } = require('./services/eventService');
const logger = require('./utils/logger');

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
initEvents(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Movie ticket booking backend running on port ${PORT}`);
});

module.exports = { app, server };