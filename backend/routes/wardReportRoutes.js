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
  "bed_total",
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
function calcProductivity(row, subSum, isICU) {
  const t = (v) => (v == null ? 0 : Number(v));
  const type1 = t(row.type1) + t(subSum?.type1 || 0);
  const type2 = t(row.type2) + t(subSum?.type2 || 0);
  const type3 = t(row.type3) + t(subSum?.type3 || 0);
  const type4 = t(row.type4) + t(subSum?.type4 || 0);
  const type5 = t(row.type5) + t(subSum?.type5 || 0);
  const rn = t(row.rn);
  const shift = row.shift;

  let weight5 = 0;
  let numerator = 0;

  switch (shift) {
    case "morning":
      weight5 = isICU ? 4.8 : 4.0;
      numerator =
        type5 * weight5 +
        type4 * 3.0 +
        type3 * 2.2 +
        type2 * 1.4 +
        type1 * 0.6;
      break;
    case "afternoon":
      weight5 = isICU ? 4.2 : 3.5;
      numerator =
        type5 * weight5 +
        type4 * 2.6 +
        type3 * 1.9 +
        type2 * 1.2 +
        type1 * 0.5;
      break;
    case "night":
      weight5 = isICU ? 3.0 : 2.5;
      numerator =
        type5 * weight5 +
        type4 * 1.9 +
        type3 * 1.4 +
        type2 * 0.9 +
        type1 * 0.4;
      break;
    default:
      // fallback ใช้สูตรเวรเช้า
      weight5 = isICU ? 4.8 : 4.0;
      numerator =
        type5 * weight5 +
        type4 * 3.0 +
        type3 * 2.2 +
        type2 * 1.4 +
        type1 * 0.6;
  }

  const denom = rn * 7;
  return denom > 0 ? Math.round(((numerator * 100) / denom) * 100) / 100 : 0;
}

/* ---------- หาว่า subward ไหนมียอดยกมามากที่สุด ---------- */
async function findMainSubward(date, shift, wardname) {
  const [rows] = await db.query(
    `SELECT id, subward, bed_carry, rn 
     FROM ward_reports 
     WHERE date=? AND shift=? AND wardname=?`,
    [date, shift, wardname]
  );
  if (!rows.length) return null;
  rows.sort((a, b) => (b.bed_carry || 0) - (a.bed_carry || 0));
  return rows[0];
}

/* ========== Routes ========== */

