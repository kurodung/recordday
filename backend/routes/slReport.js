const express = require("express");
const router = express.Router();
const db = require("../db");

/* ---------------------- 📊 ใช้ใน Dashboard ---------------------- */
router.get("/sl-report/list", async (req, res) => {
  try {
    const { start, end, shift } = req.query;
    let sql = `
      SELECT 
        id, date AS report_date, shift, wardname, subward,
        sleep, cpap, consult, opd,
        rn, pn, na, other_staff, rn_extra, rn_down,
        incident, head_nurse, username
      FROM sl_reports
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
    console.error("GET /sl-report/list error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------------- 📅 รายวัน ---------------------- */
router.get("/sl-report", async (req, res) => {
  try {
    const { date, shift, wardname, subward } = req.query;
    if (!date || !shift || !wardname) {
      return res.status(400).json({ message: "date, shift, wardname จำเป็น" });
    }

    let sql = `
      SELECT * FROM sl_reports
      WHERE date = ? AND shift = ? AND wardname = ?
    `;
    const params = [date, shift, wardname];
    if (subward) {
      sql += " AND subward = ?";
      params.push(subward);
    }

    sql += " LIMIT 1";
    const [rows] = await db.query(sql, params);

    if (!rows.length) return res.status(204).end();
    res.json(rows[0]);
  } catch (e) {
    console.error("GET /sl-report error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------------- ➕ เพิ่ม ---------------------- */
router.post("/sl-report", async (req, res) => {
  try {
    const {
      username, wardname, subward = null, date, shift,
      sleep = 0, cpap = 0, consult = 0, opd = 0,
      rn = 0, pn = 0, na = 0, other_staff = 0, rn_extra = 0, rn_down = 0,
      incident = "", head_nurse = ""
    } = req.body;

    if (!username || !wardname || !date || !shift) {
      return res.status(400).json({ message: "username, wardname, date, shift จำเป็น" });
    }

    const [result] = await db.query(
      `INSERT INTO sl_reports
       (username, wardname, subward, date, shift,
        sleep, cpap, consult, opd,
        rn, pn, na, other_staff, rn_extra, rn_down,
        incident, head_nurse)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, wardname, subward, date, shift,
       sleep, cpap, consult, opd,
       rn, pn, na, other_staff, rn_extra, rn_down,
       incident, head_nurse]
    );

    res.status(201).json({ id: result.insertId, message: "created" });
  } catch (e) {
    console.error("POST /sl-report error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------------- ✏️ อัปเดต ---------------------- */
router.put("/sl-report/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      "username","wardname","subward","date","shift",
      "sleep","cpap","consult","opd",
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
      `UPDATE sl_reports SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "ไม่พบรายการ" });
    }
    res.json({ message: "updated" });
  } catch (e) {
    console.error("PUT /sl-report/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
