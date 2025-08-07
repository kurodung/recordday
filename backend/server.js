const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require("./routes/authRoutes");
const wardReportRoutes = require("./routes/wardReportRoutes");
const covidRoutes = require("./routes/covidRoutes");
const dengueRoutes = require("./routes/dengueRoutes");
const dashboardRoute = require("./routes/dashboard");
const lrReportRoutes = require("./routes/lrReportRoutes");
const subwardsRoute = require("./routes/subwards");

// Register Routes
app.use("/api", authRoutes); // /api/register, /api/login, /api/profile
app.use("/api/ward-report", wardReportRoutes);
app.use("/api/covid-report", covidRoutes);
app.use("/api/dengue-report", dengueRoutes);
app.use("/api/subwards", subwardsRoute);
app.use("/api/dashboard", dashboardRoute);
app.use("/api/lr-report", lrReportRoutes);

// Database
const db = require("./db");

const toMysqlDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return date.toISOString().split("T")[0];
};

app.put("/api/hospital/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    if (data.date) {
      data.date = toMysqlDate(data.date);
    }

    const fields = Object.keys(data).filter((key) => key !== "id");
    const values = fields.map((key) => data[key]);
    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const sql = `
      UPDATE ward_reports 
      SET ${setClause} 
      WHERE id = ? ${data.subward ? "AND subward = ?" : "AND (subward IS NULL OR subward = '')"}
    `;

    const params = data.subward
      ? [...values, id, data.subward]
      : [...values, id];

    await db.query(sql, params);

    res.status(200).json({ message: "อัปเดตข้อมูลสำเร็จ" });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ message: "Database update failed" });
  }
});

// ✅ ควรใช้ port 5000 (ไม่ใช่ 3306 ซึ่งเป็นของ MySQL)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

console.log("Mounting wardReportRoutes at /api/ward-report");
app.use("/api/ward-report", wardReportRoutes);

