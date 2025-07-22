class FlightComparisonService {
  constructor() {
    this.comparisonMetrics = ["price", "duration", "layovers", "departure_time"]
  }

  compareFlights(flights) {
    return {
      cheapest: this.findCheapest(flights),
      fastest: this.findFastest(flights),
      mostDirect: this.findMostDirect(flights),
      bestValue: this.calculateBestValue(flights),
      comparison: this.createComparisonTable(flights),
    }
  }

  findCheapest(flights) {
    return flights.reduce((cheapest, current) => {
      const currentPrice = Number.parseFloat(current.price?.total || Number.POSITIVE_INFINITY)
      const cheapestPrice = Number.parseFloat(cheapest.price?.total || Number.POSITIVE_INFINITY)
      return currentPrice < cheapestPrice ? current : cheapest
    })
  }

  findFastest(flights) {
    return flights.reduce((fastest, current) => {
      const currentDuration = this.parseDuration(current.itineraries?.[0]?.duration)
      const fastestDuration = this.parseDuration(fastest.itineraries?.[0]?.duration)
      return currentDuration < fastestDuration ? current : fastest
    })
  }

  findMostDirect(flights) {
    return flights.reduce((mostDirect, current) => {
      const currentLayovers = (current.itineraries?.[0]?.segments?.length || 1) - 1
      const mostDirectLayovers = (mostDirect.itineraries?.[0]?.segments?.length || 1) - 1
      return currentLayovers < mostDirectLayovers ? current : mostDirect
    })
  }

  calculateBestValue(flights) {
    // Score based on price, duration, and layovers
    return flights
      .map((flight) => {
        const price = Number.parseFloat(flight.price?.total || 0)
        const duration = this.parseDuration(flight.itineraries?.[0]?.duration)
        const layovers = (flight.itineraries?.[0]?.segments?.length || 1) - 1

        // Lower is better for all metrics
        const priceScore = price / 100 // Normalize price
        const durationScore = duration // Hours
        const layoverScore = layovers * 2 // Penalty for layovers

        const totalScore = priceScore + durationScore + layoverScore

        return { ...flight, valueScore: totalScore }
      })
      .sort((a, b) => a.valueScore - b.valueScore)[0]
  }

  createComparisonTable(flights) {
    return flights.slice(0, 5).map((flight) => ({
      airline: flight.itineraries?.[0]?.segments?.[0]?.carrierCode,
      price: flight.price?.total,
      currency: flight.price?.currency,
      duration: flight.itineraries?.[0]?.duration,
      layovers: (flight.itineraries?.[0]?.segments?.length || 1) - 1,
      departure: flight.itineraries?.[0]?.segments?.[0]?.departure?.at,
      arrival: flight.itineraries?.[0]?.segments?.[flight.itineraries[0].segments.length - 1]?.arrival?.at,
    }))
  }

  parseDuration(duration) {
    if (!duration) return 0
    const match = duration.match(/PT(\d+)H(\d+)?M?/)
    if (match) {
      const hours = Number.parseInt(match[1]) || 0
      const minutes = Number.parseInt(match[2]) || 0
      return hours + minutes / 60
    }
    return 0
  }
}

module.exports.FlightComparisonService = FlightComparisonService
