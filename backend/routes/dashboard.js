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
  // console.log(`[${label}] SQL:`, sql.replace(/\s+/g, " ").trim());
  // console.log(`[${label}] Params:`, params);
}

/** ใช้ subward (ไม่ใช่ sub_ward) และตัดซ้ำด้วย DISTINCT */
const JOIN_WARDS = `
LEFT JOIN (
  SELECT DISTINCT w.wardname, w.subward, d.department_name AS department
  FROM wards w
  LEFT JOIN departments d ON w.department_id = d.id
) w
  ON w.wardname = vu.wardname
 AND COALESCE(TRIM(vu.subward),'') = COALESCE(TRIM(w.subward),'')
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

  // วันที่
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

  if (has(shift)) {
    where.push(`vu.shift = ?`);
    params.push(shift.trim());
  }

  // บังคับวอร์ดสำหรับ non-admin (ถ้าต้องการรวมทั้ง รพ. ให้ส่งผ่าน forceWardLimit:false)
  const wardParam = has(wardname) ? wardname : ward;
  if (forceWardLimit) {
    const effectiveWard = isAdmin ? wardParam || "" : user.wardname || "";
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
 * GET /api/dashboard  (แถวดิบ)
 * ----------------------------------------------- */
router.get("/", requireBearer, async (req, res) => {
  try {
    const { where, params, needsJoinWards, department } = buildFilters(req, {
      forceWardLimit: true,
    });

    const joinWards = needsJoinWards ? JOIN_WARDS : "";
    if (needsJoinWards && department) {
      where.push(`TRIM(d.department_name) = TRIM(?)`);
      params.push(department);
    }
    const selectDepartment = needsJoinWards
      ? "TRIM(w.department)          AS department"
      : "NULL                        AS department";

    const sql = `
      SELECT
        vu.report_date              AS report_date,
        vu.report_date              AS date,
        vu.shift                    AS shift,
        vu.wardname                 AS wardname,
        vu.subward                  AS subward,
        vu.source                   AS source,

        vu.bed_total                AS bed_total,
        vu.bed_carry                AS bed_carry,
        vu.bed_carry                AS carry_forward,
        vu.bed_new                  AS bed_new,
        vu.bed_transfer_in          AS bed_transfer_in,
        vu.bed_transfer_in          AS admit_transfer_in,
        vu.discharge_home           AS discharge_home,
        vu.discharge_transfer_out   AS discharge_transfer_out,
        vu.discharge_refer_out      AS discharge_refer_out,
        vu.discharge_refer_back     AS discharge_refer_back,
        vu.discharge_died           AS discharge_died,
        vu.discharge_died           AS discharge_death,
        vu.bed_remain               AS bed_remain,
        vu.type4                    AS type4,
        vu.type5                    AS type5,
        COALESCE(vu.vent_invasive,0)     AS vent_invasive,
        COALESCE(vu.vent_noninvasive,0)  AS vent_noninvasive,
        COALESCE(vu.stroke,0)            AS stroke,
        COALESCE(vu.extra_bed,0)         AS extra_bed,
        COALESCE(vu.psych,0)             AS psych,
        COALESCE(vu.prisoner,0)          AS prisoner,
        COALESCE(vu.rn,0)                AS rn,
        COALESCE(vu.rn_extra,0)          AS rn_extra,

        vu.productivity             AS productivity,

        ${selectDepartment}
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
 * GET /api/dashboard/summary  (รวมตาม ward/subward)
 * ----------------------------------------------- */
