let ioInstance = null;

function initEvents(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    socket.on('join', (userId) => {
      socket.join(`user:${userId}`);
    });

    socket.on('join_show', (showId) => {
      socket.join(`show:${showId}`);
    });

    socket.on('leave_show', (showId) => {
      socket.leave(`show:${showId}`);
    });
  });
}

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

function emitSeatUpdate(showId, seatIds, status, excludeUserId = null) {
  if (!ioInstance) return;
  ioInstance.to(`show:${showId}`).emit('seat:update', {
    show_id: showId,
    seat_ids: seatIds,
    status,
    by_user_id: excludeUserId,
  });
}

module.exports = {
  initEvents,
  emitBookingConfirmed,
  emitBookingCancelled,
  emitSeatUpdate,
};