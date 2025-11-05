const express = require("express");
const router = express.Router();
const db = require("../db");

// ดึง departments ทั้งหมด
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id, department_name
      FROM departments
      ORDER BY department_name
    `);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching departments:", err);
    res.status(500).json({ message: "Error fetching departments" });
  }
});

// เพิ่ม department ใหม่
router.post("/", async (req, res) => {
  const { department_name } = req.body;
  await db.query("INSERT INTO departments (department_name) VALUES (?)", [
    department_name,
  ]);
  res.json({ message: "เพิ่ม Department สำเร็จ" });
});

// ลบ department
router.delete("/:id", async (req, res) => {
  await db.query("DELETE FROM departments WHERE id = ?", [req.params.id]);
  res.json({ message: "ลบ Department เรียบร้อย" });
});

module.exports = router;
