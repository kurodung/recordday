const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");

function formatDateTime(date) {
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
}

router.get("/", async (req, res) => {
  const { date, shift, wardname, username, supward } = req.query;

  try {
    const [rows] = await db.query(
      `SELECT * FROM dengue_reports 
       WHERE date = ? AND shift = ? AND wardname = ? AND username = ? 
       AND ${supward ? "supward = ?" : "(supward IS NULL OR supward = '')"}
       LIMIT 1`,
      supward
        ? [date, shift, wardname, username, supward]
        : [date, shift, wardname, username]
    );

    if (rows.length > 0) res.json(rows[0]);
    else res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: "Database error" });
  }
});

router.post("/", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    const data = req.body;

    const fields = Object.keys(data).join(", ");
    const placeholders = Object.keys(data).map(() => "?").join(", ");
    const values = Object.values(data);

    await db.query(
      `INSERT INTO dengue_reports (${fields}) VALUES (${placeholders})`,
      values
    );

    res.status(200).json({ message: "บันทึกสำเร็จ" });
  } catch (err) {
    res.status(500).json({ message: "Database or token error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    if (body.created_at) {
      body.created_at = formatDateTime(body.created_at);
    }
    if (body.updated_at) {
      body.updated_at = formatDateTime(body.updated_at);
    } else {
      body.updated_at = formatDateTime(new Date());
    }

    const keys = Object.keys(body);
    const values = keys.map((key) => body[key]);

    const setClause = keys.map((key) => `${key} = ?`).join(', ');

    const sql = `UPDATE dengue_reports SET ${setClause} WHERE id = ?`;
    values.push(id);

    const [result] = await db.execute(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Not found' });
    }

    res.json({ message: 'Update success' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
