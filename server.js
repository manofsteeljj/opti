require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const db = require("./database");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

// ------------------------------------------
// Helpers
// ------------------------------------------

function generateLicense() {
    function part() {
        return crypto
            .randomBytes(3)
            .toString("hex")
            .toUpperCase();
    }

    return `REMMM-${part()}-${part()}-${part()}`;
}

function generateMachineId(input) {
    return crypto
        .createHash("sha256")
        .update(input)
        .digest("hex");
}

// ------------------------------------------
// Health check
// ------------------------------------------

app.get("/", (req, res) => {
    res.json({
        service: "REMMM License API",
        status: "online"
    });
});

// ------------------------------------------
// Admin authentication middleware
// ------------------------------------------

function adminOnly(req, res, next) {

    const secret = req.headers["x-admin-secret"];

    if (!secret || secret !== ADMIN_SECRET) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }

    next();
}

// ------------------------------------------
// CREATE LICENSE
// ------------------------------------------

app.post("/api/admin/licenses", adminOnly, (req, res) => {

    const {
        discord_id = null,
        max_activations = 1,
        expires_at = null
    } = req.body;

    let license;

    while (true) {

        license = generateLicense();

        try {

            db.prepare(`
                INSERT INTO licenses (
                    license_key,
                    discord_id,
                    max_activations,
                    expires_at
                )
                VALUES (?, ?, ?, ?)
            `).run(
                license,
                discord_id,
                max_activations,
                expires_at
            );

            break;

        } catch (error) {

            if (!error.message.includes("UNIQUE")) {
                throw error;
            }
        }
    }

    res.json({
        success: true,
        license
    });
});

// ------------------------------------------
// LICENSE INFO
// ------------------------------------------

app.get("/api/admin/licenses/:license", adminOnly, (req, res) => {

    const license = db.prepare(`
        SELECT *
        FROM licenses
        WHERE license_key = ?
    `).get(req.params.license);

    if (!license) {
        return res.status(404).json({
            success: false,
            message: "License not found"
        });
    }

    res.json({
        success: true,
        license
    });
});

// ------------------------------------------
// REVOKE LICENSE
// ------------------------------------------

app.post(
    "/api/admin/licenses/:license/revoke",
    adminOnly,
    (req, res) => {

        const result = db.prepare(`
            UPDATE licenses
            SET status = 'revoked'
            WHERE license_key = ?
        `).run(req.params.license);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "License not found"
            });
        }

        res.json({
            success: true,
            message: "License revoked"
        });
    }
);

// ------------------------------------------
// REACTIVATE LICENSE
// ------------------------------------------

app.post(
    "/api/admin/licenses/:license/reactivate",
    adminOnly,
    (req, res) => {

        const result = db.prepare(`
            UPDATE licenses
            SET status = 'active'
            WHERE license_key = ?
        `).run(req.params.license);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "License not found"
            });
        }

        res.json({
            success: true,
            message: "License reactivated"
        });
    }
);

// ------------------------------------------
// RESET DEVICE
// ------------------------------------------

app.post(
    "/api/admin/licenses/:license/reset",
    adminOnly,
    (req, res) => {

        const result = db.prepare(`
            UPDATE licenses
            SET machine_id = NULL,
                activation_count = 0
            WHERE license_key = ?
        `).run(req.params.license);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "License not found"
            });
        }

        res.json({
            success: true,
            message: "Device activation reset"
        });
    }
);

// ------------------------------------------
// ACTIVATE LICENSE
// ------------------------------------------

app.post("/api/license/activate", (req, res) => {

    const {
        license,
        machine_id
    } = req.body;

    if (!license || !machine_id) {

        return res.status(400).json({
            valid: false,
            message: "Missing license or machine ID"
        });
    }

    const row = db.prepare(`
        SELECT *
        FROM licenses
        WHERE license_key = ?
    `).get(license);

    if (!row) {

        return res.json({
            valid: false,
            message: "Invalid license"
        });
    }

    if (row.status !== "active") {

        return res.json({
            valid: false,
            message: "License is not active"
        });
    }

    // Check expiration
    if (row.expires_at) {

        const expiry = new Date(row.expires_at);

        if (Date.now() > expiry.getTime()) {

            return res.json({
                valid: false,
                message: "License expired"
            });
        }
    }

    // Already activated
    if (row.machine_id) {

        if (row.machine_id === machine_id) {

            return res.json({
                valid: true,
                message: "License valid",
                expires_at: row.expires_at
            });

        }

        return res.json({
            valid: false,
            message: "License already activated on another device"
        });
    }

    // First activation
    db.prepare(`
        UPDATE licenses
        SET machine_id = ?,
            activation_count = activation_count + 1
        WHERE license_key = ?
    `).run(
        machine_id,
        license
    );

    return res.json({
        valid: true,
        message: "License activated",
        expires_at: row.expires_at
    });
});

// ------------------------------------------
// START
// ------------------------------------------

app.listen(PORT, () => {

    console.log(`
=================================
 REMMM LICENSE API
=================================

Server:
http://localhost:${PORT}

Status:
ONLINE
`);
});