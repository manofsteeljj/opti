const Database = require("better-sqlite3");

const db = new Database("licenses.db");

db.pragma("journal_mode = WAL");

db.exec(`
    CREATE TABLE IF NOT EXISTS licenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        license_key TEXT UNIQUE NOT NULL,

        discord_id TEXT,

        status TEXT NOT NULL DEFAULT 'active',

        machine_id TEXT,

        activation_count INTEGER NOT NULL DEFAULT 0,

        max_activations INTEGER NOT NULL DEFAULT 1,

        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        expires_at TEXT
    );
`);

module.exports = db;