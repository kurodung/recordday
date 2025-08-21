const express = require("express");
const router = express.Router();
const db = require("../db");

// helpers
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

router.get("/report-status-range", async (req, res) => {
  let { start, end, wardname } = req.query;
  if (!isYMD(start) || !isYMD(end)) {
    return res.status(400).json({ ok: false, message: "start & end (YYYY-MM-DD) required" });
  }
  if (start > end) [start, end] = [end, start];

  try {
    // 1) ดึงรายชื่อ ward ทั้งหมดจากตาราง wards (ถ้ามี)
    let wardsFromTable = [];
    try {
      const [wrows] = await db.query(
        wardname
          ? "SELECT DISTINCT wardname FROM wards WHERE wardname = ?"
          : "SELECT DISTINCT wardname FROM wards",
        wardname ? [wardname] : []
      );
      wardsFromTable = (wrows || []).map(r => r.wardname).filter(Boolean);
    } catch (e) {
      // ถ้าไม่มีตาราง wards ก็ปล่อยผ่าน
      wardsFromTable = [];
    }

    // 2) ดึงรายงานเฉพาะจาก ward_reports ในช่วงวัน
    const sql = `
      SELECT wardname, DATE_FORMAT(date, '%Y-%m-%d') AS date, shift
      FROM ward_reports
      WHERE date BETWEEN ? AND ?
      ${wardname ? "AND wardname = ?" : ""}
      GROUP BY wardname, date, shift
    `;
    const params = wardname ? [start, end, wardname] : [start, end];
    const [rows] = await db.query(sql, params);

    // 3) รวมรายชื่อ ward จากตาราง + จากข้อมูลจริง (กันกรณีไม่มีใครส่งเลย)
    const wardsFromReports = Array.from(new Set(rows.map(r => r.wardname)));
    const wardSet = new Set([...wardsFromTable, ...wardsFromReports]);
    if (wardname) wardSet.add(wardname); // เผื่อ ward นั้นไม่มีในตาราง wards

    const days = listDays(start, end);

    // 4) build matrix เริ่มเป็น false ทั้งหมด
    const data = {};
    for (const w of wardSet) {
      data[w] = days.map(d => ({ date: d, morning:false, afternoon:false, night:false }));
    }

    // 5) เติมสถานะจากรายงาน
    const dayIndex = Object.fromEntries(days.map((d,i)=>[d,i]));
    for (const r of rows) {
      const i = dayIndex[r.date];
      if (i === undefined) continue;
      const arr = data[r.wardname];
      if (!arr) continue;
      if (r.shift === "morning")   arr[i].morning = true;
      else if (r.shift === "afternoon") arr[i].afternoon = true;
      else if (r.shift === "night")     arr[i].night = true;
    }

    // 6) สรุปผล
    const summary = Object.entries(data).map(([w, arr]) => {
      const total = arr.length * 3;
      const sent = arr.reduce((acc, d) => acc + (d.morning?1:0) + (d.afternoon?1:0) + (d.night?1:0), 0);
      return { wardname: w, sent, totalShifts: total, percent: total ? Math.round((sent/total)*100) : 0 };
    }).sort((a,b)=>a.wardname.localeCompare(b.wardname,"th"));

    res.json({ ok: true, start, end, data, summary });
  } catch (e) {
    console.error("GET /report-status-range error:", e);
    res.status(500).json({ ok: false, message: "server error" });
  }
});

module.exports = router;
