// routes/lrReportRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");

const toMysqlDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return date.toISOString().split("T")[0];
};

// ✅ GET ข้อมูลรายงาน lr
router.get("/", async (req, res) => {
  const { date, shift, wardname, username, subward } = req.query;

  try {
    const hassubward = subward !== undefined && subward !== null && subward !== "";

    const sqlCondition = hassubward
      ? "subward = ?"
      : "(subward IS NULL OR subward = '')";

    const sql = `
      SELECT * FROM lr_reports 
      WHERE date = ? AND shift = ? AND wardname = ? AND username = ?
      AND ${sqlCondition}
      LIMIT 1
    `;

    const params = hassubward
      ? [date, shift, wardname, username, subward]
      : [date, shift, wardname, username];

    const [rows] = await db.query(sql, params);

    if (rows.length > 0) res.json(rows[0]);
    else res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: "Database error" });
  }
});

// ✅ POST เพิ่มข้อมูลรายงาน lr
router.post("/", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    const data = req.body;

    console.log("📦 POST /api/lr-report - Received data:", data); // <<<
    
    const fields = Object.keys(data).join(",");
    const placeholders = Object.keys(data).map(() => "?").join(",");
    const values = Object.values(data);

    await db.query(
      `INSERT INTO lr_reports (${fields}) VALUES (${placeholders})`,
      values
    );

    res.status(200).json({ message: "บันทึกข้อมูลสำเร็จ" });
  } catch (err) {
    console.error("❌ POST /api/lr-report error:", err); // <<<
    res.status(500).json({ message: "Database or token error" });
  }
});


// ✅ PUT แก้ไขข้อมูลรายงาน lr
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    if (data.date) data.date = toMysqlDate(data.date);
    if (data.created_at) data.created_at = toMysqlDateTime(data.created_at);
    if (data.updated_at) data.updated_at = toMysqlDateTime(data.updated_at);

    const fields = Object.keys(data).filter((key) => key !== "id");
    const values = fields.map((key) => data[key]);

    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const sql = `
      UPDATE lr_reports 
      SET ${setClause} 
      WHERE id = ?
    `;

    const params = [...values, id];

    await db.query(sql, params);

    res.status(200).json({ message: "อัปเดตข้อมูลสำเร็จ" });
  } catch (err) {
    console.error("❌ PUT /api/lr-report error:", err);
    res.status(500).json({ message: "Database update failed", error: err.message });
  }
});

const toMysqlDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return date.toISOString().slice(0, 19).replace("T", " ");
};





module.exports = router;
