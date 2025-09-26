const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");

/* -------- helpers -------- */
const toMysqlDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d)) return null;
  return d.toISOString().slice(0, 10);
};
const toInt = (v) => (v === "" || v == null ? 0 : Number(v) || 0);

/* allowlist: ต้องตรงกับโครงสร้างตาราง hd_reports */
const ALLOWED_INT = new Set([
  "acute","chronic","icu","covid",
  "capd_opd","capd_ipd",
  "type1","type2","type3","type4","type5",
  "vent_invasive","vent_noninvasive","hfnc","oxygen",
  "extra_bed","pas","cpr","pre_op","post_op",
  "infection","gcs","stroke","psych","prisoner",
  "rn","pn","na","other_staff","rn_extra","rn_down"
]);
const ALLOWED_TEXT = new Set(["incident","head_nurse"]);

const buildRecord = (body) => {
  const b = body || {};
  const rec = {
    username: String(b.username || ""),
    wardname: String(b.wardname || ""),
    date: toMysqlDate(b.date),
    shift: String(b.shift || ""),
  };
  for (const [k,v] of Object.entries(b)) {
    if (ALLOWED_INT.has(k)) rec[k] = toInt(v);
    else if (ALLOWED_TEXT.has(k)) rec[k] = v ?? null;
  }
  // ไม่ให้ client กำหนด productivity (generated)
  delete rec.productivity;
  return rec;
};
const requireCore = (rec) =>
  !!(rec.username && rec.wardname && rec.date && rec.shift);

const respondDbError = (res, err) => {
  console.error("DB error:", err);
  if (err.code === "ER_DUP_ENTRY")
    return res.status(409).json({ message: "ข้อมูลซ้ำ (unique key)" });
  return res.status(500).json({ message: "Database error" });
};

/* -------- auth middleware -------- */
const requireBearer = (req, res, next) => {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer "))
    return res.status(401).json({ message: "No token" });
  try {
    jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/* ================= Routes ================= */

// GET /api/hd-report?date=...&shift=...&wardname=...&username=...
router.get("/", async (req, res) => {
  const { date, shift, wardname, username } = req.query;
  if (!date || !shift || !wardname || !username) {
    return res
      .status(400)
      .json({ message: "missing required query params" });
  }
  try {
    const [rows] = await db.query(
      `SELECT * FROM hd_reports
       WHERE date=? AND shift=? AND wardname=? AND username=?
       LIMIT 1`,
      [date, shift, wardname, username]
    );
    if (!rows.length) return res.status(204).send();
    return res.json(rows[0]);
  } catch (err) {
    return respondDbError(res, err);
  }
});

// POST insert/upsert
router.post("/", requireBearer, async (req, res) => {
  try {
    const rec = buildRecord(req.body);
    if (!requireCore(rec))
      return res.status(400).json({ message: "core fields missing" });

    const cols = Object.keys(rec);
    const placeholders = cols.map(() => "?").join(",");
    const updates = cols
      .filter((c) => !["username", "wardname", "date", "shift"].includes(c))
      .map((c) => `${c}=VALUES(${c})`)
      .join(", ");

    await db.query(
      `INSERT INTO hd_reports (${cols.join(",")}) VALUES (${placeholders})
       ON DUPLICATE KEY UPDATE ${updates}`,
      cols.map((c) => rec[c])
    );

    return res.json({ message: "บันทึกสำเร็จ" });
  } catch (err) {
    return respondDbError(res, err);
  }
});

// PUT update by id
router.put("/:id", requireBearer, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "id required" });

    const b = req.body || {};
    const allowed = {};
    if (b.date !== undefined) allowed.date = toMysqlDate(b.date);
    if (b.shift !== undefined) allowed.shift = String(b.shift);
    if (b.wardname !== undefined) allowed.wardname = String(b.wardname);
    if (b.username !== undefined) allowed.username = String(b.username);

    for (const [k, v] of Object.entries(b)) {
      if (ALLOWED_INT.has(k)) allowed[k] = toInt(v);
      else if (ALLOWED_TEXT.has(k)) allowed[k] = v ?? null;
    }
    delete allowed.productivity;

    if (!Object.keys(allowed).length)
      return res.status(400).json({ message: "no fields to update" });

    const set = Object.keys(allowed)
      .map((f) => `${f}=?`)
      .join(", ");
    await db.query(
      `UPDATE hd_reports SET ${set} WHERE id=?`,
      [...Object.values(allowed), id]
    );
    return res.json({ message: "อัปเดตสำเร็จ" });
  } catch (err) {
    return respondDbError(res, err);
  }
});

// GET /api/hd-report/list?start=YYYY-MM-DD&end=YYYY-MM-DD&shift=...
router.get("/list", async (req, res) => {
  try {
    const { start, end, shift } = req.query;

    let sql = `
      SELECT id, date AS report_date, shift, wardname, username,
             acute, chronic, icu, covid,
             capd_opd, capd_ipd,
             rn, pn, na, other_staff, rn_extra, rn_down
      FROM hd_reports
      WHERE 1=1
    `;
    const params = [];

    if (start) {
      sql += " AND date >= ?";
      params.push(start);
    }
    if (end) {
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
  } catch (err) {
    return respondDbError(res, err);
  }
});


// GET /api/hd-report/summary?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get("/summary", async (req, res) => {
  try {
    const { start, end } = req.query;

    let sql = `
      SELECT 
        SUM(acute) AS acute,
        SUM(chronic) AS chronic,
        SUM(icu) AS icu,
        SUM(covid) AS covid,
        SUM(capd_opd) AS capd_opd,
        SUM(capd_ipd) AS capd_ipd
      FROM hd_reports
      WHERE 1=1
    `;
    const params = [];

    if (start) {
      sql += " AND date >= ?";
      params.push(start);
    }
    if (end) {
      sql += " AND date <= ?";
      params.push(end);
    }

    const [[row]] = await db.query(sql, params);
    row.totalHD = (row.acute || 0) + (row.chronic || 0) + (row.icu || 0) + (row.covid || 0);
    row.totalCAPD = (row.capd_opd || 0) + (row.capd_ipd || 0);
    row.grandTotal = row.totalHD + row.totalCAPD;

    res.json(row);
  } catch (err) {
    return respondDbError(res, err);
  }
});


module.exports = router;
