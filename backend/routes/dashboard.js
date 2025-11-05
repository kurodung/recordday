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

    const {
      start,
      end,
      date,
      dateFrom,
      dateTo,
      shift,
      ward,
      wardname,
    } = req.query;

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
      where.push(`dr.wardname IN (SELECT wardname FROM wards WHERE department_id = ?)`); 
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

    // ✅ ดึงข้อมูลรวม พร้อมคำนวณ remain_* จากสูตร
    const sql = `
      SELECT
        -- DF
        SUM(COALESCE(dr.new_df, 0))       AS new_df,
        SUM(COALESCE(dr.discharge_df, 0)) AS dis_df,
        SUM(COALESCE(dr.died_df, 0))      AS died_df,
        SUM(COALESCE(dr.carry_df, 0))     AS carry_df,
        SUM(COALESCE(dr.transfer_df, 0))  AS transfer_df,
        SUM(
          (COALESCE(dr.carry_df, 0) + COALESCE(dr.new_df, 0) + COALESCE(dr.transfer_df, 0))
          - (COALESCE(dr.discharge_df, 0) + COALESCE(dr.move_df, 0) + COALESCE(dr.died_df, 0))
        ) AS calc_rem_df,

        -- DHF
        SUM(COALESCE(dr.new_dhf, 0))       AS new_dhf,
        SUM(COALESCE(dr.discharge_dhf, 0)) AS dis_dhf,
        SUM(COALESCE(dr.died_dhf, 0))      AS died_dhf,
        SUM(COALESCE(dr.carry_dhf, 0))     AS carry_dhf,
        SUM(COALESCE(dr.transfer_dhf, 0))  AS transfer_dhf,
        SUM(
          (COALESCE(dr.carry_dhf, 0) + COALESCE(dr.new_dhf, 0) + COALESCE(dr.transfer_dhf, 0))
          - (COALESCE(dr.discharge_dhf, 0) + COALESCE(dr.move_dhf, 0) + COALESCE(dr.died_dhf, 0))
        ) AS calc_rem_dhf,

        -- DSS
        SUM(COALESCE(dr.new_dss, 0))       AS new_dss,
        SUM(COALESCE(dr.discharge_dss, 0)) AS dis_dss,
        SUM(COALESCE(dr.died_dss, 0))      AS died_dss,
        SUM(COALESCE(dr.carry_dss, 0))     AS carry_dss,
        SUM(COALESCE(dr.transfer_dss, 0))  AS transfer_dss,
        SUM(
          (COALESCE(dr.carry_dss, 0) + COALESCE(dr.new_dss, 0) + COALESCE(dr.transfer_dss, 0))
          - (COALESCE(dr.discharge_dss, 0) + COALESCE(dr.move_dss, 0) + COALESCE(dr.died_dss, 0))
        ) AS calc_rem_dss
      FROM dengue_reports dr
      WHERE ${where.join(" AND ")}
    `;

    const [rows] = await db.query(sql, params);
    const r = rows?.[0] || {};

    const data = [
      {
        dengue_type: "DF",
        admit_new:      Number(r.new_df  || 0),
        discharge_home: Number(r.dis_df  || 0),
        discharge_died: Number(r.died_df || 0),
        bed_remain: Number(r.calc_rem_df || 0),
      },
      {
        dengue_type: "DHF",
        admit_new:      Number(r.new_dhf  || 0),
        discharge_home: Number(r.dis_dhf  || 0),
        discharge_died: Number(r.died_dhf || 0),
        bed_remain: Number(r.calc_rem_dhf || 0),
      },
      {
        dengue_type: "DSS",
        admit_new:      Number(r.new_dss  || 0),
        discharge_home: Number(r.dis_dss  || 0),
        discharge_died: Number(r.died_dss || 0),
        bed_remain: Number(r.calc_rem_dss || 0),
      },
    ];

    // ✅ รวมทั้งหมด
    const total = data.reduce(
      (a, x) => ({
        dengue_type: "รวม",
        admit_new:      a.admit_new      + x.admit_new,
        discharge_home: a.discharge_home + x.discharge_home,
        discharge_died: a.discharge_died + x.discharge_died,
        bed_remain:     a.bed_remain     + x.bed_remain,
      }),
      { dengue_type: "รวม", admit_new: 0, discharge_home: 0, discharge_died: 0, bed_remain: 0 }
    );

    res.json({ ok: true, data, total });
  } catch (err) {
    console.error("GET /dashboard/dengue-summary error:", err);
    res.status(500).json({ ok: false, message: "Database error" });
  }
});


module.exports = router;
