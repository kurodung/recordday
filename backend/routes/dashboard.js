// routes/dashboard.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");

const requireBearer = (req, res, next) => {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return res.status(401).json({ message: "No token" });
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

const has = (v) => typeof v === "string" && v.trim() !== "";

/** FROM ที่ normalize คอลัมน์ให้หน้าตาเหมือน ward_reports */
function getBaseFrom(src) {
  if ((src || "").toLowerCase() === "lr") {
    return `
      (
        SELECT
          date,
          shift,
          wardname AS wardname,
          COALESCE(subward, NULL) AS subward,
          bed_new,
          bed_transfer_in AS admit_transfer_in,
          discharge_home,
          discharge_transfer_out,
          NULL AS discharge_move_ward,           -- ไม่มีใน lr_reports
          discharge_refer_out,
          discharge_refer_back,
          discharge_died AS discharge_death,     -- ชื่อคอลัมน์ต่างกัน
          bed_carry AS carry_forward,            -- ยอดยกมา
          NULL AS brought_forward,
          NULL AS opening_census,
          NULL AS begin_balance,
          productivity,
          created_at,
          updated_at,
          NULL AS time
        FROM lr_reports
      ) AS wr
    `;
  }
  return `ward_reports wr`;
}

/** เงื่อนไข JOIN กับตาราง wards (รองรับทั้ง subward และ sub_ward) */
const JOIN_WARDS = `
  JOIN wards w
    ON w.wardname = wr.wardname
   AND (
        ( (wr.subward IS NULL OR wr.subward = '')
          AND (COALESCE(w.subward, w.sub_ward) IS NULL OR COALESCE(w.subward, w.sub_ward) = '')
        )
        OR wr.subward = COALESCE(w.subward, w.sub_ward)
   )
`;

/** LOG helper */
function logQuery(label, sql, params) {
  // พอใช้จริงค่อยปิดได้
  console.log(`[${label}] SQL:`, sql.replace(/\s+/g, " "));
  console.log(`[${label}] Params:`, params);
}

/** GET /api/dashboard */
router.get("/", requireBearer, async (req, res) => {
  try {
    const user = req.user || {};
    const isAdmin = String(user.username || "").toLowerCase() === "admin";

    const clientWard = req.query.ward; // optional (สำหรับ admin)
    const wardFilter = isAdmin ? clientWard : user.wardname;

    const { department, date, dateFrom, dateTo, subward, source } = req.query;

    // เลือกตารางฐานตาม source (lr หรือปกติ)
    const baseFrom =
      String(source || "").toLowerCase() === "lr"
        ? "lr_reports wr"
        : "ward_reports wr";

    // FROM + JOIN (join wards เสมอเพื่อดึง department)
    const from = [
      `FROM ${baseFrom}`,
      `LEFT JOIN wards w
         ON w.wardname = wr.wardname
        AND (
             (
               (wr.subward IS NULL OR wr.subward = '')
               AND (w.subward IS NULL OR w.subward = '')
             )
             OR (wr.subward = w.subward)
            )`,
    ];

    const where = ["1=1"];
    const params = [];

    // ตัวกรองตาม department (ถ้ามี) – ใช้คอลัมน์จากตาราง w
    if (typeof department === "string" && department.trim() !== "") {
      where.push("TRIM(w.department) = TRIM(?)");
      params.push(department.trim());
    }

    // กรองตาม ward (admin เลือกได้, non-admin ถูกบังคับ)
    if (typeof wardFilter === "string" && wardFilter.trim() !== "") {
      where.push("wr.wardname = ?");
      params.push(wardFilter.trim());
    }

    // subward
    if (typeof subward === "string" && subward.trim() !== "") {
      where.push("wr.subward = ?");
      params.push(subward.trim());
    }

    // วันที่
    if (typeof date === "string" && date) {
      where.push("wr.date = ?");
      params.push(date);
    } else {
      if (typeof dateFrom === "string" && dateFrom) {
        where.push("wr.date >= ?");
        params.push(dateFrom);
      }
      if (typeof dateTo === "string" && dateTo) {
        where.push("wr.date <= ?");
        params.push(dateTo);
      }
    }

    // SELECT ต้องดึง department ออกมาด้วย
    const sql =
      `SELECT wr.*, TRIM(w.department) AS department ` +
      from.join(" ") +
      ` WHERE ` +
      where.join(" AND ") +
      ` ORDER BY wr.date DESC, wr.id DESC `;

    // (ถ้าบาง environment ไม่มี created_at ก็เปลี่ยนเป็น ORDER BY wr.date DESC เฉยๆ ได้)
    const [rows] = await db.query(sql, params);
    return res.json(rows || []);
  } catch (err) {
    console.error("GET /dashboard error:", err);
    return res.status(500).json({ message: "Database error" });
  }
});


/** GET /api/dashboard/departments */
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

/** GET /api/dashboard/wards-by-department */
router.get("/wards-by-department", requireBearer, async (req, res) => {
  try {
    const { department } = req.query;
    const where = [];
    const params = [];
    if (has(department)) { where.push("TRIM(department) = TRIM(?)"); params.push(department.trim()); }

    const sql = `
      SELECT DISTINCT wardname
        FROM wards
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY wardname
    `;
    logQuery("wards-by-department", sql, params);

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("GET /dashboard/wards-by-department error:", e);
    res.status(500).json({ ok: false, message: "internal error" });
  }
});

/** GET /api/dashboard/summary/movement */
router.get("/summary/movement", requireBearer, async (req, res) => {
  try {
    const user = req.user || {};
    const isAdmin = String(user.username || "").toLowerCase() === "admin";

    const { department, date, dateFrom, dateTo, subward, source } = req.query;
    const wardFilter = isAdmin ? req.query.ward : user.wardname;

    const from = [`FROM ${getBaseFrom(source)}`];
    const where = ["1=1"];
    const params = [];

    if (has(department)) { from.push(JOIN_WARDS); where.push("TRIM(w.department) = TRIM(?)"); params.push(department.trim()); }
    if (has(wardFilter)) { where.push("wr.wardname = ?"); params.push(wardFilter.trim()); }
    if (has(subward))    { where.push("wr.subward = ?");  params.push(subward.trim()); }

    if (has(date)) { where.push("wr.date = ?"); params.push(date); }
    else {
      if (has(dateFrom)) { where.push("wr.date >= ?"); params.push(dateFrom); }
      if (has(dateTo))   { where.push("wr.date <= ?"); params.push(dateTo); }
    }

    const sql = `
      SELECT wr.*
      ${from.join(" ")}
      WHERE ${where.join(" AND ")}
      ORDER BY wr.date DESC, wr.id DESC
    `;
    logQuery("summary/movement", sql, params);

    const [rows] = await db.query(sql, params);

    const numFrom = (row, ks) => {
      for (const k of ks) {
        if (Object.prototype.hasOwnProperty.call(row, k)) {
          const v = parseFloat(row[k]);
          if (Number.isFinite(v)) return v;
        }
      }
      return 0;
    };
    const sum = (ks) => rows.reduce((s, r) => s + numFrom(r, Array.isArray(ks) ? ks : [ks]), 0);

    const carryForward    = sum(["carry_forward","brought_forward","opening_census","begin_balance","bed_carry"]);
    const admitNew        = sum(["bed_new"]);
    const admitTransferIn = sum(["admit_transfer_in","bed_transfer_in","transfer_in","receive_transfer_in"]);
    const disHome         = sum(["discharge_home"]);
    const disMoveWard     = sum(["discharge_move_ward","move_ward","transfer_intra"]);
    const disReferOut     = sum(["discharge_refer_out","discharge_transfer_out","refer_out"]);
    const disReferBack    = sum(["discharge_refer_back","refer_back"]);
    const disDeath        = sum(["discharge_death","discharge_died","death"]);

    const admitAll = admitNew + admitTransferIn;
    const dischargeAll = disHome + disMoveWard + disReferOut + disReferBack + disDeath;
    const remain = carryForward + admitAll - dischargeAll;

    res.json({ carryForward, admitNew, admitTransferIn, admitAll,
               disHome, disMoveWard, disReferOut, disReferBack, disDeath,
               dischargeAll, remain, count: rows.length });
  } catch (err) {
    console.error("GET /dashboard/summary/movement error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

module.exports = router;
