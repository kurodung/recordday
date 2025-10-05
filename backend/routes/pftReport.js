// routes/pftReport.js
const express = require("express");
const router = express.Router();
const db = require("../db");

/* ---------------------- 📊 ใช้ใน Dashboard ---------------------- */
router.get("/pft-report/list", async (req, res) => {
  try {
    const { start, end, shift } = req.query;
    let sql = `
      SELECT 
        id, date AS report_date, shift, wardname, subward,
        opd, spiro,
        rn, pn, na, other_staff, rn_extra, rn_down,
        incident, head_nurse, username
      FROM pft_reports
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
    res.json(rows || []); // ✅ ส่ง [] แทน 204 ป้องกัน error frontend
  } catch (e) {
    console.error("GET /pft-report/list error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------------- 📅 รายวัน ---------------------- */
router.get("/pft-report", async (req, res) => {
  try {
    const { date, shift, wardname, subward } = req.query;
    if (!date || !shift || !wardname) {
      return res.status(400).json({ message: "date, shift, wardname จำเป็น" });
    }

    let sql = `
      SELECT * FROM pft_reports
      WHERE date = ? AND shift = ? AND wardname = ?
    `;
    const params = [date, shift, wardname];
    if (subward) {
      sql += " AND subward = ?";
      params.push(subward);
    }

    sql += " LIMIT 1";
    const [rows] = await db.query(sql, params);

    if (!rows.length) return res.json([]); // ✅ แก้ให้ส่ง [] แทน 204
    res.json(rows[0]);
  } catch (e) {
    console.error("GET /pft-report error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------------- ➕ เพิ่ม ---------------------- */
router.post("/pft-report", async (req, res) => {
  try {
    const {
      username, wardname, subward = null, date, shift,
      opd = 0, spiro = 0,
      rn = 0, pn = 0, na = 0, other_staff = 0, rn_extra = 0, rn_down = 0,
      incident = "", head_nurse = ""
    } = req.body;

    if (!username || !wardname || !date || !shift) {
      return res.status(400).json({ message: "username, wardname, date, shift จำเป็น" });
    }

    const [result] = await db.query(
      `INSERT INTO pft_reports
       (username, wardname, subward, date, shift,
        opd, spiro,
        rn, pn, na, other_staff, rn_extra, rn_down,
        incident, head_nurse)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, wardname, subward, date, shift,
       opd, spiro,
       rn, pn, na, other_staff, rn_extra, rn_down,
       incident, head_nurse]
    );

    res.status(201).json({ id: result.insertId, message: "created" });
  } catch (e) {
    console.error("POST /pft-report error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------------- ✏️ อัปเดต ---------------------- */
router.put("/pft-report/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      "username","wardname","subward","date","shift",
      "opd","spiro",
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
      `UPDATE pft_reports SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "ไม่พบรายการ" });
    }
    res.json({ message: "updated" });
  } catch (e) {
    console.error("PUT /pft-report/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
