// routes/dashboard.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");

/** --------- Auth --------- **/
const requireBearer = (req, res, next) => {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token" });
  }
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

const has = (v) => typeof v === "string" && v.trim() !== "";

/** --------- Small utils --------- **/
function logQuery(label, sql, params) {
  // เปิดไว้ดีเวลาตรวจสอบ; ถ้าไม่ต้องการก็ comment ได้
  //console.log(`[${label}] SQL:`, sql.replace(/\s+/g, " "));
  //console.log(`[${label}] Params:`, params);
}

const JOIN_WARDS = `
LEFT JOIN wards w
  ON w.wardname = vu.wardname
 AND COALESCE(vu.subward,'') = COALESCE(w.subward,'')  -- << ใช้ sub_ward ตัวเดียว
`;

// สร้าง WHERE เงื่อนไขตาม query filter (รองรับทั้ง start/end และ date/dateFrom/dateTo)
function buildFilters(req, { forceWardLimit = true } = {}) {
  const user = req.user || {};
  const isAdmin = String(user.username || "").toLowerCase() === "admin";

  const {
    start,
    end,
    date,
    dateFrom,
    dateTo,
    shift,
    ward,
    wardname,
    subward,
    department,
  } = req.query;

  const where = ["1=1"];
  const params = [];

  // วันที่: รองรับได้ 3 แนว (start/end) หรือ (date) หรือ (dateFrom/dateTo)
  const _start = start || dateFrom || date || null;
  const _end = end || dateTo || date || null;

  if (_start && _end) {
    // ปิดที่ < end + 1day
    where.push(`vu.report_date >= ? AND vu.report_date < DATE_ADD(?, INTERVAL 1 DAY)`);
    params.push(_start, _end);
  } else if (_start) {
    where.push(`vu.report_date >= ?`);
    params.push(_start);
  } else if (_end) {
    where.push(`vu.report_date < DATE_ADD(?, INTERVAL 1 DAY)`);
    params.push(_end);
  }

  if (has(shift)) {
    where.push(`vu.shift = ?`);
    params.push(shift.trim());
  }

  // สำหรับ admin เลือกได้ทั้ง ward/wardname; non-admin บังคับตาม token (ถ้าต้องการรวมทั้งรพ. ให้ set forceWardLimit=false)
  const wardParam = has(wardname) ? wardname : ward;
  if (forceWardLimit) {
    const effectiveWard = isAdmin ? (wardParam || "") : (user.wardname || "");
    if (has(effectiveWard)) {
      where.push(`vu.wardname = ?`);
      params.push(effectiveWard.trim());
    }
  } else if (has(wardParam)) {
    where.push(`vu.wardname = ?`);
    params.push(wardParam.trim());
  }

  if (has(subward)) {
    where.push(`vu.subward = ?`);
    params.push(subward.trim());
  }

  // ต้อง join wards ก็ต่อเมื่อมี filter department
  const needsJoinWards = has(department);

  return {
    where,
    params,
    needsJoinWards,
    department: has(department) ? department.trim() : null,
  };
}

/** ------------------------------------------------
 * GET /api/dashboard
 * คืน "แถวดิบ" จาก v_reports_unified (เป็นหลัก)
 * (alias คอลัมน์ให้เข้ากับของเดิมเท่าที่จำเป็น)
 * ----------------------------------------------- */
