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
    const hasSupward = supward !== undefined && supward !== null && supward !== "";

    const sqlCondition = hasSupward
      ? "supward = ?"
      : "(supward IS NULL OR supward = '')";

    const sql = `
      SELECT * FROM ward_reports 
      WHERE date = ? AND shift = ? AND wardname = ? AND username = ?
      AND ${sqlCondition}
      LIMIT 1
    `;

    const params = hasSupward
      ? [date, shift, wardname, username, supward]
      : [date, shift, wardname, username];

    const [rows] = await db.query(sql, params);

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

    const hasSupward = data.supward !== undefined && data.supward !== null && data.supward !== "";

    const fields = Object.keys(data).filter((key) => key !== "id");
    const values = fields.map((key) => data[key]);

    const sqlCondition = hasSupward
      ? "AND supward = ?"
      : "AND (supward IS NULL OR supward = '')";

    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const sql = `
      UPDATE ward_reports 
      SET ${setClause} 
      WHERE id = ? ${sqlCondition}
    `;

    const params = hasSupward
      ? [...values, id, data.supward]
      : [...values, id];

    await db.query(sql, params);

    res.status(200).json({ message: "อัปเดตข้อมูลสำเร็จ" });
  } catch (err) {
    res.status(500).json({ message: "Database update failed" });
  }
});

router.get("/bed-total", async (req, res) => {
  let { wardname, supward } = req.query;

  if (!wardname) return res.status(400).json({ message: "wardname required" });

  // แปลง supward: ถ้าเป็น undefined, null, หรือ empty string ให้เป็น null
  if (!supward || supward.trim() === "") {
    supward = null;
  }

  try {
    const [rows] = await db.query(
      `SELECT bed_total FROM wards
       WHERE wardname = ?
       AND (
         (supward = ?)
         OR (supward IS NULL AND ? IS NULL)
         OR (supward = '' AND ? IS NULL)
       )`,
      [wardname, supward, supward, supward]
    );

    if (rows.length === 0) return res.status(404).json({ bed_total: 0 });
    res.json({ bed_total: rows[0].bed_total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching bed total" });
  }
});






module.exports = router;
