const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");

function formatDateTime(input) {
  const date = new Date(input);
  const pad = (n) => (n < 10 ? "0" + n : n);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}


router.get("/", async (req, res) => {
  const { date, shift, wardname, username, subward } = req.query;

  try {
    const [rows] = await db.query(
      `SELECT * FROM covid_report 
       WHERE date = ? AND shift = ? AND wardname = ? AND username = ? 
       AND ${subward ? "subward = ?" : "(subward IS NULL OR subward = '')"}
       LIMIT 1`,
      subward
        ? [date, shift, wardname, username, subward]
        : [date, shift, wardname, username]
    );

    if (rows.length > 0) res.json(rows[0]);
    else res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: "Database error" });
  }
});

router.post("/", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    const data = req.body;

    const fields = Object.keys(data).join(",");
    const placeholders = Object.keys(data).map(() => "?").join(",");
    const values = Object.values(data);

    await db.query(
      `INSERT INTO covid_report (${fields}) VALUES (${placeholders})`,
      values
    );

    res.status(200).json({ message: "บันทึกข้อมูลสำเร็จ" });
  } catch (err) {
    res.status(500).json({ message: "Database or token error" });
  }
});

// PUT: แก้ไขข้อมูล covid report
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    // 🔧 แปลง format datetime ให้เป็น 'YYYY-MM-DD HH:mm:ss'
    if (body.created_at) {
      body.created_at = formatDateTime(body.created_at);
    }
    if (body.updated_at) {
      body.updated_at = formatDateTime(body.updated_at);
    } else {
      body.updated_at = formatDateTime(new Date());
    }

    const keys = Object.keys(body);
    const values = keys.map((key) => body[key]);

    const setClause = keys.map((key) => `${key} = ?`).join(', ');
    const sql = `UPDATE covid_report SET ${setClause} WHERE id = ?`;
    values.push(id);

    const [result] = await db.execute(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลที่ต้องการอัปเดต' });
    }

    res.json({ message: 'อัปเดตข้อมูลสำเร็จ' });
  } catch (error) {
    console.error('PUT /covid-report/:id error', error);
    res.status(500).json({ message: 'Database error' });
  }
});



module.exports = router;
