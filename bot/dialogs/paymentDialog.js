const { ComponentDialog, WaterfallDialog, TextPrompt, ChoicePrompt } = require("botbuilder-dialogs")
const { MessageFactory, CardFactory } = require("botbuilder")
const axios = require("axios")

const PAYMENT_DIALOG = "paymentDialog"
const TEXT_PROMPT = "textPrompt"
const CHOICE_PROMPT = "choicePrompt"

class PaymentDialog extends ComponentDialog {
  constructor() {
    super("PaymentDialog")

    this.addDialog(new TextPrompt(TEXT_PROMPT))
    this.addDialog(new ChoicePrompt(CHOICE_PROMPT))

    this.addDialog(
      new WaterfallDialog(PAYMENT_DIALOG, [
        this.bookingReferenceStep.bind(this),
        this.verifyBookingStep.bind(this),
        this.processPaymentStep.bind(this),
      ]),
    )

    this.initialDialogId = PAYMENT_DIALOG
  }

  async bookingReferenceStep(stepContext) {
    return await stepContext.prompt(TEXT_PROMPT, {
      prompt: MessageFactory.text("Please enter your booking reference number:"),
    })
  }

  async verifyBookingStep(stepContext) {
    const bookingReference = stepContext.result.toUpperCase()
    stepContext.values.bookingReference = bookingReference

    try {
      const response = await axios.get(`${process.env.APP_BASE_URL}/api/bookings/${bookingReference}`)
      const booking = response.data

      if (!booking) {
        await stepContext.context.sendActivity(
          MessageFactory.text("Booking not found. Please check your reference number."),
        )
        return await stepContext.endDialog()
      }

      if (booking.payment_status === "paid") {
        await stepContext.context.sendActivity(MessageFactory.text("This booking has already been paid for."))
        return await stepContext.endDialog()
      }

      stepContext.values.booking = booking

      const flightData = JSON.parse(booking.flight_data)
      const summaryText = `
**Booking Details:**
📋 **Reference**: ${booking.booking_reference}
✈️ **Route**: ${flightData.origin} → ${flightData.destination}
💰 **Amount**: ${booking.currency} ${booking.total_amount}
📊 **Status**: ${booking.payment_status}
            `

      await stepContext.context.sendActivity(MessageFactory.text(summaryText))

      return await stepContext.prompt(CHOICE_PROMPT, {
        prompt: MessageFactory.text("Would you like to proceed with payment?"),
        choices: ["Yes, pay now", "No, cancel"],
      })
    } catch (error) {
      console.error("Booking verification error:", error)
      await stepContext.context.sendActivity(MessageFactory.text("Error retrieving booking details. Please try again."))
      return await stepContext.endDialog()
    }
  }

  async processPaymentStep(stepContext) {
    if (stepContext.result.value !== "Yes, pay now") {
      await stepContext.context.sendActivity(MessageFactory.text("Payment cancelled."))
      return await stepContext.endDialog()
    }

    try {
      const booking = stepContext.values.booking

      // Create payment intent
      const paymentResponse = await axios.post(`${process.env.APP_BASE_URL}/api/payments/create-intent`, {
        amount: booking.total_amount,
        currency: booking.currency,
        bookingReference: booking.booking_reference,
      })

      const paymentLink = `${process.env.APP_BASE_URL}/payment.html?payment_intent_client_secret=${paymentResponse.data.clientSecret}&return_url=${encodeURIComponent(process.env.APP_BASE_URL)}`

      const paymentCard = CardFactory.heroCard(
        "Complete Your Payment",
        `Booking: ${booking.booking_reference}`,
        [`Amount: ${booking.currency} ${booking.total_amount}`, "Secure payment via Stripe"],
        [],
        {
          type: "openUrl",
          title: "Pay Now",
          value: paymentLink,
        },
      )

      await stepContext.context.sendActivity(MessageFactory.attachment(paymentCard))
      await stepContext.context.sendActivity(
        MessageFactory.text("Click the 'Pay Now' button above to complete your payment securely."),
      )
    } catch (error) {
      console.error("Payment processing error:", error)
      await stepContext.context.sendActivity(MessageFactory.text("Error processing payment. Please try again later."))
    }

    return await stepContext.endDialog()
  }
}

module.exports.PaymentDialog = PaymentDialog