router.get("/", async (req, res) => {
  const { date, shift, wardname, subward } = req.query;
  if (!date || !shift || !wardname)
    return res.status(400).json({ message: "missing query params" });

  try {
    const sw = subwardCond(subward);
    console.log("🟣 GET ward-report:", wardname, "subward=", subward);

    const [rows] = await db.query(
      `SELECT * FROM ward_reports WHERE date=? AND shift=? AND wardname=? AND ${sw.clause} LIMIT 1`,
      [date, shift, wardname, ...sw.params]
    );

    // ✅ fallback กรณีไม่มี subward แต่ใน DB เก็บเป็น null
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


router.get("/bed-total", async (req, res) => {
  const { wardname, subward } = req.query;
  if (!isNonEmpty(wardname))
    return res.status(400).json({ message: "wardname required" });

  try {
    // ✅ ถ้าไม่มี subward หรือเป็น "null" หรือว่าง — ใช้เงื่อนไข IS NULL/=''
    if (!isNonEmpty(subward) || subward === "null" || subward === "undefined") {
      const [rows] = await db.query(
        `SELECT bed_total FROM wards WHERE wardname=? AND (subward IS NULL OR subward='') LIMIT 1`,
        [wardname]
      );
      if (!rows.length) return res.json({ bed_total: 0 });
      return res.json({ bed_total: Number(rows[0].bed_total) || 0 });
    }

    // ✅ ถ้ามี subward จริง
    const [rows] = await db.query(
      `SELECT bed_total FROM wards WHERE wardname=? AND subward=? LIMIT 1`,
      [wardname, subward.trim()]
    );
    if (!rows.length) {
      // 🩶 fallback กรณี subward ไม่ตรง (เช่นพิมพ์ผิด)
      const [fallback] = await db.query(
        `SELECT bed_total FROM wards WHERE wardname=? AND (subward IS NULL OR subward='') LIMIT 1`,
        [wardname]
      );
      return res.json({
        bed_total: fallback.length ? Number(fallback[0].bed_total) || 0 : 0,
      });
    }

    return res.json({ bed_total: Number(rows[0].bed_total) || 0 });
  } catch (err) {
    console.error("GET /ward-report/bed-total error:", err);
    return res.status(500).json({ message: "Error fetching bed total" });
  }
});


/** 🔹 ฟังก์ชันอัปเดต productivity ของแถวหลัก โดยรวม subward ทั้งหมดหลังบันทึก */
async function updateMainProductivity(record) {
  try {
    const { date, shift, wardname } = record;

    // ✅ ดึงข้อมูลทุก subward ของ ward เดียวกันวันเดียวกัน
    const [rows] = await db.query(
      `SELECT subward, rn, type1, type2, type3, type4, type5 
       FROM ward_reports 
       WHERE date=? AND shift=? AND wardname=?`,
      [date, shift, wardname]
    );

    if (!rows.length) {
      console.log(`⚠️ ไม่มีข้อมูลใน ward ${wardname} สำหรับอัปเดต productivity`);
      return;
    }

    // ✅ รวมค่า type ทั้งหมดของทุก subward
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

    // ✅ หาว่าแถวหลักคืออันไหน (bed_carry มากสุด)
    const [mainRow] = await db.query(
      `SELECT id, subward, rn, bed_carry 
       FROM ward_reports 
       WHERE date=? AND shift=? AND wardname=? 
       ORDER BY bed_carry DESC LIMIT 1`,
      [date, shift, wardname]
    );
    if (!mainRow || !mainRow.length) {
      console.log(`⚠️ ไม่มี main row ของ ward ${wardname}`);
      return;
    }
    const main = mainRow[0];

    // ✅ ใช้ RN ของแถวหลัก
    const rn = Number(main.rn) || 0;
    const isICU = ICU_Ven.includes(wardname);

    // ✅ เลือกสูตรตาม shift
    let weight5 = 0;
    let numerator = 0;

    switch (shift) {
      case "morning":
        weight5 = isICU ? 4.8 : 4.0;
        numerator =
          total.type5 * weight5 +
          total.type4 * 3.0 +
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
        weight5 = isICU ? 3.0 : 2.5;
        numerator =
          total.type5 * weight5 +
          total.type4 * 1.9 +
          total.type3 * 1.4 +
          total.type2 * 0.9 +
          total.type1 * 0.4;
        break;
      default:
        weight5 = isICU ? 4.8 : 4.0;
        numerator =
          total.type5 * weight5 +
          total.type4 * 3.0 +
          total.type3 * 2.2 +
          total.type2 * 1.4 +
          total.type1 * 0.6;
    }

    const denom = rn * 7;
    const productivity =
      denom > 0 ? Math.round(((numerator * 100) / denom) * 100) / 100 : 0;

    if (productivity <= 0) {
      console.log(`⚠️ Productivity คำนวณได้ ${productivity}, ข้ามการอัปเดต`);
      return;
    }

    // ✅ อัปเดตค่า productivity ในแถวหลักจริง
    await db.query(
      `UPDATE ward_reports 
       SET productivity=? 
       WHERE date=? AND shift=? AND wardname=? 
         AND (subward <=> ?)`,
      [productivity, date, shift, wardname, main.subward || null]
    );

    console.log(
      `✅ Productivity recalculated (${shift}) = ${productivity} for main row ${wardname} (${main.subward || "หลัก"})`
    );
  } catch (err) {
    console.error("❌ updateMainProductivity error:", err);
  }
}


/** POST /api/ward-report */
router.post("/", requireBearer, async (req, res) => {
  try {
    const record = buildRecord(req.body);
    if (!requireCore(record))
      return res.status(400).json({ message: "missing core fields" });

    const [subs] = await db.query(
      `SELECT type1,type2,type3,type4,type5
       FROM ward_reports
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
    const placeholders = cols.map(() => "?").join(",");
    const updates = cols
      .filter(
        (c) => !["username", "wardname", "date", "shift", "subward"].includes(c)
      )
      .map((c) => `${c}=VALUES(${c})`)
      .join(", ");
    const sql = `
      INSERT INTO ward_reports (${cols.join(",")})
      VALUES (${placeholders})
      ON DUPLICATE KEY UPDATE ${updates}`;
    await db.query(
      sql,
      cols.map((c) => record[c])
    );

    // ✅ รอ 200ms แล้วค่อยอัปเดต productivity อีกครั้ง (เพื่อให้ข้อมูล subward ใหม่ถูก commit แล้ว)
    setTimeout(async () => {
      try {
        await updateMainProductivity(record);
      } catch (err) {
        console.warn("⚠️ Delayed updateMainProductivity failed:", err);
      }
    }, 200);

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
      `SELECT type1,type2,type3,type4,type5
       FROM ward_reports
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

    const setClause = Object.keys(record)
      .map((k) => `${k}=?`)
      .join(", ");
    await db.query(`UPDATE ward_reports SET ${setClause} WHERE id=?`, [
      ...Object.values(record),
      id,
    ]);

    // ✅ รอ 200ms แล้วค่อยอัปเดต productivity อีกครั้ง (เพื่อให้ข้อมูล subward ใหม่ถูก commit แล้ว)
    setTimeout(async () => {
      try {
        await updateMainProductivity(record);
      } catch (err) {
        console.warn("⚠️ Delayed updateMainProductivity failed:", err);
      }
    }, 200);

    return res.status(200).json({
      message: "อัพเดทสำเร็จ",
      productivity: record.productivity,
    });
  } catch (err) {
    return respondDbError(res, err);
  }
});

/* ✅ ดึง productivity เวอร์ชัน production (ไม่ส่ง 404) */
router.get("/productivity", async (req, res) => {
  try {
    const { date, shift, wardname } = req.query;
    if (!date || !shift || !wardname)
      return res.status(400).json({ message: "Missing required params" });

    const [rows] = await db.query(
      `SELECT productivity 
       FROM ward_reports 
       WHERE date=? AND shift=? AND wardname=? 
       ORDER BY rn DESC, bed_carry DESC LIMIT 1`,
      [date, shift, wardname]
    );

    if (!rows.length || rows[0].productivity == null)
      return res.status(200).json({ productivity: 0 });

    return res.status(200).json({ productivity: Number(rows[0].productivity) });
  } catch (err) {
    console.error("❌ Error in GET /ward-report/productivity:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
