const express = require("express");
const router = express.Router();
const db = require("../db");

// ✅ list ใช้ใน Dashboard
router.get("/cu-report/list", async (req, res) => {
  try {
    const { start, end, shift } = req.query;
    let sql = `
      SELECT 
        id, date AS report_date, shift, wardname, subward,
        echo, est, holter, tee, other,
        rn, pn, na, other_staff, rn_extra, rn_down,
        incident, head_nurse, username
      FROM cu_reports
      WHERE 1=1
    `;
    const params = [];

    if (start && end) {
      sql += " AND date BETWEEN ? AND ?";
      params.push(start, end);
    } else if (start) {
      sql += " AND date >= ?";
      params.push(start);
    } else if (end) {
      sql += " AND date <= ?";
      params.push(end);
    }

    if (shift) {
      sql += " AND shift = ?";
      params.push(shift);
    }

    sql += " ORDER BY date DESC, shift";
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("GET /cu-report/list error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ รายวัน
router.get("/cu-report", async (req, res) => {
  try {
    const { date, shift, wardname } = req.query;
    if (!date || !shift || !wardname) {
      return res.status(400).json({ message: "date, shift, wardname จำเป็น" });
    }

    const [rows] = await db.query(
      `SELECT * FROM cu_reports
       WHERE date = ? AND shift = ? AND wardname = ?
       LIMIT 1`,
      [date, shift, wardname]
    );

    if (!rows.length) return res.status(204).end();
    res.json(rows[0]);
  } catch (e) {
    console.error("GET /cu-report error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ เพิ่ม
router.post("/cu-report", async (req, res) => {
  try {
    const {
      username, wardname, subward = null, date, shift,
      echo = 0, est = 0, holter = 0, tee = 0, other = 0,
      rn = 0, pn = 0, na = 0, other_staff = 0, rn_extra = 0, rn_down = 0,
      incident = "", head_nurse = ""
    } = req.body;

    if (!username || !wardname || !date || !shift) {
      return res.status(400).json({ message: "username, wardname, date, shift จำเป็น" });
    }

    const [result] = await db.query(
      `INSERT INTO cu_reports
       (username, wardname, subward, date, shift,
        echo, est, holter, tee, other,
        rn, pn, na, other_staff, rn_extra, rn_down,
        incident, head_nurse)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, wardname, subward, date, shift,
       echo, est, holter, tee, other,
       rn, pn, na, other_staff, rn_extra, rn_down,
       incident, head_nurse]
    );

    res.status(201).json({ id: result.insertId, message: "created" });
  } catch (e) {
    console.error("POST /cu-report error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ อัปเดต
router.put("/cu-report/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      "username","wardname","subward","date","shift",
      "echo","est","holter","tee","other",
      "rn","pn","na","other_staff","rn_extra","rn_down",
      "incident","head_nurse"
    ];

    const fields = [];
    const params = [];

    for (const k of allowed) {
      if (k in req.body) {
        fields.push(`${k} = ?`);
        params.push(req.body[k]);
      }
    }

    if (!fields.length) {
      return res.status(400).json({ message: "ไม่มีฟิลด์ให้แก้ไข" });
    }

    params.push(id);
    const [result] = await db.query(
      `UPDATE cu_reports SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "ไม่พบรายการ" });
    }
    res.json({ message: "updated" });
  } catch (e) {
    console.error("PUT /cu-report/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
