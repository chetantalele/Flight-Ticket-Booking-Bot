const axios = require("axios")

class FlightService {
  constructor() {
    this.clientId = process.env.AMADEUS_CLIENT_ID
    this.clientSecret = process.env.AMADEUS_CLIENT_SECRET
    this.baseUrl = process.env.AMADEUS_BASE_URL
    this.accessToken = null
    this.tokenExpiry = null
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/security/oauth2/token`,
        new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      )

      this.accessToken = response.data.access_token
      this.tokenExpiry = new Date(Date.now() + response.data.expires_in * 1000)

      return this.accessToken
    } catch (error) {
      console.error("Error getting Amadeus access token:", error.response?.data || error.message)
      throw new Error("Failed to authenticate with flight API")
    }
  }

  async searchFlights(searchParams) {
    try {
      const token = await this.getAccessToken()

      // Convert city names to IATA codes if needed
      const originCode = await this.getAirportCode(searchParams.origin)
      const destinationCode = await this.getAirportCode(searchParams.destination)

      const params = {
        originLocationCode: originCode,
        destinationLocationCode: destinationCode,
        departureDate: this.formatDate(searchParams.departureDate),
        adults: searchParams.passengers,
        travelClass: searchParams.travelClass || "ECONOMY",
        max: 10,
      }

      if (searchParams.returnDate) {
        params.returnDate = this.formatDate(searchParams.returnDate)
      }

      const response = await axios.get(`${this.baseUrl}/v2/shopping/flight-offers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      })

      return response.data.data || []
    } catch (error) {
      console.error("Flight search error:", error.response?.data || error.message)
      throw new Error("Failed to search flights")
    }
  }

  async getAirportCode(location) {
    // If already a 3-letter code, return as is
    if (/^[A-Z]{3}$/.test(location.toUpperCase())) {
      return location.toUpperCase()
    }

    try {
      const token = await this.getAccessToken()

      const response = await axios.get(`${this.baseUrl}/v1/reference-data/locations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          keyword: location,
          subType: "AIRPORT,CITY",
        },
      })

      if (response.data.data && response.data.data.length > 0) {
        return response.data.data[0].iataCode
      }

      throw new Error(`Airport code not found for: ${location}`)
    } catch (error) {
      console.error("Airport code lookup error:", error.response?.data || error.message)
      // Fallback to common airport codes
      const commonCodes = {
        "new york": "JFK",
        london: "LHR",
        paris: "CDG",
        tokyo: "NRT",
        "los angeles": "LAX",
        chicago: "ORD",
        miami: "MIA",
        dubai: "DXB",
      }

      const code = commonCodes[location.toLowerCase()]
      if (code) return code

      throw new Error(`Could not find airport code for: ${location}`)
    }
  }

  formatDate(dateInput) {
    const date = new Date(dateInput)
    return date.toISOString().split("T")[0]
  }

  async getFlightDetails(offerId) {
    try {
      const token = await this.getAccessToken()

      const response = await axios.post(
        `${this.baseUrl}/v1/shopping/flight-offers/pricing`,
        {
          data: {
            type: "flight-offers-pricing",
            flightOffers: [{ id: offerId }],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      )

      return response.data.data
    } catch (error) {
      console.error("Flight details error:", error.response?.data || error.message)
      throw new Error("Failed to get flight details")
    }
  }
}

module.exports.FlightService = FlightService
