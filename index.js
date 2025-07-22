const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
require("dotenv").config()

const app = express()

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use("/api/flights", require("./routes/flights"))
app.use("/api/bookings", require("./routes/bookings"))
app.use("/api/payments", require("./routes/payments"))
app.use("/api/users", require("./routes/users"))

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() })
})

const PORT = process.env.EXPRESS_PORT || 3000

app.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`)
})

// Start the bot server
require("./bot/index")
