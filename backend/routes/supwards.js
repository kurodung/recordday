// routes/supwards.js
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
        `SELECT DISTINCT supward FROM wards 
         WHERE wardname = ?
         ORDER BY FIELD(supward, 'SNB', 'NICU')`,
        [user.wardname]
      );
      
  
      const supwards = rows.map((row) => row.supward);
      res.json({ supwards });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error fetching supwards" });
    }
  });
  

module.exports = router;
