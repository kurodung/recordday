// routes/dashboard.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
const { ICUAD_WARDS, ICUCH_WARDS } = require("../constants/wards");

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

/** --------- Build filter conditions --------- **/
function buildFilters(req, { forceWardLimit = true } = {}) {
  const user = req.user || {};
  const role = String(user.role_id);
  const isAdmin = role === "4";
  const isHeadNurse = role === "2";
  const isSupervisor = role === "3";
  const isUser = role === "1";

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

  // ----- วันที่ -----
  const _start = start || dateFrom || date || null;
  const _end = end || dateTo || date || null;

  if (_start && _end) {
    where.push(
      `vu.report_date >= ? AND vu.report_date < DATE_ADD(?, INTERVAL 1 DAY)`
    );
    params.push(_start, _end);
  } else if (_start) {
    where.push(`vu.report_date >= ?`);
    params.push(_start);
  } else if (_end) {
    where.push(`vu.report_date < DATE_ADD(?, INTERVAL 1 DAY)`);
    params.push(_end);
  }

  // ----- เวร -----
  if (has(shift)) {
    where.push(`vu.shift = ?`);
    params.push(shift.trim());
  }

  // ----- จำกัดสิทธิ์ตาม role -----
  if (isAdmin) {
    // เห็นทุกอย่าง
  } else if (isHeadNurse && user.department_id) {
    where.push(`vu.department_id = ?`);
    params.push(user.department_id);
  } else if (isSupervisor || isUser) {
    if (user.wardname) {
      where.push(`TRIM(vu.wardname) = TRIM(?)`);
      params.push(user.wardname.trim());
    }
  }

  // ----- ถ้าเลือกกลุ่มงานเองจาก Dashboard -----
  if (has(department)) {
    where.push(`(vu.department_id = ? OR TRIM(vu.department_name) = TRIM(?))`);
    params.push(department.trim(), department.trim());
  }

  return { where, params };
}

/** ------------------------------------------------
 * GET /api/dashboard  (ข้อมูลรายแถว)
 * ----------------------------------------------- */
