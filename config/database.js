const mysql = require("mysql2/promise")

class Database {
  constructor() {
    this.config = {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    }
    this.pool = null
  }

  async connect() {
    try {
      this.pool = mysql.createPool(this.config)
      console.log("Database connected successfully")
      return this.pool
    } catch (error) {
      console.error("Database connection error:", error)
      throw error
    }
  }

  async query(sql, params = []) {
    try {
      if (!this.pool) {
        await this.connect()
      }
      const [results] = await this.pool.execute(sql, params)
      return results
    } catch (error) {
      console.error("Database query error:", error)
      throw error
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end()
      console.log("Database connection closed")
    }
  }
}

module.exports = new Database()
