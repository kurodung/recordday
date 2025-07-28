// routes/subwards.js
const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/", async (req, res) => {
    const { username } = req.query;
  
    if (!username) {
      return res.status(400).json({ message: "username query param is required" });
    }
  
    try {
      const [[user]] = await db.query(
        "SELECT wardname FROM users WHERE username = ?",
        [username]
      );
  
      if (!user) return res.status(404).json({ message: "User not found" });
  
      const [rows] = await db.query(
        `SELECT DISTINCT subward FROM wards 
         WHERE wardname = ?
         ORDER BY FIELD(subward, 'SNB', 'NICU')`,
        [user.wardname]
      );
      
  
      const subwards = rows.map((row) => row.subward);
      res.json({ subwards });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error fetching subwards" });
    }
  });
  

module.exports = router;
