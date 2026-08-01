let ioInstance = null;

function initEvents(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    // Client joins a room named after their user_id to receive personal booking events
    socket.on('join', (userId) => {
      socket.join(`user:${userId}`);
    });
  });
}

/**
 * Emits a real-time booking confirmation event to the user's room
 * and to a global "bookings" feed (e.g. for an admin dashboard).
 */
function emitBookingConfirmed(userId, payload) {
  if (!ioInstance) return;
  ioInstance.to(`user:${userId}`).emit('booking:confirmed', payload);
  ioInstance.emit('bookings:feed', payload);
}

function emitBookingCancelled(userId, payload) {
  if (!ioInstance) return;
  ioInstance.to(`user:${userId}`).emit('booking:cancelled', payload);
  ioInstance.emit('bookings:feed', payload);
}

module.exports = { initEvents, emitBookingConfirmed, emitBookingCancelled };
