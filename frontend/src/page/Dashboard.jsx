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

// คืนค่าเป็นวันตาม local time เช่น "2025-08-15"
const dateKey = (v) => {
  const dt = new Date(v);
  if (Number.isNaN(dt)) return "";
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 10);
};

// จัดลำดับ sub-ward แบบมี priority ต่อ ward ที่เลือก
const sortSubwardsWithPriority = (list, ward) => {
  const PRIORITY = {
    อายุรกรรม: ["อายุรกรรม", "semi icu"],
  };
  const pri = PRIORITY[ward] || [];
  const rank = new Map(pri.map((name, i) => [String(name).toLowerCase(), i]));
  return [...(list || [])].sort((a, b) => {
    const al = String(a ?? "").toLowerCase();
    const bl = String(b ?? "").toLowerCase();
    const ai = rank.has(al) ? rank.get(al) : Infinity;
    const bi = rank.has(bl) ? rank.get(bl) : Infinity;
    if (ai !== bi) return ai - bi;
    return String(a).localeCompare(String(b), "th");
  });
};

export default function Dashboard({ username, wardname }) {
  const isAdmin = String(username || "").toLowerCase() === "admin";
  const [searchParams] = useSearchParams();
  const qpDate = searchParams.get("date") || "";
  const qpShift = searchParams.get("shift") || "";

  const [data, setData] = useState([]);
  const [departments, setDepartments] = useState([]); // รายชื่อ department สำหรับ dropdown
  const [wardOptions, setWardOptions] = useState([]); // รายชื่อ ward ตาม department ที่เลือก
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ฟิลเตอร์มี department เพิ่ม
  const [filters, setFilters] = useState({
    date: "",
    shift: "",
    department: "",
    ward: "",
    subward: "",
    month: "",
    year: "",
  });

  // non-admin: ล็อก ward = wardname ของตัวเอง
  useEffect(() => {
    if (!isAdmin) {
      setFilters((f) => ({ ...f, ward: wardname || "" }));
    }
  }, [isAdmin, wardname]);

  // sync ค่าเริ่มจาก URL (?date=...&shift=...)
  useEffect(() => {
    setFilters((f) => ({
      ...f,
      date: qpDate || f.date,
      shift: qpShift || f.shift,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qpDate, qpShift]);

  // โหลดรายชื่อ department (ครั้งแรก)
  useEffect(() => {
    const run = async () => {
      try {
        const token = localStorage.getItem("token") || "";
        const res = await fetch("http://localhost:5000/api/dashboard/departments", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("โหลดรายชื่อแผนกไม่สำเร็จ");
        const rows = await res.json();
        setDepartments(rows.map((r) => r.department));
      } catch (e) {
        // ไม่ฟ้องแรง ปล่อยให้ user ใช้งานส่วนอื่นได้
        console.warn(e);
      }
    };
    run();
  }, []);

  // เมื่อเลือก department → ดึงรายชื่อ ward ใต้แผนกนั้น + เคลียร์ ward/subward
  useEffect(() => {
    const run = async () => {
      try {
        if (!filters.department) {
          setWardOptions([]);
          return;
        }
        const token = localStorage.getItem("token") || "";
        const qs = new URLSearchParams({ department: filters.department });
        const res = await fetch(
          `http://localhost:5000/api/dashboard/wards-by-department?${qs}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error("โหลดรายชื่อวอร์ดในแผนกไม่สำเร็จ");
        const rows = await res.json();
        setWardOptions(rows.map((r) => r.wardname));
      } catch (e) {
        console.warn(e);
        setWardOptions([]);
      }
    };
    run();
    // เคลียร์เมื่อเปลี่ยนแผนก
    setFilters((f) => ({ ...f, ward: isAdmin ? "" : f.ward, subward: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.department]);

  // โหลดข้อมูลรายงาน (รองรับกรองตาม ward + department ฝั่งเซิร์ฟเวอร์)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("token") || "";
        const qs = new URLSearchParams();
        if (isAdmin && filters.ward) qs.set("ward", filters.ward);
        if (filters.department) qs.set("department", filters.department); // ★ เพิ่มกรองตามแผนก
        const url = `http://localhost:5000/api/dashboard${qs.toString() ? `?${qs}` : ""}`;

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
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
  }, [isAdmin, filters.ward, filters.department]);

  // ตัวเลือกในแผงฟิลเตอร์
  const filterOptions = useMemo(() => {
    // ถ้าเลือก department แล้ว มีรายการ ward เฉพาะในแผนกนั้น
    const wardsFromDept = filters.department ? wardOptions : null;

    const uniqueWards = wardsFromDept
      ? [...wardsFromDept].sort()
      : [...new Set(data.map((d) => d.wardname))].sort();

    const uniqueYears = [
      ...new Set(
        data
          .map((d) => dateKey(d.date))
          .filter(Boolean)
          .map((s) => Number(s.slice(0, 4)))
      ),
    ].sort((a, b) => b - a);

    const subFromData = filters.ward
      ? [
          ...new Set(
            data
              .filter((d) => d.wardname === filters.ward && d.subward)
              .map((d) => d.subward)
          ),
        ]
      : [];
    const uniqueSubwards = sortSubwardsWithPriority(subFromData, filters.ward);

    return {
      departments,
      wards: uniqueWards,
      years: uniqueYears,
      subwards: uniqueSubwards,
    };
  }, [data, filters.ward, filters.department, departments, wardOptions]);

  // เปลี่ยน ward แล้วเคลียร์ subward
  useEffect(() => {
    setFilters((f) => ({ ...f, subward: "" }));
  }, [filters.ward]);

  // กรองข้อมูลตาม date/shift/ward/subward/month/year (★ เมื่อส่ง department ไปเซิร์ฟเวอร์แล้ว จะกลับมาเฉพาะแผนกนั้นอยู่แล้ว)
  const filteredData = useMemo(() => {
    return data.filter((d) => {
      const key = dateKey(d.date);
      const matchesDate = !filters.date || key === filters.date;

      const yearNum = key ? Number(key.slice(0, 4)) : NaN;
      const monthNum = key ? Number(key.slice(5, 7)) : NaN;

      const matchesWard = !filters.ward || d.wardname === filters.ward;
      const matchesSubward = !filters.subward || d.subward === filters.subward;
      const matchesMonth = !filters.month || monthNum === Number(filters.month);
      const matchesYear = !filters.year || yearNum === Number(filters.year);
      const matchesShift = !filters.shift || d.shift === filters.shift;
      const matchesOwnWard = isAdmin || d.wardname === wardname;

      return (
        matchesDate &&
        matchesWard &&
        matchesSubward &&
        matchesMonth &&
        matchesYear &&
        matchesShift &&
        matchesOwnWard
      );
    });
  }, [data, filters, isAdmin, wardname]);

  // ★ ถ้าไม่ได้เลือก department → รวมข้อมูลตาม department เดียวกัน (เพื่อให้ชื่อแผนกเดียวกันถูกรวม)
  // ใช้รวมสำหรับพายชาร์ต (แทนที่จะรวมตาม ward)
  const departmentDistribution = useMemo(() => {
    if (filters.department) return []; // ถ้าเลือกแล้ว ให้แสดงตาม ward แทน
    // ต้องอาศัย mapping ฝั่งเซิร์ฟเวอร์ใน /api/dashboard (เราไม่ได้ส่ง department มาด้วยทุกแถว)
    // ดังนั้นจะ fallback เป็นการรวมแบบ "ตาม ward" ถ้าไม่มีฟิลด์ department ใน row
    // ถ้าคุณแก้ backend ให้ใส่ department มาทุกแถว ก็เปลี่ยนตรงนี้เป็น d.department ได้ทันที
    const byWard = {};
    filteredData.forEach((d) => {
      const key = d.department || d.wardname; // ถ้า backend เติม department มา จะรวมตาม department อัตโนมัติ
      byWard[key] = (byWard[key] || 0) + (d.bed_new || 0);
    });
    return Object.entries(byWard).map(([name, value]) => ({ name, value }));
  }, [filteredData, filters.department]);

  // พายชาร์ตกระจาย: ถ้าเลือก department แล้ว → ราย ward ในแผนกนั้น, ถ้าไม่เลือก → รวมตาม department
  const wardDistribution = useMemo(() => {
    if (!filters.department) return departmentDistribution;
    const wardCounts = {};
    filteredData.forEach((d) => {
      wardCounts[d.wardname] = (wardCounts[d.wardname] || 0) + (d.bed_new || 0);
    });
    return Object.entries(wardCounts).map(([name, value]) => ({ name, value }));
  }, [filteredData, filters.department, departmentDistribution]);

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

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      date: "",
      shift: "",
      department: "",
      ward: isAdmin ? "" : wardname || "",
      subward: "",
      month: "",
      year: "",
    });
  };

  const COLORS = ["#7e3cbd", "#c084fc", "#a855f7", "#9333ea", "#8b5cf6", "#7c3aed"];

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
          { label: "จำนวนรายการทั้งหมด", value: summaryStats.recordCount, icon: <Users size={24} />, colorClass: "blue" },
          { label: "ยอดรับใหม่ (Admit)", value: summaryStats.totalAdmissions, icon: <TrendingUp size={24} />, colorClass: "green" },
          { label: "ยอดจำหน่าย (Discharge)", value: summaryStats.totalDischarges, icon: <Activity size={24} />, colorClass: "yellow" },
          { label: "Productivity เฉลี่ย", value: `${summaryStats.avgProductivity}%`, icon: <Award size={24} />, colorClass: "red" },
        ].map((card, index) => (
          <div key={index} className={styles.summaryCard}>
            <div className={styles.summaryCardHeader}>
              <div className={`${styles.summaryCardIcon} ${styles[card.colorClass]}`}>
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
            { name: "date", label: "เลือกวันที่", type: "date", value: filters.date },
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
                label: new Date(0, i).toLocaleString("th-TH", { month: "long" }),
              })),
            },
            // ★ Department dropdown
            {
              name: "department",
              label: "เลือกกลุ่มงาน",
              type: "select",
              value: filters.department,
              options: filterOptions.departments,
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
                  onPointerDown={(e) => {
                    const el = e.currentTarget;
                    if (typeof el.showPicker === "function") {
                      e.preventDefault();
                      el.showPicker();
                    }
                  }}
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
                        value={typeof option === "object" ? option.value : option}
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
            <LineChart data={filteredData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString("th-TH", { month: "short", day: "numeric" })
                }
              />
              <YAxis />
              <Tooltip
                formatter={(value, name) => [
                  value,
                  name === "productivity" ? "Productivity (%)" : name === "bed_new" ? "การรับใหม่" : name,
                ]}
                labelFormatter={(value) => `วันที่: ${new Date(value).toLocaleDateString("th-TH")}`}
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
          <h3 className={styles.chartTitleSmall}>
            {filters.department ? "การกระจายตาม Ward (ใน Department ที่เลือก)" : "การกระจายตาม Department"}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={wardDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                {wardDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
          <BarChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("th-TH", { month: "short", day: "numeric" })
              }
            />
            <YAxis />
            <Tooltip formatter={(value, name) => [value, name]} />
            <Legend />
            <Bar dataKey="bed_new" fill="#7e3cbd" name="รับใหม่" radius={[4, 4, 0, 0]} />
            <Bar dataKey="discharge_home" fill="#10b981" name="จำหน่ายกลับบ้าน" radius={[4, 4, 0, 0]} />
            <Bar dataKey="discharge_transfer_out" fill="#f59e0b" name="โอนออก" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
