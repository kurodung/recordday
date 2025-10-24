const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
const { ICU_Ven } = require("../constants/wards");

/* ----------------------- helpers ----------------------- */
const toMysqlDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};
const toInt = (v) => (v === "" || v == null ? 0 : Number(v) || 0);
const isNonEmpty = (v) => typeof v === "string" && v.trim() !== "";

/* ------------------- helper: subward condition ------------------- */
const subwardCond = (subward) =>
  isNonEmpty(subward)
    ? { clause: "subward = ?", params: [subward.trim()] }
    : { clause: "(subward IS NULL OR subward = '')", params: [] };

/* ------------------- whitelist fields ------------------- */
const ALLOWED_INT = new Set([
  "bed_carry",
  "bed_new",
  "bed_transfer_in",
  "discharge_home",
  "discharge_transfer_out",
  "discharge_refer_out",
  "discharge_refer_back",
  "discharge_died",
  "type1",
  "type2",
  "type3",
  "type4",
  "type5",
  "vent_invasive",
  "vent_noninvasive",
  "hfnc",
  "oxygen",
  "extra_bed",
  "pas",
  "cpr",
  "infection",
  "gcs",
  "stroke",
  "psych",
  "prisoner",
  "palliative",
  "pre_op",
  "post_op",
  "rn",
  "pn",
  "na",
  "other_staff",
  "rn_extra",
  "rn_down",
]);
const ALLOWED_TEXT = new Set(["incident", "head_nurse"]);

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
const requireCore = (rec) =>
  !!(rec.username && rec.wardname && rec.date && rec.shift);
const respondDbError = (res, err) => {
  console.error("DB error:", err);
  if (err.code === "ER_DUP_ENTRY")
    return res.status(409).json({ message: "Duplicate entry" });
  return res.status(500).json({ message: "Database error" });
};

