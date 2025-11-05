const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// POST: สมัครสมาชิก (อัปเดตให้รองรับ schema ใหม่)
router.post("/register", async (req, res) => {
  // รับ ward_id แทน wardname
  const { username, password, ward_id } = req.body;

  try {
    const hash = await bcrypt.hash(password, 10);

    // role_id = 1 (User) เป็นค่าเริ่มต้น
    await db.query(
      "INSERT INTO users (username, password, role_id, ward_id) VALUES (?, ?, 1, ?)",
      [username, hash, ward_id]
    );
    res.status(201).json({ message: "User registered" });
  } catch (err) {
    console.error("Register error:", err);
    res
      .status(400)
      .json({ message: "Username already exists or database error" });
  }
});

// POST: เข้าสู่ระบบ (อัปเดต query และ token)
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // ✅ อัปเดต SQL Query:
    // เรา JOIN ตาราง roles และ wards เพื่อดึงข้อมูลสิทธิ์ทั้งหมด
    const [rows] = await db.query(
      `SELECT 
         u.id, u.username, u.password,
         u.role_id, u.ward_id, u.department_id,
         r.role_name,
         w.wardname, w.subward, w.department_id AS ward_department_id
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN wards w ON u.ward_id = w.id
       WHERE u.username = ?`,
      [username]
    );

    const user = rows[0];
    if (!user) {
      return res
        .status(401)
        .json({ message: "คุณกรอก user หรือ password ไม่ถูกต้อง" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res
        .status(401)
        .json({ message: "คุณกรอก user หรือ password ไม่ถูกต้อง" });
    }

    // ✅ สร้าง Token (JWT) ที่มีข้อมูลสิทธิ์ใหม่
    // ข้อมูลเหล่านี้จะถูกส่งไปให้ Frontend
    // ✅ สร้าง Token (JWT) ที่มีข้อมูลสิทธิ์ใหม่
    const userInfo = {
      id: user.id,
      username: user.username,
      role: user.role_name, // เช่น 'User', 'Admin', 'HeadNurse'

      ward_id: user.ward_id, // ✅ เปลี่ยนเป็น snake_case
      wardname: user.wardname, // ✅ ให้ตรงกับ dashboard.js
      subward: user.subward, // ✅ เหมือนใน v_reports_unified
      department_id: user.department_id, // ✅ ตรงกับ database
      ward_department_id: user.ward_department_id, // ✅ เผื่อใช้ในอนาคต
    };

    const token = jwt.sign(userInfo, process.env.JWT_SECRET, {
      expiresIn: "10h",
    });

    res.json({ token });
  } catch (err) {
    console.error("Login error:", err); // แสดง error ใน console
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET: ตรวจสอบ token (ไม่ต้องแก้ไข)
router.get("/profile", (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    res.json(user);
  });
});

module.exports = router;
