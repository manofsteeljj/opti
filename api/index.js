const express = require("express");

const app = express();

app.use(express.json());

// ==========================================
// TEST
// ==========================================

app.get("/", (req, res) => {
    res.json({
        service: "REMMM License API",
        status: "online"
    });
});

// ==========================================
// API TEST
// ==========================================

app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "REMMM License API is working!"
    });
});

// ==========================================
// LICENSE ACTIVATION
// ==========================================

app.post("/api/license/activate", (req, res) => {

    const {
        license,
        machine_id
    } = req.body;

    console.log("License activation request:");
    console.log({
        license,
        machine_id
    });

    if (!license || !machine_id) {
        return res.status(400).json({
            valid: false,
            message: "Missing license or machine ID"
        });
    }

    // TEMPORARY TEST LICENSE
    if (license === "REMMM-TEST-1234-5678") {

        return res.json({
            valid: true,
            message: "License valid"
        });
    }

    return res.json({
        valid: false,
        message: "Invalid license"
    });
});

module.exports = app;