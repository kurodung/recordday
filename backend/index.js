const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const db = require("./db");
const app = express();
app.use(cors());
app.use(express.json());

// สมัครสมาชิก
app.post("/register", async (req, res) => {
  const { username, password, wardname} = req.body;
  console.log("Trying to register:", username); // ✅ log

  const hash = await bcrypt.hash(password, 10);
  try {
    const result = await db.query(
      "INSERT INTO users (username, password, wardname) VALUES ($1, $2, $3)",
      [username, hash, wardname]
    );
    console.log("User inserted"); // ✅ log
    res.status(201).json({ message: "User registered" });
  } catch (err) {
    console.error("Register error:", err); // ✅ log actual error
    res.status(400).json({ error: "Username already exists" });
  }
});

// เข้าสู่ระบบ
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const userResult = await db.query("SELECT * FROM users WHERE username = $1", [
    username,
  ]);
  const user = userResult.rows[0];

  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      wardname: user.wardname,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
  res.json({ token });
});

// ตรวจสอบ Token
app.get("/profile", (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    res.json(user);
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