router.get("/summary", requireBearer, async (req, res) => {
  try {
    const { where, params, needsJoinWards, department } = buildFilters(req, {
      forceWardLimit: false,
    });

    const joinWards = needsJoinWards ? JOIN_WARDS : "";
    if (needsJoinWards && department) {
      where.push(`TRIM(d.department_name) = TRIM(?)`);
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
      ${joinWards}
      WHERE ${where.join(" AND ")}
      GROUP BY vu.wardname, vu.subward
      ORDER BY vu.wardname, vu.subward
    `;

    logQuery("GET /dashboard/summary", sql, params);
    const [rows] = await db.query(sql, params);

    // แถวรวม “รวม”
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
          "type4",
          "type5",
          "vent_invasive",
          "vent_noninvasive",
          "stroke",
          "extra_bed",
          "psych",
          "prisoner",
          "rn",
          "rn_extra",
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

/** --------- JOIN สำหรับ dengue (ใช้ตอนกรอง department) --------- **/
const JOIN_WARDS_DENGUE = `
LEFT JOIN (
  SELECT DISTINCT w.wardname, w.subward, d.department_name AS department
  FROM wards w
  LEFT JOIN departments d ON w.department_id = d.id
) w
  ON w.wardname = dr.wardname
 AND COALESCE(TRIM(dr.subward),'') = COALESCE(TRIM(w.subward),'')
`;

/** ฟิลเตอร์สำหรับ dengue_reports (alias: dr) */
function buildDengueFilters(req, { forceWardLimit = false } = {}) {
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

  // NOTE: ตารางนี้ใช้คอลัมน์วันที่ชื่อ 'date'
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

  if (has(shift)) {
    where.push(`dr.shift = ?`);
    params.push(shift.trim());
  }

  // จำกัดสิทธิ์ตาม ward สำหรับ non-admin (ถ้าอยากรวมทั้ง รพ. ไม่ต้องส่ง ward มา)
  const wardParam = has(wardname) ? wardname : ward;
  if (forceWardLimit) {
    const effectiveWard = isAdmin ? wardParam || "" : user.wardname || "";
    if (has(effectiveWard)) {
      where.push(`dr.wardname = ?`);
      params.push(effectiveWard.trim());
    }
  } else if (has(wardParam)) {
    where.push(`dr.wardname = ?`);
    params.push(wardParam.trim());
  }

  if (has(subward)) {
    where.push(`dr.subward = ?`);
    params.push(subward.trim());
  }

  const needsJoinWards = has(department);

  return {
    where,
    params,
    needsJoinWards,
    department: has(department) ? department.trim() : null,
  };
}

/** ------------------------------------------------
 * GET /api/dashboard/dengue-summary
 *  สรุป DF/DHF/DSS: รับใหม่, กลับบ้าน, เสียชีวิต, คงพยาบาล
 *  (รวมจากคอลัมน์ *_df, *_dhf, *_dss)
 * ----------------------------------------------- */
router.get("/dengue-summary", requireBearer, async (req, res) => {
  try {
    const { where, params, needsJoinWards, department } = buildDengueFilters(
      req,
      {
        forceWardLimit: false, // อยากรวมทั้ง รพ. ได้เว้นแต่ส่ง ward มากรอง
      }
    );

    const joinWards = needsJoinWards ? JOIN_WARDS_DENGUE : "";
    if (needsJoinWards && department) {
      where.push(`TRIM(d.department_name) = TRIM(?)`);
      params.push(department);
    }

    // ดึงยอดรวมครั้งเดียว แล้วค่อยแตกเป็น 3 แถวในโค้ด
    const sql = `
      SELECT
        SUM(COALESCE(dr.new_df,        0)) AS new_df,
        SUM(COALESCE(dr.discharge_df,  0)) AS dis_df,
        SUM(COALESCE(dr.died_df,       0)) AS died_df,
        SUM(COALESCE(dr.remain_df,     0)) AS rem_df,

        SUM(COALESCE(dr.new_dhf,       0)) AS new_dhf,
        SUM(COALESCE(dr.discharge_dhf, 0)) AS dis_dhf,
        SUM(COALESCE(dr.died_dhf,      0)) AS died_dhf,
        SUM(COALESCE(dr.remain_dhf,    0)) AS rem_dhf,

        SUM(COALESCE(dr.new_dss,       0)) AS new_dss,
        SUM(COALESCE(dr.discharge_dss, 0)) AS dis_dss,
        SUM(COALESCE(dr.died_dss,      0)) AS died_dss,
        SUM(COALESCE(dr.remain_dss,    0)) AS rem_dss
      FROM dengue_reports dr
      ${joinWards}
      WHERE ${where.join(" AND ")}
    `;

    const [rows] = await db.query(sql, params);
    const r = rows?.[0] || {};

    const data = [
      {
        dengue_type: "DF",
        admit_new: Number(r.new_df || 0),
        discharge_home: Number(r.dis_df || 0),
        discharge_died: Number(r.died_df || 0),
        bed_remain: Number(r.rem_df || 0),
      },
      {
        dengue_type: "DHF",
        admit_new: Number(r.new_dhf || 0),
        discharge_home: Number(r.dis_dhf || 0),
        discharge_died: Number(r.died_dhf || 0),
        bed_remain: Number(r.rem_dhf || 0),
      },
      {
        dengue_type: "DSS",
        admit_new: Number(r.new_dss || 0),
        discharge_home: Number(r.dis_dss || 0),
        discharge_died: Number(r.died_dss || 0),
        bed_remain: Number(r.rem_dss || 0),
      },
    ];

    const total = data.reduce(
      (a, x) => ({
        dengue_type: "รวม",
        admit_new: a.admit_new + x.admit_new,
        discharge_home: a.discharge_home + x.discharge_home,
        discharge_died: a.discharge_died + x.discharge_died,
        bed_remain: a.bed_remain + x.bed_remain,
      }),
      {
        dengue_type: "รวม",
        admit_new: 0,
        discharge_home: 0,
        discharge_died: 0,
        bed_remain: 0,
      }
    );

    res.json({ ok: true, data, total });
  } catch (err) {
    console.error("GET /dashboard/dengue-summary error:", err);
    res.status(500).json({ ok: false, message: "Database error" });
  }
});

/** ------------------------------------------------
 * GET /api/dashboard/summary/movement  (รวมทั้ง รพ.)
 * ----------------------------------------------- */
router.get("/summary/movement", requireBearer, async (req, res) => {
  try {
    const { where, params, needsJoinWards, department } = buildFilters(req, {
      forceWardLimit: false,
    });

    const joinWards = needsJoinWards ? JOIN_WARDS : "";
    if (needsJoinWards && department) {
      where.push(`TRIM(d.department_name) = TRIM(?)`);
      params.push(department);
    }

    const sql = `
      SELECT
        SUM(vu.bed_carry)              AS carryForward,
        SUM(vu.bed_new)                AS admitNew,
        SUM(vu.bed_transfer_in)        AS admitTransferIn,
        SUM(vu.discharge_home)         AS disHome,
        SUM(vu.discharge_transfer_out) AS disMoveWard,
        SUM(vu.discharge_refer_out)    AS disReferOut,
        SUM(vu.discharge_refer_back)   AS disReferBack,
        SUM(vu.discharge_died)         AS disDeath
      FROM v_reports_unified vu
      ${joinWards}
      WHERE ${where.join(" AND ")}
    `;

    logQuery("GET /dashboard/summary/movement", sql, params);
    const [rows] = await db.query(sql, params);
    const row = rows?.[0] || {};

    const carryForward = Number(row.carryForward) || 0;
    const admitNew = Number(row.admitNew) || 0;
    const admitTransferIn = Number(row.admitTransferIn) || 0;
    const disHome = Number(row.disHome) || 0;
    const disMoveWard = Number(row.disMoveWard) || 0;
    const disReferOut = Number(row.disReferOut) || 0;
    const disReferBack = Number(row.disReferBack) || 0;
    const disDeath = Number(row.disDeath) || 0;

    const admitAll = admitNew + admitTransferIn;
    const dischargeAll =
      disHome + disMoveWard + disReferOut + disReferBack + disDeath;
    const remain = carryForward + admitAll - dischargeAll;

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
      count: 1,
    });
  } catch (err) {
    console.error("GET /dashboard/summary/movement error:", err);
    res.status(500).json({ message: "Database error" });
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
      where.push("d.department_name = TRIM(?)");
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
