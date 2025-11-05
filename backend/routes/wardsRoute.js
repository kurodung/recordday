// routes/wardsRoute.js
const express = require("express");
const router = express.Router();
const db = require("../db");

// ✅ ดึงรายชื่อ wards ทั้งหมดจากฐานข้อมูล
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, wardname, subward FROM wards ORDER BY wardname, subward"
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching wards:", err);
    res.status(500).json({ message: "Error fetching wards" });
  }
});

module.exports = router;
