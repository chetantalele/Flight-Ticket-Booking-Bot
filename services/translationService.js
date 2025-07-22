const { Translate } = require("@google-cloud/translate").v2

class TranslationService {
  constructor() {
    this.translate = new Translate({
      key: process.env.GOOGLE_TRANSLATE_API_KEY,
    })
  }

  async translateText(text, sourceLanguage, targetLanguage) {
    try {
      if (sourceLanguage === targetLanguage) {
        return text
      }

      const [translation] = await this.translate.translate(text, {
        from: sourceLanguage,
        to: targetLanguage,
      })

      return translation
    } catch (error) {
      console.error("Translation error:", error)
      // Return original text if translation fails
      return text
    }
  }

  async detectLanguage(text) {
    try {
      const [detection] = await this.translate.detect(text)
      return detection.language
    } catch (error) {
      console.error("Language detection error:", error)
      return "en" // Default to English
    }
  }

  getSupportedLanguages() {
    return {
      en: "English",
      es: "Spanish",
      fr: "French",
      de: "German",
      it: "Italian",
      pt: "Portuguese",
      ru: "Russian",
      ja: "Japanese",
      ko: "Korean",
      zh: "Chinese",
    }
  }
}

module.exports.TranslationService = TranslationService
