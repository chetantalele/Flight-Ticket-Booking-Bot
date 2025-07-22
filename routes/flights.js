const express = require("express")
const router = express.Router()
const { FlightService } = require("../services/flightService")

const flightService = new FlightService()

// Search flights
router.post("/search", async (req, res) => {
  try {
    const searchParams = req.body
    const flights = await flightService.searchFlights(searchParams)
    res.json(flights)
  } catch (error) {
    console.error("Flight search error:", error)
    res.status(500).json({ error: "Failed to search flights" })
  }
})

// Get flight details
router.get("/details/:offerId", async (req, res) => {
  try {
    const { offerId } = req.params
    const flightDetails = await flightService.getFlightDetails(offerId)
    res.json(flightDetails)
  } catch (error) {
    console.error("Flight details error:", error)
    res.status(500).json({ error: "Failed to get flight details" })
  }
})

// Get airport suggestions
router.get("/airports/search", async (req, res) => {
  try {
    const { query } = req.query
    const airportCode = await flightService.getAirportCode(query)
    res.json({ code: airportCode })
  } catch (error) {
    console.error("Airport search error:", error)
    res.status(500).json({ error: "Airport not found" })
  }
})

module.exports = router
