const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");

const toMysqlDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return date.toISOString().split("T")[0];
};

router.get("/", async (req, res) => {
  const { date, shift, wardname, username, supward } = req.query;

  try {
    const [rows] = await db.query(
      `SELECT * FROM ward_reports 
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
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    const data = req.body;
    const fields = Object.keys(data).join(",");
    const placeholders = Object.keys(data).map(() => "?").join(",");
    const values = Object.values(data);

    await db.query(
      `INSERT INTO ward_reports (${fields}) VALUES (${placeholders})`,
      values
    );
    res.status(200).json({ message: "บันทึกข้อมูลสำเร็จ" });
  } catch (err) {
    res.status(500).json({ message: "Database or token error" });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    if (data.date) data.date = toMysqlDate(data.date);
    const fields = Object.keys(data).filter((key) => key !== "id");
    const values = fields.map((key) => data[key]);
    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const sql = `
      UPDATE ward_reports 
      SET ${setClause} 
      WHERE id = ? ${data.supward ? "AND supward = ?" : "AND (supward IS NULL OR supward = '')"}
    `;

    const params = data.supward
      ? [...values, id, data.supward]
      : [...values, id];
    await db.query(sql, params);

    res.status(200).json({ message: "อัปเดตข้อมูลสำเร็จ" });
  } catch (err) {
    res.status(500).json({ message: "Database update failed" });
  }
});

module.exports = router;
