// backend/routes/wardReportRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
const { ICU_Ven } = require("../constants/wards");

/* ----------------------- Helpers ----------------------- */
const toMysqlDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const toInt = (v) => (v === "" || v == null ? 0 : Number(v) || 0);
const isNonEmpty = (v) => typeof v === "string" && v.trim() !== "";

/* ✅ เงื่อนไข subward (รองรับ null/ว่าง) */
const subwardCond = (subward) =>
  isNonEmpty(subward)
    ? { clause: "subward = ?", params: [subward.trim()] }
    : { clause: "(subward IS NULL OR subward = '')", params: [] };

/* ✅ field whitelist */
const ALLOWED_INT = new Set([
  "bed_total", "bed_carry", "bed_new", "bed_transfer_in",
  "discharge_home", "discharge_transfer_out", "discharge_refer_out",
  "discharge_refer_back", "discharge_died",
  "type1", "type2", "type3", "type4", "type5",
  "vent_invasive", "vent_noninvasive", "hfnc", "oxygen",
  "extra_bed", "pas", "cpr", "infection", "gcs",
  "stroke", "psych", "prisoner", "palliative",
  "pre_op", "post_op", "rn", "pn", "na",
  "other_staff", "rn_extra", "rn_down",
]);
const ALLOWED_TEXT = new Set(["incident", "head_nurse"]);

/* ✅ สร้าง record พร้อม type-check */
const buildRecord = (body) => {
  const b = body || {};
  const rec = {
    username: String(b.username || ""),
    wardname: String(b.wardname || ""),
    date: toMysqlDate(b.date),
    shift: String(b.shift || ""),
    subward: isNonEmpty(b.subward) ? String(b.subward).trim() : null,
  };
  for (const [k, v] of Object.entries(b)) {
    if (ALLOWED_INT.has(k)) rec[k] = toInt(v);
    else if (ALLOWED_TEXT.has(k)) rec[k] = v ?? null;
  }
  delete rec.bed_remain;
  return rec;
};

/* ✅ ตรวจ core fields ครบไหม */
const requireCore = (rec) =>
  !!(rec.username && rec.wardname && rec.date && rec.shift);

/* ✅ จัดการ error จาก database */
const respondDbError = (res, err) => {
  console.error("DB error:", err);
  if (err.code === "ER_DUP_ENTRY")
    return res.status(409).json({ message: "Duplicate entry" });
  return res.status(500).json({ message: "Database error" });
};

