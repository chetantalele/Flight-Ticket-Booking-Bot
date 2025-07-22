const { AirlineBookingService } = require("./airlineBookingService")
const { PaymentService } = require("./paymentService")

class RealBookingFlow {
  constructor() {
    this.airlineService = new AirlineBookingService()
    this.paymentService = new PaymentService()
  }

  async processRealBooking(flightOffer, passengerDetails, paymentDetails) {
    try {
      // Step 1: Create PNR (Passenger Name Record) with airline
      console.log("Creating airline reservation...")
      const pnr = await this.airlineService.createPNR(flightOffer, passengerDetails)

      // Step 2: Hold the reservation (usually 24-48 hours)
      console.log("Reservation created, PNR:", pnr.pnr)

      // Step 3: Process payment
      console.log("Processing payment...")
      const paymentResult = await this.paymentService.processPayment(paymentDetails)

      if (paymentResult.status !== "succeeded") {
        // Cancel the reservation if payment fails
        await this.airlineService.cancelPNR(pnr.pnr)
        throw new Error("Payment failed, reservation cancelled")
      }

      // Step 4: Issue actual tickets
      console.log("Issuing tickets...")
      const tickets = await this.airlineService.issueTickets(pnr.pnr, paymentResult.id)

      // Step 5: Send confirmation with real ticket numbers
      return {
        success: true,
        pnr: pnr.pnr,
        ticketNumbers: tickets.eTicketNumbers,
        boardingPasses: tickets.boardingPasses,
        bookingReference: pnr.pnr, // Real airline confirmation
      }
    } catch (error) {
      console.error("Real booking failed:", error)
      throw error
    }
  }
}

module.exports.RealBookingFlow = RealBookingFlow
