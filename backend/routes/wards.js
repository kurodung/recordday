const express = require("express");
const router = express.Router();
const db = require("../db");

// ดึง wards ทั้งหมด
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT w.*, d.department_name
      FROM wards w
      LEFT JOIN departments d ON w.department_id = d.id
      ORDER BY w.wardname
    `);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching wards:", err);
    res.status(500).json({ message: "Error fetching wards" });
  }
});

// เพิ่ม ward ใหม่
router.post("/", async (req, res) => {
  const { wardname, subward, department_id } = req.body;
  await db.query(
    "INSERT INTO wards (wardname, subward, department_id) VALUES (?, ?, ?)",
    [wardname, subward, department_id || null]
  );
  res.json({ message: "เพิ่ม Ward สำเร็จ" });
});

// ลบ ward
router.delete("/:id", async (req, res) => {
  await db.query("DELETE FROM wards WHERE id = ?", [req.params.id]);
  res.json({ message: "ลบ Ward เรียบร้อย" });
});

module.exports = router;
