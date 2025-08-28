// src/pages/Dashboard.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import { Filter, Users, Activity, TrendingUp, Award, RefreshCw, X } from "lucide-react";
import styles from "../styles/Dashboard.module.css";

/** -------------------------------- Config -------------------------------- **/
const API_BASE = (import.meta?.env?.VITE_API_BASE || "http://localhost:5000/api").replace(/\/$/, "");
const LOG_PAGE_SIZE = 10; // จำนวนรายการ log ต่อหน้า

/** -------------------------------- Utils --------------------------------- **/
// คืนค่าเป็นวันตาม local time เช่น "2025-08-15"
const dateKey = (v) => {
  const dt = new Date(v);
  if (Number.isNaN(dt)) return "";
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 10);
};

// จัดลำดับ sub-ward แบบมี priority ต่อ ward ที่เลือก
const sortSubwardsWithPriority = (list, ward) => {
  const PRIORITY = { อายุรกรรม: ["อายุรกรรม", "semi icu"] };
  const pri = PRIORITY[ward] || [];
  const rank = new Map(pri.map((name, i) => [String(name).toLowerCase(), i]));
  return [...(list || [])].sort((a, b) => {
    const al = String(a ?? "").toLowerCase();
    const bl = String(b ?? "").toLowerCase();
    const ai = rank.has(al) ? rank.get(al) : Infinity;
    const bi = rank.has(bl) ? rank.get(bl) : Infinity;
    if (ai !== bi) return ai - bi;
    return String(a).localeCompare(String(b), "th", { sensitivity: "base" });
  });
};

// อ่านตัวเลข/สตริงจากหลายคีย์
const numFromKeys = (row, keys) => {
  for (const k of keys) {
    const v = parseFloat(row?.[k]);
    if (Number.isFinite(v)) return v;
  }
  return 0;
};
const strFromKeys = (row, keys) => {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return "";
};

// แสดงเลขไทยสวย ๆ
const fmt = (n) => (Number.isFinite(+n) ? +n : 0).toLocaleString("th-TH");

// ป้ายชื่อเวร
const shiftLabel = (sh) => (sh === "morning" ? "เวรเช้า" : sh === "afternoon" ? "เวรบ่าย" : sh === "night" ? "เวรดึก" : "");

// ช่วยประกอบช่วงวันที่จาก filters (รองรับใส่ช่องเดียว)
const buildDateRange = (filters) => {
  const qs = new URLSearchParams();
  if (filters.startDate || filters.endDate) {
    const s = filters.startDate || filters.endDate;
    const e = filters.endDate || filters.startDate;
    qs.set("start", s);
    qs.set("end", e);
  } else if (filters.year && filters.month) {
    const y = Number(filters.year);
    const m = Number(filters.month);
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    qs.set("start", start);
    qs.set("end", end);
  } else if (filters.year) {
    qs.set("start", `${filters.year}-01-01`);
    qs.set("end", `${filters.year}-12-31`);
  }
  return qs;
};

