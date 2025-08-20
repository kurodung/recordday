// routes/dashboard.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");

/** auth middleware: ตรวจ Bearer แล้วผูก req.user */
const requireBearer = (req, res, next) => {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token" });
  }
  try {
    const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    req.user = decoded; // คาดว่ามี decoded.username, decoded.wardname
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/** helper */
const has = (v) => typeof v === "string" && v.trim() !== "";

/**
 * GET /api/dashboard
 * - admin: เห็นทั้งหมด (ถ้าส่ง ?ward=... มาก็กรองได้)
 * - non-admin: บังคับกรองตาม ward ของ user
 * - รองรับ ?department=... เพื่อกรองตามแผนก (join กับตาราง wards)
 * - ตัวกรองอื่นๆที่รองรับ: ?date=YYYY-MM-DD, ?dateFrom, ?dateTo
 */
router.get("/", requireBearer, async (req, res) => {
  try {
    const user = req.user || {};
    const isAdmin = String(user.username || "").toLowerCase() === "admin";

    const clientWard = req.query.ward; // optional (สำหรับ admin)
    const wardFilter = isAdmin ? clientWard : user.wardname;

    const { department, date, dateFrom, dateTo, subward } = req.query;

    // base
    const from = ["FROM ward_reports wr"];
    const where = ["1=1"];
    const params = [];

    // หากกรองตาม department ให้ join กับตาราง wards
    if (has(department)) {
      +from.push(
        `JOIN wards w
      ON w.wardname = wr.wardname
     AND (
         (
            (wr.subward IS NULL OR wr.subward = '')
           AND (w.subward IS NULL OR w.subward = '')
         )
         OR (wr.subward = w.subward)
        )`
      );
      where.push("TRIM(w.department) = TRIM(?)");
      params.push(department.trim());
    }

    // กรองตาม ward (admin เลือกได้, non-admin ถูกบังคับ)
    if (has(wardFilter)) {
      where.push("wr.wardname = ?");
      params.push(wardFilter.trim());
    }

    // ถ้ามี subward เพิ่มเติม
    if (has(subward)) {
      where.push("wr.subward = ?");
      params.push(subward.trim());
    }

    // ตัวกรองวันที่
    if (has(date)) {
      where.push("wr.date = ?");
      params.push(date);
    } else {
      if (has(dateFrom)) {
        where.push("wr.date >= ?");
        params.push(dateFrom);
      }
      if (has(dateTo)) {
        where.push("wr.date <= ?");
        params.push(dateTo);
      }
    }

    const sql =
      `SELECT wr.* ` +
      from.join(" ") +
      ` WHERE ` +
      where.join(" AND ") +
      ` ORDER BY wr.date DESC`;

    const [rows] = await db.query(sql, params);
    return res.json(rows || []);
  } catch (err) {
    console.error("GET /dashboard error:", err);
    return res.status(500).json({ message: "Database error" });
  }
});

/**
 * GET /api/dashboard/departments
 * - คืนรายชื่อแผนก (สำหรับ dropdown กรอง)
 */
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

/**
 * GET /api/dashboard/wards-by-department?department=อายุรกรรม
 * - คืนรายชื่อ ward ภายใต้ department ที่เลือก (ช่วยผูก filter ซ้อน)
 */
router.get("/wards-by-department", requireBearer, async (req, res) => {
  try {
    const { department } = req.query;
    const where = [];
    const params = [];
    if (has(department)) {
      where.push("TRIM(department) = TRIM(?)");
      params.push(department.trim());
    }
    const sql = `SELECT DISTINCT wardname
         FROM wards
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY wardname`;
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("GET /dashboard/wards-by-department error:", e);
    res.status(500).json({ ok: false, message: "internal error" });
  }
});

/**
 * GET /api/dashboard/summary/by-department
 * - รวมข้อมูลตาม department (ชื่อแผนกเดียวกันถูกรวมเป็นแถวเดียว)
 * - ใช้กับตาราง wards เพื่อสรุปเตียงรวมต่อแผนก
 * - พารามิเตอร์:
 *     ?department=...   (ถ้าส่งจะสรุปเฉพาะแผนกนั้น)
 *     ?ward=...         (ถ้าต้องการจำกัดให้แคบลง)
 *     ?includeWardCount=true  (คืนจำนวน ward ต่อแผนก)
 */
router.get("/summary/by-department", requireBearer, async (req, res) => {
  try {
    const { department, ward, includeWardCount } = req.query;

    const where = [];
    const params = [];

    if (has(department)) {
      where.push("TRIM(department) = TRIM(?)");
      params.push(department.trim());
    }
    if (has(ward)) {
      where.push("wardname = ?");
      params.push(ward.trim());
    }

    const pieces = [
      "SELECT TRIM(department) AS department",
      ", SUM(COALESCE(bed_total,0)) AS bed_total",
    ];
    if (String(includeWardCount).toLowerCase() === "true") {
      pieces.push(", COUNT(*) AS ward_count");
    }

    const sql =
      pieces.join(" ") +
      `  FROM wards
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        GROUP BY TRIM(department)
        ORDER BY department`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("GET /dashboard/summary/by-department error:", e);
    res.status(500).json({ ok: false, message: "internal error" });
  }
});

/**
 * GET /api/dashboard/summary/movement
 * รวมยอด ยอดยกมา / รับใหม่ / รับย้าย / จำหน่ายย่อย / คงพยาบาล
 * ตัวกรองเหมือนกับ /api/dashboard
 */
router.get("/summary/movement", requireBearer, async (req, res) => {
  try {
    const user = req.user || {};
    const isAdmin = String(user.username || "").toLowerCase() === "admin";

    const clientWard = req.query.ward; // optional (เฉพาะ admin)
    const wardFilter = isAdmin ? clientWard : user.wardname;

    const { department, date, dateFrom, dateTo, subward } = req.query;

    // --- สร้าง query เหมือน route หลัก ---
    const from = ["FROM ward_reports wr"];
    const where = ["1=1"];
    const params = [];

    if (has(department)) {
      from.push(
        `JOIN wards w
           ON w.wardname = wr.wardname
          AND (
               (
                 (wr.subward IS NULL OR wr.subward = '')
                 AND (w.subward IS NULL OR w.subward = '')
               )
               OR (wr.subward = w.subward)
              )`
      );
      where.push("TRIM(w.department) = TRIM(?)");
      params.push(department.trim());
    }

    if (has(wardFilter)) {
      where.push("wr.wardname = ?");
      params.push(wardFilter.trim());
    }

    if (has(subward)) {
      where.push("wr.subward = ?");
      params.push(subward.trim());
    }

    if (has(date)) {
      where.push("wr.date = ?");
      params.push(date);
    } else {
      if (has(dateFrom)) {
        where.push("wr.date >= ?");
        params.push(dateFrom);
      }
      if (has(dateTo)) {
        where.push("wr.date <= ?");
        params.push(dateTo);
      }
    }

    const sql =
      `SELECT wr.* ` +
      from.join(" ") +
      ` WHERE ` +
      where.join(" AND ") +
      ` ORDER BY wr.date DESC`;

    const [rows] = await db.query(sql, params);

    // --- รวมยอดแบบปลอดภัยต่อการไม่มีคอลัมน์ ---
    const numFromKeys = (row, keys) => {
      for (const k of keys) {
        if (Object.prototype.hasOwnProperty.call(row, k)) {
          const v = parseFloat(row[k]);
          if (Number.isFinite(v)) return v;
        }
      }
      return 0;
    };

    const sum = (keys) =>
      rows.reduce(
        (s, r) => s + numFromKeys(r, Array.isArray(keys) ? keys : [keys]),
        0
      );

    const carryForward = sum([
      "carry_forward",
      "brought_forward",
      "opening_census",
      "begin_balance",
    ]);
    const admitNew = sum("bed_new");
    const admitTransferIn = sum([
      "admit_transfer_in",
      "transfer_in",
      "receive_transfer_in",
    ]);

    const disHome = sum("discharge_home");
    const disMoveWard = sum([
      "discharge_move_ward",
      "move_ward",
      "transfer_intra",
    ]);
    const disReferOut = sum([
      "discharge_transfer_out",
      "discharge_refer_out",
      "refer_out",
    ]);
    const disReferBack = sum(["discharge_refer_back", "refer_back"]);
    const disDeath = sum(["discharge_death", "death"]);

    const admitAll = admitNew + admitTransferIn;
    const dischargeAll =
      disHome + disMoveWard + disReferOut + disReferBack + disDeath;
    const remain = carryForward + admitAll - dischargeAll;

    return res.json({
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
    return res.status(500).json({ message: "Database error" });
  }
});

module.exports = router;
