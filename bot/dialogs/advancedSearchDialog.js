const { ComponentDialog, WaterfallDialog, TextPrompt, ChoicePrompt, NumberPrompt } = require("botbuilder-dialogs")
const { MessageFactory } = require("botbuilder")

class AdvancedSearchDialog extends ComponentDialog {
  constructor() {
    super("AdvancedSearchDialog")

    this.addDialog(new TextPrompt("textPrompt"))
    this.addDialog(new ChoicePrompt("choicePrompt"))
    this.addDialog(new NumberPrompt("numberPrompt"))

    this.addDialog(
      new WaterfallDialog("advancedSearchDialog", [
        this.filterOptionsStep.bind(this),
        this.priceRangeStep.bind(this),
        this.airlinePreferenceStep.bind(this),
        this.durationFilterStep.bind(this),
        this.layoverFilterStep.bind(this),
        this.applyFiltersStep.bind(this),
      ]),
    )

    this.initialDialogId = "advancedSearchDialog"
  }

  async filterOptionsStep(stepContext) {
    const filterOptions = [
      "Price Range",
      "Specific Airlines",
      "Maximum Duration",
      "Number of Layovers",
      "Departure Time",
      "All Filters",
      "Skip Filters",
    ]

    return await stepContext.prompt("choicePrompt", {
      prompt: MessageFactory.text("What filters would you like to apply?"),
      choices: filterOptions,
    })
  }

  async priceRangeStep(stepContext) {
    const choice = stepContext.result.value
    stepContext.values.filterChoice = choice

    if (choice === "Price Range" || choice === "All Filters") {
      return await stepContext.prompt("textPrompt", {
        prompt: MessageFactory.text("Enter your budget range (e.g., '200-500 USD'):"),
      })
    }

    return await stepContext.next()
  }

  async airlinePreferenceStep(stepContext) {
    if (stepContext.result && typeof stepContext.result === "string") {
      stepContext.values.priceRange = stepContext.result
    }

    if (stepContext.values.filterChoice === "Specific Airlines" || stepContext.values.filterChoice === "All Filters") {
      const airlines = [
        "American Airlines",
        "Delta",
        "United",
        "Southwest",
        "JetBlue",
        "Alaska Airlines",
        "Any Airline",
      ]

      return await stepContext.prompt("choicePrompt", {
        prompt: MessageFactory.text("Which airline do you prefer?"),
        choices: airlines,
      })
    }

    return await stepContext.next()
  }

  async durationFilterStep(stepContext) {
    if (stepContext.result && stepContext.result.value) {
      stepContext.values.preferredAirline = stepContext.result.value
    }

    if (stepContext.values.filterChoice === "Maximum Duration" || stepContext.values.filterChoice === "All Filters") {
      return await stepContext.prompt("numberPrompt", {
        prompt: MessageFactory.text("Maximum flight duration in hours (e.g., 8):"),
        retryPrompt: MessageFactory.text("Please enter a valid number of hours."),
      })
    }

    return await stepContext.next()
  }

  async layoverFilterStep(stepContext) {
    if (stepContext.result) {
      stepContext.values.maxDuration = stepContext.result
    }

    if (stepContext.values.filterChoice === "Number of Layovers" || stepContext.values.filterChoice === "All Filters") {
      const layoverOptions = ["Direct flights only", "1 layover max", "2 layovers max", "Any number of layovers"]

      return await stepContext.prompt("choicePrompt", {
        prompt: MessageFactory.text("How many layovers are acceptable?"),
        choices: layoverOptions,
      })
    }

    return await stepContext.next()
  }

  async applyFiltersStep(stepContext) {
    if (stepContext.result && stepContext.result.value) {
      stepContext.values.layoverPreference = stepContext.result.value
    }

    // Apply filters to search results
    const filters = {
      priceRange: stepContext.values.priceRange,
      airline: stepContext.values.preferredAirline,
      maxDuration: stepContext.values.maxDuration,
      layovers: stepContext.values.layoverPreference,
    }

    // This would filter the existing search results
    const filteredResults = await this.applySearchFilters(stepContext.options.searchResults, filters)

    await stepContext.context.sendActivity(
      MessageFactory.text(`Applied filters. Found ${filteredResults.length} flights matching your criteria.`),
    )

    return await stepContext.endDialog(filteredResults)
  }

  async applySearchFilters(flights, filters) {
    let filtered = [...flights]

    // Filter by price range
    if (filters.priceRange) {
      const [minPrice, maxPrice] = this.parsePriceRange(filters.priceRange)
      filtered = filtered.filter((flight) => {
        const price = Number.parseFloat(flight.price?.total || 0)
        return price >= minPrice && price <= maxPrice
      })
    }

    // Filter by airline
    if (filters.airline && filters.airline !== "Any Airline") {
      filtered = filtered.filter((flight) => {
        const airline = flight.itineraries?.[0]?.segments?.[0]?.carrierCode
        return airline === this.getAirlineCode(filters.airline)
      })
    }

    // Filter by duration
    if (filters.maxDuration) {
      filtered = filtered.filter((flight) => {
        const duration = this.parseDuration(flight.itineraries?.[0]?.duration)
        return duration <= filters.maxDuration
      })
    }

    // Filter by layovers
    if (filters.layovers) {
      filtered = filtered.filter((flight) => {
        const segments = flight.itineraries?.[0]?.segments?.length || 0
        const layovers = segments - 1

        switch (filters.layovers) {
          case "Direct flights only":
            return layovers === 0
          case "1 layover max":
            return layovers <= 1
          case "2 layovers max":
            return layovers <= 2
          default:
            return true
        }
      })
    }

    return filtered
  }

  parsePriceRange(priceRange) {
    const match = priceRange.match(/(\d+)-(\d+)/)
    if (match) {
      return [Number.parseInt(match[1]), Number.parseInt(match[2])]
    }
    return [0, 999999]
  }

  getAirlineCode(airlineName) {
    const codes = {
      "American Airlines": "AA",
      Delta: "DL",
      United: "UA",
      Southwest: "WN",
      JetBlue: "B6",
      "Alaska Airlines": "AS",
    }
    return codes[airlineName] || airlineName
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

module.exports.AdvancedSearchDialog = AdvancedSearchDialog
