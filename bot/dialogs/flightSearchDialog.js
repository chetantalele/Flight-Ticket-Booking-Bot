const {
  ComponentDialog,
  WaterfallDialog,
  TextPrompt,
  DateTimePrompt,
  NumberPrompt,
  ChoicePrompt,
} = require("botbuilder-dialogs")
const { MessageFactory, CardFactory } = require("botbuilder")
const { FlightService } = require("../../services/flightService")

const FLIGHT_SEARCH_DIALOG = "flightSearchDialog"
const TEXT_PROMPT = "textPrompt"
const DATETIME_PROMPT = "datetimePrompt"
const NUMBER_PROMPT = "numberPrompt"
const CHOICE_PROMPT = "choicePrompt"

class FlightSearchDialog extends ComponentDialog {
  constructor() {
    super("FlightSearchDialog")

    this.flightService = new FlightService()

    this.addDialog(new TextPrompt(TEXT_PROMPT))
    this.addDialog(new DateTimePrompt(DATETIME_PROMPT))
    this.addDialog(new NumberPrompt(NUMBER_PROMPT))
    this.addDialog(new ChoicePrompt(CHOICE_PROMPT))

    this.addDialog(
      new WaterfallDialog(FLIGHT_SEARCH_DIALOG, [
        this.originStep.bind(this),
        this.destinationStep.bind(this),
        this.departureDateStep.bind(this),
        this.returnDateStep.bind(this),
        this.passengersStep.bind(this),
        this.classStep.bind(this),
        this.searchStep.bind(this),
        this.resultsStep.bind(this),
      ]),
    )

    this.initialDialogId = FLIGHT_SEARCH_DIALOG
  }

  async originStep(stepContext) {
    return await stepContext.prompt(TEXT_PROMPT, {
      prompt: MessageFactory.text("Where would you like to fly from? (Enter city or airport code)"),
    })
  }

  async destinationStep(stepContext) {
    stepContext.values.origin = stepContext.result
    return await stepContext.prompt(TEXT_PROMPT, {
      prompt: MessageFactory.text("Where would you like to fly to? (Enter city or airport code)"),
    })
  }

  async departureDateStep(stepContext) {
    stepContext.values.destination = stepContext.result
    return await stepContext.prompt(DATETIME_PROMPT, {
      prompt: MessageFactory.text('When would you like to depart? (e.g., "tomorrow", "Dec 25", "2024-01-15")'),
    })
  }

  async returnDateStep(stepContext) {
    stepContext.values.departureDate = stepContext.result[0].value
    return await stepContext.prompt(CHOICE_PROMPT, {
      prompt: MessageFactory.text("Is this a round trip?"),
      choices: ["Yes", "No (One way)"],
    })
  }

  async passengersStep(stepContext) {
    const isRoundTrip = stepContext.result.value === "Yes"
    stepContext.values.isRoundTrip = isRoundTrip

    if (isRoundTrip) {
      const returnPrompt = await stepContext.prompt(DATETIME_PROMPT, {
        prompt: MessageFactory.text("When would you like to return?"),
      })
      stepContext.values.returnDate = returnPrompt.result?.[0]?.value
    }

    return await stepContext.prompt(NUMBER_PROMPT, {
      prompt: MessageFactory.text("How many passengers? (1-9)"),
      retryPrompt: MessageFactory.text("Please enter a number between 1 and 9."),
    })
  }

  async classStep(stepContext) {
    stepContext.values.passengers = stepContext.result
    return await stepContext.prompt(CHOICE_PROMPT, {
      prompt: MessageFactory.text("Which class would you prefer?"),
      choices: ["Economy", "Premium Economy", "Business", "First"],
    })
  }

  async searchStep(stepContext) {
    stepContext.values.travelClass = stepContext.result.value

    const searchParams = {
      origin: stepContext.values.origin,
      destination: stepContext.values.destination,
      departureDate: stepContext.values.departureDate,
      returnDate: stepContext.values.returnDate,
      passengers: stepContext.values.passengers,
      travelClass: stepContext.values.travelClass.toUpperCase().replace(" ", "_"),
    }

    await stepContext.context.sendActivity(MessageFactory.text("🔍 Searching for flights... Please wait."))

    try {
      const flights = await this.flightService.searchFlights(searchParams)
      stepContext.values.searchResults = flights

      if (flights.length === 0) {
        await stepContext.context.sendActivity(
          MessageFactory.text(
            "Sorry, no flights found for your search criteria. Please try different dates or destinations.",
          ),
        )
        return await stepContext.endDialog()
      }

      return await stepContext.next()
    } catch (error) {
      console.error("Flight search error:", error)
      await stepContext.context.sendActivity(
        MessageFactory.text("Sorry, there was an error searching for flights. Please try again later."),
      )
      return await stepContext.endDialog()
    }
  }

  async resultsStep(stepContext) {
    const flights = stepContext.values.searchResults

    // Create flight cards
    const cards = flights.slice(0, 5).map((flight, index) => this.createFlightCard(flight, index))
    const reply = MessageFactory.carousel(cards)
    reply.text = `Found ${flights.length} flights. Here are the top options:`

    await stepContext.context.sendActivity(reply)

    // Ask if user wants to book
    return await stepContext.prompt(CHOICE_PROMPT, {
      prompt: MessageFactory.text("Would you like to book one of these flights?"),
      choices: ["Yes, book now", "Search again", "Not now"],
    })
  }

  createFlightCard(flight, index) {
    const price = flight.price?.total || "N/A"
    const currency = flight.price?.currency || "USD"
    const airline = flight.itineraries?.[0]?.segments?.[0]?.carrierCode || "Unknown"
    const departure = flight.itineraries?.[0]?.segments?.[0]?.departure
    const arrival = flight.itineraries?.[0]?.segments?.[flight.itineraries[0].segments.length - 1]?.arrival

    return CardFactory.heroCard(
      `${airline} - ${currency} ${price}`,
      `${departure?.iataCode} → ${arrival?.iataCode}`,
      [
        `Departure: ${new Date(departure?.at).toLocaleString()}`,
        `Arrival: ${new Date(arrival?.at).toLocaleString()}`,
        `Duration: ${flight.itineraries?.[0]?.duration || "N/A"}`,
        `Stops: ${flight.itineraries?.[0]?.segments?.length - 1 || 0}`,
      ],
      [],
      {
        type: "imBack",
        title: "Book This Flight",
        value: `book flight ${index}`,
      },
    )
  }
}

module.exports.FlightSearchDialog = FlightSearchDialog
