const {
  ComponentDialog,
  WaterfallDialog,
  TextPrompt,
  NumberPrompt,
  ChoicePrompt,
  ConfirmPrompt,
} = require("botbuilder-dialogs")
const { MessageFactory, CardFactory } = require("botbuilder")
const axios = require("axios")

const BOOKING_DIALOG = "bookingDialog"
const TEXT_PROMPT = "textPrompt"
const NUMBER_PROMPT = "numberPrompt"
const CHOICE_PROMPT = "choicePrompt"
const CONFIRM_PROMPT = "confirmPrompt"

class BookingDialog extends ComponentDialog {
  constructor() {
    super("BookingDialog")

    this.addDialog(new TextPrompt(TEXT_PROMPT))
    this.addDialog(new NumberPrompt(NUMBER_PROMPT))
    this.addDialog(new ChoicePrompt(CHOICE_PROMPT))
    this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT))

    this.addDialog(
      new WaterfallDialog(BOOKING_DIALOG, [
        this.flightSelectionStep.bind(this),
        this.passengerDetailsStep.bind(this),
        this.contactDetailsStep.bind(this),
        this.confirmationStep.bind(this),
        this.createBookingStep.bind(this),
        this.paymentStep.bind(this),
      ]),
    )

    this.initialDialogId = BOOKING_DIALOG
  }

  async flightSelectionStep(stepContext) {
    const flightIndex = stepContext.options.flightIndex
    const searchResults = stepContext.options.searchResults

    if (flightIndex !== undefined && searchResults && searchResults[flightIndex]) {
      stepContext.values.selectedFlight = searchResults[flightIndex]
      return await stepContext.next()
    }

    return await stepContext.prompt(TEXT_PROMPT, {
      prompt: MessageFactory.text("Please select a flight by typing the flight number or 'cancel' to go back."),
    })
  }

  async passengerDetailsStep(stepContext) {
    if (!stepContext.values.selectedFlight) {
      await stepContext.context.sendActivity(MessageFactory.text("No flight selected. Please start over."))
      return await stepContext.endDialog()
    }

    const flight = stepContext.values.selectedFlight
    const passengers = flight.travelerPricings?.length || 1

    stepContext.values.passengers = []
    stepContext.values.currentPassenger = 0
    stepContext.values.totalPassengers = passengers

    return await stepContext.prompt(TEXT_PROMPT, {
      prompt: MessageFactory.text(
        `Please enter details for passenger ${stepContext.values.currentPassenger + 1} of ${passengers}:\n\nFull Name:`,
      ),
    })
  }

  async contactDetailsStep(stepContext) {
    // Store passenger name
    if (stepContext.values.currentPassenger < stepContext.values.totalPassengers) {
      stepContext.values.passengers.push({
        name: stepContext.result,
        passengerNumber: stepContext.values.currentPassenger + 1,
      })

      stepContext.values.currentPassenger++

      if (stepContext.values.currentPassenger < stepContext.values.totalPassengers) {
        return await stepContext.prompt(TEXT_PROMPT, {
          prompt: MessageFactory.text(
            `Please enter details for passenger ${stepContext.values.currentPassenger + 1} of ${stepContext.values.totalPassengers}:\n\nFull Name:`,
          ),
        })
      }
    }

    // All passengers entered, now get contact details
    return await stepContext.prompt(TEXT_PROMPT, {
      prompt: MessageFactory.text("Please enter your email address for booking confirmation:"),
    })
  }

  async confirmationStep(stepContext) {
    stepContext.values.email = stepContext.result

    return await stepContext.prompt(TEXT_PROMPT, {
      prompt: MessageFactory.text("Please enter your phone number:"),
    })
  }

  async createBookingStep(stepContext) {
    stepContext.values.phone = stepContext.result

    // Create booking summary
    const flight = stepContext.values.selectedFlight
    const price = flight.price?.total || "0"
    const currency = flight.price?.currency || "USD"

    const summaryText = `
**Booking Summary:**
✈️ **Flight**: ${flight.itineraries?.[0]?.segments?.[0]?.carrierCode || "N/A"}
📍 **Route**: ${flight.itineraries?.[0]?.segments?.[0]?.departure?.iataCode} → ${flight.itineraries?.[0]?.segments?.[flight.itineraries[0].segments.length - 1]?.arrival?.iataCode}
👥 **Passengers**: ${stepContext.values.passengers.length}
💰 **Total**: ${currency} ${price}
📧 **Email**: ${stepContext.values.email}
📱 **Phone**: ${stepContext.values.phone}

**Passengers:**
${stepContext.values.passengers.map((p, i) => `${i + 1}. ${p.name}`).join("\n")}
        `

    await stepContext.context.sendActivity(MessageFactory.text(summaryText))

    return await stepContext.prompt(CONFIRM_PROMPT, {
      prompt: MessageFactory.text("Do you want to proceed with this booking?"),
    })
  }

  async paymentStep(stepContext) {
    if (!stepContext.result) {
      await stepContext.context.sendActivity(MessageFactory.text("Booking cancelled."))
      return await stepContext.endDialog()
    }

    try {
      const userId = stepContext.context.activity.from.id
      const flight = stepContext.values.selectedFlight
      const price = Number.parseFloat(flight.price?.total || "0")
      const currency = flight.price?.currency || "USD"

      // Create booking in database
      const bookingData = {
        userId: userId,
        flightData: {
          flightOffer: flight,
          origin: flight.itineraries?.[0]?.segments?.[0]?.departure?.iataCode,
          destination:
            flight.itineraries?.[0]?.segments?.[flight.itineraries[0].segments.length - 1]?.arrival?.iataCode,
          departureDate: flight.itineraries?.[0]?.segments?.[0]?.departure?.at,
        },
        passengerDetails: {
          passengers: stepContext.values.passengers,
          email: stepContext.values.email,
          phone: stepContext.values.phone,
        },
        totalAmount: price,
        currency: currency,
      }

      const response = await axios.post(`${process.env.APP_BASE_URL}/api/bookings`, bookingData)

      if (response.data.success) {
        const bookingReference = response.data.bookingReference

        // Create payment intent
        const paymentResponse = await axios.post(`${process.env.APP_BASE_URL}/api/payments/create-intent`, {
          amount: price,
          currency: currency,
          bookingReference: bookingReference,
        })

        const paymentLink = `${process.env.APP_BASE_URL}/payment.html?payment_intent_client_secret=${paymentResponse.data.clientSecret}&return_url=${encodeURIComponent(process.env.APP_BASE_URL)}`

        const paymentCard = CardFactory.heroCard(
          "Complete Your Payment",
          `Booking Reference: ${bookingReference}`,
          [`Amount: ${currency} ${price}`, "Click below to complete payment"],
          [],
          {
            type: "openUrl",
            title: "Pay Now",
            value: paymentLink,
          },
        )

        await stepContext.context.sendActivity(MessageFactory.attachment(paymentCard))
        await stepContext.context.sendActivity(
          MessageFactory.text(
            `Your booking has been created with reference: **${bookingReference}**\n\nPlease complete the payment to confirm your booking.`,
          ),
        )
      } else {
        throw new Error("Failed to create booking")
      }
    } catch (error) {
      console.error("Booking creation error:", error)
      await stepContext.context.sendActivity(
        MessageFactory.text("Sorry, there was an error creating your booking. Please try again."),
      )
    }

    return await stepContext.endDialog()
  }
}

module.exports.BookingDialog = BookingDialog
