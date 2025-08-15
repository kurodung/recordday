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
  const { date, shift, wardname, username, subward } = req.query;

  try {
    const hassubward =
      subward !== undefined && subward !== null && subward !== "";

    const sqlCondition = hassubward
      ? "subward = ?"
      : "(subward IS NULL OR subward = '')";

    const sql = `
      SELECT * FROM ward_reports 
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

router.post("/", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    const data = req.body;
    const fields = Object.keys(data).join(",");
    const placeholders = Object.keys(data)
      .map(() => "?")
      .join(",");
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

    const hassubward =
      data.subward !== undefined &&
      data.subward !== null &&
      data.subward !== "";

    const fields = Object.keys(data).filter((key) => key !== "id");
    const values = fields.map((key) => data[key]);

    const sqlCondition = hassubward
      ? "AND subward = ?"
      : "AND (subward IS NULL OR subward = '')";

    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const sql = `
      UPDATE ward_reports 
      SET ${setClause} 
      WHERE id = ? ${sqlCondition}
    `;

    const params = hassubward ? [...values, id, data.subward] : [...values, id];

    await db.query(sql, params);

    res.status(200).json({ message: "อัปเดตข้อมูลสำเร็จ" });
  } catch (err) {
    res.status(500).json({ message: "Database update failed" });
  }
});

router.get("/bed-total", async (req, res) => {
  let { wardname, subward } = req.query;

  if (!wardname) {
    return res.status(400).json({ message: "wardname required" });
  }

  // admin ไม่ใช่ ward จริง → คืน 0 เงียบ ๆ
  if (wardname.trim().toLowerCase() === "admin") {
    return res.json({ bed_total: 0 });
  }

  const hasSub = typeof subward === "string" && subward.trim() !== "";
  const cleanSub = hasSub ? subward.trim() : null;

  try {
    // รองรับทั้ง NULL และ '' ในคอลัมน์ subward
    const sql = `
      SELECT bed_total
      FROM wards
      WHERE wardname = ?
        AND (
          (? IS NULL AND (subward IS NULL OR subward = ''))
          OR subward = ?
        )
      LIMIT 1
    `;
    const params = [wardname, cleanSub, cleanSub];

    const [rows] = await db.query(sql, params);
    return res.json({ bed_total: rows?.[0]?.bed_total ?? 0 }); // ✅ 200 เสมอ
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching bed total" });
  }
});




module.exports = router;
