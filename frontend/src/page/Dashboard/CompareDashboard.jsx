// src/pages/Dashboard/CompareDashboard.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { jwtDecode } from "jwt-decode";
import { useSearchParams } from "react-router-dom";
import { API_BASE } from "../../config";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

import styles from "../../styles/Dashboard.module.css";
import FilterPanel from "../../components/dashboard/FilterPanel";
import Block from "../../components/common/Block";
import TableBox from "../../components/common/TableBox";
import {
  dateKey,
  strFromKeys,
  numFromKeys,
  fmt,
  shiftLabel,
  buildDateRange,
} from "../../utils/helpers";

export default function CompareDashboard({ username, wardname }) {
  const token = localStorage.getItem("token");
  let role_id = 1;
  let ward_id = null;
  let department_id = null;
  if (token) {
    try {
      const decoded = jwtDecode(token);
      role_id = decoded.role_id || decoded.role || 1;
      ward_id = decoded.ward_id || decoded.wardId || null;
      department_id = decoded.department_id || decoded.departmentId || null;
      if (typeof role_id === "string") {
        const map = { Admin: 4, Supervisor: 3, HeadNurse: 2, User: 1 };
        role_id = map[role_id] || 1;
      }
    } catch {}
  }
  const isAdmin = role_id === 4;
  const isSupervisor = role_id === 3;
  const isHeadNurse = role_id === 2;
  const isUser = role_id === 1;

  const [searchParams] = useSearchParams();
  const qpShift = searchParams.get("shift") || "";
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    shift: qpShift || "",
    department: "",
    ward: "",
    subward: "",
    month: "",
    year: "",
    compareMode: "shift",
  });

  useEffect(() => {
    setFilters((f) => {
      if (isAdmin || isSupervisor) return f;
      if (isHeadNurse)
        return { ...f, department: department_id || "", ward: "", subward: "" };
      if (isUser)
        return { ...f, ward: wardname || "", department: "", subward: "" };
      return f;
    });
  }, [isAdmin, isSupervisor, isHeadNurse, isUser, wardname, department_id]);

  const [data, setData] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [wardOptions, setWardOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const tk = localStorage.getItem("token") || "";
        const res = await fetch(`${API_BASE}/api/dashboard/departments`, {
          headers: tk ? { Authorization: `Bearer ${tk}` } : {},
          signal: ac.signal,
        });
        const rows = await res.json();
        const uniq = [
          ...new Set((rows || []).map((r) => r?.department).filter(Boolean)),
        ];
        setDepartments(uniq);
      } catch {}
    })();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        if (!filters.department) {
          setWardOptions([]);
          return;
        }
        const tk = localStorage.getItem("token") || "";
        const qs = new URLSearchParams({ department: filters.department });
        const res = await fetch(
          `${API_BASE}/api/dashboard/wards-by-department?${qs}`,
          {
            headers: tk ? { Authorization: `Bearer ${tk}` } : {},
            signal: ac.signal,
          }
        );
        const rows = await res.json();
        setWardOptions((rows || []).map((r) => r.wardname).filter(Boolean));
      } catch {
        setWardOptions([]);
      }
    })();
    setFilters((f) => ({ ...f, ward: isAdmin ? "" : f.ward, subward: "" }));
    return () => ac.abort();
  }, [filters.department]);

  const fetchData = useCallback(
    async (f, signal) => {
      setLoading(true);
      setError(null);
      try {
        const tk = localStorage.getItem("token") || "";
        const qs = buildDateRange(f);
        if (f.shift) qs.set("shift", f.shift);
        if (isAdmin && f.ward) qs.set("ward", f.ward);
        if (f.subward) qs.set("subward", f.subward);
        if (f.department) qs.set("department", f.department);
        if (isUser && wardname) qs.set("ward", wardname);
        const url = `${API_BASE}/api/dashboard${qs.toString() ? `?${qs}` : ""}`;
        const res = await fetch(url, {
          headers: tk ? { Authorization: `Bearer ${tk}` } : {},
          signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "โหลดข้อมูลไม่สำเร็จ");
        setData(Array.isArray(json) ? json : []);
      } catch (err) {
        if (err.name !== "AbortError")
          setError(err.message || "เชื่อมต่อ API ไม่ได้");
        setData([]);
      } finally {
        setLoading(false);
      }
    },
    [isAdmin, isUser, wardname]
  );

  useEffect(() => {
    const ac = new AbortController();
    fetchData(filters, ac.signal);
    return () => ac.abort();
  }, [fetchData, filters]);

  const filteredData = useMemo(() => {
    return data.filter((d) => {
      const dWard = strFromKeys(d, ["wardname", "ward"]);
      const dSub = strFromKeys(d, ["subward", "sub_ward", "subWard"]);
      const key = dateKey(d.date);
      const useRange = Boolean(filters.startDate || filters.endDate);
      const start = filters.startDate || filters.endDate;
      const end = filters.endDate || filters.startDate;
      const inRange =
        (!start || (key && key >= start)) && (!end || (key && key <= end));
      const y = key ? Number(key.slice(0, 4)) : NaN;
      const m = key ? Number(key.slice(5, 7)) : NaN;
      const matchesWard = !filters.ward || dWard === filters.ward;
      const matchesSub = !filters.subward || dSub === filters.subward;
      const matchesMonth =
        useRange || !filters.month || m === Number(filters.month);
      const matchesYear =
        useRange || !filters.year || y === Number(filters.year);
      const matchesShift = !filters.shift || d.shift === filters.shift;
      const matchesOwnWard = isAdmin || dWard === wardname;
      return (
        (!useRange || inRange) &&
        matchesWard &&
        matchesSub &&
        matchesMonth &&
        matchesYear &&
        matchesShift &&
        matchesOwnWard
      );
    });
  }, [data, filters, isAdmin, wardname]);

  const [selectedMetric, setSelectedMetric] = useState("admit");

  const groupLabelers = {
    shift: (r) => shiftLabel(r.shift || "") || "ไม่ระบุ",
    day: (r) => {
      const d = new Date(dateKey(r.date));
      return Number.isNaN(d) ? "-" : d.toLocaleDateString("th-TH");
    },
    month: (r) => {
      const d = new Date(dateKey(r.date));
      return Number.isNaN(d)
        ? "-"
        : d.toLocaleString("th-TH", { month: "short", year: "numeric" });
    },
    quarter: (r) => {
      const dk = dateKey(r.date);
      if (!dk) return "-";
      const y = Number(dk.slice(0, 4));
      const m = Number(dk.slice(5, 7));
      const q = Math.ceil(m / 3);
      return `Q${q} ${y}`;
    },
    year: (r) => {
      const dk = dateKey(r.date);
      return dk ? dk.slice(0, 4) : "-";
    },
  };

  const compare = useMemo(() => {
    const mode = filters.compareMode || "shift";
    const labeler = groupLabelers[mode];
    const by = {};
    for (const r of filteredData) {
      const label = labeler(r);
      if (!by[label]) {
        by[label] = {
          admit: 0,
          disHome: 0,
          moveWard: 0,
          referOut: 0,
          referBack: 0,
          death: 0,
          remain: 0,
          prodSum: 0,
          prodCnt: 0,
        };
      }
      by[label].admit += Number(r.bed_new || 0);
      by[label].disHome += Number(r.discharge_home || 0);
      by[label].moveWard += numFromKeys(r, [
        "discharge_transfer_out",
        "discharge_move_ward",
        "move_ward",
        "transfer_intra",
      ]);
      by[label].referOut += numFromKeys(r, [
        "discharge_refer_out",
        "refer_out",
      ]);
      by[label].referBack += numFromKeys(r, [
        "discharge_refer_back",
        "refer_back",
      ]);
      by[label].death += numFromKeys(r, [
        "discharge_death",
        "discharge_died",
        "death",
      ]);
      by[label].remain += Number(r.bed_remain ?? r.remain ?? 0);
      const p = parseFloat(r.productivity);
      if (!Number.isNaN(p) && p > 0) {
        by[label].prodSum += p;
        by[label].prodCnt += 1;
      }
    }
    const labels = Object.keys(by);
    const rows = labels.map((label) => {
      const v = by[label];
      const discharge =
        v.disHome + v.moveWard + v.referOut + v.referBack + v.death;
      const productivity = v.prodCnt ? v.prodSum / v.prodCnt : 0;
      return {
        label,
        admit: v.admit,
        discharge,
        disHome: v.disHome,
        moveWard: v.moveWard,
        referOut: v.referOut,
        referBack: v.referBack,
        death: v.death,
        remain: v.remain,
        productivity,
      };
    });
    const total = rows.reduce(
      (a, r) => ({
        admit: a.admit + r.admit,
        discharge: a.discharge + r.discharge,
        disHome: a.disHome + r.disHome,
        moveWard: a.moveWard + r.moveWard,
        referOut: a.referOut + r.referOut,
        referBack: a.referBack + r.referBack,
        death: a.death + r.death,
        remain: a.remain + r.remain,
        prodSum: a.prodSum + r.productivity,
        prodCnt: a.prodCnt + 1,
      }),
      {
        admit: 0,
        discharge: 0,
        disHome: 0,
        moveWard: 0,
        referOut: 0,
        referBack: 0,
        death: 0,
        remain: 0,
        prodSum: 0,
        prodCnt: 0,
      }
    );
    const totalProd = total.prodCnt ? total.prodSum / total.prodCnt : 0;
    return { labels, rows, total: { ...total, productivity: totalProd } };
  }, [filteredData, filters.compareMode]);

  const handleFilterChange = (e) =>
    setFilters((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => {
      if (name === "startDate") {
        const start = value;
        const end = prev.endDate && prev.endDate < start ? start : prev.endDate;
        return { ...prev, startDate: start, endDate: end };
      }
      if (name === "endDate") return { ...prev, endDate: value };
      return prev;
    });
  };
  const clearFilters = () => {
    setFilters((prev) => ({
      startDate: "",
      endDate: "",
      shift: "",
      department: isAdmin || isHeadNurse ? "" : prev.department,
      ward: isAdmin || isHeadNurse ? "" : prev.ward,
      subward: "",
      month: "",
      year: "",
      compareMode: prev.compareMode,
    }));
  };

  const metricOptions = [
    { key: "admit", label: "รับใหม่ (Admit)" },
    { key: "discharge", label: "จำหน่าย (Discharge รวม)" },
    { key: "disHome", label: "กลับบ้าน" },
    { key: "moveWard", label: "ย้ายตึก" },
    { key: "referOut", label: "Refer out" },
    { key: "referBack", label: "Refer back" },
    { key: "death", label: "เสียชีวิต" },
    { key: "remain", label: "คงพยาบาล" },
    { key: "productivity", label: "Productivity (%)" },
  ];

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.dashboardHeader}>
        <div className={styles.dashboardHeaderContent}>
          <div>
            <h1 className={styles.dashboardTitle}>📊 Compare Dashboard</h1>
            <p className={styles.dashboardSubtitle}>
              เปรียบเทียบตาม: เวร / วัน / เดือน / ไตรมาส / ปี
            </p>
          </div>
        </div>
      </div>

      <FilterPanel
        styles={styles}
        filters={filters}
        filterOptions={useMemo(() => {
          const uniqueWards = filters.department
            ? [...wardOptions].sort((a, b) =>
                String(a).localeCompare(String(b), "th", {
                  sensitivity: "base",
                })
              )
            : [
                ...new Set(
                  data.map((d) => strFromKeys(d, ["wardname", "ward"]))
                ),
              ]
                .filter(Boolean)
                .sort((a, b) =>
                  String(a).localeCompare(String(b), "th", {
                    sensitivity: "base",
                  })
                );
          const uniqueYears = [
            ...new Set(
              data
                .map((d) => dateKey(d.date))
                .filter(Boolean)
                .map((s) => Number(s.slice(0, 4)))
            ),
          ].sort((a, b) => b - a);
          return {
            departments,
            wards: uniqueWards,
            years: uniqueYears,
            subwards: [],
          };
        }, [data, filters.department, departments, wardOptions])}
        departments={departments}
        onChangeFilter={handleFilterChange}
        onChangeDate={handleDateChange}
        onClear={clearFilters}
        disabledFields={{ department: isUser, ward: isUser }}
      />

      <Block
        styles={styles}
        title="ตั้งค่าเปรียบเทียบ"
        loading={false}
        error={null}
        empty={false}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div>
            <label style={{ fontWeight: 600, marginRight: 8 }}>
              โหมดเปรียบเทียบ:
            </label>
            <select
              value={filters.compareMode}
              onChange={(e) =>
                setFilters((f) => ({ ...f, compareMode: e.target.value }))
              }
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #ddd",
              }}
            >
              <option value="shift">เวร (เช้า / บ่าย / ดึก)</option>
              <option value="day">วัน</option>
              <option value="month">เดือน</option>
              <option value="quarter">ไตรมาส</option>
              <option value="year">ปี</option>
            </select>
          </div>
          <div>
            <label style={{ fontWeight: 600, marginRight: 8 }}>
              หัวข้อกราฟแท่ง:
            </label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid ddd",
              }}
            >
              {metricOptions.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Block>

      {/* ตารางเปรียบเทียบ */}
      <Block
        styles={styles}
        title="ตารางเปรียบเทียบ (เหมือน Excel)"
        loading={loading}
        error={error}
        empty={!compare.rows.length}
      >
        {compare && Array.isArray(compare.rows) && compare.rows.length > 0 ? (
          <TableBox
            headers={["หัวข้อ", ...(compare.labels || []), "รวม"]}
            rows={(() => {
              const mk = (name, getter) => [
                name,
                ...(compare.rows || []).map((r) => fmt(getter(r))),
                fmt(getter(compare.total || {})),
              ];
              return [
                mk("รับใหม่ (Admit)", (r) => r.admit || 0),
                mk("จำหน่ายรวม (Discharge)", (r) => r.discharge || 0),
                mk("กลับบ้าน", (r) => r.disHome || 0),
                mk("ย้ายตึก", (r) => r.moveWard || 0),
                mk("Refer out", (r) => r.referOut || 0),
                mk("Refer back", (r) => r.referBack || 0),
                mk("เสียชีวิต", (r) => r.death || 0),
                mk("คงพยาบาล", (r) => r.remain || 0),
                [
                  "Productivity (%)",
                  ...(compare.rows || []).map((r) =>
                    Number.isFinite(+r.productivity)
                      ? Number(r.productivity).toFixed(2)
                      : "-"
                  ),
                  Number.isFinite(+compare.total?.productivity)
                    ? Number(compare.total.productivity).toFixed(2)
                    : "-",
                ],
              ];
            })()}
          />
        ) : (
          <div style={{ padding: "16px", textAlign: "center", color: "#777" }}>
            ไม่มีข้อมูลเปรียบเทียบ
          </div>
        )}
      </Block>

      {/* ===== เพิ่มตารางสรุปแบบเดียวกับ Dashboard หลัก ===== */}

      <Block styles={styles} title="รวมคงพยาบาลทั้งหมด ทุกวอร์ด">
        <TableBox
          headers={["หัวข้อ", ...(compare.labels || []), "รวม"]}
          rows={[
            ["วอร์ดทั้งหมด", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["วอร์ดพิเศษ", ...compare.labels.map(() => fmt(0)), fmt(0)],
          ]}
        />
      </Block>

      <Block styles={styles} title="สรุป คงพยาบาล ICU">
        <TableBox
          headers={["หัวข้อ", ...(compare.labels || []), "รวม"]}
          rows={[
            ["ICU (ผู้ใหญ่)", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["ICU (เด็ก)", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["รวม ICU", ...compare.labels.map(() => fmt(0)), fmt(0)],
          ]}
        />
      </Block>

      <Block styles={styles} title="สรุป สามัญ / Semi ICU / ทารก">
        <TableBox
          headers={["หัวข้อ", ...(compare.labels || []), "รวม"]}
          rows={[
            ["คงพยาบาล (สามัญ)", ...compare.labels.map(() => fmt(0)), fmt(0)],
            [
              "คงพยาบาล (Semi ICU)",
              ...compare.labels.map(() => fmt(0)),
              fmt(0),
            ],
            ["คงพยาบาล (ทารก)", ...compare.labels.map(() => fmt(0)), fmt(0)],
          ]}
        />
      </Block>

      <Block styles={styles} title="สรุป Ventilator">
        <TableBox
          headers={["หัวข้อ", ...(compare.labels || []), "รวม"]}
          rows={[
            ["ICU (รวม)", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["ผู้ใหญ่", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["เด็ก", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["รวมทั้งหมด", ...compare.labels.map(() => fmt(0)), fmt(0)],
          ]}
        />
      </Block>

      <Block styles={styles} title="สรุปไข้เลือดออก (DF / DHF / DSS)">
        <TableBox
          headers={["ประเภท", ...(compare.labels || []), "รวม"]}
          rows={[
            ["DF - รับใหม่", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["DF - กลับบ้าน", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["DF - เสียชีวิต", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["DF - คงพยาบาล", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["DHF - รับใหม่", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["DHF - กลับบ้าน", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["DHF - เสียชีวิต", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["DHF - คงพยาบาล", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["DSS - รับใหม่", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["DSS - กลับบ้าน", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["DSS - เสียชีวิต", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["DSS - คงพยาบาล", ...compare.labels.map(() => fmt(0)), fmt(0)],
          ]}
        />
      </Block>

      <Block styles={styles} title="รวม Stroke / จิตเวช / นักโทษ">
        <TableBox
          headers={["หัวข้อ", ...(compare.labels || []), "รวม"]}
          rows={[
            ["รวม Stroke", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["รวม จิตเวช", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["รวม นักโทษ", ...compare.labels.map(() => fmt(0)), fmt(0)],
          ]}
        />
      </Block>

      <Block styles={styles} title="สรุปกำลังพยาบาล (RN)">
        <TableBox
          headers={["หัวข้อ", ...(compare.labels || []), "รวม"]}
          rows={[
            ["RN", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["RN เพิ่ม", ...compare.labels.map(() => fmt(0)), fmt(0)],
            ["รวม RN", ...compare.labels.map(() => fmt(0)), fmt(0)],
          ]}
        />
      </Block>

      {/* กราฟแท่ง */}
      <Block
        styles={styles}
        title={`กราฟแท่ง: ${
          metricOptions.find((m) => m.key === selectedMetric)?.label || ""
        }`}
        loading={loading}
        error={error}
        empty={!compare.rows.length}
      >
        <ResponsiveContainer width="100%" height={360}>
          <BarChart
            data={compare.rows}
            margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip
              formatter={(v) =>
                selectedMetric === "productivity"
                  ? `${Number(v).toFixed(2)}%`
                  : `${fmt(v)} คน`
              }
            />
            <Legend />
            <Bar
              dataKey={selectedMetric}
              name={metricOptions.find((m) => m.key === selectedMetric)?.label}
              fill="#7e3cbd"
            />
          </BarChart>
        </ResponsiveContainer>
      </Block>
    </div>
  );
}
