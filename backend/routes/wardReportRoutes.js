// wardReportRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");

/* ----------------------- helpers ----------------------- */
const toMysqlDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
};
const toInt = (v) => (v === "" || v == null ? 0 : Number(v) || 0);
const isNonEmpty = (v) => typeof v === "string" && v.trim() !== "";

/** คืน { clause, params } สำหรับ WHERE subward */
const subwardCond = (subward) =>
  isNonEmpty(subward)
    ? { clause: "subward = ?", params: [subward.trim()] }
    : { clause: "(subward IS NULL OR subward = '')", params: [] };

/** whitelist ฟิลด์ที่อนุญาตให้บันทึก */
const ALLOWED_INT = new Set([
  "bed_carry", "bed_new", "bed_transfer_in",
  "discharge_home", "discharge_transfer_out", "discharge_refer_out", "discharge_refer_back", "discharge_died",
  "type1", "type2", "type3", "type4", "type5",
  "vent_invasive", "vent_noninvasive", "hfnc", "oxygen",
  "extra_bed", "pas", "cpr", "infection", "gcs", "stroke", "psych", "prisoner",
  "pre_op", "post_op",
  "rn", "pn", "na", "other_staff", "rn_extra", "rn_down"
]);
const ALLOWED_TEXT = new Set(["incident", "head_nurse"]);

/** สร้าง object record จาก body (กรอง whitelist และแปลงชนิดข้อมูล) */
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

  // ห้ามให้ client กำหนดค่า bed_remain (เป็น generated/calculated)
  delete rec.bed_remain;
  return rec;
};

const requireCore = (rec) =>
  !!(rec.username && rec.wardname && rec.date && rec.shift);

/** จัดการ error DB ให้สถานะ/ข้อความสม่ำเสมอ */
const respondDbError = (res, err) => {
  console.error("DB error:", {
    code: err.code, errno: err.errno, sqlState: err.sqlState,
    sqlMessage: err.sqlMessage, message: err.message,
  });

  if (err.code === "ER_NON_DEFAULT_VALUE_FOR_GENERATED_COLUMN") {
    return res.status(400).json({ message: "bed_remain เป็น generated column ห้ามกำหนดค่า" });
  }
  if (err.code === "ER_BAD_FIELD_ERROR") {
    return res.status(400).json({ message: "Unknown column in payload" });
  }
  if (err.code === "ER_BAD_NULL_ERROR") {
    return res.status(400).json({ message: "Null not allowed for some field" });
  }
  if (err.code === "ER_NO_DEFAULT_FOR_FIELD") {
    return res.status(400).json({ message: "Required DB field missing (no default)" });
  }
  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ message: "Duplicate entry (unique key)" });
  }
  return res.status(500).json({ message: "Database error" });
};

