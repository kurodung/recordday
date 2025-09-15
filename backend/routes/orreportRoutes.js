// routes/orreportRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");

// GET /api/or-report?date=YYYY-MM-DD&shift=...&wardname=...
router.get("/or-report", async (req, res) => {
  try {
    const { date, shift, wardname } = req.query;
    if (!date || !shift || !wardname) {
      return res.status(400).json({ message: "date, shift, wardname จำเป็น" });
    }

    const [rows] = await db.query(
      `SELECT * FROM or_reports
       WHERE date = ? AND shift = ? AND wardname = ?
       LIMIT 1`,
      [date, shift, wardname]
    );

    if (!rows.length) return res.status(204).end();
    return res.json(rows[0]);
  } catch (e) {
    console.error("GET /or-report error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/or-report
router.post("/or-report", async (req, res) => {
  try {
    const {
      username, wardname, date, shift,
      complex = 0, endoscopic = 0, major_surgery = 0, minor_surgery = 0,
      cast = 0, or_small = 0, ods = 0, eye = 0, covid = 0, smc = 0,
    } = req.body;

    if (!username || !wardname || !date || !shift) {
      return res.status(400).json({ message: "username, wardname, date, shift จำเป็น" });
    }

    const [result] = await db.query(
      `INSERT INTO or_reports
       (username, wardname, date, shift,
        complex, endoscopic, major_surgery, minor_surgery,
        cast, or_small, ods, eye, covid, smc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, wardname, date, shift,
       complex, endoscopic, major_surgery, minor_surgery,
       cast, or_small, ods, eye, covid, smc]
    );

    res.status(201).json({ id: result.insertId, message: "created" });
  } catch (e) {
    if (e && e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "รายการซ้ำ (มีข้อมูลวันนี้/เวรนี้อยู่แล้ว)" });
    }
    console.error("POST /or-report error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/or-report/:id
router.put("/or-report/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      "complex","endoscopic","major_surgery","minor_surgery",
      "cast","or_small","ods","eye","covid","smc",
      "username","wardname","date","shift"
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
      `UPDATE or_reports SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "ไม่พบรายการ" });
    }
    res.json({ message: "updated" });
  } catch (e) {
    console.error("PUT /or-report/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
