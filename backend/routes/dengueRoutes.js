const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");

function formatDateTime(date) {
  return new Date(date).toISOString().slice(0, 19).replace("T", " ");
}

router.get("/", async (req, res) => {
  const { date, shift, wardname, username, subward } = req.query;

  try {
    const [rows] = await db.query(
      `SELECT * FROM dengue_reports 
       WHERE date = ? AND shift = ? AND wardname = ? AND username = ? 
       AND ${subward ? "subward = ?" : "(subward IS NULL OR subward = '')"}
       LIMIT 1`,
      subward
        ? [date, shift, wardname, username, subward]
        : [date, shift, wardname, username]
    );

    if (rows.length > 0) res.json(rows[0]);
    else res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: "Database error" });
  }
});

router.post("/", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    const data = req.body;

    const fields = Object.keys(data).join(", ");
    const placeholders = Object.keys(data)
      .map(() => "?")
      .join(", ");
    const values = Object.values(data);

    // ✅ คำนวณ remain ก่อนบันทึก
    const calcRemain = (carry, newly, transfer, discharge, move, died) =>
      (Number(carry) || 0) +
      (Number(newly) || 0) +
      (Number(transfer) || 0) -
      ((Number(discharge) || 0) + (Number(move) || 0) + (Number(died) || 0));

    data.remain_df = calcRemain(
      data.carry_df,
      data.new_df,
      data.transfer_df,
      data.discharge_df,
      data.move_df,
      data.died_df
    );
    data.remain_dhf = calcRemain(
      data.carry_dhf,
      data.new_dhf,
      data.transfer_dhf,
      data.discharge_dhf,
      data.move_dhf,
      data.died_dhf
    );
    data.remain_dss = calcRemain(
      data.carry_dss,
      data.new_dss,
      data.transfer_dss,
      data.discharge_dss,
      data.move_dss,
      data.died_dss
    );

    await db.query(
      `INSERT INTO dengue_reports (${fields}) VALUES (${placeholders})`,
      values
    );

    res.status(200).json({ message: "บันทึกสำเร็จ" });
  } catch (err) {
    res.status(500).json({ message: "Database or token error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    if (body.created_at) {
      body.created_at = formatDateTime(body.created_at);
    }
    if (body.updated_at) {
      body.updated_at = formatDateTime(body.updated_at);
    } else {
      body.updated_at = formatDateTime(new Date());
    }

    // ✅ คำนวณ remain ก่อนอัปเดต
    const calcRemain = (carry, newly, transfer, discharge, move, died) =>
      (Number(carry) || 0) +
      (Number(newly) || 0) +
      (Number(transfer) || 0) -
      ((Number(discharge) || 0) + (Number(move) || 0) + (Number(died) || 0));

    body.remain_df = calcRemain(
      body.carry_df,
      body.new_df,
      body.transfer_df,
      body.discharge_df,
      body.move_df,
      body.died_df
    );
    body.remain_dhf = calcRemain(
      body.carry_dhf,
      body.new_dhf,
      body.transfer_dhf,
      body.discharge_dhf,
      body.move_dhf,
      body.died_dhf
    );
    body.remain_dss = calcRemain(
      body.carry_dss,
      body.new_dss,
      body.transfer_dss,
      body.discharge_dss,
      body.move_dss,
      body.died_dss
    );

    const keys = Object.keys(body);
    const values = keys.map((key) => body[key]);

    const setClause = keys.map((key) => `${key} = ?`).join(", ");

    const sql = `UPDATE dengue_reports SET ${setClause} WHERE id = ?`;
    values.push(id);

    const [result] = await db.execute(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json({ message: "Update success" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