/* ------------------- auth middleware ------------------- */
const requireBearer = (req, res, next) => {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer "))
    return res.status(401).json({ message: "No token" });
  try {
    jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/* ---------- ฟังก์ชันคำนวณ productivity ---------- */
function calcProductivity(row, subSum, isICU, shift) {
  const t = (v) => (v == null ? 0 : Number(v));
  const type1 = t(row.type1) + t(subSum?.type1 || 0);
  const type2 = t(row.type2) + t(subSum?.type2 || 0);
  const type3 = t(row.type3) + t(subSum?.type3 || 0);
  const type4 = t(row.type4) + t(subSum?.type4 || 0);
  const type5 = t(row.type5) + t(subSum?.type5 || 0);
  const rn = t(row.rn);

  let weight5, numerator;
  switch (shift) {
    case "morning":
      weight5 = isICU ? 4.2 : 3.5;
      numerator =
        type5 * weight5 +
        type4 * 2.6 +
        type3 * 1.9 +
        type2 * 1.2 +
        type1 * 0.5;
      break;
    case "afternoon":
      weight5 = isICU ? 4.8 : 4;
      numerator =
        type5 * weight5 +
        type4 * 3 +
        type3 * 2.2 +
        type2 * 1.4 +
        type1 * 0.6;
      break;
    case "night":
      weight5 = isICU ? 3 : 2.5;
      numerator =
        type5 * weight5 +
        type4 * 1.9 +
        type3 * 1.4 +
        type2 * 0.9 +
        type1 * 0.4;
      break;
    default:
      weight5 = isICU ? 4 : 3.5;
      numerator =
        type5 * weight5 +
        type4 * 2.5 +
        type3 * 1.8 +
        type2 * 1.1 +
        type1 * 0.5;
  }

  const denom = rn * 7;
  return denom > 0 ? Math.round(((numerator * 100) / denom) * 100) / 100 : 0;
}

/* ---------- อัปเดต productivity เฉพาะแถวหลักจริง ---------- */
async function updateMainProductivity(record) {
  try {
    const { date, shift, wardname } = record;
    const [mainRows] = await db.query(
      `SELECT id FROM ward_reports 
       WHERE date=? AND shift=? AND wardname=? 
         AND (subward IS NULL OR subward='') 
       LIMIT 1`,
      [date, shift, wardname]
    );
    if (!mainRows.length) return;
    const mainId = mainRows[0].id;
    const productivity = record.productivity || 0;
    if (productivity <= 0) return;
    await db.query(`UPDATE ward_reports SET productivity=? WHERE id=?`, [
      productivity,
      mainId,
    ]);
  } catch (err) {
    console.error("updateMainProductivity error:", err);
  }
}

/* ========== Routes ========== */
router.get("/", async (req, res) => {
  const { date, shift, wardname, subward } = req.query;
  if (!date || !shift || !wardname)
    return res.status(400).json({ message: "missing query params" });
  const sw = subwardCond(subward);
  try {
    const [rows] = await db.query(
      `SELECT * FROM ward_reports
       WHERE date=? AND shift=? AND wardname=? AND ${sw.clause}
       LIMIT 1`,
      [date, shift, wardname, ...sw.params]
    );
    if (!rows.length) return res.status(204).send();
    return res.json(rows[0]);
  } catch (err) {
    return respondDbError(res, err);
  }
});

router.get("/bed-total", async (req, res) => {
  const { wardname, subward } = req.query;
  if (!isNonEmpty(wardname))
    return res.status(400).json({ message: "wardname required" });
  try {
    const sw = subwardCond(subward);
    const [rows] = await db.query(
      `SELECT bed_total FROM wards WHERE wardname=? AND ${sw.clause} LIMIT 1`,
      [wardname, ...sw.params]
    );
    if (!rows.length) return res.json({ bed_total: 0 });
    return res.json({ bed_total: Number(rows[0].bed_total) || 0 });
  } catch (err) {
    console.error("GET /ward-report/bed-total error:", err);
    return res.status(500).json({ message: "Error fetching bed total" });
  }
});

/** คำนวณ productivity แบบรวมทุก subward */
router.get("/productivity", async (req, res) => {
  try {
    const { date, shift, wardname } = req.query;
    if (!date || !shift || !wardname)
      return res.status(400).json({ message: "missing query params" });

    const [rows] = await db.query(
      `SELECT subward, rn, type1, type2, type3, type4, type5
       FROM ward_reports WHERE date=? AND shift=? AND wardname=?`,
      [date, shift, wardname]
    );
    if (!rows.length) return res.status(404).json({ message: "no data" });

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

    const [mainRows] = await db.query(
      `SELECT rn FROM ward_reports 
       WHERE date=? AND shift=? AND wardname=? 
         AND (subward IS NULL OR subward='') LIMIT 1`,
      [date, shift, wardname]
    );
    if (!mainRows.length)
      return res.status(404).json({ message: "no main row" });

    const rn = Number(mainRows[0].rn) || 0;
    const isICU = ICU_Ven.includes(wardname);

    // ✅ สูตรคำนวณแยกตามเวร
    let weight5, numerator;
    switch (shift) {
      case "morning":
        weight5 = isICU ? 4.8 : 4;
        numerator =
          total.type5 * weight5 +
          total.type4 * 3 +
          total.type3 * 2.2 +
          total.type2 * 1.4 +
          total.type1 * 0.6;
        break;
      case "afternoon":
        weight5 = isICU ? 4.2 : 3.5;
        numerator =
          total.type5 * weight5 +
          total.type4 * 2.6 +
          total.type3 * 1.9 +
          total.type2 * 1.2 +
          total.type1 * 0.5;
        break;
      case "night":
        weight5 = isICU ? 3 : 2.5;
        numerator =
          total.type5 * weight5 +
          total.type4 * 1.9 +
          total.type3 * 1.4 +
          total.type2 * 0.9 +
          total.type1 * 0.4;
        break;
      default:
        weight5 = isICU ? 4 : 3.5;
        numerator =
          total.type5 * weight5 +
          total.type4 * 2.5 +
          total.type3 * 1.8 +
          total.type2 * 1.1 +
          total.type1 * 0.5;
    }

    const denom = rn * 7;
    const productivity =
      denom > 0 ? Math.round(((numerator * 100) / denom) * 100) / 100 : 0;

    return res.json({ productivity });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

/** POST /api/ward-report */
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
    record.productivity = calcProductivity(
      record,
      subSum,
      isICU,
      record.shift
    );

    const cols = Object.keys(record);
    const placeholders = cols.map(() => "?").join(",");
    const updates = cols
      .filter(
        (c) => !["username", "wardname", "date", "shift", "subward"].includes(c)
      )
      .map((c) => `${c}=VALUES(${c})`)
      .join(", ");
    await db.query(
      `INSERT INTO ward_reports (${cols.join(",")})
       VALUES (${placeholders})
       ON DUPLICATE KEY UPDATE ${updates}`,
      cols.map((c) => record[c])
    );

    setTimeout(() => updateMainProductivity(record), 200);
    return res.status(200).json({
      message: "บันทึกสำเร็จ",
      productivity: record.productivity,
    });
  } catch (err) {
    return respondDbError(res, err);
  }
});

/** PUT /api/ward-report/:id */
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
    record.productivity = calcProductivity(
      record,
      subSum,
      isICU,
      record.shift
    );

    const setClause = Object.keys(record)
      .map((k) => `${k}=?`)
      .join(", ");
    await db.query(`UPDATE ward_reports SET ${setClause} WHERE id=?`, [
      ...Object.values(record),
      id,
    ]);

    setTimeout(() => updateMainProductivity(record), 200);
    return res.status(200).json({
      message: "อัพเดทสำเร็จ",
      productivity: record.productivity,
    });
  } catch (err) {
    return respondDbError(res, err);
  }
});

module.exports = router;
