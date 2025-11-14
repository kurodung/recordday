// routes/lrReportRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");

const toMysqlDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return date.toISOString().split("T")[0];
};

const toMysqlDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return date.toISOString().slice(0, 19).replace("T", " ");
};

/* ----------------------- Helpers (แก้ไข toInt ให้เป็น 0) ----------------------- */
const toInt = (v) => {
  // ✅ ถ้า v เป็นสตริงว่างเปล่า ("") หรือ null/undefined ให้ส่ง 0 แทน
  if (v === "" || v == null) {
    return 0; 
  }
  
  const num = Number(v);
  
  // ถ้าแปลงเป็นตัวเลขไม่ได้ (เช่น 'abc') ให้กลับเป็น 0
  if (isNaN(num)) {
      return 0; 
  }
  
  return num;
};

const isNonEmpty = (v) => typeof v === "string" && v.trim() !== "";

// กำหนด Field ตัวเลขทั้งหมดที่ควรถูกแปลง
const NUMERIC_FIELDS = [
  "bed_total", "bed_carry", "bed_new", "bed_transfer_in", "bed_remain", 
  "discharge_home", "discharge_transfer_out", "discharge_refer_out", 
  "discharge_refer_back", "discharge_died", "nl", "forcep", "vac", "br", 
  "cs", "vent_invasive", "vent_noninvasive", "hfnc", "oxygen", "extra_bed", 
  "pas", "cpr", "infection", "gcs", "stroke", "psych", "prisoner", 
  "pre_op", "post_op", "rn", "pn", "na", "other_staff", "rn_extra", 
  "rn_down", "productivity"
];

const sanitizeRecord = (body) => {
    const sanitized = {};
    for (const [key, value] of Object.entries(body)) {
        if (NUMERIC_FIELDS.includes(key)) {
            // ใช้ toInt ที่แก้ไขแล้ว
            sanitized[key] = toInt(value); 
        } else if (key === 'date') {
            sanitized[key] = toMysqlDate(value);
        } else if (key === 'subward') {
            sanitized[key] = isNonEmpty(value) ? value : null;
        } else {
            // Field อื่น ๆ เช่น username, wardname, shift, head_nurse, incident
            sanitized[key] = value;
        }
    }
    return sanitized;
};
/* --------------------------------------------------------------------- */

// ✅ GET ข้อมูลรายงาน lr
router.get("/", async (req, res) => {
  const { date, shift, wardname, username, subward } = req.query;

  try {
    const hassubward = subward !== undefined && subward !== null && subward !== "";

    const sqlCondition = hassubward
      ? "subward = ?"
      : "(subward IS NULL OR subward = '')";

    const sql = `
      SELECT * FROM lr_reports 
      WHERE date = ? AND shift = ? AND wardname = ? AND username = ?
      AND ${sqlCondition}
      LIMIT 1
    `;

    const params = hassubward
      ? [date, shift, wardname, username, subward]
      : [date, shift, wardname, username];

    const [rows] = await db.query(sql, params);

    if (rows.length > 0) res.json(rows[0]);
    else res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: "Database error" });
  }
});


// ✅ POST เพิ่ม/แก้ไขข้อมูลรายงาน lr (เปลี่ยนเป็น Upsert)
router.post("/", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    
    // ✅ ใช้ sanitizeRecord เพื่อแปลงค่าตัวเลขก่อนบันทึก
    const data = sanitizeRecord(req.body); 

    // หาก payload มี ID แสดงว่าเป็น PUT แต่ใช้ POST (ไม่แนะนำ) ให้ใช้ PUT API ดีกว่า
    if (data.id) return res.status(400).json({ message: "Use PUT for updates" });

    const fields = Object.keys(data);
    const placeholders = fields.map(() => "?").join(",");
    const values = Object.values(data);
    
    // สร้าง SET clause สำหรับ ON DUPLICATE KEY UPDATE
    const updateFields = fields.filter(
        (c) =>
          !["id", "username", "wardname", "date", "shift", "subward"].includes(c)
      )
      .map((c) => `${c}=VALUES(${c})`)
      .join(", ");

    const sql = `
      INSERT INTO lr_reports (${fields.join(",")})
      VALUES (${placeholders})
      ON DUPLICATE KEY UPDATE ${updateFields}
    `;

    await db.query(sql, values);

    res.status(200).json({ message: "บันทึกข้อมูลสำเร็จ" });
  } catch (err) {
    console.error("❌ POST /api/lr-report error:", err); 
    res.status(500).json({ message: "Database or token error" });
  }
});


// ✅ PUT แก้ไขข้อมูลรายงาน lr
router.put("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // ✅ ใช้ sanitizeRecord เพื่อแปลงค่าตัวเลขก่อนอัปเดต
    let data = sanitizeRecord(req.body);
    
    // ลบ Field ที่ไม่ต้องการอัปเดต (เช่น id ที่ไม่ควรอยู่ใน set clause)
    delete data.id; 

    // สร้าง setClause โดยใช้ data ที่ถูก sanitize แล้ว
    const fields = Object.keys(data);
    const values = fields.map((key) => data[key]);

    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const sql = `
      UPDATE lr_reports 
      SET ${setClause} 
      WHERE id = ?
    `;

    const params = [...values, id];

    await db.query(sql, params);

    res.status(200).json({ message: "อัปเดตข้อมูลสำเร็จ" });
  } catch (err) {
    console.error("❌ PUT /api/lr-report error:", err);
    res.status(500).json({ message: "Database update failed", error: err.message });
  }
});

module.exports = router;