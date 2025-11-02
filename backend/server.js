const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Database
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require("./routes/authRoutes");
const wardReportRoutes = require("./routes/wardReportRoutes");
const covidRoutes = require("./routes/covidRoutes");
const dengueRoutes = require("./routes/dengueRoutes");
const dashboardRoute = require("./routes/dashboard");
const lrReportRoutes = require("./routes/lrReport");
const subwardsRoute = require("./routes/subwards");
const reportStatusRoutes = require("./routes/reportStatusRoutes");
const orReportRoutes = require("./routes/orReport");
const hdReportRoutes = require("./routes/hdReport");
const clReportRoutes = require("./routes/clReport");
const cuReportRoutes = require("./routes/cuReport");
const stchReportRoutes = require("./routes/stchReport");
const endoReportRoutes = require("./routes/endoReport");
const rtReportRoutes = require("./routes/rtReport");
const irReportRoutes = require("./routes/irReport");
const nmReportRoutes = require("./routes/nmReport");
const slReportRoutes = require("./routes/slReport");
const pftReportRoutes = require("./routes/pftReport");
const nwcwReportRoutes = require("./routes/nwcwReport");
const erReportRoutes = require("./routes/erReport");
const opdReportRoutes = require("./routes/opdReport");
const wardsRoute = require("./routes/wardsRoute");



// Register Routes
app.use("/api", authRoutes); // /api/register, /api/login, /api/profile
app.use("/api/ward-report", wardReportRoutes);
app.use("/api/covid-report", covidRoutes);
app.use("/api/dengue-report", dengueRoutes);
app.use("/api/subwards", subwardsRoute);
app.use("/api/dashboard", dashboardRoute);
app.use("/api/lr-report", lrReportRoutes);
app.use("/api", reportStatusRoutes);           // -> /api/report-status-range
app.use("/api", orReportRoutes);
app.use("/api/hd-report", hdReportRoutes);
app.use("/api", clReportRoutes);
app.use("/api", cuReportRoutes);
app.use("/api", stchReportRoutes);
app.use("/api", endoReportRoutes);
app.use("/api", rtReportRoutes);
app.use("/api", irReportRoutes);
app.use("/api", nmReportRoutes);
app.use("/api", slReportRoutes);
app.use("/api", pftReportRoutes);
app.use("/api", nwcwReportRoutes);
app.use("/api", erReportRoutes);
app.use("/api", opdReportRoutes);
app.use("/api/wards", wardsRoute);
app.use("/api/users", require("./routes/users.js"));
app.use("/api/wards", require("./routes/wards"));
app.use("/api/departments", require("./routes/departments"));


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




