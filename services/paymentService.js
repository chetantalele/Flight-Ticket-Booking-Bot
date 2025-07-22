const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)

class PaymentService {
  constructor() {
    this.stripe = stripe
  }

  async createPaymentIntent(amount, currency = "usd", metadata = {}) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      })

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      }
    } catch (error) {
      console.error("Payment intent creation error:", error)
      throw new Error("Failed to create payment intent")
    }
  }

  async confirmPayment(paymentIntentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId)
      return {
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
      }
    } catch (error) {
      console.error("Payment confirmation error:", error)
      throw new Error("Failed to confirm payment")
    }
  }

  async refundPayment(paymentIntentId, amount = null) {
    try {
      const refundData = { payment_intent: paymentIntentId }
      if (amount) {
        refundData.amount = Math.round(amount * 100)
      }

      const refund = await this.stripe.refunds.create(refundData)
      return {
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount,
        currency: refund.currency,
      }
    } catch (error) {
      console.error("Refund error:", error)
      throw new Error("Failed to process refund")
    }
  }

  generatePaymentLink(clientSecret, returnUrl) {
    return `${process.env.APP_BASE_URL}/payment?payment_intent_client_secret=${clientSecret}&return_url=${encodeURIComponent(returnUrl)}`
  }
}

module.exports.PaymentService = PaymentService
