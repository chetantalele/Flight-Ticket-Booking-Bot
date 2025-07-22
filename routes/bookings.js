const express = require("express")
const router = express.Router()
const { v4: uuidv4 } = require("uuid")
const database = require("../config/database")

// Create new booking
router.post("/", async (req, res) => {
  try {
    const { userId, flightData, passengerDetails, totalAmount, currency = "USD" } = req.body

    const bookingReference = "FB" + uuidv4().substring(0, 8).toUpperCase()

    const sql = `
            INSERT INTO bookings (booking_reference, user_id, flight_data, passenger_details, total_amount, currency)
            VALUES (?, ?, ?, ?, ?, ?)
        `

    await database.query(sql, [
      bookingReference,
      userId,
      JSON.stringify(flightData),
      JSON.stringify(passengerDetails),
      totalAmount,
      currency,
    ])

    res.json({
      success: true,
      bookingReference,
      message: "Booking created successfully",
    })
  } catch (error) {
    console.error("Booking creation error:", error)
    res.status(500).json({ error: "Failed to create booking" })
  }
})

// Get user bookings
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params

    const sql = `
            SELECT * FROM bookings 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `

    const bookings = await database.query(sql, [userId])
    res.json(bookings)
  } catch (error) {
    console.error("Get bookings error:", error)
    res.status(500).json({ error: "Failed to retrieve bookings" })
  }
})

// Get booking by reference
router.get("/:bookingReference", async (req, res) => {
  try {
    const { bookingReference } = req.params

    const sql = `
            SELECT * FROM bookings 
            WHERE booking_reference = ?
        `

    const [booking] = await database.query(sql, [bookingReference])

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" })
    }

    res.json(booking)
  } catch (error) {
    console.error("Get booking error:", error)
    res.status(500).json({ error: "Failed to retrieve booking" })
  }
})

// Update booking payment status
router.patch("/:bookingReference/payment", async (req, res) => {
  try {
    const { bookingReference } = req.params
    const { paymentStatus, paymentId } = req.body

    const sql = `
            UPDATE bookings 
            SET payment_status = ?, payment_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE booking_reference = ?
        `

    await database.query(sql, [paymentStatus, paymentId, bookingReference])

    res.json({
      success: true,
      message: "Payment status updated successfully",
    })
  } catch (error) {
    console.error("Update payment status error:", error)
    res.status(500).json({ error: "Failed to update payment status" })
  }
})

module.exports = router
