// routes/admin/users.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcrypt");

/* ----------------------- 🧍 ผู้ใช้งาน ----------------------- */
router.get("/", async (req, res) => {
  const [rows] = await db.query(`
    SELECT u.*, r.role_name, w.wardname, w.subward, d.department_name
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN wards w ON u.ward_id = w.id
    LEFT JOIN departments d ON u.department_id = d.id
    ORDER BY u.id DESC
  `);
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { username, password, role_id, ward_id, department_id } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" });

  const hashed = await bcrypt.hash(password, 10);
  await db.query(
    "INSERT INTO users (username, password, role_id, ward_id, department_id) VALUES (?, ?, ?, ?, ?)",
    [username, hashed, role_id, ward_id, department_id]
  );
  res.json({ message: "เพิ่มผู้ใช้สำเร็จ" });
});

router.delete("/:id", async (req, res) => {
  await db.query("DELETE FROM users WHERE id = ?", [req.params.id]);
  res.json({ message: "ลบผู้ใช้เรียบร้อย" });
});

/* ----------------------- 🔐 สิทธิ์ user_wards ----------------------- */
router.get("/:user_id/wards", async (req, res) => {
  const { user_id } = req.params;
  const [rows] = await db.query(
    `
    SELECT uw.id, w.wardname, w.subward
    FROM user_wards uw
    JOIN wards w ON uw.ward_id = w.id
    WHERE uw.user_id = ?
    ORDER BY w.wardname
    `,
    [user_id]
  );
  res.json(rows);
});

router.post("/:user_id/wards", async (req, res) => {
  const { user_id } = req.params;
  const { ward_id } = req.body;

  const [exist] = await db.query(
    "SELECT id FROM user_wards WHERE user_id = ? AND ward_id = ?",
    [user_id, ward_id]
  );
  if (exist.length > 0)
    return res.status(400).json({ message: "สิทธิ์นี้มีอยู่แล้ว" });

  await db.query("INSERT INTO user_wards (user_id, ward_id) VALUES (?, ?)", [
    user_id,
    ward_id,
  ]);
  res.json({ message: "เพิ่มสิทธิ์สำเร็จ" });
});

router.delete("/wards/:id", async (req, res) => {
  await db.query("DELETE FROM user_wards WHERE id = ?", [req.params.id]);
  res.json({ message: "ลบสิทธิ์เรียบร้อย" });
});

module.exports = router;
