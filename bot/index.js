const restify = require("restify")
const { BotFrameworkAdapter, ConversationState, MemoryStorage, UserState } = require("botbuilder")
const { FlightBookingBot } = require("./bot")
require("dotenv").config()

// Create HTTP server
const server = restify.createServer()
server.use(restify.plugins.bodyParser())

// Create adapter
const adapter = new BotFrameworkAdapter({
  appId: process.env.MICROSOFT_APP_ID,
  appPassword: process.env.MICROSOFT_APP_PASSWORD,
})

// Error handler
adapter.onTurnError = async (context, error) => {
  console.error(`\n [onTurnError] unhandled error: ${error}`)
  await context.sendActivity("Sorry, an error occurred. Please try again.")
}

// Create conversation and user state
const memoryStorage = new MemoryStorage()
const conversationState = new ConversationState(memoryStorage)
const userState = new UserState(memoryStorage)

// Create the main dialog
const bot = new FlightBookingBot(conversationState, userState)

// Listen for incoming requests
server.post("/api/messages", async (req, res) => {
  await adapter.process(req, res, (context) => bot.run(context))
})

const PORT = process.env.BOT_PORT || 3978
server.listen(PORT, () => {
  console.log(`Bot server running on port ${PORT}`)
  console.log(`Bot endpoint: http://localhost:${PORT}/api/messages`)
})
