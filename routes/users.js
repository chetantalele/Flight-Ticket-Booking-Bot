const express = require("express")
const router = express.Router()
const database = require("../config/database")

// Create or update user
router.post("/", async (req, res) => {
  try {
    const { userId, name, email, phone, preferredLanguage = "en" } = req.body

    const sql = `
            INSERT INTO users (user_id, name, email, phone, preferred_language)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            email = VALUES(email),
            phone = VALUES(phone),
            preferred_language = VALUES(preferred_language),
            updated_at = CURRENT_TIMESTAMP
        `

    await database.query(sql, [userId, name, email, phone, preferredLanguage])

    res.json({
      success: true,
      message: "User profile updated successfully",
    })
  } catch (error) {
    console.error("User creation/update error:", error)
    res.status(500).json({ error: "Failed to update user profile" })
  }
})

// Get user profile
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params

    const sql = "SELECT * FROM users WHERE user_id = ?"
    const [user] = await database.query(sql, [userId])

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    res.json(user)
  } catch (error) {
    console.error("Get user error:", error)
    res.status(500).json({ error: "Failed to retrieve user profile" })
  }
})

// Update user language preference
router.patch("/:userId/language", async (req, res) => {
  try {
    const { userId } = req.params
    const { language } = req.body

    const sql = `
            UPDATE users 
            SET preferred_language = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        `

    await database.query(sql, [language, userId])

    res.json({
      success: true,
      message: "Language preference updated successfully",
    })
  } catch (error) {
    console.error("Update language error:", error)
    res.status(500).json({ error: "Failed to update language preference" })
  }
})

module.exports = router
