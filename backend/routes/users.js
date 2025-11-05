// routes/users.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcrypt");

/* ----------------------- 🧍 ผู้ใช้งาน ----------------------- */
// ดึงรายชื่อผู้ใช้ทั้งหมด
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        u.*, 
        r.role_name, 
        w.wardname, 
        w.subward, 
        d.department_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN wards w ON u.ward_id = w.id
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY u.id DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching users:", err);
    res.status(500).json({ message: "ดึงข้อมูลผู้ใช้ล้มเหลว" });
  }
});

// เพิ่มผู้ใช้ใหม่
router.post("/", async (req, res) => {
  try {
    const { username, password, role_id, ward_id, department_id } = req.body;
    if (!username || !password)
      return res
        .status(400)
        .json({ message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" });

    const hashed = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (username, password, role_id, ward_id, department_id) VALUES (?, ?, ?, ?, ?)",
      [username, hashed, role_id, ward_id, department_id]
    );

    res.json({ message: "เพิ่มผู้ใช้สำเร็จ" });
  } catch (err) {
    console.error("❌ Add user error:", err);
    res.status(500).json({ message: "ไม่สามารถเพิ่มผู้ใช้ได้" });
  }
});

// ลบผู้ใช้ (พร้อมลบสิทธิ์ก่อน)
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    // 🧹 ลบสิทธิ์ก่อน (กัน foreign key error)
    await db.query("DELETE FROM user_wards WHERE user_id = ?", [userId]);

    // 🧍‍♂️ ลบผู้ใช้
    await db.query("DELETE FROM users WHERE id = ?", [userId]);

    res.json({ message: "ลบผู้ใช้เรียบร้อย" });
  } catch (err) {
    console.error("❌ Delete user error:", err);
    res.status(500).json({ message: "ไม่สามารถลบผู้ใช้ได้" });
  }
});

/* ----------------------- 🔐 สิทธิ์ user_wards ----------------------- */

// ดึงสิทธิ์ทั้งหมดของผู้ใช้
router.get("/:user_id/wards", async (req, res) => {
  try {
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
  } catch (err) {
    console.error("❌ Fetch user wards error:", err);
    res.status(500).json({ message: "ไม่สามารถโหลดสิทธิ์ผู้ใช้ได้" });
  }
});

// เพิ่มสิทธิ์ ward ให้ผู้ใช้
router.post("/:user_id/wards", async (req, res) => {
  try {
    const { user_id } = req.params;
    const { ward_id } = req.body;

    if (!user_id || !ward_id)
      return res.status(400).json({ message: "ข้อมูลไม่ครบ" });

    // ตรวจว่ามีอยู่แล้วหรือไม่
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
  } catch (err) {
    console.error("❌ Add user ward error:", err);
    res.status(500).json({ message: "ไม่สามารถเพิ่มสิทธิ์ได้" });
  }
});

// ลบสิทธิ์ ward ของผู้ใช้
router.delete("/wards/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM user_wards WHERE id = ?", [req.params.id]);
    res.json({ message: "ลบสิทธิ์เรียบร้อย" });
  } catch (err) {
    console.error("❌ Delete user ward error:", err);
    res.status(500).json({ message: "ไม่สามารถลบสิทธิ์ได้" });
  }
});

module.exports = router;