/* ------------------- auth middleware ------------------- */
const requireBearer = (req, res, next) => {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token" });
  }
  try {
    jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    return next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/* ===================== Routes ===================== */

/** GET /api/ward-report
 *  ดึงรายงานของวัน/เวร/วอร์ด
 *  - ถ้ามี username จะค้นด้วย username ด้วย (original behavior)
 *  - ถ้าไม่มี username จะค้นเฉพาะ ward/date/shift/(subward)
 */
router.get("/", async (req, res) => {
  const { date, shift, wardname, username, subward } = req.query;
  if (!date || !shift || !wardname) {
    return res.status(400).json({
      message: "missing required query params",
      got: { date, shift, wardname, username, subward },
    });
  }

  const sw = subwardCond(subward);

  let sql, params;
  if (isNonEmpty(username)) {
    sql = `
      SELECT * FROM ward_reports
      WHERE date = ? AND shift = ? AND wardname = ? AND username = ? AND ${sw.clause}
      LIMIT 1
    `;
    params = [date, shift, wardname, username, ...sw.params];
  } else {
    sql = `
      SELECT * FROM ward_reports
      WHERE date = ? AND shift = ? AND wardname = ? AND ${sw.clause}
      LIMIT 1
    `;
    params = [date, shift, wardname, ...sw.params];
  }

  try {
    const [rows] = await db.query(sql, params);
    if (!rows || rows.length === 0) return res.status(204).send();
    return res.json(rows[0]);
  } catch (err) {
    return respondDbError(res, err);
  }
});

/** GET /api/ward-report/bed-total
 *  ดึงจำนวนเตียงจากตาราง wards; ไม่เจอคืน 0 (200)
 */
router.get("/bed-total", async (req, res) => {
  const wardname = req.query.wardname;
  const subward = req.query.subward;

  if (!isNonEmpty(wardname)) {
    return res.status(400).json({ message: "wardname required" });
  }

  try {
    // 1) ลองหาแบบตรงตัวก่อน (มี subward ก็ใช้ subward)
    const sw = subwardCond(subward);
    const [rows] = await db.query(
      `SELECT bed_total FROM wards WHERE wardname = ? AND ${sw.clause} LIMIT 1`,
      [wardname, ...sw.params]
    );

    // 2) ไม่พบและมี subward → ลองระดับ ward (subward IS NULL)
    if ((!rows || rows.length === 0) && isNonEmpty(subward)) {
      const [rows2] = await db.query(
        `SELECT bed_total FROM wards WHERE wardname = ? AND subward IS NULL LIMIT 1`,
        [wardname]
      );
      if (rows2 && rows2.length) {
        return res.json({ bed_total: Number(rows2[0].bed_total) || 0 });
      }
      return res.json({ bed_total: 0 });
    }

    // 3) พบหรือไม่พบตั้งแต่รอบแรก
    if (!rows || rows.length === 0) return res.json({ bed_total: 0 });
    return res.json({ bed_total: Number(rows[0].bed_total) || 0 });
  } catch (err) {
    console.error("GET /ward-report/bed-total error:", err);
    return res.status(500).json({ message: "Error fetching bed total" });
  }
});

/** POST /api/ward-report
 *  บันทึกรายงาน (upsert ด้วย UNIQUE KEY ถ้าตั้งไว้)
 *  คืน object ของแถวที่เป็นปัจจุบัน (row)
 */
router.post("/", requireBearer, async (req, res) => {
  try {
    const record = buildRecord(req.body);
    if (!requireCore(record)) {
      return res.status(400).json({ message: "username, wardname, date, shift are required" });
    }

    const cols = Object.keys(record);
    const placeholders = cols.map(() => "?").join(",");
    const values = cols.map((c) => record[c]);
    const updates = cols
      .filter((c) => !["username", "wardname", "date", "shift", "subward"].includes(c))
      .map((c) => `${c}=VALUES(${c})`)
      .join(", ");

    const sql = `
      INSERT INTO ward_reports (${cols.join(",")})
      VALUES (${placeholders})
      ${updates ? `ON DUPLICATE KEY UPDATE ${updates}` : ""}
    `;
    const [result] = await db.query(sql, values);

    // เพื่อความแน่นอน ให้ select แถวกลับมาจาก unique key (ward/date/shift/subward)
    const sw = subwardCond(record.subward);
    const [rows] = await db.query(
      `SELECT * FROM ward_reports WHERE date = ? AND shift = ? AND wardname = ? AND ${sw.clause} LIMIT 1`,
      [record.date, record.shift, record.wardname, ...sw.params]
    );

    if (!rows || rows.length === 0) {
      // unexpected, แต่รายงาน success แล้ว
      return res.status(200).json({ message: "บันทึกสำเร็จ (แต่ไม่พบแถวหลัง insert)" });
    }

    return res.status(200).json({ message: "บันทึกสำเร็จ", row: rows[0] });
  } catch (err) {
    return respondDbError(res, err);
  }
});

/** PUT /api/ward-report/:id
 *  อัปเดตรายงานตาม id (ไม่อนุญาต bed_remain)
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "id required" });

    const b = req.body || {};
    const allowed = {};

    // core (optional)
    if (b.date !== undefined) allowed.date = toMysqlDate(b.date);
    if (b.shift !== undefined) allowed.shift = String(b.shift);
    if (b.wardname !== undefined) allowed.wardname = String(b.wardname);
    if (b.username !== undefined) allowed.username = String(b.username);
    if (b.subward !== undefined) {
      allowed.subward = isNonEmpty(b.subward) ? String(b.subward).trim() : null;
    }

    // numeric/text
    for (const [k, v] of Object.entries(b)) {
      if (ALLOWED_INT.has(k)) allowed[k] = toInt(v);
      else if (ALLOWED_TEXT.has(k)) allowed[k] = v ?? null;
    }
    delete allowed.bed_remain;

    const fields = Object.keys(allowed);
    if (fields.length === 0) {
      return res.status(400).json({ message: "no fields to update" });
    }

    const setClause = fields.map((f) => `${f} = ?`).join(", ");
    const values = fields.map((f) => allowed[f]);

    const sql = `UPDATE ward_reports SET ${setClause} WHERE id = ?`;
    await db.query(sql, [...values, id]);

    // คืน row ที่อัปเดตแล้วกลับ (เพื่อความสะดวก client)
    const [rows] = await db.query(`SELECT * FROM ward_reports WHERE id = ? LIMIT 1`, [id]);
    return res.status(200).json({ message: "อัปเดตสำเร็จ", row: rows && rows[0] ? rows[0] : null });
  } catch (err) {
    return respondDbError(res, err);
  }
});

module.exports = router;
