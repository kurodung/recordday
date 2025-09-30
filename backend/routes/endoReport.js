const express = require("express");
const router = express.Router();
const db = require("../db");

// ✅ list ใช้ใน Dashboard
router.get("/endo-report/list", async (req, res) => {
  try {
    const { start, end, shift } = req.query;
    let sql = `
      SELECT 
        id, date AS report_date, shift, wardname, subward,
        complex, upgi, lowgi, chest,
        rn, pn, na, other_staff, rn_extra, rn_down,
        incident, head_nurse, username
      FROM endo_reports
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
    console.error("GET /endo-report/list error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ รายวัน
router.get("/endo-report", async (req, res) => {
  try {
    const { date, shift, wardname } = req.query;
    if (!date || !shift || !wardname) {
      return res.status(400).json({ message: "date, shift, wardname จำเป็น" });
    }

    const [rows] = await db.query(
      `SELECT * FROM endo_reports
       WHERE date = ? AND shift = ? AND wardname = ?
       LIMIT 1`,
      [date, shift, wardname]
    );

    if (!rows.length) return res.status(204).end();
    res.json(rows[0]);
  } catch (e) {
    console.error("GET /endo-report error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ เพิ่ม
router.post("/endo-report", async (req, res) => {
  try {
    const {
      username, wardname, subward = null, date, shift,
      complex = 0, upgi = 0, lowgi = 0, chest = 0,
      rn = 0, pn = 0, na = 0, other_staff = 0, rn_extra = 0, rn_down = 0,
      incident = "", head_nurse = ""
    } = req.body;

    if (!username || !wardname || !date || !shift) {
      return res.status(400).json({ message: "username, wardname, date, shift จำเป็น" });
    }

    const [result] = await db.query(
      `INSERT INTO endo_reports
       (username, wardname, subward, date, shift,
        complex, upgi, lowgi, chest,
        rn, pn, na, other_staff, rn_extra, rn_down,
        incident, head_nurse)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, wardname, subward, date, shift,
       complex, upgi, lowgi, chest,
       rn, pn, na, other_staff, rn_extra, rn_down,
       incident, head_nurse]
    );

    res.status(201).json({ id: result.insertId, message: "created" });
  } catch (e) {
    console.error("POST /endo-report error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ อัปเดต
router.put("/endo-report/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      "username","wardname","subward","date","shift",
      "complex","upgi","lowgi","chest",
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
      `UPDATE endo_reports SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "ไม่พบรายการ" });
    }
    res.json({ message: "updated" });
  } catch (e) {
    console.error("PUT /endo-report/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