/* ----------------------- Auth Middleware ----------------------- */
const requireBearer = (req, res, next) => {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer "))
    return res.status(401).json({ message: "No token provided" });

  try {
    jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/* ----------------------- Productivity Calculator ----------------------- */
function calcProductivity(row, subSum, isICU) {
  const t = (v) => (v == null ? 0 : Number(v));
  const type1 = t(row.type1) + t(subSum?.type1 || 0);
  const type2 = t(row.type2) + t(subSum?.type2 || 0);
  const type3 = t(row.type3) + t(subSum?.type3 || 0);
  const type4 = t(row.type4) + t(subSum?.type4 || 0);
  const type5 = t(row.type5) + t(subSum?.type5 || 0);
  const rn = t(row.rn);
  const pn = t(row.pn);
  const shift = row.shift;

  let weight5, numerator;
  switch (shift) {
    case "morning":
      weight5 = isICU ? 4.8 : 4.0;
      numerator = type5 * weight5 + type4 * 3 + type3 * 2.2 + type2 * 1.4 + type1 * 0.6;
      break;
    case "afternoon":
      weight5 = isICU ? 4.2 : 3.5;
      numerator = type5 * weight5 + type4 * 2.6 + type3 * 1.9 + type2 * 1.2 + type1 * 0.5;
      break;
    case "night":
      weight5 = isICU ? 3.0 : 2.5;
      numerator = type5 * weight5 + type4 * 1.9 + type3 * 1.4 + type2 * 0.9 + type1 * 0.4;
      break;
    default:
      weight5 = isICU ? 4.8 : 4.0;
      numerator = type5 * weight5 + type4 * 3 + type3 * 2.2 + type2 * 1.4 + type1 * 0.6;
  }

  const denom = (rn + pn) * 7;
  return denom > 0 ? Math.round(((numerator * 100) / denom) * 100) / 100 : 0;
}

/* ----------------------- Routes ----------------------- */

/** 🔹 GET /api/ward-report */
router.get("/", async (req, res) => {
  const { date, shift, wardname, subward } = req.query;
  if (!date || !shift || !wardname)
    return res.status(400).json({ message: "missing query params" });

  try {
    const sw = subwardCond(subward);
    const [rows] = await db.query(
      `SELECT * FROM ward_reports WHERE date=? AND shift=? AND wardname=? AND ${sw.clause} LIMIT 1`,
      [date, shift, wardname, ...sw.params]
    );

    if (!rows.length && (!isNonEmpty(subward) || subward === "null")) {
      const [fallback] = await db.query(
        `SELECT * FROM ward_reports WHERE date=? AND shift=? AND wardname=? AND (subward IS NULL OR subward='') LIMIT 1`,
        [date, shift, wardname]
      );
      if (fallback.length) return res.json(fallback[0]);
    }

    if (!rows.length) return res.status(204).send();
    return res.json(rows[0]);
  } catch (err) {
    return respondDbError(res, err);
  }
});

/** 🔹 GET /api/ward-report/bed-total */
router.get("/bed-total", async (req, res) => {
  const { wardname, subward } = req.query;
  if (!isNonEmpty(wardname))
    return res.status(400).json({ message: "wardname required" });

  try {
    const baseQuery = `SELECT bed_total FROM wards WHERE wardname=?`;
    let rows;

    if (!isNonEmpty(subward) || ["null", "undefined"].includes(subward)) {
      [rows] = await db.query(`${baseQuery} AND (subward IS NULL OR subward='') LIMIT 1`, [wardname]);
    } else {
      [rows] = await db.query(`${baseQuery} AND subward=? LIMIT 1`, [wardname, subward.trim()]);
      if (!rows.length)
        [rows] = await db.query(`${baseQuery} AND (subward IS NULL OR subward='') LIMIT 1`, [wardname]);
    }

    return res.json({ bed_total: Number(rows[0]?.bed_total) || 0 });
  } catch (err) {
    console.error("GET /ward-report/bed-total error:", err);
    return res.status(500).json({ message: "Error fetching bed total" });
  }
});

/* ----------------------- Productivity Update ----------------------- */
async function updateMainProductivity(record) {
  try {
    const { date, shift, wardname } = record;

    const [rows] = await db.query(
      `SELECT subward, rn, pn, type1, type2, type3, type4, type5 
       FROM ward_reports WHERE date=? AND shift=? AND wardname=?`,
      [date, shift, wardname]
    );
    if (!rows.length) return;

    const total = rows.reduce(
      (acc, r) => ({
        type1: acc.type1 + (r.type1 || 0),
        type2: acc.type2 + (r.type2 || 0),
        type3: acc.type3 + (r.type3 || 0),
        type4: acc.type4 + (r.type4 || 0),
        type5: acc.type5 + (r.type5 || 0),
      }),
      { type1: 0, type2: 0, type3: 0, type4: 0, type5: 0 }
    );

    const [mainRow] = await db.query(
      `SELECT id, subward, rn, pn, bed_carry FROM ward_reports 
       WHERE date=? AND shift=? AND wardname=? 
       ORDER BY bed_carry DESC LIMIT 1`,
      [date, shift, wardname]
    );
    if (!mainRow?.length) return;

    const main = mainRow[0];
    const rn = Number(main.rn) || 0;
    const pn = Number(main.pn) || 0;
    const isICU = ICU_Ven.includes(wardname);
    const productivity = calcProductivity({ shift, rn, pn, ...total }, {}, isICU);

    if (productivity <= 0) return;

    await db.query(
      `UPDATE ward_reports SET productivity=? 
       WHERE date=? AND shift=? AND wardname=? AND (subward <=> ?)`,
      [productivity, date, shift, wardname, main.subward || null]
    );
  } catch (err) {
    console.error("updateMainProductivity error:", err);
  }
}

/* ----------------------- POST ----------------------- */
router.post("/", requireBearer, async (req, res) => {
  try {
    const record = buildRecord(req.body);
    if (!requireCore(record))
      return res.status(400).json({ message: "missing core fields" });

    const [subs] = await db.query(
      `SELECT type1,type2,type3,type4,type5 FROM ward_reports 
       WHERE date=? AND shift=? AND wardname=? AND subward<>?`,
      [record.date, record.shift, record.wardname, record.subward || ""]
    );

    const subSum = subs.reduce(
      (acc, r) => ({
        type1: acc.type1 + (r.type1 || 0),
        type2: acc.type2 + (r.type2 || 0),
        type3: acc.type3 + (r.type3 || 0),
        type4: acc.type4 + (r.type4 || 0),
        type5: acc.type5 + (r.type5 || 0),
      }),
      { type1: 0, type2: 0, type3: 0, type4: 0, type5: 0 }
    );

    const isICU = ICU_Ven.includes(record.wardname);
    record.productivity = calcProductivity(record, subSum, isICU);

    const cols = Object.keys(record);
    const sql = `
      INSERT INTO ward_reports (${cols.join(",")})
      VALUES (${cols.map(() => "?").join(",")})
      ON DUPLICATE KEY UPDATE ${cols
        .filter((c) => !["username", "wardname", "date", "shift", "subward"].includes(c))
        .map((c) => `${c}=VALUES(${c})`)
        .join(", ")}
    `;
    await db.query(sql, cols.map((c) => record[c]));

    setTimeout(() => updateMainProductivity(record), 200);
    return res.json({ message: "บันทึกสำเร็จ", productivity: record.productivity });
  } catch (err) {
    return respondDbError(res, err);
  }
});

/* ----------------------- PUT ----------------------- */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "id required" });

    const record = buildRecord(req.body);
    const [subs] = await db.query(
      `SELECT type1,type2,type3,type4,type5 FROM ward_reports 
       WHERE date=? AND shift=? AND wardname=? AND subward<>?`,
      [record.date, record.shift, record.wardname, record.subward || ""]
    );

    const subSum = subs.reduce(
      (acc, r) => ({
        type1: acc.type1 + (r.type1 || 0),
        type2: acc.type2 + (r.type2 || 0),
        type3: acc.type3 + (r.type3 || 0),
        type4: acc.type4 + (r.type4 || 0),
        type5: acc.type5 + (r.type5 || 0),
      }),
      { type1: 0, type2: 0, type3: 0, type4: 0, type5: 0 }
    );

    const isICU = ICU_Ven.includes(record.wardname);
    record.productivity = calcProductivity(record, subSum, isICU);

    const setClause = Object.keys(record).map((k) => `${k}=?`).join(", ");
    await db.query(`UPDATE ward_reports SET ${setClause} WHERE id=?`, [
      ...Object.values(record),
      id,
    ]);

    setTimeout(() => updateMainProductivity(record), 200);
    return res.json({ message: "อัพเดทสำเร็จ", productivity: record.productivity });
  } catch (err) {
    return respondDbError(res, err);
  }
});

/* ----------------------- GET Productivity ----------------------- */
router.get("/productivity", async (req, res) => {
  try {
    const { date, shift, wardname } = req.query;
    if (!date || !shift || !wardname)
      return res.status(400).json({ message: "Missing required params" });

    const [rows] = await db.query(
      `SELECT productivity FROM ward_reports 
       WHERE date=? AND shift=? AND wardname=? 
       ORDER BY rn DESC, bed_carry DESC LIMIT 1`,
      [date, shift, wardname]
    );

    return res.json({ productivity: Number(rows[0]?.productivity) || 0 });
  } catch (err) {
    console.error("GET /ward-report/productivity error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
