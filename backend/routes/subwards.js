// routes/subwards.js
const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/", async (req, res) => {
  const { username } = req.query;
  if (!username)
    return res.status(400).json({ message: "username query param is required" });

  try {
    // ✅ หาว่า user คนนี้มี ward ไหนบ้าง จาก user_wards
    const [rows] = await db.query(`
      SELECT DISTINCT w.subward
      FROM user_wards uw
      JOIN users u ON uw.user_id = u.id
      JOIN wards w ON uw.ward_id = w.id
      WHERE u.username = ?
      AND w.subward IS NOT NULL
      ORDER BY w.id ASC
    `, [username]);

    const subwards = rows.map(r => r.subward);
    if (subwards.length === 0) {
      // fallback: กรณี user มี ward_id เดียว
      const [fallback] = await db.query(`
        SELECT DISTINCT w.subward
        FROM users u
        JOIN wards w ON u.ward_id = w.id
        WHERE u.username = ?
        AND w.subward IS NOT NULL
      `, [username]);
      return res.json({ subwards: fallback.map(f => f.subward) });
    }

    res.json({ subwards });
  } catch (err) {
    console.error("Error fetching subwards:", err);
    res.status(500).json({ message: "Error fetching subwards" });
  }
});

module.exports = router;
