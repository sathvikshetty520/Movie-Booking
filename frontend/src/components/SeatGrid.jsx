const TYPE_LABELS = {
  REGULAR: 'Regular',
  PREMIUM: 'Premium',
  RECLINER: 'Recliner',
  ACCESSIBLE: 'Accessible',
};

export default function SeatGrid({ seats, selectedSeatIds, onToggleSeat, lockedByMe }) {
  // group seats by row_label, preserving row order (A, B, C...)
  const rows = {};
  seats.forEach((seat) => {
    const row = seat.row_label || seat.seat_number[0];
    if (!rows[row]) rows[row] = [];
    rows[row].push(seat);
  });
  const rowLabels = Object.keys(rows).sort();

  const renderSeat = (seat) => {
    const isBooked = seat.status === 'BOOKED';
    const isSelected = selectedSeatIds.includes(seat.seat_id);
    const isLockedByMe = lockedByMe.includes(seat.seat_id);
    const type = (seat.seat_type || 'REGULAR').toLowerCase();

    let stateClass = 'available';
    if (isBooked) stateClass = 'booked';
    else if (isLockedByMe) stateClass = 'locked-mine';
    else if (isSelected) stateClass = 'selected';

    return (
      <button
        key={seat.seat_id}
        className={`seat seat-${type} seat-${stateClass}`}
        disabled={isBooked}
        onClick={() => onToggleSeat(seat.seat_id)}
        title={`${seat.seat_number} — ${TYPE_LABELS[seat.seat_type] || 'Regular'} — ${seat.status}`}
      >
        {seat.seat_type === 'ACCESSIBLE' ? '♿' : seat.seat_number.replace(/^[A-Z]/, '')}
      </button>
    );
  };

  // split each row at the midpoint to create a center aisle
  const splitRow = (rowSeats) => {
    const mid = Math.ceil(rowSeats.length / 2);
    return [rowSeats.slice(0, mid), rowSeats.slice(mid)];
  };

  return (
    <div className="theatre">
      <div className="screen-wrap">
        <div className="screen" />
        <span className="screen-label">SCREEN</span>
      </div>

      <div className="theatre-rows">
        {rowLabels.map((row) => {
          const [left, right] = splitRow(rows[row]);
          return (
            <div key={row} className="theatre-row">
              <span className="row-label">{row}</span>
              <div className="row-seats">
                {left.map(renderSeat)}
                <span className="aisle-gap" />
                {right.map(renderSeat)}
              </div>
              <span className="row-label">{row}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}