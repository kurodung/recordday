// routes/adminUsers.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcrypt");

/* ---------------------------------------------------------------------- */
/* 📋 ดึงรายชื่อ Users ทั้งหมด                                            */
/* ---------------------------------------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.username, r.role_name, w.wardname, w.subward
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN wards w ON u.ward_id = w.id
      ORDER BY u.id ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ message: "Error fetching users" });
  }
});

/* ---------------------------------------------------------------------- */
/* ➕ เพิ่ม User ใหม่                                                      */
/* ---------------------------------------------------------------------- */
router.post("/", async (req, res) => {
  try {
    const { username, password, role_id, ward_id } = req.body;
    if (!username || !password || !ward_id)
      return res.status(400).json({ message: "Missing required fields" });

    const hash = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (username, password, role_id, ward_id) VALUES (?, ?, ?, ?)",
      [username, hash, role_id || 1, ward_id]
    );

    res.json({ message: "User created successfully" });
  } catch (err) {
    console.error("Add user error:", err);
    res.status(500).json({ message: "Error creating user" });
  }
});

/* ---------------------------------------------------------------------- */
/* 🗑️ ลบ User                                                             */
/* ---------------------------------------------------------------------- */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM users WHERE id = ?", [id]);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ message: "Error deleting user" });
  }
});

/* ---------------------------------------------------------------------- */
/* ✏️ แก้ไข User (เปลี่ยน role หรือ ward)                               */
/* ---------------------------------------------------------------------- */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { role_id, ward_id, password } = req.body;

    let query = "UPDATE users SET role_id = ?, ward_id = ? WHERE id = ?";
    let params = [role_id, ward_id, id];

    if (password && password.trim() !== "") {
      const hash = await bcrypt.hash(password, 10);
      query = "UPDATE users SET role_id = ?, ward_id = ?, password = ? WHERE id = ?";
      params = [role_id, ward_id, hash, id];
    }

    await db.query(query, params);
    res.json({ message: "User updated successfully" });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ message: "Error updating user" });
  }
});

module.exports = router;
