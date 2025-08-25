// routes/dashboardSummary.js
const express = require("express");
const router = express.Router();
const db = require("../db");

// GET /api/dashboard/summary?start=YYYY-MM-DD&end=YYYY-MM-DD&shift=...&wardname=...&subward=...
router.get("/dashboard/summary", async (req, res) => {
  try {
    const { start, end, shift, wardname, subward } = req.query;

    // ✅ ไม่บังคับ start/end
    const whereParts = ["1=1"];
    const params = [];

    // ใช้คอลัมน์วันที่ของ view (เป็น DATETIME)
    const dateCol = "report_date";

    if (start && end) {
      whereParts.push(`${dateCol} >= ? AND ${dateCol} < DATE_ADD(?, INTERVAL 1 DAY)`);
      params.push(start, end);
    } else if (start) {
      whereParts.push(`${dateCol} >= ?`);
      params.push(start);
    } else if (end) {
      whereParts.push(`${dateCol} < DATE_ADD(?, INTERVAL 1 DAY)`);
      params.push(end);
    }

    if (shift)    { whereParts.push("shift = ?");           params.push(shift); }
    if (wardname) { whereParts.push("wardname = ?");        params.push(wardname); }
    if (subward)  { whereParts.push("subward = ?");         params.push(subward); }

    const WHERE = "WHERE " + whereParts.join(" AND ");

    const baseSQL = `
      SELECT
        wardname,
        subward,
        SUM(COALESCE(bed_carry,0))               AS bed_carry,
        SUM(COALESCE(bed_new,0))                 AS bed_new,
        SUM(COALESCE(bed_transfer_in,0))         AS bed_transfer_in,
        SUM(COALESCE(discharge_home,0))          AS discharge_home,
        SUM(COALESCE(discharge_transfer_out,0))  AS discharge_transfer_out,
        SUM(COALESCE(discharge_refer_out,0))     AS discharge_refer_out,
        SUM(COALESCE(discharge_refer_back,0))    AS discharge_refer_back,
        SUM(COALESCE(discharge_died,0))          AS discharge_died,
        SUM(COALESCE(bed_remain,0))              AS bed_remain,

        SUM(COALESCE(deliveries_total,0))        AS deliveries_total,
        SUM(COALESCE(delivery_nl,0))             AS delivery_nl,
        SUM(COALESCE(delivery_forcep,0))         AS delivery_forcep,
        SUM(COALESCE(delivery_vac,0))            AS delivery_vac,
        SUM(COALESCE(delivery_br,0))             AS delivery_br,
        SUM(COALESCE(delivery_cs,0))             AS delivery_cs
      FROM v_reports_unified
      ${WHERE}
      GROUP BY wardname, subward
    `;

    const totalSQL = `
      SELECT
        'รวม' AS wardname,
        NULL  AS subward,
        SUM(COALESCE(bed_carry,0))               AS bed_carry,
        SUM(COALESCE(bed_new,0))                 AS bed_new,
        SUM(COALESCE(bed_transfer_in,0))         AS bed_transfer_in,
        SUM(COALESCE(discharge_home,0))          AS discharge_home,
        SUM(COALESCE(discharge_transfer_out,0))  AS discharge_transfer_out,
        SUM(COALESCE(discharge_refer_out,0))     AS discharge_refer_out,
        SUM(COALESCE(discharge_refer_back,0))    AS discharge_refer_back,
        SUM(COALESCE(discharge_died,0))          AS discharge_died,
        SUM(COALESCE(bed_remain,0))              AS bed_remain,

        SUM(COALESCE(deliveries_total,0))        AS deliveries_total,
        SUM(COALESCE(delivery_nl,0))             AS delivery_nl,
        SUM(COALESCE(delivery_forcep,0))         AS delivery_forcep,
        SUM(COALESCE(delivery_vac,0))            AS delivery_vac,
        SUM(COALESCE(delivery_br,0))             AS delivery_br,
        SUM(COALESCE(delivery_cs,0))             AS delivery_cs
      FROM v_reports_unified
      ${WHERE}
    `;

    const sql = `
      ${baseSQL}
      UNION ALL
      ${totalSQL}
      ORDER BY (wardname = 'รวม'), wardname, subward
    `;

    const fullParams = [...params, ...params];
    const [rows] = await db.query(sql, fullParams);
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("GET /dashboard/summary error:", err);
    res.status(500).json({ ok: false, message: "server error" });
  }
});

module.exports = router;
