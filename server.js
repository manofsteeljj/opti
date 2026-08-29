require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const { pool, initializeDatabase } = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

app.use(express.json());

function generateLicense() {
    function part() {
        return crypto.randomBytes(3).toString("hex").toUpperCase();
    }

    return `REMMM-${part()}-${part()}-${part()}`;
}

function adminOnly(req, res, next) {
    if (!req.headers["x-admin-secret"] || req.headers["x-admin-secret"] !== ADMIN_SECRET) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    next();
}

function databaseError(res, error) {
    console.error(error);
    return res.status(500).json({
        success: false,
        message: "License database error"
    });
}

app.get("/", (req, res) => {
    res.json({ service: "REMMM License API", status: "online" });
});

app.post("/api/admin/licenses", adminOnly, async (req, res) => {
    const {
        discord_id = null,
        max_activations = 1,
        expires_at = null
    } = req.body;

    try {
        const result = await pool.query(`
            INSERT INTO licenses (license_key, discord_id, max_activations, expires_at)
            VALUES ($1, $2, $3, $4)
            RETURNING license_key
        `, [generateLicense(), discord_id, max_activations, expires_at]);

        return res.json({ success: true, license: result.rows[0].license_key });
    } catch (error) {
        return databaseError(res, error);
    }
});

app.get("/api/admin/licenses/:license", adminOnly, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM licenses WHERE license_key = $1",
            [req.params.license]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "License not found" });
        }

        return res.json({ success: true, license: result.rows[0] });
    } catch (error) {
        return databaseError(res, error);
    }
});

async function setLicenseStatus(req, res, status) {
    try {
        const result = await pool.query(
            "UPDATE licenses SET status = $1 WHERE license_key = $2",
            [status, req.params.license]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "License not found" });
        }

        return res.json({
            success: true,
            message: status === "active" ? "License reactivated" : "License revoked"
        });
    } catch (error) {
        return databaseError(res, error);
    }
}

app.post("/api/admin/licenses/:license/revoke", adminOnly, (req, res) => {
    setLicenseStatus(req, res, "revoked");
});

app.post("/api/admin/licenses/:license/reactivate", adminOnly, (req, res) => {
    setLicenseStatus(req, res, "active");
});

app.post("/api/admin/licenses/:license/reset", adminOnly, async (req, res) => {
    try {
        const result = await pool.query(`
            UPDATE licenses
            SET machine_id = NULL, activation_count = 0
            WHERE license_key = $1
        `, [req.params.license]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "License not found" });
        }

        return res.json({ success: true, message: "Device activation reset" });
    } catch (error) {
        return databaseError(res, error);
    }
});

app.post("/api/license/activate", async (req, res) => {
    const { license, machine_id } = req.body;

    if (!license || !machine_id) {
        return res.status(400).json({ valid: false, message: "Missing license or machine ID" });
    }

    try {
        const result = await pool.query(
            "SELECT * FROM licenses WHERE license_key = $1",
            [license]
        );
        const row = result.rows[0];

        if (!row) {
            return res.json({ valid: false, message: "Invalid license" });
        }

        if (row.status !== "active") {
            return res.json({ valid: false, message: "License is not active" });
        }

        if (row.expires_at && Date.now() > new Date(row.expires_at).getTime()) {
            return res.json({ valid: false, message: "License expired" });
        }

        if (row.machine_id && row.machine_id !== machine_id) {
            return res.json({
                valid: false,
                message: "License already activated on another device"
            });
        }

        if (!row.machine_id) {
            const activation = await pool.query(`
                UPDATE licenses
                SET machine_id = $1, activation_count = activation_count + 1
                WHERE license_key = $2 AND machine_id IS NULL
            `, [machine_id, license]);

            if (activation.rowCount === 0) {
                return res.json({
                    valid: false,
                    message: "License activated on another device"
                });
            }
        }

        return res.json({
            valid: true,
            message: row.machine_id ? "License valid" : "License activated",
            expires_at: row.expires_at
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ valid: false, message: "License database error" });
    }
});

initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`REMMM License API listening on port ${PORT}`);
        });
    })
    .catch(error => {
        console.error("Could not initialize license database", error);
        process.exit(1);
    });
