const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// POST: สมัครสมาชิก
router.post("/register", async (req, res) => {
  const { username, password, wardname } = req.body;

  try {
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (username, password, wardname) VALUES (?, ?, ?)",
      [username, hash, wardname]
    );
    res.status(201).json({ message: "User registered" });
  } catch (err) {
    console.error("Register error:", err);
    res
      .status(400)
      .json({ message: "Username already exists or database error" });
  }
});

// POST: เข้าสู่ระบบ
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);
    const user = rows[0];
    if (!user) return res.status(401).json({ message: "คุณกรอก user หรือ password ไม่ถูกต้อง" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "คุณกรอก user หรือ password ไม่ถูกต้อง" });

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        wardname: user.wardname,
      },
      process.env.JWT_SECRET,
      { expiresIn: "10h" }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET: ตรวจสอบ token
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
