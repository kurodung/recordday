import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Filter,
  Users,
  Activity,
  TrendingUp,
  Award,
  RefreshCw,
  X,
} from "lucide-react";
import styles from "../styles/Dashboard.module.css";

// คืนค่าเป็นวันตาม local time เช่น "2025-08-15" (แก้ปัญหาเลือก -1 วัน)
const dateKey = (v) => {
  const dt = new Date(v);
  if (Number.isNaN(dt)) return "";
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 10);
};

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const qpDate = searchParams.get("date") || "";
  const qpShift = searchParams.get("shift") || "";

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ฟิลเตอร์มี shift เพิ่มเข้ามา
  const [filters, setFilters] = useState({
    date: "",
    shift: "",
    ward: "",
    subward: "",
    month: "",
    year: "",
  });

  // sync ค่าเริ่มจาก URL (?date=...&shift=...)
  useEffect(() => {
    setFilters((f) => ({
      ...f,
      date: qpDate || f.date,
      shift: qpShift || f.shift,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qpDate, qpShift]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch("http://localhost:5000/api/dashboard");
        if (!response.ok) throw new Error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err.message || "ไม่สามารถเชื่อมต่อ API ได้");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ตัวเลือกในแผงฟิลเตอร์
  const filterOptions = useMemo(() => {
    const uniqueWards = [...new Set(data.map((d) => d.wardname))].sort();

    // ปีจากคีย์วันแบบ local (ป้องกัน timezone เหลื่อม)
    const uniqueYears = [
      ...new Set(
        data
          .map((d) => dateKey(d.date))
          .filter(Boolean)
          .map((s) => Number(s.slice(0, 4)))
      ),
    ].sort((a, b) => b - a);

    const uniqueSubwards = filters.ward
      ? [
          ...new Set(
            data
              .filter((d) => d.wardname === filters.ward && d.subward)
              .map((d) => d.subward)
          ),
        ].sort()
      : [];

    return { wards: uniqueWards, years: uniqueYears, subwards: uniqueSubwards };
  }, [data, filters.ward]);

  // เปลี่ยน ward แล้วเคลียร์ subward
  useEffect(() => {
    setFilters((f) => ({ ...f, subward: "" }));
  }, [filters.ward]);

  // กรองข้อมูลตาม date/shift/ward/subward/month/year
  const filteredData = useMemo(() => {
    return data.filter((d) => {
      const key = dateKey(d.date); // "YYYY-MM-DD" ตามเวลาท้องถิ่น
      const matchesDate = !filters.date || key === filters.date;

      const yearNum = key ? Number(key.slice(0, 4)) : NaN;
      const monthNum = key ? Number(key.slice(5, 7)) : NaN;

      const matchesWard = !filters.ward || d.wardname === filters.ward;
      const matchesSubward = !filters.subward || d.subward === filters.subward;
      const matchesMonth = !filters.month || monthNum === Number(filters.month);
      const matchesYear = !filters.year || yearNum === Number(filters.year);
      const matchesShift = !filters.shift || d.shift === filters.shift;

      return (
        matchesDate &&
        matchesWard &&
        matchesSubward &&
        matchesMonth &&
        matchesYear &&
        matchesShift
      );
    });
  }, [data, filters]);

  // สรุปสถิติ
  const summaryStats = useMemo(() => {
    const totalAdmissions = filteredData.reduce(
      (sum, row) => sum + (row.bed_new || 0),
      0
    );
    const totalDischarges = filteredData.reduce(
      (sum, row) =>
        sum + (row.discharge_home || 0) + (row.discharge_transfer_out || 0),
      0
    );
    const totalProductivity = filteredData.reduce(
      (sum, row) => sum + (parseFloat(row.productivity) || 0),
      0
    );
    const avgProductivity = filteredData.length
      ? totalProductivity / filteredData.length
      : 0;
    return {
      recordCount: filteredData.length,
      totalAdmissions,
      totalDischarges,
      avgProductivity: avgProductivity.toFixed(2),
    };
  }, [filteredData]);

  // พายชาร์ตกระจายตาม ward
  const wardDistribution = useMemo(() => {
    const wardCounts = {};
    filteredData.forEach((d) => {
      wardCounts[d.wardname] = (wardCounts[d.wardname] || 0) + (d.bed_new || 0);
    });
    return Object.entries(wardCounts).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      date: "",
      shift: "",
      ward: "",
      subward: "",
      month: "",
      year: "",
    });
  };

  const COLORS = [
    "#7e3cbd",
    "#c084fc",
    "#a855f7",
    "#9333ea",
    "#8b5cf6",
    "#7c3aed",
  ];

  if (loading)
    return (
      <div className={`${styles.loadingContainer} ${styles.fadeIn}`}>
        <RefreshCw className={styles.loadingSpinner} size={24} />
        <span className={styles.loadingText}>กำลังโหลดข้อมูล...</span>
      </div>
    );

  if (error) return <div className={styles.errorContainer}>{error}</div>;

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.dashboardHeader}>
        <div className={styles.dashboardHeaderContent}>
          <div>
            <h1 className={styles.dashboardTitle}>📊 ภาพรวมข้อมูลโรงพยาบาล</h1>
            <p className={styles.dashboardSubtitle}>
              ระบบติดตามและวิเคราะห์ข้อมูลการดำเนินงาน
            </p>
          </div>
        </div>
      </div>

      <div className={styles.summaryCardsGrid}>
        {[
          {
            label: "จำนวนรายการทั้งหมด",
            value: summaryStats.recordCount,
            icon: <Users size={24} />,
            colorClass: "blue",
          },
          {
            label: "ยอดรับใหม่ (Admit)",
            value: summaryStats.totalAdmissions,
            icon: <TrendingUp size={24} />,
            colorClass: "green",
          },
          {
            label: "ยอดจำหน่าย (Discharge)",
            value: summaryStats.totalDischarges,
            icon: <Activity size={24} />,
            colorClass: "yellow",
          },
          {
            label: "Productivity เฉลี่ย",
            value: `${summaryStats.avgProductivity}%`,
            icon: <Award size={24} />,
            colorClass: "red",
          },
        ].map((card, index) => (
          <div key={index} className={styles.summaryCard}>
            <div className={styles.summaryCardHeader}>
              <div
                className={`${styles.summaryCardIcon} ${
                  styles[card.colorClass]
                }`}
              >
                {card.icon}
              </div>
            </div>
            <div className={styles.summaryCardLabel}>{card.label}</div>
            <div className={styles.summaryCardValue}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className={styles.filterSection}>
        <div className={styles.filterHeader}>
          <Filter size={20} style={{ color: "#7e3cbd" }} />
          <h3 className={styles.filterTitle}>ตัวกรองข้อมูล</h3>
        </div>
        <div className={styles.filterGrid}>
          {[
            {
              name: "date",
              label: "เลือกวันที่",
              type: "date",
              value: filters.date,
            },
            {
              name: "shift",
              label: "เลือกเวร",
              type: "select",
              value: filters.shift,
              options: [
                { value: "morning", label: "เวรเช้า" },
                { value: "afternoon", label: "เวรบ่าย" },
                { value: "night", label: "เวรดึก" },
              ],
            },
            {
              name: "year",
              label: "เลือกปี",
              type: "select",
              value: filters.year,
              options: filterOptions.years,
            },
            {
              name: "month",
              label: "เลือกเดือน",
              type: "select",
              value: filters.month,
              options: Array.from({ length: 12 }, (_, i) => ({
                value: i + 1,
                label: new Date(0, i).toLocaleString("th-TH", {
                  month: "long",
                }),
              })),
            },
            {
              name: "ward",
              label: "เลือก Ward",
              type: "select",
              value: filters.ward,
              options: filterOptions.wards,
            },
            {
              name: "subward",
              label: "เลือก Sub-ward",
              type: "select",
              value: filters.subward,
              options: filterOptions.subwards,
              disabled: !filters.ward || filterOptions.subwards.length === 0,
            },
          ].map((field) => (
            <div key={field.name} className={styles.filterItem}>
              <label className={styles.filterLabel}>{field.label}</label>
              {field.type === "date" ? (
                <input
                  type="date"
                  name={field.name}
                  value={field.value}
                  onChange={handleFilterChange}
                  className={styles.filterInput}
                />
              ) : (
                <select
                  name={field.name}
                  value={field.value}
                  onChange={handleFilterChange}
                  disabled={field.disabled}
                  className={styles.filterSelect}
                >
                  <option value="">ทั้งหมด</option>
                  {field.options &&
                    field.options.map((option) => (
                      <option
                        key={typeof option === "object" ? option.value : option}
                        value={
                          typeof option === "object" ? option.value : option
                        }
                      >
                        {typeof option === "object" ? option.label : option}
                      </option>
                    ))}
                </select>
              )}
            </div>
          ))}
          <button onClick={clearFilters} className={styles.clearFiltersBtn}>
            <X size={16} />
            ล้างตัวกรอง
          </button>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>
            <TrendingUp size={20} style={{ color: "#7e3cbd" }} />
            แนวโน้ม Productivity และการรับผู้ป่วย
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={filteredData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString("th-TH", {
                    month: "short",
                    day: "numeric",
                  })
                }
              />
              <YAxis />
              <Tooltip
                formatter={(value, name) => [
                  value,
                  name === "productivity"
                    ? "Productivity (%)"
                    : name === "bed_new"
                    ? "การรับใหม่"
                    : name,
                ]}
                labelFormatter={(value) =>
                  `วันที่: ${new Date(value).toLocaleDateString("th-TH")}`
                }
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="productivity"
                stroke="#7e3cbd"
                strokeWidth={3}
                name="Productivity (%)"
                dot={{ fill: "#7e3cbd", strokeWidth: 2, r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="bed_new"
                stroke="#10b981"
                strokeWidth={3}
                name="การรับใหม่"
                dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitleSmall}>การกระจายตาม Ward</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={wardDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {wardDistribution.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} คน`, "จำนวน"]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={`${styles.chartContainer} ${styles.fullWidthChart}`}>
        <h3 className={styles.chartTitle}>
          <Activity size={20} style={{ color: "#7e3cbd" }} />
          เปรียบเทียบการรับและจำหน่ายผู้ป่วย
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={filteredData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("th-TH", {
                  month: "short",
                  day: "numeric",
                })
              }
            />
            <YAxis />
            <Tooltip formatter={(value, name) => [value, name]} />
            <Legend />
            <Bar
              dataKey="bed_new"
              fill="#7e3cbd"
              name="รับใหม่"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="discharge_home"
              fill="#10b981"
              name="จำหน่ายกลับบ้าน"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="discharge_transfer_out"
              fill="#f59e0b"
              name="โอนออก"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
