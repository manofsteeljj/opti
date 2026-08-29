const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false
});

async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS licenses (
            id SERIAL PRIMARY KEY,
            license_key TEXT UNIQUE NOT NULL,
            discord_id TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            machine_id TEXT,
            activation_count INTEGER NOT NULL DEFAULT 0,
            max_activations INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMPTZ
        )
    `);
}

module.exports = { pool, initializeDatabase };