router.get("/", requireBearer, async (req, res) => {
  try {
    const { where, params, needsJoinWards, department } = buildFilters(req, {
      forceWardLimit: true, // non-admin จะถูกจำกัดตาม token. admin เลือกได้
    });

     const joinWards = JOIN_WARDS;

    if (department) {
      where.push(`TRIM(w.department) = TRIM(?)`);
      params.push(department);
    }

    const sql = `
      SELECT
        -- วัน/เวลาหลักจาก view
        vu.report_date              AS report_date,
        vu.report_date              AS date,            -- alias ให้โค้ดหน้าเดิมใช้ได้
        vu.shift                    AS shift,
        vu.wardname                 AS wardname,
        vu.subward                  AS subward,
        vu.source                   AS source,

        -- เตียง/เคลื่อนไหว
        vu.bed_total                AS bed_total,
        vu.bed_carry                AS bed_carry,
        vu.bed_carry                AS carry_forward,   -- alias ให้ helper เดิมอ่านได้
        vu.bed_new                  AS bed_new,
        vu.bed_transfer_in          AS bed_transfer_in,
        vu.bed_transfer_in          AS admit_transfer_in,  -- alias
        vu.discharge_home           AS discharge_home,
        vu.discharge_transfer_out   AS discharge_transfer_out,
        vu.discharge_refer_out      AS discharge_refer_out,
        vu.discharge_refer_back     AS discharge_refer_back,
        vu.discharge_died           AS discharge_died,
        vu.discharge_died           AS discharge_death, -- alias
        vu.bed_remain               AS bed_remain,

        -- อื่น ๆ
        vu.productivity             AS productivity,

        -- department จากตาราง wards
        TRIM(w.department)          AS department
      FROM v_reports_unified vu
      ${joinWards}
      WHERE ${where.join(" AND ")}
      ORDER BY vu.report_date DESC, vu.wardname, vu.subward
    `;

    logQuery("GET /dashboard", sql, params);
    const [rows] = await db.query(sql, params);
    res.json(rows || []);
  } catch (err) {
    console.error("GET /dashboard error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

/** ------------------------------------------------
 * GET /api/dashboard/summary
 * รวมผลตาม ward/sub-ward จาก v_reports_unified
 * ส่งกลับ { ok:true, data:[รายการ..., แถวรวม] }
 * ----------------------------------------------- */
router.get("/summary", requireBearer, async (req, res) => {
  try {
    // อนุญาต “ไม่จำกัด ward” ได้ (เพื่อสรุประดับ รพ.) => forceWardLimit:false
    const { where, params, needsJoinWards, department } = buildFilters(req, {
      forceWardLimit: false,
    });

    const joinWards = JOIN_WARDS;

    if (needsJoinWards && department) {
      where.push(`TRIM(w.department) = TRIM(?)`);
      params.push(department);
    }

    const sql = `
      SELECT
        vu.wardname,
        vu.subward,
        SUM(vu.bed_carry)              AS bed_carry,
        SUM(vu.bed_new)                AS bed_new,
        SUM(vu.bed_transfer_in)        AS bed_transfer_in,
        SUM(vu.discharge_home)         AS discharge_home,
        SUM(vu.discharge_transfer_out) AS discharge_transfer_out,
        SUM(vu.discharge_refer_out)    AS discharge_refer_out,
        SUM(vu.discharge_refer_back)   AS discharge_refer_back,
        SUM(vu.discharge_died)         AS discharge_died,
        SUM(vu.bed_remain)             AS bed_remain

      FROM v_reports_unified vu
      ${joinWards}
      WHERE ${where.join(" AND ")}
      GROUP BY vu.wardname, vu.subward
      ORDER BY vu.wardname, vu.subward
    `;

    logQuery("GET /dashboard/summary", sql, params);
    const [rows] = await db.query(sql, params);

    // สร้างแถวรวม “รวม”
    const total = rows.reduce(
      (t, r) => {
        for (const k of [
          "bed_carry",
          "bed_new",
          "bed_transfer_in",
          "discharge_home",
          "discharge_transfer_out",
          "discharge_refer_out",
          "discharge_refer_back",
          "discharge_died",
          "bed_remain",

        ]) {
          t[k] = (t[k] || 0) + (Number(r[k]) || 0);
        }
        return t;
      },
      { wardname: "รวม", subward: null }
    );

    res.json({ ok: true, data: [...rows, total] });
  } catch (err) {
    console.error("GET /dashboard/summary error:", err);
    res.status(500).json({ ok: false, message: "Database error" });
  }
});

/** ------------------------------------------------
 * GET /api/dashboard/summary/movement
 * รวมเคลื่อนไหว (carry, admit, discharge, remain)
 * อ้างอิงคอลัมน์จาก view โดยตรง
 * ----------------------------------------------- */
router.get("/summary/movement", requireBearer, async (req, res) => {
  try {
    // ไม่บังคับ ward เพื่อให้สรุประดับ รพ. ได้
    const { where, params, needsJoinWards, department } = buildFilters(req, {
      forceWardLimit: false,
    });

    const joinWards = JOIN_WARDS;

    if (needsJoinWards && department) {
      where.push(`TRIM(w.department) = TRIM(?)`);
      params.push(department);
    }

    const sql = `
      SELECT
        vu.bed_carry              AS bed_carry,
        vu.bed_new                AS bed_new,
        vu.bed_transfer_in        AS bed_transfer_in,
        vu.discharge_home         AS discharge_home,
        vu.discharge_transfer_out AS discharge_transfer_out,
        vu.discharge_refer_out    AS discharge_refer_out,
        vu.discharge_refer_back   AS discharge_refer_back,
        vu.discharge_died         AS discharge_died
      FROM v_reports_unified vu
      ${joinWards}
      WHERE ${where.join(" AND ")}
    `;

    logQuery("GET /dashboard/summary/movement", sql, params);
    const [rows] = await db.query(sql, params);

    const sum = (key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);

    const carryForward    = sum("bed_carry");
    const admitNew        = sum("bed_new");
    const admitTransferIn = sum("bed_transfer_in");
    const disHome         = sum("discharge_home");
    const disMoveWard     = sum("discharge_transfer_out"); // ใน view ใช้คอลัมน์นี้แทน 'move ward'
    const disReferOut     = sum("discharge_refer_out");
    const disReferBack    = sum("discharge_refer_back");
    const disDeath        = sum("discharge_died");

    const admitAll     = admitNew + admitTransferIn;
    const dischargeAll = disHome + disMoveWard + disReferOut + disReferBack + disDeath;
    const remain       = carryForward + admitAll - dischargeAll;

    res.json({
      carryForward,
      admitNew,
      admitTransferIn,
      admitAll,
      disHome,
      disMoveWard,
      disReferOut,
      disReferBack,
      disDeath,
      dischargeAll,
      remain,
      count: rows.length,
    });
  } catch (err) {
    console.error("GET /dashboard/summary/movement error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

/** ------------------------------------------------
 * GET /api/dashboard/departments
 * ใช้จากตาราง wards (เหมือนเดิม)
 * ----------------------------------------------- */
router.get("/departments", requireBearer, async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT DISTINCT TRIM(department) AS department
         FROM wards
        WHERE department IS NOT NULL AND TRIM(department) <> ''
        ORDER BY department`
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /dashboard/departments error:", e);
    res.status(500).json({ ok: false, message: "internal error" });
  }
});

/** ------------------------------------------------
 * GET /api/dashboard/wards-by-department
 * ใช้จากตาราง wards (เหมือนเดิม)
 * ----------------------------------------------- */
router.get("/wards-by-department", requireBearer, async (req, res) => {
  try {
    const { department } = req.query;
    const where = [];
    const params = [];
    if (has(department)) {
      where.push("TRIM(department) = TRIM(?)");
      params.push(department.trim());
    }

    const sql = `
      SELECT DISTINCT wardname
        FROM wards
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY wardname
    `;
    logQuery("GET /dashboard/wards-by-department", sql, params);

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("GET /dashboard/wards-by-department error:", e);
    res.status(500).json({ ok: false, message: "internal error" });
  }
});

module.exports = router;
