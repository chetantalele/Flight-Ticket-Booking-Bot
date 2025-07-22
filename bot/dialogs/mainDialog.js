const {
  ComponentDialog,
  WaterfallDialog,
  TextPrompt,
  ChoicePrompt,
  NumberPrompt,
  DateTimePrompt,
} = require("botbuilder-dialogs")
const { MessageFactory, CardFactory } = require("botbuilder")
const { FlightSearchDialog } = require("./flightSearchDialog")
const { BookingDialog } = require("./bookingDialog")
const { PaymentDialog } = require("./paymentDialog")

const MAIN_WATERFALL_DIALOG = "mainWaterfallDialog"
const TEXT_PROMPT = "textPrompt"
const CHOICE_PROMPT = "choicePrompt"

class MainDialog extends ComponentDialog {
  constructor() {
    super("MainDialog")

    this.addDialog(new TextPrompt(TEXT_PROMPT))
    this.addDialog(new ChoicePrompt(CHOICE_PROMPT))
    this.addDialog(new FlightSearchDialog())
    this.addDialog(new BookingDialog())
    this.addDialog(new PaymentDialog())

    this.addDialog(
      new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
        this.introStep.bind(this),
        this.actStep.bind(this),
        this.finalStep.bind(this),
      ]),
    )

    this.initialDialogId = MAIN_WATERFALL_DIALOG
  }

  async introStep(stepContext) {
    const messageText =
      stepContext.options?.restartMsg ||
      "What would you like to do today? I can help you search flights, view bookings, or make payments."

    const promptMessage = MessageFactory.text(messageText)

    return await stepContext.prompt(CHOICE_PROMPT, {
      prompt: promptMessage,
      choices: ["Search Flights", "View My Bookings", "Make Payment", "Help", "Change Language"],
    })
  }

  async actStep(stepContext) {
    const choice = stepContext.result.value.toLowerCase()

    switch (choice) {
      case "search flights":
        return await stepContext.beginDialog("FlightSearchDialog")
      case "view my bookings":
        return await this.showBookings(stepContext)
      case "make payment":
        return await stepContext.beginDialog("PaymentDialog")
      case "help":
        return await this.showHelp(stepContext)
      case "change language":
        return await this.changeLanguage(stepContext)
      default:
        // Check if it's a flight booking command
        if (choice.startsWith("book flight")) {
          const flightIndex = Number.parseInt(choice.split(" ")[2])
          if (!isNaN(flightIndex)) {
            return await stepContext.beginDialog("BookingDialog", {
              flightIndex: flightIndex,
              searchResults: stepContext.values.lastSearchResults,
            })
          }
        }

        const didntUnderstandMessageText = `Sorry, I didn't understand that. Please choose from the available options.`
        await stepContext.context.sendActivity(MessageFactory.text(didntUnderstandMessageText))
        return await stepContext.replaceDialog(this.id)
    }
  }

  async finalStep(stepContext) {
    return await stepContext.replaceDialog(this.id, { restartMsg: "What else can I help you with?" })
  }

  async showBookings(stepContext) {
    const axios = require("axios")
    const userId = stepContext.context.activity.from.id

    try {
      const response = await axios.get(`${process.env.APP_BASE_URL}/api/bookings/user/${userId}`)
      const bookings = response.data

      if (bookings.length === 0) {
        await stepContext.context.sendActivity(MessageFactory.text("You have no bookings yet."))
      } else {
        const cards = bookings.map((booking) => this.createBookingCard(booking))
        const reply = MessageFactory.carousel(cards)
        await stepContext.context.sendActivity(reply)
      }
    } catch (error) {
      await stepContext.context.sendActivity(MessageFactory.text("Sorry, I couldn't retrieve your bookings right now."))
    }

    return await stepContext.endDialog()
  }

  createBookingCard(booking) {
    const flightData = JSON.parse(booking.flight_data)
    return CardFactory.heroCard(
      `Booking ${booking.booking_reference}`,
      `${flightData.origin} → ${flightData.destination}`,
      [
        `Departure: ${flightData.departureDate}`,
        `Amount: ${booking.currency} ${booking.total_amount}`,
        `Status: ${booking.payment_status}`,
      ],
      [],
      {
        type: "openUrl",
        title: "View Details",
        value: `${process.env.APP_BASE_URL}/booking/${booking.booking_reference}`,
      },
    )
  }

  async showHelp(stepContext) {
    const helpText = `
**Flight Booking Bot Help**

I can help you with:
• **Search Flights** - Find and compare flight options
• **Book Flights** - Complete your flight booking with payment
• **View Bookings** - See your existing bookings
• **Make Payment** - Complete pending payments

**Commands you can use:**
• "search flights from New York to London"
• "show my bookings"
• "help"
• "change language"

Just type what you need, and I'll guide you through the process!
        `

    await stepContext.context.sendActivity(MessageFactory.text(helpText))
    return await stepContext.endDialog()
  }

  async changeLanguage(stepContext) {
    const languageChoices = ["English", "Spanish", "French", "German", "Italian"]

    return await stepContext.prompt(CHOICE_PROMPT, {
      prompt: MessageFactory.text("Which language would you prefer?"),
      choices: languageChoices,
    })
  }
}

module.exports.MainDialog = MainDialog
