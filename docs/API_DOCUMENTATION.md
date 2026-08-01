# API Documentation

Base URL: `http://localhost:3000/api`

---

## 1. Get Movies and Shows
`GET /movies`

**Response 200**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "movie_id": 1,
      "title": "Interstellar Odyssey",
      "genre": "Sci-Fi",
      "language": "English",
      "duration_mins": 148,
      "rating": "4.7",
      "shows": [
        { "show_id": 1, "theatre_name": "PVR Forum Mall", "city": "Bengaluru",
          "screen_name": "Screen 1", "show_time": "2026-08-01T18:00:00Z",
          "price": "250.00", "total_seats": 10 }
      ]
    }
  ]
}
```

---

## 2. Get Available Seats
`GET /shows/:show_id/seats`

**Response 200**
```json
{
  "success": true,
  "show_id": 1,
  "count": 10,
  "data": [
    { "seat_id": 1, "show_id": 1, "seat_number": "A1", "status": "AVAILABLE" },
    { "seat_id": 2, "show_id": 1, "seat_number": "A2", "status": "BOOKED" }
  ]
}
```

---

## 3. Lock Seats
`POST /shows/:show_id/lock-seats`

**Request Body**
```json
{ "user_id": 1, "seat_ids": [1, 2] }
```

**Response 200**
```json
{
  "success": true,
  "message": "Seats locked successfully. Complete booking before lock expires.",
  "showId": 1,
  "seatIds": [1, 2],
  "lockedBy": 1,
  "ttlSeconds": 120
}
```

**Response 409 (conflict — already locked by someone else)**
```json
{ "success": false, "error": "Seat 2 is already locked by another user" }
```

---

## 4. Book Tickets
`POST /bookings`

**Request Body**
```json
{ "user_id": 1, "show_id": 1, "seat_ids": [1, 2] }
```

**Response 201**
```json
{
  "success": true,
  "message": "Booking confirmed",
  "data": {
    "booking_id": 5,
    "user_id": 1,
    "show_id": 1,
    "seat_ids": [1, 2],
    "total_amount": "500.00",
    "status": "CONFIRMED",
    "created_at": "2026-07-31T10:00:00Z"
  }
}
```

**Response 409 (lock expired or seat already booked)**
```json
{ "success": false, "error": "One or more seats were already booked. Please pick different seats." }
```

---

## 5. Cancel Booking
`PATCH /bookings/:booking_id/cancel`

**Response 200**
```json
{
  "success": true,
  "message": "Booking cancelled",
  "data": { "booking_id": 5, "seat_ids": [1, 2], "show_id": 1, "user_id": 1 }
}
```

---

## 6. Booking Confirmation Event
`GET /bookings/:booking_id/confirmation`

Re-emits the real-time `booking:confirmed` Socket.io event and returns the booking.

**Response 200**
```json
{
  "success": true,
  "data": { "booking_id": 5, "user_id": 1, "show_id": 1, "seat_ids": [1,2],
            "total_amount": "500.00", "status": "CONFIRMED" }
}
```

**Socket.io client example**
```javascript
const socket = io("http://localhost:3000");
socket.emit("join", userId);
socket.on("booking:confirmed", (data) => console.log("Booking confirmed:", data));
```

---

## 7. AI Movie Recommendation
`GET /recommendations/:user_id`

**Response 200**
```json
{
  "success": true,
  "user_id": 1,
  "data": [
    { "movie_id": 2, "title": "The Last Heist", "genre": "Action", "rating": "4.3",
      "score": 0.71, "reason": "Based on your interest in Action and current trends" },
    { "movie_id": 1, "title": "Interstellar Odyssey", "genre": "Sci-Fi", "rating": "4.7",
      "score": 0.58, "reason": "Trending now among all users" }
  ]
}
```

---

## Error Format (all endpoints)
```json
{ "success": false, "error": "Human-readable message" }
```
| Status | Meaning |
|--------|---------|
| 400 | Validation error (missing/invalid input) |
| 404 | Resource not found |
| 409 | Conflict (seat locked/booked, booking already cancelled) |
| 500 | Internal server error |
