const express = require("express")
const router = express.Router()
const { PaymentService } = require("../services/paymentService")
const database = require("../config/database")

const paymentService = new PaymentService()

// Create payment intent
router.post("/create-intent", async (req, res) => {
  try {
    const { amount, currency, bookingReference } = req.body

    const paymentIntent = await paymentService.createPaymentIntent(amount, currency, { bookingReference })

    // Store payment transaction
    const sql = `
            INSERT INTO payment_transactions (booking_id, payment_gateway, transaction_id, amount, currency, status)
            SELECT id, 'stripe', ?, ?, ?, 'pending'
            FROM bookings WHERE booking_reference = ?
        `

    await database.query(sql, [paymentIntent.paymentIntentId, amount, currency, bookingReference])

    res.json(paymentIntent)
  } catch (error) {
    console.error("Payment intent creation error:", error)
    res.status(500).json({ error: "Failed to create payment intent" })
  }
})

// Confirm payment
router.post("/confirm/:paymentIntentId", async (req, res) => {
  try {
    const { paymentIntentId } = req.params

    const paymentResult = await paymentService.confirmPayment(paymentIntentId)

    // Update payment transaction status
    const updateTransactionSql = `
            UPDATE payment_transactions 
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE transaction_id = ?
        `

    await database.query(updateTransactionSql, [
      paymentResult.status === "succeeded" ? "completed" : "failed",
      paymentIntentId,
    ])

    // Update booking payment status if payment succeeded
    if (paymentResult.status === "succeeded") {
      const updateBookingSql = `
                UPDATE bookings b
                JOIN payment_transactions pt ON b.id = pt.booking_id
                SET b.payment_status = 'paid', b.payment_id = ?, b.updated_at = CURRENT_TIMESTAMP
                WHERE pt.transaction_id = ?
            `

      await database.query(updateBookingSql, [paymentIntentId, paymentIntentId])
    }

    res.json({
      success: paymentResult.status === "succeeded",
      status: paymentResult.status,
      message: paymentResult.status === "succeeded" ? "Payment completed successfully" : "Payment failed",
    })
  } catch (error) {
    console.error("Payment confirmation error:", error)
    res.status(500).json({ error: "Failed to confirm payment" })
  }
})

// Webhook for Stripe events
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"]
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event

  try {
    event = require("stripe").webhooks.constructEvent(req.body, sig, endpointSecret)
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded":
      const paymentIntent = event.data.object
      console.log("Payment succeeded:", paymentIntent.id)

      // Update database
      await database.query('UPDATE payment_transactions SET status = "completed" WHERE transaction_id = ?', [
        paymentIntent.id,
      ])
      break

    case "payment_intent.payment_failed":
      const failedPayment = event.data.object
      console.log("Payment failed:", failedPayment.id)

      await database.query('UPDATE payment_transactions SET status = "failed" WHERE transaction_id = ?', [
        failedPayment.id,
      ])
      break

    default:
      console.log(`Unhandled event type ${event.type}`)
  }

  res.json({ received: true })
})

module.exports = router
