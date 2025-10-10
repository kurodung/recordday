// routes/opdReport.js
const express = require("express");
const router = express.Router();
const db = require("../db");

/* ---------------------- 📊 ใช้ใน Dashboard ---------------------- */
router.get("/opd-report/list", async (req, res) => {
  try {
    const { start, end, shift } = req.query;
    let sql = `
      SELECT 
        id, date AS report_date, shift, wardname, subward,
        treat_back, admit,
        rn, pn, na, other_staff, rn_extra, rn_down,
        incident, head_nurse, username
      FROM opd_reports
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
    res.json(rows || []);
  } catch (e) {
    console.error("GET /opd-report/list error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------------- 📅 รายวัน ---------------------- */
router.get("/opd-report", async (req, res) => {
  try {
    const { date, shift, wardname, subward } = req.query;
    if (!date || !shift || !wardname)
      return res.status(400).json({ message: "date, shift, wardname จำเป็น" });

    let sql = `
      SELECT * FROM opd_reports
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
    console.error("GET /opd-report error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------------- ➕ เพิ่มหรืออัปเดต ---------------------- */
router.post("/opd-report", async (req, res) => {
  try {
    const {
      username,
      wardname,
      subward = null,
      date,
      shift,
      treat_back = 0,
      admit = 0,
      rn = 0,
      pn = 0,
      na = 0,
      other_staff = 0,
      rn_extra = 0,
      rn_down = 0,
      inj_total = 0,
      inj_inject = 0,
      inj_wound = 0,
      inj_stitch = 0,
      inj_dialysis_mix = 0,
      incident = "",
      head_nurse = "",
    } = req.body;

    if (!username || !wardname || !date || !shift)
      return res.status(400).json({ message: "ข้อมูลหลักไม่ครบ" });

    const sql = `
      INSERT INTO opd_reports
      (
        username, wardname, subward, date, shift,
        treat_back, admit, rn, pn, na, other_staff,
        rn_extra, rn_down,
        inj_total, inj_inject, inj_wound, inj_stitch, inj_dialysis_mix,
        incident, head_nurse
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        treat_back = VALUES(treat_back),
        admit = VALUES(admit),
        rn = VALUES(rn),
        pn = VALUES(pn),
        na = VALUES(na),
        other_staff = VALUES(other_staff),
        rn_extra = VALUES(rn_extra),
        rn_down = VALUES(rn_down),
        inj_total = VALUES(inj_total),
        inj_inject = VALUES(inj_inject),
        inj_wound = VALUES(inj_wound),
        inj_stitch = VALUES(inj_stitch),
        inj_dialysis_mix = VALUES(inj_dialysis_mix),
        incident = VALUES(incident),
        head_nurse = VALUES(head_nurse),
        updated_at = CURRENT_TIMESTAMP
    `;

    const params = [
      username,
      wardname,
      subward,
      date,
      shift,
      treat_back,
      admit,
      rn,
      pn,
      na,
      other_staff,
      rn_extra,
      rn_down,
      inj_total,
      inj_inject,
      inj_wound,
      inj_stitch,
      inj_dialysis_mix,
      incident,
      head_nurse,
    ];

    const [result] = await db.query(sql, params);
    res.status(201).json({
      id: result.insertId,
      message: "created or updated",
    });
  } catch (e) {
    console.error("POST /opd-report error:", e);
    res.status(500).json({ message: "Server error" });
  }
});



/* ---------------------- ✏️ อัปเดต ---------------------- */
router.put("/opd-report/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      "username",
      "wardname",
      "subward",
      "date",
      "shift",
      "treat_back",
      "admit",
      "rn",
      "pn",
      "na",
      "other_staff",
      "rn_extra",
      "rn_down",
      "inj_total",
      "inj_inject",
      "inj_wound",
      "inj_stitch",
      "inj_dialysis_mix",
      "incident",
      "head_nurse",
    ];
    const fields = [];
    const params = [];
    for (const k of allowed) {
      if (k in req.body) {
        fields.push(`${k} = ?`);
        params.push(req.body[k]);
      }
    }
    if (!fields.length)
      return res.status(400).json({ message: "ไม่มีฟิลด์ให้แก้ไข" });

    params.push(id);
    const [result] = await db.query(
      `UPDATE opd_reports SET ${fields.join(", ")} WHERE id = ?`,
      params
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "ไม่พบรายการ" });

    res.json({ message: "updated" });
  } catch (e) {
    console.error("PUT /opd-report/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------------- 📅 Dashboard: ศูนย์ Admit วันอาทิตย์ ---------------------- */
router.get("/opd-sun-report/list", async (req, res) => {
  try {
    const { start, end, shift } = req.query;
    let sql = `
      SELECT 
        date AS report_date, shift, wardname,
        SUM(sun_obsgyn) AS sun_obsgyn,
        SUM(sun_Internal) AS sun_Internal,
        SUM(sun_surgery) AS sun_surgery,
        SUM(sun_ped) AS sun_ped,
        SUM(sun_den) AS sun_den,
        SUM(sun_eye) AS sun_eye,
        SUM(sun_ent) AS sun_ent,
        SUM(sun_ortho) AS sun_ortho,
        SUM(sun_total) AS sun_total
      FROM opd_sun_reports
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

    sql += " GROUP BY date, shift ORDER BY date DESC";
    const [rows] = await db.query(sql, params);
    res.json(rows || []);
  } catch (e) {
    console.error("GET /opd-sun-report/list error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------------- 📅 รายวัน: ศูนย์ Admit วันอาทิตย์ ---------------------- */
router.get("/opd-sun-report", async (req, res) => {
  try {
    const { date, shift, wardname } = req.query;
    if (!date || !shift || !wardname)
      return res.status(400).json({ message: "date, shift, wardname จำเป็น" });

    const [rows] = await db.query(
      `SELECT * FROM opd_sun_reports WHERE date = ? AND shift = ? AND wardname = ? LIMIT 1`,
      [date, shift, wardname]
    );

    if (!rows.length) return res.status(204).end();
    res.json(rows[0]);
  } catch (e) {
    console.error("GET /opd-sun-report error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ➕ เพิ่มข้อมูลใหม่ */
router.post("/opd-sun-report", async (req, res) => {
  try {
    const {
      wardname, date, shift,
      sun_obsgyn = 0, sun_Internal = 0, sun_surgery = 0,
      sun_ped = 0, sun_den = 0, sun_eye = 0,
      sun_ent = 0, sun_ortho = 0, sun_total = 0,
      username = ""
    } = req.body;

    if (!wardname || !date || !shift)
      return res.status(400).json({ message: "ข้อมูลหลักไม่ครบ" });

    const [result] = await db.query(
      `INSERT INTO opd_sun_reports
      (wardname, date, shift,
       sun_obsgyn, sun_Internal, sun_surgery, sun_ped, sun_den, sun_eye,
       sun_ent, sun_ortho, sun_total, username)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        wardname, date, shift,
        sun_obsgyn, sun_Internal, sun_surgery, sun_ped, sun_den, sun_eye,
        sun_ent, sun_ortho, sun_total, username
      ]
    );
    res.status(201).json({ id: result.insertId, message: "created" });
  } catch (e) {
    console.error("POST /opd-sun-report error:", e);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