/** ------------------------------- Component ------------------------------ **/
export default function Dashboard({ username, wardname }) {
  const isAdmin = String(username || "").toLowerCase() === "admin";
  const [searchParams] = useSearchParams();
  const qpShift = searchParams.get("shift") || "";

  const [data, setData] = useState([]);
  const [departments, setDepartments] = useState([]); // รายชื่อ department สำหรับ dropdown
  const [wardOptions, setWardOptions] = useState([]); // รายชื่อ ward ตาม department ที่เลือก
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logPage, setLogPage] = useState(1);

  // ✅ state สำหรับ "ตารางจาก view ใหม่"
  const [unifiedRows, setUnifiedRows] = useState([]);
  const [unifiedLoading, setUnifiedLoading] = useState(false);
  const [unifiedError, setUnifiedError] = useState(null);

  // ฟิลเตอร์
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    shift: "",
    department: "",
    ward: "",
    subward: "",
    month: "",
    year: "",
  });

  // non-admin: ล็อก ward = wardname ของตัวเอง
  useEffect(() => {
    if (!isAdmin) setFilters((f) => ({ ...f, ward: wardname || "" }));
  }, [isAdmin, wardname]);

  // sync ค่าเริ่มจาก URL (?shift=...)
  useEffect(() => {
    setFilters((f) => ({ ...f, shift: qpShift || f.shift }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qpShift]);

  /** -------------------------- Load departments -------------------------- **/
  useEffect(() => {
    const ac = new AbortController();
    const run = async () => {
      try {
        const token = localStorage.getItem("token") || "";
        const res = await fetch(`${API_BASE}/dashboard/departments`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: ac.signal,
        });
        if (!res.ok) throw new Error("โหลดรายชื่อแผนกไม่สำเร็จ");
        const rows = await res.json();
        const uniq = [...new Set((rows || []).map((r) => r?.department).filter(Boolean))];
        setDepartments(uniq);
      } catch (e) {
        if (e.name !== "AbortError") console.warn("departments error:", e);
      }
    };
    run();
    return () => ac.abort();
  }, []);

  /** -------------------- Load wards when department changes -------------------- **/
  useEffect(() => {
    const ac = new AbortController();
    const run = async () => {
      try {
        if (!filters.department) {
          setWardOptions([]);
          return;
        }
        const token = localStorage.getItem("token") || "";
        const qs = new URLSearchParams({ department: filters.department });
        const res = await fetch(`${API_BASE}/dashboard/wards-by-department?${qs}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: ac.signal,
        });
        if (!res.ok) throw new Error("โหลดรายชื่อวอร์ดในแผนกไม่สำเร็จ");
        const rows = await res.json();
        setWardOptions((rows || []).map((r) => r.wardname).filter(Boolean));
      } catch (e) {
        if (e.name !== "AbortError") console.warn("wards error:", e);
        setWardOptions([]);
      }
    };
    run();
    // เคลียร์เมื่อเปลี่ยนแผนก
    setFilters((f) => ({ ...f, ward: isAdmin ? "" : f.ward, subward: "" }));
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.department]);

  /** --------------------------- Fetch dashboard data -------------------------- **/
  const fetchData = useCallback(async (filters, signal) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token") || "";
      const qs = buildDateRange(filters);
      if (filters.shift) qs.set("shift", filters.shift);
      if (isAdmin && filters.ward) qs.set("ward", filters.ward);
      if (filters.department) qs.set("department", filters.department);
      if (filters.subward) qs.set("subward", filters.subward);

      const url = `${API_BASE}/dashboard${qs.toString() ? `?${qs}` : ""}`;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
      setData(Array.isArray(json) ? json : []);
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message || "ไม่สามารถเชื่อมต่อ API ได้");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    const ac = new AbortController();
    fetchData(filters, ac.signal);
    return () => ac.abort();
  }, [fetchData, filters, isAdmin, username]);

  /** --------------------- Fetch summary from v_reports_unified -------------------- **/
  const fetchUnified = useCallback(async (filters, signal) => {
    setUnifiedLoading(true);
    setUnifiedError(null);
    try {
      const token = localStorage.getItem("token") || "";
      const qs = buildDateRange(filters);
      if (filters.shift) qs.set("shift", filters.shift);
      if (filters.ward) qs.set("wardname", filters.ward); // ส่งเฉพาะเมื่อเลือกจริง
      if (filters.subward) qs.set("subward", filters.subward);

      const url = `${API_BASE}/dashboard/summary${qs.toString() ? `?${qs}` : ""}`;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal });
      const json = await res.json();

      if (!res.ok || json?.ok === false) throw new Error(json?.message || "โหลดสรุปจาก View ไม่สำเร็จ");
      const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      setUnifiedRows(rows);
    } catch (e) {
      if (e.name === "AbortError") return;
      setUnifiedError(e.message || "ไม่สามารถโหลดสรุปจาก View ได้");
      setUnifiedRows([]);
    } finally {
      setUnifiedLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    fetchUnified(filters, ac.signal);
    return () => ac.abort();
  }, [fetchUnified, filters]);

  /** -------------------- Filter options derived from data ------------------- **/
  const filterOptions = useMemo(() => {
    const wardsFromDept = filters.department ? wardOptions : null;
    const uniqueWards = wardsFromDept
      ? [...wardsFromDept].sort((a, b) => String(a).localeCompare(String(b), "th", { sensitivity: "base" }))
      : [...new Set(data.map((d) => strFromKeys(d, ["wardname", "ward"])))]
          .filter(Boolean)
          .sort((a, b) => String(a).localeCompare(String(b), "th", { sensitivity: "base" }));

    const uniqueYears = [
      ...new Set(
        data
          .map((d) => dateKey(d.date))
          .filter(Boolean)
          .map((s) => Number(s.slice(0, 4)))
      ),
    ].sort((a, b) => b - a);

    const selectedWard = filters.ward;
    const subFromData = selectedWard
      ? [
          ...new Set(
            data
              .filter(
                (d) =>
                  strFromKeys(d, ["wardname", "ward"]) === selectedWard &&
                  strFromKeys(d, ["subward", "sub_ward", "subWard"]) !== ""
              )
              .map((d) => strFromKeys(d, ["subward", "sub_ward", "subWard"]))
          ),
        ]
      : [];
    const uniqueSubwards = sortSubwardsWithPriority(subFromData, selectedWard);

    return { departments, wards: uniqueWards, years: uniqueYears, subwards: uniqueSubwards };
  }, [data, filters.ward, filters.department, departments, wardOptions]);

  // เปลี่ยน ward แล้วเคลียร์ subward
  useEffect(() => {
    setFilters((f) => ({ ...f, subward: "" }));
  }, [filters.ward]);

  /** ------------------------------ Filtering data ----------------------------- **/
  const filteredData = useMemo(() => {
    return data.filter((d) => {
      const dWard = strFromKeys(d, ["wardname", "ward"]);
      const dSub = strFromKeys(d, ["subward", "sub_ward", "subWard"]);
      const key = dateKey(d.date);
      const useRange = Boolean(filters.startDate || filters.endDate);
      const start = filters.startDate || filters.endDate; // ถ้าใส่ช่องเดียว ให้ใช้วันเดียว
      const end = filters.endDate || filters.startDate;
      const inRange = (!start || (key && key >= start)) && (!end || (key && key <= end));

      const yearNum = key ? Number(key.slice(0, 4)) : NaN;
      const monthNum = key ? Number(key.slice(5, 7)) : NaN;

      const matchesWard = !filters.ward || dWard === filters.ward;
      const matchesSubward = !filters.subward || dSub === filters.subward;
      const matchesMonth = useRange || !filters.month || monthNum === Number(filters.month);
      const matchesYear = useRange || !filters.year || yearNum === Number(filters.year);
      const matchesShift = !filters.shift || d.shift === filters.shift;
      const matchesOwnWard = isAdmin || dWard === wardname;

      return (
        (!useRange || inRange) &&
        matchesWard &&
        matchesSubward &&
        matchesMonth &&
        matchesYear &&
        matchesShift &&
        matchesOwnWard
      );
    });
  }, [data, filters, isAdmin, wardname]);

  /** --------------------------- Aggregations/Charts -------------------------- **/
  const departmentDistribution = useMemo(() => {
    if (filters.department) return [];
    const byKey = {};
    filteredData.forEach((d) => {
      const groupKey = d.department || strFromKeys(d, ["wardname", "ward"]);
      byKey[groupKey] = (byKey[groupKey] || 0) + (d.bed_new || 0);
    });
    return Object.entries(byKey).map(([name, value]) => ({ name, value }));
  }, [filteredData, filters.department]);

  const wardDistribution = useMemo(() => {
    if (!filters.department) return departmentDistribution;
    const wardCounts = {};
    filteredData.forEach((d) => {
      const w = strFromKeys(d, ["wardname", "ward"]);
      wardCounts[w] = (wardCounts[w] || 0) + (d.bed_new || 0);
    });
    return Object.entries(wardCounts).map(([name, value]) => ({ name, value }));
  }, [filteredData, filters.department, departmentDistribution]);

  const summaryStats = useMemo(() => {
    const totalAdmissions = filteredData.reduce((s, r) => s + (r.bed_new || 0), 0);
    const totalDischarges = filteredData.reduce((s, r) => s + (r.discharge_home || 0) + (r.discharge_transfer_out || 0), 0);
    const totalProductivity = filteredData.reduce((s, r) => s + (parseFloat(r.productivity) || 0), 0);
    const avgProductivity = filteredData.length ? totalProductivity / filteredData.length : 0;
    return { recordCount: filteredData.length, totalAdmissions, totalDischarges, avgProductivity: avgProductivity.toFixed(2) };
  }, [filteredData]);

  /** --------------------------- Movement (local data) -------------------------- **/
  const movement = useMemo(() => {
    const carryForward = filteredData.reduce(
      (s, r) =>
        s +
        numFromKeys(r, ["carry_forward", "brought_forward", "opening_census", "begin_balance", "bed_carry"]),
      0
    );
    const admitNew = filteredData.reduce((s, r) => s + (r.bed_new || 0), 0);
    const admitTransferIn = filteredData.reduce(
      (s, r) => s + numFromKeys(r, ["admit_transfer_in", "bed_transfer_in", "transfer_in", "receive_transfer_in"]),
      0
    );
    const disHome = filteredData.reduce((s, r) => s + (r.discharge_home || 0), 0);
    const disMoveWard = filteredData.reduce(
      (s, r) => s + numFromKeys(r, ["discharge_transfer_out", "discharge_move_ward", "move_ward", "transfer_intra"]),
      0
    );
    const disReferOut = filteredData.reduce((s, r) => s + numFromKeys(r, ["discharge_refer_out", "refer_out"]), 0);
    const disReferBack = filteredData.reduce((s, r) => s + numFromKeys(r, ["discharge_refer_back", "refer_back"]), 0);
    const disDeath = filteredData.reduce((s, r) => s + numFromKeys(r, ["discharge_death", "discharge_died", "death"]), 0);

    const admitAll = admitNew + admitTransferIn;
    const dischargeAll = disHome + disMoveWard + disReferOut + disReferBack + disDeath;
    const remain = carryForward + admitAll - dischargeAll;

    return { carryForward, admitNew, admitTransferIn, admitAll, disHome, disMoveWard, disReferOut, disReferBack, disDeath, dischargeAll, remain };
  }, [filteredData]);

  /** ------------------------ Movement from unifiedRows ------------------------ **/
  const buildMovementFromUnified = (rows = []) => {
    const n = (v) => Number(v ?? 0) || 0;
    const pick = (o, keys) => {
      for (const k of keys) if (o?.[k] !== undefined && o?.[k] !== null) return o[k];
      return 0;
    };
    const F = {
      carry: (r) => n(pick(r, ["bed_carry", "carry_forward", "carry"])),
      admitNew: (r) => n(pick(r, ["bed_new", "admit_new"])),
      admitTI: (r) => n(pick(r, ["bed_transfer_in", "admit_transfer_in", "transfer_in", "receive_transfer_in"])),
      disHome: (r) => n(pick(r, ["discharge_home", "dis_home"])),
      disMove: (r) => n(pick(r, ["discharge_move_ward", "move_ward", "transfer_intra", "discharge_transfer_out", "dis_transfer_out"])),
      disRefOut: (r) => n(pick(r, ["discharge_refer_out", "dis_ref_out"])),
      disRefBack: (r) => n(pick(r, ["discharge_refer_back", "dis_ref_back"])),
      disDeath: (r) => n(pick(r, ["discharge_died", "dis_death", "death"])),
      remain: (r) => n(pick(r, ["bed_remain", "remain"])),
    };

    const isRollup = (r) => (r?.wardname == null && r?.subward == null) || String(r?.wardname || "").trim() === "รวม";

    const normalRows = rows.filter((r) => !isRollup(r));
    const rollupRow = rows.find(isRollup);

    const zero = { carryForward: 0, admitNew: 0, admitTransferIn: 0, disHome: 0, disMoveWard: 0, disReferOut: 0, disReferBack: 0, disDeath: 0, admitAll: 0, dischargeAll: 0, remain: 0 };

    // มีแถวปกติ -> รวมเอง
    if (normalRows.length) {
      const t = normalRows.reduce(
        (a, r) => ({
          carry: a.carry + F.carry(r),
          admitNew: a.admitNew + F.admitNew(r),
          admitTI: a.admitTI + F.admitTI(r),
          disHome: a.disHome + F.disHome(r),
          disMove: a.disMove + F.disMove(r),
          disRefOut: a.disRefOut + F.disRefOut(r),
          disRefBack: a.disRefBack + F.disRefBack(r),
          disDeath: a.disDeath + F.disDeath(r),
          remain: a.remain + F.remain(r),
        }),
        { carry: 0, admitNew: 0, admitTI: 0, disHome: 0, disMove: 0, disRefOut: 0, disRefBack: 0, disDeath: 0, remain: 0 }
      );

      const mv = {
        carryForward: t.carry,
        admitNew: t.admitNew,
        admitTransferIn: t.admitTI,
        disHome: t.disHome,
        disMoveWard: t.disMove,
        disReferOut: t.disRefOut,
        disReferBack: t.disRefBack,
        disDeath: t.disDeath,
        remain: t.remain,
      };
      mv.admitAll = mv.admitNew + mv.admitTransferIn;
      mv.dischargeAll = mv.disHome + mv.disMoveWard + mv.disReferOut + mv.disReferBack + mv.disDeath;
      return { movement: mv, hasData: true };
    }

    // ไม่มีแถวปกติ แต่มีแถวรวม -> ใช้แถวรวมนั้นเลย
    if (rollupRow) {
      const R = rollupRow;
      const mv = {
        carryForward: F.carry(R),
        admitNew: F.admitNew(R),
        admitTransferIn: F.admitTI(R),
        disHome: F.disHome(R),
        disMoveWard: F.disMove(R),
        disReferOut: F.disRefOut(R),
        disReferBack: F.disRefBack(R),
        disDeath: F.disDeath(R),
        remain: F.remain(R),
      };
      mv.admitAll = mv.admitNew + mv.admitTransferIn;
      mv.dischargeAll = mv.disHome + mv.disMoveWard + mv.disReferOut + mv.disReferBack + mv.disDeath;
      return { movement: mv, hasData: true };
    }

    // ไม่มีข้อมูลเลย
    return { movement: zero, hasData: false };
  };

  const { movement: movementV, hasData: unifiedHasData } = useMemo(() => buildMovementFromUnified(unifiedRows), [unifiedRows]);

  /** ----------------------------- Log view w/ paging ---------------------------- **/
  const logItems = useMemo(() => {
    const shiftStart = { morning: "07:00", afternoon: "15:00", night: "23:00" };
    const dtCandidates = ["datetime", "date_time", "created_at", "updated_at", "time"];

    const toDisplayDateTime = (row) => {
      for (const k of dtCandidates) {
        if (row?.[k]) {
          const d = new Date(row[k]);
          if (!Number.isNaN(d)) return { ts: d.getTime(), text: d.toLocaleDateString("th-TH") };
        }
      }
      if (row?.date) {
        const time = shiftStart[row?.shift] || "00:00";
        const dSort = new Date(`${dateKey(row.date)}T${time}:00`);
        const dText = new Date(dateKey(row.date));
        if (!Number.isNaN(dSort) && !Number.isNaN(dText)) return { ts: dSort.getTime(), text: dText.toLocaleDateString("th-TH") };
      }
      if (row?.date) {
        const d = new Date(dateKey(row.date));
        if (!Number.isNaN(d)) return { ts: d.getTime(), text: d.toLocaleDateString("th-TH") };
      }
      return { ts: 0, text: "-" };
    };

    return [...filteredData]
      .map((r) => {
        const dt = toDisplayDateTime(r);
        const carry = numFromKeys(r, ["carry_forward", "brought_forward", "opening_census", "begin_balance", "bed_carry"]);
        const tIn = numFromKeys(r, ["admit_transfer_in", "bed_transfer_in", "transfer_in", "receive_transfer_in"]);
        const moveW = numFromKeys(r, ["discharge_transfer_out", "discharge_move_ward", "move_ward", "transfer_intra"]);
        const refOut = numFromKeys(r, ["discharge_refer_out", "refer_out"]);
        const refBack = numFromKeys(r, ["discharge_refer_back", "refer_back"]);
        const death = numFromKeys(r, ["discharge_death", "discharge_died", "death"]);
        const admitNew = r.bed_new || 0;
        const disHome = r.discharge_home || 0;
        const admitAll = admitNew + tIn;
        const dischargeAll = disHome + moveW + refOut + refBack + death;
        const remain = carry + admitAll - dischargeAll;

        return {
          ts: dt.ts,
          timeText: dt.text,
          shift: r.shift || "",
          ward: strFromKeys(r, ["wardname", "ward"]) || "-",
          subward: strFromKeys(r, ["subward", "sub_ward", "subWard"]) || "-",
          admitNew,
          transferIn: tIn,
          disHome,
          moveWard: moveW,
          referOut: refOut,
          referBack: refBack,
          death,
          remain,
          productivity: r.productivity,
        };
      })
      .sort((a, b) => b.ts - a.ts || b.ward.localeCompare(a.ward, "th", { sensitivity: "base" }));
  }, [filteredData]);

  const totalLogPages = useMemo(() => Math.max(1, Math.ceil(logItems.length / LOG_PAGE_SIZE)), [logItems.length]);
  const pageLogItems = useMemo(() => logItems.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE), [logItems, logPage]);

  // reset หน้า เมื่อฟิลเตอร์เปลี่ยน
  useEffect(() => {
    setLogPage(1);
  }, [filteredData.length, filters.startDate, filters.endDate, filters.shift, filters.department, filters.ward, filters.subward, filters.month, filters.year]);

  // ถ้าจำนวนหน้าลดลง
  useEffect(() => {
    if (logPage > totalLogPages) setLogPage(totalLogPages);
  }, [totalLogPages, logPage]);

  /** ------------------------------- Handlers -------------------------------- **/
  const handleFilterChange = (e) => setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // เฉพาะช่องวันที่: บังคับ end >= start
  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => {
      if (name === "startDate") {
        const start = value;
        const end = prev.endDate && prev.endDate < start ? start : prev.endDate;
        return { ...prev, startDate: start, endDate: end };
      }
      if (name === "endDate") {
        return { ...prev, endDate: value };
      }
      return prev;
    });
  };

  const clearFilters = () => {
    setFilters({ startDate: "", endDate: "", shift: "", department: "", ward: "", subward: "", month: "", year: "" });
  };

  /** --------------------------------- Styles --------------------------------- **/
  const COLORS = ["#7e3cbd", "#c084fc", "#a855f7", "#9333ea", "#8b5cf6", "#7c3aed"];
  const tableStyle = { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" };
  const thStyle = { padding: 8, borderBottom: "1px solid #e5e7eb", textAlign: "center", whiteSpace: "nowrap" };
  const tdStyle = { padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "center", verticalAlign: "middle", overflow: "hidden", textOverflow: "ellipsis" };

  /** --------------------------------- Render --------------------------------- **/
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
            <p className={styles.dashboardSubtitle}>ระบบติดตามและวิเคราะห์ข้อมูลการดำเนินงาน</p>
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
              <div className={`${styles.summaryCardIcon} ${styles[card.colorClass]}`}>{card.icon}</div>
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
            { name: "startDate", label: "ตั้งแต่วันที่", type: "date", value: filters.startDate },
            { name: "endDate", label: "ถึงวันที่", type: "date", value: filters.endDate },
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
            { name: "year", label: "เลือกปี", type: "select", value: filters.year, options: filterOptions.years },
            {
              name: "month",
              label: "เลือกเดือน",
              type: "select",
              value: filters.month,
              options: Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(0, i).toLocaleString("th-TH", { month: "long" }) })),
              disabled: !filters.year, // 👉 เลือกเดือนได้ต่อเมื่อเลือกปีก่อน
            },
            { name: "department", label: "เลือกกลุ่มงาน", type: "select", value: filters.department, options: departments },
            { name: "ward", label: "เลือก Ward", type: "select", value: filters.ward, options: filterOptions.wards },
            { name: "subward", label: "เลือก Sub-ward", type: "select", value: filters.subward, options: filterOptions.subwards, disabled: !filters.ward || filterOptions.subwards.length === 0 },
          ].map((field) => (
            <div key={field.name} className={styles.filterItem}>
              <label className={styles.filterLabel}>{field.label}</label>
              {field.type === "date" ? (
                <input
                  type="date"
                  name={field.name}
                  value={field.value}
                  onChange={handleDateChange}
                  min={field.name === "endDate" && filters.startDate ? filters.startDate : undefined}
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
                <select name={field.name} value={field.value} onChange={handleFilterChange} disabled={field.disabled} className={styles.filterSelect}>
                  <option value="">ทั้งหมด</option>
                  {field.options &&
                    field.options.map((option) => (
                      <option key={typeof option === "object" ? option.value : option} value={typeof option === "object" ? option.value : option}>
                        {typeof option === "object" ? option.label : option}
                      </option>
                    ))}
                </select>
              )}
            </div>
          ))}
          <button onClick={clearFilters} className={styles.clearFiltersBtn}>
            <X size={16} /> ล้างตัวกรอง
          </button>
        </div>
      </div>

      {/* กราฟเดิม */}
      <div className={styles.chartsGrid}>
        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>
            <TrendingUp size={20} style={{ color: "#7e3cbd" }} /> แนวโน้ม Productivity และการรับผู้ป่วย
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={filteredData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString("th-TH", { month: "short", day: "numeric" })}
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
              <Line type="monotone" dataKey="productivity" stroke="#7e3cbd" strokeWidth={3} name="Productivity (%)" dot={{ fill: "#7e3cbd", strokeWidth: 2, r: 4 }} />
              <Line type="monotone" dataKey="bed_new" stroke="#10b981" strokeWidth={3} name="การรับใหม่" dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitleSmall}>
            {filters.department ? "การกระจายตาม Ward (ใน Department ที่เลือก)" : "การกระจายตาม Department"}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={filters.department ? wardDistribution : departmentDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {(filters.department ? wardDistribution : departmentDistribution).map((_, index) => (
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
          <Activity size={20} style={{ color: "#7e3cbd" }} /> เปรียบเทียบการรับและจำหน่ายผู้ป่วย
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => new Date(value).toLocaleDateString("th-TH", { month: "short", day: "numeric" })}
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

      {/* ✅ สรุปเคลื่อนไหวผู้ป่วย (local) */}
      <div className={`${styles.chartContainer} ${styles.fullWidthChart}`}>
        <h3 className={styles.chartTitle}>สรุปเคลื่อนไหวผู้ป่วย</h3>
        {!filteredData.length ? (
          <div className={styles.loadingContainer} style={{ height: 80 }}>
            <span className={styles.loadingText}>ไม่มีข้อมูลตามตัวกรอง</span>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th rowSpan={2} style={thStyle}>ยอดยกมา</th>
                  <th colSpan={2} style={thStyle}>ยอดรับ</th>
                  <th colSpan={5} style={thStyle}>ยอดจำหน่าย</th>
                  <th rowSpan={2} style={thStyle}>คงพยาบาล</th>
                </tr>
                <tr>
                  <th style={thStyle}>รับใหม่</th>
                  <th style={thStyle}>รับย้าย</th>
                  <th style={thStyle}>กลับบ้าน</th>
                  <th style={thStyle}>ย้ายตึก</th>
                  <th style={thStyle}>Refer out</th>
                  <th style={thStyle}>Refer back</th>
                  <th style={thStyle}>เสียชีวิต</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}>{fmt(movement.carryForward)}</td>
                  <td style={tdStyle}>{fmt(movement.admitNew)}</td>
                  <td style={tdStyle}>{fmt(movement.admitTransferIn)}</td>
                  <td style={tdStyle}>{fmt(movement.disHome)}</td>
                  <td style={tdStyle}>{fmt(movement.disMoveWard)}</td>
                  <td style={tdStyle}>{fmt(movement.disReferOut)}</td>
                  <td style={tdStyle}>{fmt(movement.disReferBack)}</td>
                  <td style={tdStyle}>{fmt(movement.disDeath)}</td>
                  <td style={tdStyle}>{fmt(movement.remain)}</td>
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

      {/* ✅ สรุปจาก View (v_reports_unified) */}
      <div className={`${styles.chartContainer} ${styles.fullWidthChart}`}>
        <h3 className={styles.chartTitle}>สรุปจาก View (v_reports_unified)</h3>

        {unifiedLoading ? (
          <div className={styles.loadingContainer} style={{ height: 80 }}>
            <RefreshCw className={styles.loadingSpinner} size={20} />
            <span className={styles.loadingText}>กำลังโหลดข้อมูลจาก View...</span>
          </div>
        ) : unifiedError ? (
          <div className={styles.errorContainer}>{unifiedError}</div>
        ) : !unifiedHasData ? (
          <div className={styles.loadingContainer} style={{ height: 80 }}>
            <span className={styles.loadingText}>ไม่มีข้อมูลตามตัวกรอง</span>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th rowSpan={2} style={thStyle}>ยอดยกมา</th>
                  <th colSpan={2} style={thStyle}>ยอดรับ</th>
                  <th colSpan={5} style={thStyle}>ยอดจำหน่าย</th>
                  <th rowSpan={2} style={thStyle}>คงพยาบาล</th>
                </tr>
                <tr>
                  <th style={thStyle}>รับใหม่</th>
                  <th style={thStyle}>รับย้าย</th>
                  <th style={thStyle}>กลับบ้าน</th>
                  <th style={thStyle}>ย้ายตึก</th>
                  <th style={thStyle}>Refer out</th>
                  <th style={thStyle}>Refer back</th>
                  <th style={thStyle}>เสียชีวิต</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}>{fmt(movementV.carryForward)}</td>
                  <td style={tdStyle}>{fmt(movementV.admitNew)}</td>
                  <td style={tdStyle}>{fmt(movementV.admitTransferIn)}</td>
                  <td style={tdStyle}>{fmt(movementV.disHome)}</td>
                  <td style={tdStyle}>{fmt(movementV.disMoveWard)}</td>
                  <td style={tdStyle}>{fmt(movementV.disReferOut)}</td>
                  <td style={tdStyle}>{fmt(movementV.disReferBack)}</td>
                  <td style={tdStyle}>{fmt(movementV.disDeath)}</td>
                  <td style={tdStyle}>{fmt(movementV.remain)}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
              <div style={{ padding: "6px 10px", background: "#f3f4f6", borderRadius: 8 }}>
                <strong>ยอดรับรวม:</strong> {fmt(movementV.admitAll)}
              </div>
              <div style={{ padding: "6px 10px", background: "#f3f4f6", borderRadius: 8 }}>
                <strong>ยอดจำหน่ายรวม:</strong> {fmt(movementV.dischargeAll)}
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
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>วันที่</th>
                  <th style={thStyle}>เวร</th>
                  <th style={thStyle}>Ward</th>
                  <th style={thStyle}>Sub-ward</th>
                  <th style={thStyle}>รับใหม่</th>
                  <th style={thStyle}>รับย้าย</th>
                  <th style={thStyle}>กลับบ้าน</th>
                  <th style={thStyle}>ย้ายตึก</th>
                  <th style={thStyle}>Refer out</th>
                  <th style={thStyle}>Refer back</th>
                  <th style={thStyle}>เสียชีวิต</th>
                  <th style={thStyle}>คงพยาบาล</th>
                  <th style={thStyle}>Prod. (%)</th>
                </tr>
              </thead>
              <tbody>
                {pageLogItems.map((r, idx) => (
                  <tr key={`${r.ts}-${idx}`}>
                    <td style={tdStyle}>{r.timeText}</td>
                    <td style={tdStyle}>{shiftLabel(r.shift)}</td>
                    <td style={tdStyle}>{r.ward || "-"}</td>
                    <td style={tdStyle}>{r.subward || "-"}</td>
                    <td style={tdStyle}>{fmt(r.admitNew)}</td>
                    <td style={tdStyle}>{fmt(r.transferIn)}</td>
                    <td style={tdStyle}>{fmt(r.disHome)}</td>
                    <td style={tdStyle}>{fmt(r.moveWard)}</td>
                    <td style={tdStyle}>{fmt(r.referOut)}</td>
                    <td style={tdStyle}>{fmt(r.referBack)}</td>
                    <td style={tdStyle}>{fmt(r.death)}</td>
                    <td style={tdStyle}>{fmt(r.remain)}</td>
                    <td style={tdStyle}>{Number.isFinite(+r.productivity) ? Number(r.productivity).toFixed(2) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ตัวควบคุมแบ่งหน้า */}
            <div className={styles.pagination}>
              <button className={styles.pageBtn} onClick={() => setLogPage(1)} disabled={logPage === 1}>
                « หน้าแรก
              </button>
              <button className={styles.pageBtn} onClick={() => setLogPage((p) => Math.max(1, p - 1))} disabled={logPage === 1}>
                ‹ ก่อนหน้า
              </button>

              <span className={styles.pageInfo}>
                หน้า {logPage} / {totalLogPages} • ทั้งหมด {logItems.length.toLocaleString("th-TH")} รายการ
              </span>

              <button className={styles.pageBtn} onClick={() => setLogPage((p) => Math.min(totalLogPages, p + 1))} disabled={logPage === totalLogPages}>
                ถัดไป ›
              </button>
              <button className={styles.pageBtn} onClick={() => setLogPage(totalLogPages)} disabled={logPage === totalLogPages}>
                หน้าสุดท้าย »
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
