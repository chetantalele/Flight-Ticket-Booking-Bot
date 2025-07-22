const { ActivityHandler, MessageFactory, CardFactory } = require("botbuilder")
const { MainDialog } = require("./dialogs/mainDialog")
const { TranslationService } = require("../services/translationService")

class FlightBookingBot extends ActivityHandler {
  constructor(conversationState, userState) {
    super()

    this.conversationState = conversationState
    this.userState = userState
    this.dialog = new MainDialog()
    this.dialogState = this.conversationState.createProperty("DialogState")
    this.translationService = new TranslationService()

    this.onMessage(async (context, next) => {
      // Detect and translate user input if needed
      const userLanguage = await this.getUserLanguage(context)
      let translatedText = context.activity.text

      if (userLanguage !== "en") {
        translatedText = await this.translationService.translateText(context.activity.text, userLanguage, "en")
      }

      // Update context with translated text
      context.activity.text = translatedText

      // Run the Dialog with the new message Activity
      await this.dialog.run(context, this.dialogState)

      await next()
    })

    this.onMembersAdded(async (context, next) => {
      const welcomeText = await this.getWelcomeMessage(context)
      for (let cnt = 0; cnt < context.activity.membersAdded.length; ++cnt) {
        if (context.activity.membersAdded[cnt].id !== context.activity.recipient.id) {
          await context.sendActivity(MessageFactory.text(welcomeText))
        }
      }
      await next()
    })
  }

  async getUserLanguage(context) {
    const userProfile = await this.userState.createProperty("UserProfile").get(context, () => ({}))
    return userProfile.language || "en"
  }

  async getWelcomeMessage(context) {
    const userLanguage = await this.getUserLanguage(context)
    const welcomeText =
      "Welcome to Flight Booking Bot! I can help you search and book flights. Type 'search flights' to get started."

    if (userLanguage !== "en") {
      return await this.translationService.translateText(welcomeText, "en", userLanguage)
    }

    return welcomeText
  }

  async run(context) {
    await super.run(context)
    await this.conversationState.saveChanges(context, false)
    await this.userState.saveChanges(context, false)
  }
}

module.exports.FlightBookingBot = FlightBookingBot
