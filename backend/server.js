const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const db = require("./db"); // ✅ ใช้ mysql2/promise version
const app = express();
app.use(cors());
app.use(express.json());

const toMysqlDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return date.toISOString().split("T")[0]; // 'YYYY-MM-DD'
};

// PUT: อัปเดตข้อมูล ward report
app.put("/api/hospital/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    if (data.date) {
      data.date = toMysqlDate(data.date);
    }

    const fields = Object.keys(data).filter((key) => key !== "id");
    const values = fields.map((key) => data[key]);
    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const sql = `
  UPDATE ward_reports 
  SET ${setClause} 
  WHERE id = ? ${
    data.supward ? "AND supward = ?" : "AND (supward IS NULL OR supward = '')"
  }
`;

    const params = data.supward
      ? [...values, id, data.supward]
      : [...values, id];
    await db.query(sql, params);

    res.status(200).json({ message: "อัปเดตข้อมูลสำเร็จ" });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ message: "Database update failed" });
  }
});

// GET: ดึงข้อมูล ward report
app.get("/api/ward-report", async (req, res) => {
  const { date, shift, wardname, username, supward } = req.query;

  try {
    let rows;
    if (supward) {
      // ถ้ามี supward
      [rows] = await db.query(
        `SELECT * FROM ward_reports 
         WHERE date = ? AND shift = ? AND wardname = ? AND username = ? AND supward = ?
         LIMIT 1`,
        [date, shift, wardname, username, supward]
      );
    } else {
      // ถ้าไม่มี supward
      [rows] = await db.query(
        `SELECT * FROM ward_reports 
         WHERE date = ? AND shift = ? AND wardname = ? AND username = ? AND (supward IS NULL OR supward = '')
         LIMIT 1`,
        [date, shift, wardname, username]
      );
    }

    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(204).send(); // no content
    }
  } catch (err) {
    console.error("Ward report error:", err);
    res.status(500).json({ error: err.message || "Database error" });
  }
});

// POST: บันทึกข้อมูลใหม่
app.post("/api/ward-report", async (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const data = req.body;

    const fields = Object.keys(data).join(",");
    const placeholders = Object.keys(data)
      .map(() => "?")
      .join(",");
    const values = Object.values(data);

    const sql = `INSERT INTO ward_reports (${fields}) VALUES (${placeholders})`;
    await db.query(sql, values);

    res.status(200).json({ message: "บันทึกข้อมูลสำเร็จ" });
  } catch (err) {
    console.error("Ward report error:", err);
    res.status(500).json({ message: "Database or token error" });
  }
});

// POST: สมัครสมาชิก
app.post("/register", async (req, res) => {
  const { username, password, wardname } = req.body;
  console.log("Trying to register:", username);

  const hash = await bcrypt.hash(password, 10);
  try {
    const [result] = await db.query(
      "INSERT INTO users (username, password, wardname) VALUES (?, ?, ?)",
      [username, hash, wardname]
    );
    console.log("User inserted");
    res.status(201).json({ message: "User registered" });
  } catch (err) {
    console.error("Register error:", err);
    res
      .status(400)
      .json({ message: "Username already exists or database error" });
  }
});

// POST: เข้าสู่ระบบ
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);
    const user = rows[0];

    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

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
    console.error("Login error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET: ตรวจสอบ token
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
