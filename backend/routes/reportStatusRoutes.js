// routes/reportStatusRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");

const isYMD = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

const listDays = (start, end) => {
  const out = [];
  let cur = new Date(start), e = new Date(end);
  while (cur <= e && out.length < 400) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

// ✅ รองรับพารามิเตอร์ wardname_like
router.get("/report-status-range", async (req, res) => {
  let { start, end, wardname, wardname_like, department, includeSubward } = req.query;
  if (!isYMD(start) || !isYMD(end)) {
    return res
      .status(400)
      .json({ ok: false, message: "start & end (YYYY-MM-DD) required" });
  }
  if (start > end) [start, end] = [end, start];

  const wantSub =
    String(includeSubward || "").toLowerCase() === "1" ||
    String(includeSubward || "").toLowerCase() === "true";

  try {
    // 1) ดึงรายชื่อ ward จากตาราง wards (ใช้ department / wardname_like)
    let allowedWards = new Set();
    try {
      const args = [];
      const where = [];
      if (department) {
        where.push("department = ?");
        args.push(department);
      }
      if (wardname) {
        where.push("wardname = ?");
        args.push(wardname);
      } else if (wardname_like) {
        where.push("wardname LIKE ?");
        args.push(`%${wardname_like}%`);
      }

      const sqlW = `
        SELECT DISTINCT wardname
        FROM wards
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
      `;
      const [wrows] = await db.query(sqlW, args);
      allowedWards = new Set(
        (wrows || []).map((r) => r.wardname).filter(Boolean)
      );
    } catch {}

    // 2) ดึงรายงานจาก ward_reports (รวม subward)
    const argsR = [start, end];
    let sqlR = `
      SELECT wardname,
             NULLIF(TRIM(subward), '') AS subward,
             DATE_FORMAT(date, '%Y-%m-%d') AS date,
             shift
      FROM ward_reports
      WHERE date BETWEEN ? AND ?
    `;

    if (wardname) {
      sqlR += " AND wardname = ?";
      argsR.push(wardname);
    } else if (wardname_like) {
      sqlR += " AND wardname LIKE ?";
      argsR.push(`%${wardname_like}%`);
    }

    sqlR += " GROUP BY wardname, subward, date, shift";
    let [rows] = await db.query(sqlR, argsR);

    // กรองตาม department ถ้ามี
    if (allowedWards.size > 0) {
      rows = rows.filter((r) => allowedWards.has(r.wardname));
    }

    // รวมชื่อ ward จากรายงานด้วย
    const wardsFromReports = Array.from(new Set(rows.map((r) => r.wardname)));
    for (const w of wardsFromReports) allowedWards.add(w);
    if (wardname) allowedWards.add(wardname);

    const days = listDays(start, end);
    const data = {};
    const dayIndex = Object.fromEntries(days.map((d, i) => [d, i]));

    // เตรียมบรรทัดรวม ward
    for (const w of Array.from(allowedWards)) {
      data[w] = days.map((d) => ({
        date: d,
        morning: false,
        afternoon: false,
        night: false,
      }));
    }

    // เติมข้อมูลจากรายงาน
    for (const r of rows) {
      const i = dayIndex[r.date];
      if (i === undefined) continue;

      const arrWard =
        data[r.wardname] ||
        (data[r.wardname] = days.map((d) => ({
          date: d,
          morning: false,
          afternoon: false,
          night: false,
        })));

      if (r.shift === "morning") arrWard[i].morning = true;
      else if (r.shift === "afternoon") arrWard[i].afternoon = true;
      else if (r.shift === "night") arrWard[i].night = true;

      if (wantSub && r.subward) {
        const key = `${r.wardname} / ${r.subward}`;
        const arrSub =
          data[key] ||
          (data[key] = days.map((d) => ({
            date: d,
            morning: false,
            afternoon: false,
            night: false,
          })));
        if (r.shift === "morning") arrSub[i].morning = true;
        else if (r.shift === "afternoon") arrSub[i].afternoon = true;
        else if (r.shift === "night") arrSub[i].night = true;
      }
    }

    const summary = Object.entries(data)
      .map(([k, arr]) => {
        const total = arr.length * 3;
        const sent = arr.reduce(
          (acc, d) =>
            acc +
            (d.morning ? 1 : 0) +
            (d.afternoon ? 1 : 0) +
            (d.night ? 1 : 0),
          0
        );
        return {
          wardname: k,
          sent,
          totalShifts: total,
          percent: total ? Math.round((sent / total) * 100) : 0,
        };
      })
      .sort((a, b) => a.wardname.localeCompare(b.wardname, "th"));

    res.json({ ok: true, start, end, data, summary });
  } catch (e) {
    console.error("GET /report-status-range error:", e);
    res.status(500).json({ ok: false, message: "server error" });
  }
});

// ✅ เหมือนเดิม
router.get("/report-status-departments", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT department
      FROM wards
      WHERE department IS NOT NULL AND department <> ''
      ORDER BY department
    `);
    const departments = (rows || []).map((r) => r.department);
    return res.json({ departments });
  } catch (e) {
    console.warn("GET /report-status-departments fallback:", e?.code || e?.message);
    return res.json({ departments: [] });
  }
});

module.exports = router;
