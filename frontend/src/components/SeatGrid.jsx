export default function SeatGrid({ seats, selectedSeatIds, onToggleSeat, lockedByMe }) {
  return (
    <div className="seat-grid">
      {seats.map((seat) => {
        const isBooked = seat.status === 'BOOKED';
        const isSelected = selectedSeatIds.includes(seat.seat_id);
        const isLockedByMe = lockedByMe.includes(seat.seat_id);

        let className = 'seat available';
        if (isBooked) className = 'seat booked';
        else if (isLockedByMe) className = 'seat locked-mine';
        else if (isSelected) className = 'seat selected';

        return (
          <button
            key={seat.seat_id}
            className={className}
            disabled={isBooked}
            onClick={() => onToggleSeat(seat.seat_id)}
            title={`${seat.seat_number} — ${seat.status}`}
          >
            {seat.seat_number}
          </button>
        );
      })}
    </div>
  );
}