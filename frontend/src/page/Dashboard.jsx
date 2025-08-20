// src/pages/Dashboard.jsx 
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

/** ---------------- Utils ---------------- **/

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

// อ่านตัวเลขจากหลายคีย์ (กันกรณีชื่อคอลัมน์ไม่ตรงกัน)
const numFromKeys = (row, keys) => {
  for (const k of keys) {
    const v = parseFloat(row?.[k]);
    if (Number.isFinite(v)) return v;
  }
  return 0;
};

// แสดงเลขไทยสวย ๆ
const fmt = (n) => (Number.isFinite(+n) ? +n : 0).toLocaleString("th-TH");

// ป้ายชื่อเวร
const shiftLabel = (sh) =>
  sh === "morning"
    ? "เวรเช้า"
    : sh === "afternoon"
    ? "เวรบ่าย"
    : sh === "night"
    ? "เวรดึก"
    : "";

// จำนวนรายการ log ต่อหน้า
const LOG_PAGE_SIZE = 10;

/** --------------- Component --------------- **/
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
  const [logPage, setLogPage] = useState(1); // <-- state แบ่งหน้า log

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
        if (filters.subward) qs.set("subward", filters.subward);
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
  }, [isAdmin, filters.ward, filters.department, filters.subward]);

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
    if (filters.department) return [];
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

  // สรุปสถิติการ์ดบนสุด
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

  /** ---------------- สรุปเคลื่อนไหวผู้ป่วย (คำนวณฝั่งหน้า) ---------------- **/
  const movement = useMemo(() => {
    const carryForward = filteredData.reduce(
      (s, r) =>
        s +
        numFromKeys(r, [
          "carry_forward",
          "brought_forward",
          "opening_census",
          "begin_balance",
        ]),
      0
    );
    const admitNew = filteredData.reduce((s, r) => s + (r.bed_new || 0), 0);
    const admitTransferIn = filteredData.reduce(
      (s, r) =>
        s +
        numFromKeys(r, [
          "admit_transfer_in",
          "transfer_in",
          "receive_transfer_in",
        ]),
      0
    );
    const disHome = filteredData.reduce(
      (s, r) => s + (r.discharge_home || 0),
      0
    );
    const disMoveWard = filteredData.reduce(
      (s, r) =>
        s +
        numFromKeys(r, ["discharge_move_ward", "move_ward", "transfer_intra"]),
      0
    );
    const disReferOut = filteredData.reduce(
      (s, r) =>
        s +
        numFromKeys(r, [
          "discharge_transfer_out",
          "discharge_refer_out",
          "refer_out",
        ]),
      0
    );
    const disReferBack = filteredData.reduce(
      (s, r) => s + numFromKeys(r, ["discharge_refer_back", "refer_back"]),
      0
    );
    const disDeath = filteredData.reduce(
      (s, r) => s + numFromKeys(r, ["discharge_death", "death"]),
      0
    );

    const admitAll = admitNew + admitTransferIn;
    const dischargeAll =
      disHome + disMoveWard + disReferOut + disReferBack + disDeath;
    const remain = carryForward + admitAll - dischargeAll;

    return {
      carryForward,
      admitNew,
      admitTransferIn,
      admitAll,
      disHome,
      disMoveWard,
      disReferOut,
      disReferBack,
      disDeath,
      dischargeAll,
      remain,
    };
  }, [filteredData]);

  /** ---------------- รายการตามเวลา (Log view) ---------------- **/
  const logItems = useMemo(() => {
    const shiftStart = { morning: "07:00", afternoon: "15:00", night: "23:00" };
    const dtCandidates = ["datetime", "date_time", "created_at", "updated_at", "time"];

    const toDisplayDateTime = (row) => {
      // 1) ถ้ามีฟิลด์วัน/เวลา ใช้สำหรับ ts แต่แสดงผลเป็น "วันที่" อย่างเดียว
      for (const k of dtCandidates) {
        if (row?.[k]) {
          const d = new Date(row[k]);
          if (!Number.isNaN(d)) {
            return { ts: d.getTime(), text: d.toLocaleDateString("th-TH") };
          }
        }
      }
      // 2) ถ้าไม่มี datetime ให้ผูกเวลาเริ่มเวรไว้สำหรับการ sort แต่ text แสดง "วันที่" เท่านั้น
      if (row?.date) {
        const time = shiftStart[row?.shift] || "00:00";
        const dSort = new Date(`${dateKey(row.date)}T${time}:00`);
        const dText = new Date(dateKey(row.date));
        if (!Number.isNaN(dSort) && !Number.isNaN(dText)) {
          return { ts: dSort.getTime(), text: dText.toLocaleDateString("th-TH") };
        }
      }
      // 3) สุดท้าย แสดงเฉพาะวันที่
      if (row?.date) {
        const d = new Date(dateKey(row.date));
        if (!Number.isNaN(d)) {
          return { ts: d.getTime(), text: d.toLocaleDateString("th-TH") };
        }
      }
      return { ts: 0, text: "-" };
    };

    return [...filteredData]
      .map((r) => {
        const dt = toDisplayDateTime(r);
        const carry = numFromKeys(r, [
          "carry_forward",
          "brought_forward",
          "opening_census",
          "begin_balance",
        ]);
        const tIn = numFromKeys(r, [
          "admit_transfer_in",
          "transfer_in",
          "receive_transfer_in",
        ]);
        const moveWard = numFromKeys(r, [
          "discharge_move_ward",
          "move_ward",
          "transfer_intra",
        ]);
        const refOut = numFromKeys(r, [
          "discharge_transfer_out",
          "discharge_refer_out",
          "refer_out",
        ]);
        const refBack = numFromKeys(r, ["discharge_refer_back", "refer_back"]);
        const death = numFromKeys(r, ["discharge_death", "death"]);
        const admitNew = r.bed_new || 0;
        const disHome = r.discharge_home || 0;
        const admitAll = admitNew + tIn;
        const dischargeAll = disHome + moveWard + refOut + refBack + death;
        const remain = carry + admitAll - dischargeAll;

        return {
          ts: dt.ts,
          timeText: dt.text,
          shift: r.shift || "",
          department: r.department || "",
          ward: r.wardname || "",
          subward: r.subward || "",
          admitNew,
          transferIn: tIn,
          disHome,
          moveWard,
          referOut: refOut,
          referBack: refBack,
          death,
          remain,
          productivity: r.productivity,
        };
      })
      .sort((a, b) => b.ts - a.ts || b.ward.localeCompare(a.ward, "th"));
  }, [filteredData]);

  // ---------------- Pagination for logItems ----------------
  const totalLogPages = useMemo(
    () => Math.max(1, Math.ceil(logItems.length / LOG_PAGE_SIZE)),
    [logItems.length]
  );

  const pageLogItems = useMemo(
    () => logItems.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE),
    [logItems, logPage]
  );

  // เมื่อกรองข้อมูลใหม่/จำนวนรายการเปลี่ยน ให้เด้งกลับหน้า 1
  useEffect(() => {
    setLogPage(1);
  }, [
    filteredData.length,
    filters.date,
    filters.shift,
    filters.department,
    filters.ward,
    filters.subward,
    filters.month,
    filters.year,
  ]);

  // ถ้าจำนวนหน้าลดลง ให้ปรับหน้าปัจจุบันไม่ให้เกิน totalLogPages
  useEffect(() => {
    if (logPage > totalLogPages) setLogPage(totalLogPages);
  }, [totalLogPages, logPage]);

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

      {/* การ์ดสรุป */}
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

      {/* ฟิลเตอร์ */}
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

      {/* กราฟเดิม */}
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

      {/* ✅ สรุปเคลื่อนไหวผู้ป่วย (คำนวณฝั่งหน้า) */}
      <div className={`${styles.chartContainer} ${styles.fullWidthChart}`}>
        <h3 className={styles.chartTitle}>สรุปเคลื่อนไหวผู้ป่วย</h3>
        {!filteredData.length ? (
          <div className={styles.loadingContainer} style={{ height: 80 }}>
            <span className={styles.loadingText}>ไม่มีข้อมูลตามตัวกรอง</span>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>ยอดยกมา</th>
                  <th colSpan={2} style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>ยอดรับ</th>
                  <th colSpan={5} style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>ยอดจำหน่าย</th>
                  <th rowSpan={2} style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>คงพยาบาล</th>
                </tr>
                <tr>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>รับใหม่</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>รับย้าย</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>กลับบ้าน</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>ย้ายตึก</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Refer out</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Refer back</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>เสียชีวิต</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{fmt(movement.carryForward)}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{fmt(movement.admitNew)}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{fmt(movement.admitTransferIn)}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{fmt(movement.disHome)}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{fmt(movement.disMoveWard)}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{fmt(movement.disReferOut)}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{fmt(movement.disReferBack)}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{fmt(movement.disDeath)}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{fmt(movement.remain)}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
              <div style={{ padding: "6px 10px", background: "#f3f4f6", borderRadius: 8 }}>
                <strong>ยอดรับรวม:</strong> {fmt(movement.admitAll)}
              </div>
              <div style={{ padding: "6px 10px", background: "#f3f4f6", borderRadius: 8 }}>
                <strong>ยอดจำหน่ายรวม:</strong> {fmt(movement.dischargeAll)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ✅ รายการตามเวลา (Log view) + แบ่งหน้า */}
<div className={`${styles.chartContainer} ${styles.fullWidthChart}`}>
  <h3 className={styles.chartTitle}>รายการตามเวลา</h3>
  {!logItems.length ? (
    <div className={styles.loadingContainer} style={{ height: 80 }}>
      <span className={styles.loadingText}>ไม่มีข้อมูลตามตัวกรอง</span>
    </div>
  ) : (
    <div style={{ overflowX: "auto" }}>
      <table className={styles.logTable}>
        <thead>
          <tr>
            <th>วันที่</th>
            <th>เวร</th>
            <th>กลุ่มงาน</th>
            <th>Ward</th>
            <th>Sub-ward</th>
            <th>รับใหม่</th>
            <th>รับย้าย</th>
            <th>กลับบ้าน</th>
            <th>ย้ายตึก</th>
            <th>Refer out</th>
            <th>Refer back</th>
            <th>เสียชีวิต</th>
            <th>คงพยาบาล</th>
            <th>Prod. (%)</th>
          </tr>
        </thead>
        <tbody>
          {pageLogItems.map((r, idx) => (
            <tr key={`${r.ts}-${idx}`}>
              <td>{r.timeText}</td>
              <td>{shiftLabel(r.shift)}</td>
              <td>{r.department || "-"}</td>
              <td>{r.ward || "-"}</td>
              <td>{r.subward || "-"}</td>
              <td>{fmt(r.admitNew)}</td>
              <td>{fmt(r.transferIn)}</td>
              <td>{fmt(r.disHome)}</td>
              <td>{fmt(r.moveWard)}</td>
              <td>{fmt(r.referOut)}</td>
              <td>{fmt(r.referBack)}</td>
              <td>{fmt(r.death)}</td>
              <td>{fmt(r.remain)}</td>
              <td>{Number.isFinite(+r.productivity) ? Number(r.productivity).toFixed(2) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ตัวควบคุมแบ่งหน้า */}
      <div className={styles.pagination}>
        <button className={styles.pageBtn} onClick={() => setLogPage(1)} disabled={logPage === 1}>
          « หน้าแรก
        </button>
        <button
          className={styles.pageBtn}
          onClick={() => setLogPage((p) => Math.max(1, p - 1))}
          disabled={logPage === 1}
        >
          ‹ ก่อนหน้า
        </button>

        <span className={styles.pageInfo}>
          หน้า {logPage} / {totalLogPages} • ทั้งหมด {logItems.length.toLocaleString("th-TH")} รายการ
        </span>

        <button
          className={styles.pageBtn}
          onClick={() => setLogPage((p) => Math.min(totalLogPages, p + 1))}
          disabled={logPage === totalLogPages}
        >
          ถัดไป ›
        </button>
        <button
          className={styles.pageBtn}
          onClick={() => setLogPage(totalLogPages)}
          disabled={logPage === totalLogPages}
        >
          หน้าสุดท้าย »
        </button>
      </div>
    </div>
  )}
</div>

    </div>
  );
}
