// routes/dashboard.js
const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM ward_reports");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

module.exports = router;