router.get("/", requireBearer, async (req, res) => {
  try {
    const { where, params } = buildFilters(req, { forceWardLimit: true });

    const sql = `
      SELECT
        vu.id,
        vu.report_date AS date,
        vu.shift,
        vu.wardname,
        vu.subward,
        vu.source,
        vu.bed_total,
        vu.bed_carry,
        vu.bed_new,
        vu.bed_transfer_in,
        vu.discharge_home,
        vu.discharge_transfer_out,
        vu.discharge_refer_out,
        vu.discharge_refer_back,
        vu.discharge_died,
        vu.bed_remain,
        vu.type1, vu.type2, vu.type3, vu.type4, vu.type5,
        vu.vent_invasive,
        vu.vent_noninvasive,
        vu.stroke,
        vu.extra_bed,
        vu.psych,
        vu.prisoner,
        vu.rn,
        vu.rn_extra,
        vu.productivity,
        vu.department_id,
        vu.department_name
      FROM v_reports_unified vu
      WHERE ${where.join(" AND ")}
      ORDER BY vu.report_date DESC, vu.wardname, vu.subward
    `;

    const [rows] = await db.query(sql, params);
    res.json(rows || []);
  } catch (err) {
    console.error("GET /dashboard error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

/** ------------------------------------------------
 * GET /api/dashboard/summary  (รวมตาม ward/subward)
 * ----------------------------------------------- */
router.get("/summary", requireBearer, async (req, res) => {
  try {
    const { where, params } = buildFilters(req, { forceWardLimit: false });

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
        SUM(vu.bed_remain)             AS bed_remain,
        SUM(vu.type4)                  AS type4,
        SUM(vu.type5)                  AS type5,
        SUM(COALESCE(vu.vent_invasive,0))    AS vent_invasive,
        SUM(COALESCE(vu.vent_noninvasive,0)) AS vent_noninvasive,
        SUM(COALESCE(vu.stroke,0))            AS stroke,
        SUM(COALESCE(vu.extra_bed,0))         AS extra_bed,
        SUM(COALESCE(vu.psych,0))             AS psych,
        SUM(COALESCE(vu.prisoner,0))          AS prisoner,
        SUM(COALESCE(vu.rn,0))                AS rn,
        SUM(COALESCE(vu.rn_extra,0))          AS rn_extra
      FROM v_reports_unified vu
      WHERE ${where.join(" AND ")}
      GROUP BY vu.wardname, vu.subward
      ORDER BY vu.wardname, vu.subward
    `;

    const [rows] = await db.query(sql, params);

    // รวมแถวสุดท้าย
    const total = rows.reduce(
      (t, r) => {
        for (const k in r) {
          if (["wardname", "subward"].includes(k)) continue;
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
 * GET /api/dashboard/departments
 * ----------------------------------------------- */
router.get("/departments", requireBearer, async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT d.id, d.department_name AS department
      FROM departments d
      JOIN wards w ON d.id = w.department_id
      ORDER BY d.department_name
    `);
    res.json(rows);
  } catch (e) {
    console.error("GET /dashboard/departments error:", e);
    res.status(500).json({ ok: false, message: "internal error" });
  }
});

/** ------------------------------------------------
 * GET /api/dashboard/wards-by-department
 * ----------------------------------------------- */
router.get("/wards-by-department", requireBearer, async (req, res) => {
  try {
    const { department } = req.query;
    const where = [];
    const params = [];

    if (has(department)) {
      where.push("(w.department_id = ? OR TRIM(d.department_name) = TRIM(?))");
      params.push(department.trim(), department.trim());
    }

    const sql = `
      SELECT DISTINCT w.wardname
      FROM wards w
      LEFT JOIN departments d ON w.department_id = d.id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY w.wardname
    `;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("GET /dashboard/wards-by-department error:", e);
    res.status(500).json({ ok: false, message: "internal error" });
  }
});

/** ------------------------------------------------
 * GET /api/dashboard/dengue-summary
 *  สรุป DF / DHF / DSS: รับใหม่, กลับบ้าน, เสียชีวิต, คงพยาบาล (คำนวณจากสูตร)
 * ----------------------------------------------- */
router.get("/dengue-summary", requireBearer, async (req, res) => {
  try {
    const user = req.user || {};
    const role = String(user.role_id);
    const isAdmin = role === "4";
    const isHeadNurse = role === "2";
    const isSupervisor = role === "3";
    const isUser = role === "1";

    const { start, end, date, dateFrom, dateTo, shift, ward, wardname } =
      req.query;

    const where = ["1=1"];
    const params = [];

    // วันที่
    const _start = start || dateFrom || date || null;
    const _end = end || dateTo || date || null;
    if (_start && _end) {
      where.push(`dr.date >= ? AND dr.date < DATE_ADD(?, INTERVAL 1 DAY)`);
      params.push(_start, _end);
    } else if (_start) {
      where.push(`dr.date >= ?`);
      params.push(_start);
    } else if (_end) {
      where.push(`dr.date < DATE_ADD(?, INTERVAL 1 DAY)`);
      params.push(_end);
    }

    // เวร
    if (shift) {
      where.push(`dr.shift = ?`);
      params.push(shift.trim());
    }

    // จำกัดสิทธิ์ตาม role
    if (isAdmin) {
      // เห็นทั้งหมด
    } else if (isHeadNurse && user.department_id) {
      // หัวหน้าตึกเห็น ward ทั้งหมดในแผนกเดียวกัน
      where.push(
        `dr.wardname IN (SELECT wardname FROM wards WHERE department_id = ?)`
      );
      params.push(user.department_id);
    } else if (isSupervisor || isUser) {
      if (user.wardname) {
        where.push(`TRIM(dr.wardname) = TRIM(?)`);
        params.push(user.wardname.trim());
      }
    }

    // กรอง ward ถ้ามีเลือกจาก filter
    const effectiveWard = wardname || ward;
    if (effectiveWard) {
      where.push(`TRIM(dr.wardname) = TRIM(?)`);
      params.push(effectiveWard.trim());
    }

    // ✅ Query template
    const dengueSql = (type) => `
  SELECT
    dr.wardname,
    dr.subward,
    '${type}' AS dengue_type,
    SUM(COALESCE(dr.new_${type.toLowerCase()}, 0))       AS admit_new,
    SUM(COALESCE(dr.discharge_${type.toLowerCase()}, 0)) AS discharge_home,
    SUM(COALESCE(dr.died_${type.toLowerCase()}, 0))      AS discharge_died,
    SUM(
      (COALESCE(dr.carry_${type.toLowerCase()}, 0)
      + COALESCE(dr.new_${type.toLowerCase()}, 0)
      + COALESCE(dr.transfer_${type.toLowerCase()}, 0))
      - (COALESCE(dr.discharge_${type.toLowerCase()}, 0)
      + COALESCE(dr.move_${type.toLowerCase()}, 0)
      + COALESCE(dr.died_${type.toLowerCase()}, 0))
    ) AS bed_remain
  FROM dengue_reports dr
  WHERE ${where.join(" AND ")}
  GROUP BY dr.wardname, dr.subward
  ORDER BY dr.wardname, dr.subward
`;

    const [dfRows] = await db.query(dengueSql("DF"), params);
    const [dhfRows] = await db.query(dengueSql("DHF"), params);
    const [dssRows] = await db.query(dengueSql("DSS"), params);

    // รวมทั้งหมด
    const rows = [...dfRows, ...dhfRows, ...dssRows];

    // ✅ รวมสรุปทั้งหมด
    // ✅ รวมสรุปทั้งหมด (แก้เวอร์ชันนี้)
    const total = rows.reduce(
      (a, x) => {
        a.admit_new += Number(x.admit_new) || 0;
        a.discharge_home += Number(x.discharge_home) || 0;
        a.discharge_died += Number(x.discharge_died) || 0;
        a.bed_remain += Number(x.bed_remain) || 0;
        return a;
      },
      {
        dengue_type: "รวม",
        admit_new: 0,
        discharge_home: 0,
        discharge_died: 0,
        bed_remain: 0,
      }
    );

    res.json({ ok: true, data: rows, total });
  } catch (err) {
    console.error("GET /dashboard/dengue-summary error:", err);
    res.status(500).json({ ok: false, message: "Database error" });
  }
});

/* =====================================================
   📊 รายเดือน: /api/dashboard/monthly-summary?year=2025
   ===================================================== */
router.get("/monthly-summary", requireBearer, async (req, res) => {
  try {
    const { year } = req.query;
    if (!year)
      return res.status(400).json({ ok: false, message: "กรุณาระบุปี" });

    const sql = `
      SELECT 
        YEAR(vu.report_date) AS year,
        MONTH(vu.report_date) AS month,

        -- 🏥 คงพยาบาลทั้งหมด
        SUM(COALESCE(vu.bed_remain,0)) AS ward_all,

           -- 🏥 วอร์ดพิเศษ
       SUM(CASE 
             WHEN vu.wardname LIKE '%พิเศษ%' 
               OR vu.subward LIKE '%พิเศษ%' 
               OR vu.wardname LIKE '%เฉลิม%' 
               OR vu.wardname LIKE '%VIP%' 
             THEN COALESCE(vu.bed_remain,0) 
             ELSE 0 
           END) AS ward_special,

       -- 🧠 ICU
       SUM(CASE 
             WHEN vu.wardname LIKE '%ICU%' 
               OR vu.subward LIKE '%ICU%' 
             THEN COALESCE(vu.bed_remain,0) 
             ELSE 0 
           END) AS icu_adult,

      SUM(CASE 
             WHEN vu.wardname LIKE '%NICU%' 
               OR vu.subward LIKE '%NICU%' 
             THEN COALESCE(vu.bed_remain,0) 
             ELSE 0 
           END) AS icu_child,

       -- 🧩 Semi ICU / ทารก
      SUM(CASE WHEN vu.wardname LIKE '%Semi%' OR vu.subward LIKE '%Semi%' THEN COALESCE(vu.bed_remain,0) ELSE 0 END) AS semi_icu,
       SUM(CASE WHEN vu.wardname LIKE '%ทารก%' OR vu.subward LIKE '%ทารก%' THEN COALESCE(vu.bed_remain,0) ELSE 0 END) AS newborn,

        -- 🧠 ประเภทผู้ป่วย
        SUM(COALESCE(vu.type5,0)) AS type5,
        SUM(COALESCE(vu.type4,0)) AS type4,
        SUM(COALESCE(vu.bed_new,0)) AS admit,
        SUM(COALESCE(vu.discharge_home,0)) AS home,
        SUM(COALESCE(vu.discharge_died,0)) AS died,

        -- 💨 Ventilator (ICU / ผู้ใหญ่ / เด็ก / รวม)
        SUM(CASE WHEN COALESCE(CONCAT(vu.wardname, ' - ', vu.subward), vu.wardname)
                  IN ('SICU 3','MICU 2','MICU 2 - AIIR','MICU 1','RCU','SICU 1','SICU 2','CCU','CVT','NICU','PICU')
                 THEN COALESCE(vu.vent_invasive,0)+COALESCE(vu.vent_noninvasive,0)
                 ELSE 0 END) AS vent_icu,

        SUM(CASE WHEN COALESCE(CONCAT(vu.wardname, ' - ', vu.subward), vu.wardname)
                  IN (
                    'หลังคลอด - ผู้ใหญ่','นรีเวชกรรม','Stroke Unit','เคมีบำบัด','EENT','พิเศษ EENT',
                    'อายุรกรรมหญิง 3 - อายุรกรรมหญิง 3','อายุรกรรมหญิง 3 - Semi ICU','พิเศษอายุรกรรม 3',
                    'อายุรกรรมหญิง 4 - อายุรกรรมหญิง 4','อายุรกรรมหญิง 4 - Semi ICU','พิเศษอายุรกรรม 4',
                    'อายุรกรรมชาย 5 - อายุรกรรมชาย 5','อายุรกรรมชาย 5 - Semi ICU','พิเศษอายุรกรรม 5',
                    'อายุรกรรมชาย 6 - อายุรกรรมชาย 6','อายุรกรรมชาย 6 - Semi ICU','พิเศษอายุรกรรม 6',
                    'อายุรกรรมชาย 7/สงฆ์','พิเศษอายุรกรรม 7',
                    'เฉลิมฯ 2 - ผู้ใหญ่','เฉลิมฯ 3 - ผู้ใหญ่','เฉลิมฯ 4 - ผู้ใหญ่',
                    'ออร์โธปิดิกส์ชาย - ออร์โธปิดิกส์ชาย','ออร์โธปิดิกส์ชาย - URO','พิเศษ 3',
                    'ออร์โธปิดิกส์หญิง','พิเศษ 4',
                    'ศัลยกรรมหญิง 1 - ศัลยกรรมหญิง 1','ศัลยกรรมหญิง 1 - Semi ICU',
                    'ศัลยกรรมหญิง 2 - ศัลยกรรมหญิง 2','ศัลยกรรมหญิง 2 - URO','พิเศษ 5',
                    'ศัลยกรรมชาย 2 - ศัลยกรรมชาย 2','ศัลยกรรมชาย 2 - Semi ICU','พิเศษ 6',
                    'ศัลยกรรมชาย 1 - ศัลยกรรมชาย 1','ศัลยกรรมชาย 1 - Semi ICU','พิเศษ 7','ปาริชาติ'
                  )
                 THEN COALESCE(vu.vent_invasive,0)+COALESCE(vu.vent_noninvasive,0)
                 ELSE 0 END) AS vent_adult,

        SUM(CASE WHEN COALESCE(CONCAT(vu.wardname, ' - ', vu.subward), vu.wardname)
                  IN ('SNB - SNB','SNB - NICU','กุมารเวชกรรม 1','กุมารเวชกรรม 2','พิเศษ 2')
                 THEN COALESCE(vu.vent_invasive,0)+COALESCE(vu.vent_noninvasive,0)
                 ELSE 0 END) AS vent_child,

        -- ✅ แก้ไข vent_total ให้รวมจาก 3 รายการข้างบนเท่านั้น
        SUM(CASE 
            WHEN COALESCE(CONCAT(vu.wardname, ' - ', vu.subward), vu.wardname) IN (
                -- รายการที่ 1 (ICU)
                'SICU 3','MICU 2','MICU 2 - AIIR','MICU 1','RCU','SICU 1','SICU 2','CCU','CVT','NICU','PICU'
            ) OR
            COALESCE(CONCAT(vu.wardname, ' - ', vu.subward), vu.wardname) IN (
                -- รายการที่ 2 (ผู้ใหญ่)
                'หลังคลอด - ผู้ใหญ่','นรีเวชกรรม','Stroke Unit','เคมีบำบัด','EENT','พิเศษ EENT',
                'อายุรกรรมหญิง 3 - อายุรกรรมหญิง 3','อายุรกรรมหญิง 3 - Semi ICU','พิเศษอายุรกรรม 3',
                'อายุรกรรมหญิง 4 - อายุรกรรมหญิง 4','อายุรกรรมหญิง 4 - Semi ICU','พิเศษอายุรกรรม 4',
                'อายุรกรรมชาย 5 - อายุรกรรมชาย 5','อายุรกรรมชาย 5 - Semi ICU','พิเศษอายุรกรรม 5',
                'อายุรกรรมชาย 6 - อายุรกรรมชาย 6','อายุรกรรมชาย 6 - Semi ICU','พิเศษอายุรกรรม 6',
                'อายุรกรรมชาย 7/สงฆ์','พิเศษอายุรกรรม 7',
                'เฉลิมฯ 2 - ผู้ใหญ่','เฉลิมฯ 3 - ผู้ใหญ่','เฉลิมฯ 4 - ผู้ใหญ่',
                'ออร์โธปิดิกส์ชาย - ออร์โธปิดิกส์ชาย','ออร์โธปิดิกส์ชาย - URO','พิเศษ 3',
                'ออร์โธปิดิกส์หญิง','พิเศษ 4',
                'ศัลยกรรมหญิง 1 - ศัลยกรรมหญิง 1','ศัลยกรรมหญิง 1 - Semi ICU',
                'ศัลยกรรมหญิง 2 - ศัลยกรรมหญิง 2','ศัลยกรรมหญิง 2 - URO','พิเศษ 5',
                'ศัลยกรรมชาย 2 - ศัลยกรรมชาย 2','ศัลยกรรมชาย 2 - Semi ICU','พิเศษ 6',
                'ศัลยกรรมชาย 1 - ศัลยกรรมชาย 1','ศัลยกรรมชาย 1 - Semi ICU','พิเศษ 7','ปาริชาติ'
            ) OR
            COALESCE(CONCAT(vu.wardname, ' - ', vu.subward), vu.wardname) IN (
                -- รายการที่ 3 (เด็ก)
                'SNB - SNB','SNB - NICU','กุมารเวชกรรม 1','กุมารเวชกรรม 2','พิเศษ 2'
            )
            THEN COALESCE(vu.vent_invasive,0)+COALESCE(vu.vent_noninvasive,0)
            ELSE 0 
        END) AS vent_total,

        -- อื่น ๆ
        SUM(COALESCE(vu.stroke,0)) AS stroke_total,
        SUM(COALESCE(vu.psych,0)) AS psych_total,
        SUM(COALESCE(vu.prisoner,0)) AS prisoner_total,
        SUM(COALESCE(vu.rn,0)+COALESCE(vu.rn_extra,0)) AS rn_total,
        ROUND(AVG(NULLIF(vu.productivity,0)),2) AS productivity

      FROM v_reports_unified vu
      WHERE (YEAR(vu.report_date) = ? OR YEAR(vu.report_date) = ? + 543)
      GROUP BY YEAR(vu.report_date), MONTH(vu.report_date)
      ORDER BY YEAR(vu.report_date), MONTH(vu.report_date)
    `;

    const [rows] = await db.query(sql, [year, year]);
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error("❌ monthly-summary error:", err.sqlMessage || err.message);
    res.status(500).json({
      ok: false,
      message: "โหลดรายเดือนล้มเหลว",
      error: err.sqlMessage || err.message,
    });
  }
});

/* =====================================================
   📊 รายปี: /api/dashboard/yearly-summary
   ===================================================== */
router.get("/yearly-summary", requireBearer, async (req, res) => {
  try {
    // ✅ ป้องกัน array ว่าง
    const ICUAD = ICUAD_WARDS?.length ? ICUAD_WARDS : ["ICU_AD_DUMMY"];
    const ICUCH = ICUCH_WARDS?.length ? ICUCH_WARDS : ["ICU_CH_DUMMY"];
    const placeholdersICUAD = ICUAD.map(() => "?").join(",");
    const placeholdersICUCH = ICUCH.map(() => "?").join(",");

    const sql = `
      SELECT 
        YEAR(vu.report_date) AS year,

        -- 🏥 คงพยาบาลทั้งหมด
        SUM(COALESCE(vu.bed_remain,0)) AS ward_all,

        -- 🏥 วอร์ดพิเศษ
        SUM(CASE 
              WHEN vu.wardname LIKE '%พิเศษ%' 
                OR vu.subward LIKE '%พิเศษ%' 
                OR vu.wardname LIKE '%เฉลิม%' 
                OR vu.wardname LIKE '%VIP%' 
              THEN COALESCE(vu.bed_remain,0) 
              ELSE 0 
            END) AS ward_special,

        -- 🧠 ICU
        SUM(CASE WHEN vu.wardname IN (${placeholdersICUAD})
                 THEN COALESCE(vu.bed_remain,0) ELSE 0 END) AS icu_adult,
        SUM(CASE WHEN vu.wardname IN (${placeholdersICUCH})
                 THEN COALESCE(vu.bed_remain,0) ELSE 0 END) AS icu_child,
        SUM(CASE WHEN vu.wardname IN (${placeholdersICUAD}) 
                       OR vu.wardname IN (${placeholdersICUCH})
                 THEN COALESCE(vu.bed_remain,0) ELSE 0 END) AS icu_all,

        -- 🛏️ Semi ICU / ทารก
        SUM(CASE WHEN vu.wardname LIKE '%Semi%' 
                  OR vu.subward LIKE '%Semi%' 
                 THEN COALESCE(vu.bed_remain,0) ELSE 0 END) AS semi_icu,
        SUM(CASE WHEN vu.wardname LIKE '%ทารก%' 
                  OR vu.subward LIKE '%ทารก%' 
                  OR vu.subward LIKE '%NB%' 
                  OR vu.subward LIKE '%NICU%' 
                 THEN COALESCE(vu.bed_remain,0) ELSE 0 END) AS newborn,

        -- 👨‍⚕️ ประเภทผู้ป่วย
        SUM(COALESCE(vu.type5,0)) AS type5,
        SUM(COALESCE(vu.type4,0)) AS type4,
        SUM(COALESCE(vu.bed_new,0)) AS admit,
        SUM(COALESCE(vu.discharge_home,0)) AS home,
        SUM(COALESCE(vu.discharge_died,0)) AS died,

        -- 💨 Ventilator (Fixed Logic)
        SUM(CASE 
            WHEN COALESCE(CONCAT(vu.wardname, ' - ', vu.subward), vu.wardname) IN (
                -- รายการที่ 1 (ICU)
                'SICU 3','MICU 2','MICU 2 - AIIR','MICU 1','RCU','SICU 1','SICU 2','CCU','CVT','NICU','PICU'
            )
            THEN COALESCE(vu.vent_invasive,0)+COALESCE(vu.vent_noninvasive,0)
            ELSE 0 
        END) AS vent_icu,

        SUM(CASE 
            WHEN COALESCE(CONCAT(vu.wardname, ' - ', vu.subward), vu.wardname) IN (
                -- รายการที่ 2 (ผู้ใหญ่)
                'หลังคลอด - ผู้ใหญ่','นรีเวชกรรม','Stroke Unit','เคมีบำบัด','EENT','พิเศษ EENT',
                'อายุรกรรมหญิง 3 - อายุรกรรมหญิง 3','อายุรกรรมหญิง 3 - Semi ICU','พิเศษอายุรกรรม 3',
                'อายุรกรรมหญิง 4 - อายุรกรรมหญิง 4','อายุรกรรมหญิง 4 - Semi ICU','พิเศษอายุรกรรม 4',
                'อายุรกรรมชาย 5 - อายุรกรรมชาย 5','อายุรกรรมชาย 5 - Semi ICU','พิเศษอายุรกรรม 5',
                'อายุรกรรมชาย 6 - อายุรกรรมชาย 6','อายุรกรรมชาย 6 - Semi ICU','พิเศษอายุรกรรม 6',
                'อายุรกรรมชาย 7/สงฆ์','พิเศษอายุรกรรม 7',
                'เฉลิมฯ 2 - ผู้ใหญ่','เฉลิมฯ 3 - ผู้ใหญ่','เฉลิมฯ 4 - ผู้ใหญ่',
                'ออร์โธปิดิกส์ชาย - ออร์โธปิดิกส์ชาย','ออร์โธปิดิกส์ชาย - URO','พิเศษ 3',
                'ออร์โธปิดิกส์หญิง','พิเศษ 4',
                'ศัลยกรรมหญิง 1 - ศัลยกรรมหญิง 1','ศัลยกรรมหญิง 1 - Semi ICU',
                'ศัลยกรรมหญิง 2 - ศัลยกรรมหญิง 2','ศัลยกรรมหญิง 2 - URO','พิเศษ 5',
                'ศัลยกรรมชาย 2 - ศัลยกรรมชาย 2','ศัลยกรรมชาย 2 - Semi ICU','พิเศษ 6',
                'ศัลยกรรมชาย 1 - ศัลยกรรมชาย 1','ศัลยกรรมชาย 1 - Semi ICU','พิเศษ 7','ปาริชาติ'
            )
            THEN COALESCE(vu.vent_invasive,0)+COALESCE(vu.vent_noninvasive,0)
            ELSE 0 
        END) AS vent_adult,

        SUM(CASE 
            WHEN COALESCE(CONCAT(vu.wardname, ' - ', vu.subward), vu.wardname) IN (
                -- รายการที่ 3 (เด็ก)
                'SNB - SNB','SNB - NICU','กุมารเวชกรรม 1','กุมารเวชกรรม 2','พิเศษ 2'
            )
            THEN COALESCE(vu.vent_invasive,0)+COALESCE(vu.vent_noninvasive,0)
            ELSE 0 
        END) AS vent_child,

        SUM(CASE 
            WHEN COALESCE(CONCAT(vu.wardname, ' - ', vu.subward), vu.wardname) IN (
                -- รายการที่ 1 (ICU)
                'SICU 3','MICU 2','MICU 2 - AIIR','MICU 1','RCU','SICU 1','SICU 2','CCU','CVT','NICU','PICU'
            ) OR
            COALESCE(CONCAT(vu.wardname, ' - ', vu.subward), vu.wardname) IN (
                -- รายการที่ 2 (ผู้ใหญ่)
                'หลังคลอด - ผู้ใหญ่','นรีเวชกรรม','Stroke Unit','เคมีบำบัด','EENT','พิเศษ EENT',
                'อายุรกรรมหญิง 3 - อายุรกรรมหญิง 3','อายุรกรรมหญิง 3 - Semi ICU','พิเศษอายุรกรรม 3',
                'อายุรกรรมหญิง 4 - อายุรกรรมหญิง 4','อายุรกรรมหญิง 4 - Semi ICU','พิเศษอายุรกรรม 4',
                'อายุรกรรมชาย 5 - อายุรกรรมชาย 5','อายุรกรรมชาย 5 - Semi ICU','พิเศษอายุรกรรม 5',
                'อายุรกรรมชาย 6 - อายุรกรรมชาย 6','อายุรกรรมชาย 6 - Semi ICU','พิเศษอายุรกรรม 6',
                'อายุรกรรมชาย 7/สงฆ์','พิเศษอายุรกรรม 7',
                'เฉลิมฯ 2 - ผู้ใหญ่','เฉลิมฯ 3 - ผู้ใหญ่','เฉลิมฯ 4 - ผู้ใหญ่',
                'ออร์โธปิดิกส์ชาย - ออร์โธปิดิกส์ชาย','ออร์โธปิดิกส์ชาย - URO','พิเศษ 3',
                'ออร์โธปิดิกส์หญิง','พิเศษ 4',
                'ศัลยกรรมหญิง 1 - ศัลยกรรมหญิง 1','ศัลยกรรมหญิง 1 - Semi ICU',
                'ศัลยกรรมหญิง 2 - ศัลยกรรมหญิง 2','ศัลยกรรมหญิง 2 - URO','พิเศษ 5',
                'ศัลยกรรมชาย 2 - ศัลยกรรมชาย 2','ศัลยกรรมชาย 2 - Semi ICU','พิเศษ 6',
                'ศัลยกรรมชาย 1 - ศัลยกรรมชาย 1','ศัลยกรรมชาย 1 - Semi ICU','พิเศษ 7','ปาริชาติ'
            ) OR
            COALESCE(CONCAT(vu.wardname, ' - ', vu.subward), vu.wardname) IN (
                -- รายการที่ 3 (เด็ก)
                'SNB - SNB','SNB - NICU','กุมารเวชกรรม 1','กุมารเวชกรรม 2','พิเศษ 2'
            )
            THEN COALESCE(vu.vent_invasive,0)+COALESCE(vu.vent_noninvasive,0)
            ELSE 0 
        END) AS vent_total,


        -- 🧠 อื่น ๆ
        SUM(COALESCE(vu.stroke,0)) AS stroke_total,
        SUM(COALESCE(vu.psych,0)) AS psych_total,
        SUM(COALESCE(vu.prisoner,0)) AS prisoner_total,
        SUM(COALESCE(vu.rn,0)+COALESCE(vu.rn_extra,0)) AS rn_total,
        ROUND(AVG(NULLIF(vu.productivity,0)),2) AS productivity

      FROM v_reports_unified vu
      GROUP BY YEAR(vu.report_date)
      ORDER BY YEAR(vu.report_date)
    `;

    const params = [
      ...ICUAD,
      ...ICUCH, // icu_adult + icu_child
      ...ICUAD,
      ...ICUCH, // icu_all
    ];

    const [rows] = await db.query(sql, params);
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error("❌ yearly-summary error:", err.sqlMessage || err.message);
    res.status(500).json({
      ok: false,
      message: "โหลดรายปีล้มเหลว",
      error: err.sqlMessage || err.message,
    });
  }
});

module.exports = router;
