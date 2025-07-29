// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "../styles/HospitalUI.css"; // หรือเปลี่ยนชื่อถ้าคุณแยก css dashboard ต่างหาก

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedWard, setSelectedWard] = useState("");
  const [selectedSubward, setSelectedSubward] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/dashboard")
      .then((res) => setData(res.data))
      .catch((err) => console.error(err));
  }, []);

  const filtered = data.filter((d) => {
    const date = new Date(d.date);
    const matchesDate = selectedDate ? d.date === selectedDate : true;
    const matchesWard = selectedWard ? d.wardname === selectedWard : true;
    const matchesSubward = selectedSubward ? d.subward === selectedSubward : true;
    const matchesMonth = selectedMonth ? date.getMonth() + 1 === +selectedMonth : true;
    const matchesYear = selectedYear ? date.getFullYear() === +selectedYear : true;
    return matchesDate && matchesWard && matchesSubward && matchesMonth && matchesYear;
  });

  const totalBed = filtered.reduce((sum, row) => sum + (row.bed_total || 0), 0);
  const totalProductivity = filtered.reduce(
    (sum, row) => sum + (parseFloat(row.productivity) || 0),
    0
  );
  const avgProductivity = filtered.length
    ? totalProductivity / filtered.length
    : 0;

  return (
    <div className="dashboard-container">
      <h2 className="dashboard-title">ภาพรวมข้อมูล</h2>

      {/* Summary */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-label">จำนวนรายการ</div>
          <div className="summary-value">{filtered.length}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">รวมเตียงทั้งหมด</div>
          <div className="summary-value">{totalBed}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Productivity เฉลี่ย</div>
          <div className="summary-value">{avgProductivity.toFixed(2)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-section">
        <div className="filter-item">
          <label>เลือกวันที่:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <div className="filter-item">
          <label>เลือก Ward:</label>
          <select value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)}>
            <option value="">ทั้งหมด</option>
            {[...new Set(data.map((d) => d.wardname))].map((ward) => (
              <option key={ward} value={ward}>{ward}</option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>เลือก Subward:</label>
          <select value={selectedSubward} onChange={(e) => setSelectedSubward(e.target.value)}>
            <option value="">ทั้งหมด</option>
            {[...new Set(data.map((d) => d.subward))].map((subward) => (
              <option key={subward} value={subward}>{subward}</option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>เลือกเดือน:</label>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            <option value="">ทั้งหมด</option>
            {[...new Set(data.map((d) => new Date(d.date).getMonth() + 1))].sort().map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>เลือกปี:</label>
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
            <option value="">ทั้งหมด</option>
            {[...new Set(data.map((d) => new Date(d.date).getFullYear()))].sort().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Chart */}
      <div className="chart-section">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={filtered}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="productivity" stroke="#007bff" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
