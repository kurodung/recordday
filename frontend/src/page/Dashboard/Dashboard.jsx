// src/pages/Dashboard.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { jwtDecode } from "jwt-decode";
import { useSearchParams } from "react-router-dom";
import { API_BASE } from "../../config";
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
import { Users, Activity, TrendingUp, Award, RefreshCw } from "lucide-react";
import styles from "../../styles/Dashboard.module.css";

// Components
import FilterPanel from "../../components/dashboard/FilterPanel";
import Block from "../../components/common/Block";
import TableBox from "../../components/common/TableBox";

// Constants (moved out)
import {
  SPECIAL_WARDS,
  ICUAD_WARDS,
  ICUCH_WARDS,
  NORMAL_WARDS,
  Semi_ICU,
  Newborn,
  ICU_Ven,
  AD_Ven,
  CH_Ven,
} from "../../constants/wards";

// Helpers (moved out)
import {
  dateKey,
  sortSubwardsWithPriority,
  numFromKeys,
  strFromKeys,
  fmt,
  shiftLabel,
  buildDateRange,
} from "../../utils/helpers";

const LOG_PAGE_SIZE = 10;

/** ------------------------------- Component ------------------------------ **/
export default function Dashboard({ username, wardname }) {
  // 🔑 อ่านสิทธิ์จาก token
  const token = localStorage.getItem("token");
  let role_id = 1;
  let ward_id = null;
  let department_id = null;

  if (token) {
    try {
      const decoded = jwtDecode(token);

      // ✅ รองรับทั้งชื่อคีย์แบบ snake_case และ camelCase
      role_id = decoded.role_id || decoded.role || 1;
      ward_id = decoded.ward_id || decoded.wardId || null;
      department_id = decoded.department_id || decoded.departmentId || null;

      // ✅ ถ้า role เป็น string (เช่น "HeadNurse") ให้แปลงเป็นตัวเลข
      if (typeof role_id === "string") {
        const roleMap = {
          Admin: 4,
          Supervisor: 3,
          HeadNurse: 2,
          User: 1,
        };
        role_id = roleMap[role_id] || 1;
      }
    } catch (e) {
      console.warn("JWT decode error:", e);
    }
  }

  const isAdmin = role_id === 4;
  const isSupervisor = role_id === 3;
  const isHeadNurse = role_id === 2;
  const isUser = role_id === 1;

  const [searchParams] = useSearchParams();
  const qpShift = searchParams.get("shift") || "";

  //state
  const [data, setData] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [wardOptions, setWardOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logPage, setLogPage] = useState(1);
  const [dengueRows, setDengueRows] = useState([]);
  const [dengueTotal, setDengueTotal] = useState(null);
  const [dengueLoading, setDengueLoading] = useState(false);
  const [dengueError, setDengueError] = useState(null);
  const [showStrokeDetails, setShowStrokeDetails] = useState(false);
  const [showPsychDetails, setShowPsychDetails] = useState(false);
  const [showPrisonerDetails, setShowPrisonerDetails] = useState(false);

  // UI: toggle รายละเอียดเปลเสริม (ซ่อน/แสดง)
  const [showExtraBedDetails, setShowExtraBedDetails] = useState(false);

  // สำหรับ view summary
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

  // non-admin: ล็อก ward เป็นของตัวเอง
  // 🔒 จำกัดสิทธิ์การดูข้อมูลตาม role
  useEffect(() => {
    setFilters((f) => {
      if (isAdmin || isSupervisor) return f; // ดูได้ทั้งหมด
      if (isHeadNurse)
        return { ...f, department: department_id || "", ward: "", subward: "" };
      if (isUser)
        return { ...f, ward: wardname || "", department: "", subward: "" };
      return f;
    });
  }, [isAdmin, isSupervisor, isHeadNurse, isUser, wardname, department_id]);

  // sync จาก URL (?shift=...)
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
        const res = await fetch(`${API_BASE}/api/dashboard/departments`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: ac.signal,
        });
        if (!res.ok) throw new Error("โหลดรายชื่อแผนกไม่สำเร็จ");
        const rows = await res.json();
        const uniq = [
          ...new Set((rows || []).map((r) => r?.department).filter(Boolean)),
        ];
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
        const res = await fetch(
          `${API_BASE}/api/dashboard/wards-by-department?${qs}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: ac.signal,
          }
        );
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
  const fetchData = useCallback(
    async (filters, signal) => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("token") || "";
        const qs = buildDateRange(filters);
        if (filters.shift) qs.set("shift", filters.shift);
        if (isAdmin && filters.ward) qs.set("ward", filters.ward);
        if (filters.subward) qs.set("subward", filters.subward);
        if (filters.department) qs.set("department", filters.department);

        if (isUser && wardname) qs.set("ward", wardname);

        const url = `${API_BASE}/api/dashboard${qs.toString() ? `?${qs}` : ""}`;
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal,
        });
        const json = await res.json();
        if (!res.ok)
          throw new Error(json?.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
        setData(Array.isArray(json) ? json : []);
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(err.message || "ไม่สามารถเชื่อมต่อ API ได้");
        setData([]);
      } finally {
        setLoading(false);
      }
    },
    [isAdmin, isUser, isHeadNurse, wardname, department_id]
  );

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
      if (filters.ward) qs.set("wardname", filters.ward);
      if (filters.subward) qs.set("subward", filters.subward);
      if (filters.department) qs.set("department", filters.department);

      const url = `${API_BASE}/api/dashboard/summary${
        qs.toString() ? `?${qs}` : ""
      }`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal,
      });
      const json = await res.json();

      if (!res.ok || json?.ok === false)
        throw new Error(json?.message || "โหลดสรุปจาก View ไม่สำเร็จ");
      const rows = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json)
        ? json
        : [];
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
      ? [...wardsFromDept].sort((a, b) =>
          String(a).localeCompare(String(b), "th", { sensitivity: "base" })
        )
      : [...new Set(data.map((d) => strFromKeys(d, ["wardname", "ward"])))]
          .filter(Boolean)
          .sort((a, b) =>
            String(a).localeCompare(String(b), "th", { sensitivity: "base" })
          );

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

  /** ------------------------------ Filtering data ----------------------------- **/
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

      const yearNum = key ? Number(key.slice(0, 4)) : NaN;
      const monthNum = key ? Number(key.slice(5, 7)) : NaN;

      const matchesWard = !filters.ward || dWard === filters.ward;
      const matchesSubward = !filters.subward || dSub === filters.subward;
      const matchesMonth =
        useRange || !filters.month || monthNum === Number(filters.month);
      const matchesYear =
        useRange || !filters.year || yearNum === Number(filters.year);
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
    // รวมรับใหม่และจำหน่ายตามปกติ
    const totalAdmissions = filteredData.reduce(
      (s, r) => s + (r.bed_new || 0),
      0
    );
    const totalDischarges = filteredData.reduce(
      (s, r) => s + (r.discharge_home || 0) + (r.discharge_transfer_out || 0),
      0
    );

    // ✅ เอาเฉพาะแถวที่ productivity มีค่ามากกว่า 0
    const validRows = filteredData.filter(
      (r) => r.productivity !== null && parseFloat(r.productivity) > 0
    );

    const totalProductivity = validRows.reduce(
      (s, r) => s + parseFloat(r.productivity || 0),
      0
    );

    const avgProductivity = validRows.length
      ? totalProductivity / validRows.length
      : 0;

    return {
      recordCount: filteredData.length,
      totalAdmissions,
      totalDischarges,
      avgProductivity: avgProductivity.toFixed(2),
    };
  }, [filteredData]);

  /** --------------------------- Movement (local data) -------------------------- **/
  const movement = useMemo(() => {
    const carryForward = filteredData.reduce(
      (s, r) =>
        s +
        numFromKeys(r, [
          "carry_forward",
          "brought_forward",
          "opening_census",
          "begin_balance",
          "bed_carry",
        ]),
      0
    );
    const admitNew = filteredData.reduce((s, r) => s + (r.bed_new || 0), 0);
    const admitTransferIn = filteredData.reduce(
      (s, r) =>
        s +
        numFromKeys(r, [
          "admit_transfer_in",
          "bed_transfer_in",
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
        numFromKeys(r, [
          "discharge_transfer_out",
          "discharge_move_ward",
          "move_ward",
          "transfer_intra",
        ]),
      0
    );
    const disReferOut = filteredData.reduce(
      (s, r) => s + numFromKeys(r, ["discharge_refer_out", "refer_out"]),
      0
    );
    const disReferBack = filteredData.reduce(
      (s, r) => s + numFromKeys(r, ["discharge_refer_back", "refer_back"]),
      0
    );
    const disDeath = filteredData.reduce(
      (s, r) =>
        s + numFromKeys(r, ["discharge_death", "discharge_died", "death"]),
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
      disHome,
      disMoveWard,
      disReferOut,
      disReferBack,
      disDeath,
      admitAll,
      dischargeAll,
      remain,
    };
  }, [filteredData]);

  /** ------------------------ Movement from unifiedRows ------------------------ **/
  const buildMovementFromUnified = (rows = []) => {
    const n = (v) => Number(v ?? 0) || 0;
    const pick = (o, keys) => {
      for (const k of keys)
        if (o?.[k] !== undefined && o?.[k] !== null) return o[k];
      return 0;
    };
    const F = {
      carry: (r) => n(pick(r, ["bed_carry", "carry_forward", "carry"])),
      admitNew: (r) => n(pick(r, ["bed_new", "admit_new"])),
      admitTI: (r) =>
        n(
          pick(r, [
            "bed_transfer_in",
            "admit_transfer_in",
            "transfer_in",
            "receive_transfer_in",
          ])
        ),
      disHome: (r) => n(pick(r, ["discharge_home", "dis_home"])),
      disMove: (r) =>
        n(
          pick(r, [
            "discharge_move_ward",
            "move_ward",
            "transfer_intra",
            "discharge_transfer_out",
            "dis_transfer_out",
          ])
        ),
      disRefOut: (r) => n(pick(r, ["discharge_refer_out", "dis_ref_out"])),
      disRefBack: (r) => n(pick(r, ["discharge_refer_back", "dis_ref_back"])),
      disDeath: (r) => n(pick(r, ["discharge_died", "dis_death", "death"])),
      remain: (r) => n(pick(r, ["bed_remain", "remain"])),
    };

    const isRollup = (r) =>
      (r?.wardname == null && r?.subward == null) ||
      String(r?.wardname || "").trim() === "รวม";

    const normalRows = rows.filter((r) => !isRollup(r));
    const rollupRow = rows.find(isRollup);

    const zero = {
      carryForward: 0,
      admitNew: 0,
      admitTransferIn: 0,
      disHome: 0,
      disMoveWard: 0,
      disReferOut: 0,
      disReferBack: 0,
      disDeath: 0,
      admitAll: 0,
      dischargeAll: 0,
      remain: 0,
    };

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
        {
          carry: 0,
          admitNew: 0,
          admitTI: 0,
          disHome: 0,
          disMove: 0,
          disRefOut: 0,
          disRefBack: 0,
          disDeath: 0,
          remain: 0,
        }
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
      mv.dischargeAll =
        mv.disHome +
        mv.disMoveWard +
        mv.disReferOut +
        mv.disReferBack +
        mv.disDeath;
      return { movement: mv, hasData: true };
    }

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
      mv.dischargeAll =
        mv.disHome +
        mv.disMoveWard +
        mv.disReferOut +
        mv.disReferBack +
        mv.disDeath;
      return { movement: mv, hasData: true };
    }

    return { movement: zero, hasData: false };
  };

  const { hasData: unifiedHasData } = useMemo(
    () => buildMovementFromUnified(unifiedRows),
    [unifiedRows]
  );

  // รวมคงพยาบาลทั้งหมด + วอร์ดพิเศษ
  const { allRemain, specialRemain, specialFound } = useMemo(() => {
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()\-_.]/g, "");

    const wardOf = (r) => strFromKeys(r, ["wardname", "ward", "ward_name"]);
    const subOf = (r) => strFromKeys(r, ["subward", "sub_ward", "subWard"]);
    const remainOf = (r) => Number(r?.bed_remain ?? r?.remain ?? 0) || 0;

    const SINGLE = new Set();
    const COMBO = new Set();
    for (const label of SPECIAL_WARDS) {
      const [w, s] = String(label).split(/\s*-\s*/);
      if (s) COMBO.add(`${norm(w)}|${norm(s)}`);
      else SINGLE.add(norm(w));
    }

    const isRollup = (r) =>
      (r?.wardname == null && r?.subward == null) ||
      String(r?.wardname || "").trim() === "รวม";

    if (!unifiedRows?.length)
      return { allRemain: 0, specialRemain: 0, specialFound: false };

    const rows = unifiedRows.filter((r) => !isRollup(r));
    if (!rows.length) {
      const R = unifiedRows.find(isRollup);
      return {
        allRemain: R ? remainOf(R) : 0,
        specialRemain: 0,
        specialFound: false,
      };
    }

    let all = 0;
    let sp = 0;
    let found = false;

    for (const r of rows) {
      const w = norm(wardOf(r));
      const s = norm(subOf(r));
      const rm = remainOf(r);
      all += rm;

      if (s) {
        if (COMBO.has(`${w}|${s}`)) {
          sp += rm;
          found = true;
        }
      } else {
        if (SINGLE.has(w)) {
          sp += rm;
          found = true;
        }
      }
    }

    return { allRemain: all, specialRemain: sp, specialFound: found };
  }, [unifiedRows]);

  // ICU รวม
  const { icuAdRemain, icuChRemain, icuAllRemain } = useMemo(() => {
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()\-_.]/g, "");

    const wardOf = (r) => strFromKeys(r, ["wardname", "ward", "ward_name"]);
    const subOf = (r) => strFromKeys(r, ["subward", "sub_ward", "subWard"]);
    const remainOf = (r) => Number(r?.bed_remain ?? r?.remain ?? 0) || 0;

    const isRollup = (r) =>
      (r?.wardname == null && r?.subward == null) ||
      String(r?.wardname || "").trim() === "รวม";

    if (!unifiedRows?.length)
      return { icuAdRemain: 0, icuChRemain: 0, icuAllRemain: 0 };

    const rows = unifiedRows.filter((r) => !isRollup(r));
    if (!rows.length)
      return { icuAdRemain: 0, icuChRemain: 0, icuAllRemain: 0 };

    const parseList = (labels) => {
      const SINGLE = new Set();
      const COMBO = new Set();
      for (const label of labels || []) {
        const [w, s] = String(label).split(/\s*-\s*/);
        if (s) COMBO.add(`${norm(w)}|${norm(s)}`);
        else SINGLE.add(norm(w));
      }
      return { SINGLE, COMBO };
    };

    const sumRemainBy = (labels) => {
      const { SINGLE, COMBO } = parseList(labels);
      let sum = 0;
      for (const r of rows) {
        const w = norm(wardOf(r));
        const s = norm(subOf(r));
        const rm = remainOf(r);
        if (s) {
          if (COMBO.has(`${w}|${s}`)) sum += rm;
        } else {
          if (SINGLE.has(w)) sum += rm;
        }
      }
      return sum;
    };

    const ad = sumRemainBy(ICUAD_WARDS);
    const ch = sumRemainBy(ICUCH_WARDS);
    return { icuAdRemain: ad, icuChRemain: ch, icuAllRemain: ad + ch };
  }, [unifiedRows]);

  // สามัญ / Semi ICU / ทารก
  const { normalRemain, semiRemain, newbornRemain } = useMemo(() => {
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()\-_.]/g, "");

    const wardOf = (r) => strFromKeys(r, ["wardname", "ward", "ward_name"]);
    const subOf = (r) => strFromKeys(r, ["subward", "sub_ward", "subWard"]);
    const remainOf = (r) => Number(r?.bed_remain ?? r?.remain ?? 0) || 0;

    const isRollup = (r) =>
      (r?.wardname == null && r?.subward == null) ||
      String(r?.wardname || "").trim() === "รวม";

    if (!unifiedRows?.length)
      return { normalRemain: 0, semiRemain: 0, newbornRemain: 0 };

    const rows = unifiedRows.filter((r) => !isRollup(r));
    if (!rows.length)
      return { normalRemain: 0, semiRemain: 0, newbornRemain: 0 };

    const parseList = (labels) => {
      const SINGLE = new Set();
      const COMBO = new Set();
      for (const label of labels || []) {
        const [w, s] = String(label).split(/\s*-\s*/);
        if (s) COMBO.add(`${norm(w)}|${norm(s)}`);
        else SINGLE.add(norm(w));
      }
      return { SINGLE, COMBO };
    };

    const sumRemainBy = (labels) => {
      const { SINGLE, COMBO } = parseList(labels);
      let sum = 0;
      for (const r of rows) {
        const w = norm(wardOf(r));
        const s = norm(subOf(r));
        const rm = remainOf(r);
        if (s) {
          if (COMBO.has(`${w}|${s}`)) sum += rm;
        } else {
          if (SINGLE.has(w)) sum += rm;
        }
      }
      return sum;
    };

    return {
      normalRemain: sumRemainBy(NORMAL_WARDS),
      semiRemain: sumRemainBy(Semi_ICU),
      newbornRemain: sumRemainBy(Newborn),
    };
  }, [unifiedRows]);

  // สรุป Ventilator จาก unifiedRows (ICU / ผู้ใหญ่ / เด็ก / รวม)
  const { ventICU, ventAD, ventCH, ventAll } = useMemo(() => {
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()\-_.]/g, "");
    const wardOf = (r) => strFromKeys(r, ["wardname", "ward", "ward_name"]);
    const subOf = (r) => strFromKeys(r, ["subward", "sub_ward", "subWard"]);

    const isRollup = (r) =>
      (r?.wardname == null && r?.subward == null) ||
      String(r?.wardname || "").trim() === "รวม";

    // ฟังก์ชันอ่านค่า Vent ให้ทนต่อชื่อคีย์หลากหลาย
    const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const getByAliases = (row, aliases) => {
      // normalize คีย์ต่อแถว
      const m = {};
      for (const [k, v] of Object.entries(row || {})) {
        m[norm(k)] = v;
      }
      for (const name of aliases) {
        const k = norm(name);
        if (m[k] !== undefined && m[k] !== null && m[k] !== "") return m[k];
      }
      return 0;
    };
    const ventOf = (r) =>
      toNum(
        getByAliases(r, [
          "vent_invasive",
          "ventinv",
          "invasivevent",
          "venti_inv",
          "vent_i",
        ])
      ) +
      toNum(
        getByAliases(r, [
          "vent_noninvasive",
          "vent_non_invasive",
          "ventniv",
          "noninvasivevent",
          "vent_ni",
        ])
      );

    if (!Array.isArray(unifiedRows) || unifiedRows.length === 0) {
      return { ventICU: 0, ventAD: 0, ventCH: 0, ventAll: 0 };
    }

    // ใช้เฉพาะแถวราย ward/subward (ไม่เอาแถว "รวม")
    const rows = unifiedRows.filter((r) => !isRollup(r));
    if (!rows.length) return { ventICU: 0, ventAD: 0, ventCH: 0, ventAll: 0 };

    // ยูทิลเลือกแบบ "Ward" อย่างเดียว หรือ "Ward-Subward"
    const parseList = (labels) => {
      const SINGLE = new Set();
      const COMBO = new Set();
      for (const label of labels || []) {
        const [w, s] = String(label).split(/\s*-\s*/);
        if (s) COMBO.add(`${norm(w)}|${norm(s)}`);
        else SINGLE.add(norm(w));
      }
      return { SINGLE, COMBO };
    };
    const sumVentBy = (labels) => {
      const { SINGLE, COMBO } = parseList(labels);
      let sum = 0;
      for (const r of rows) {
        const w = norm(wardOf(r));
        const s = norm(subOf(r));
        if (s) {
          if (COMBO.has(`${w}|${s}`)) sum += ventOf(r);
        } else {
          if (SINGLE.has(w)) sum += ventOf(r);
        }
      }
      return sum;
    };

    const icu = sumVentBy(ICU_Ven);
    const ad = sumVentBy(AD_Ven);
    const ch = sumVentBy(CH_Ven);
    return { ventICU: icu, ventAD: ad, ventCH: ch, ventAll: icu + ad + ch };
  }, [unifiedRows]);

  // รวมค่า type5, type4, bed_new, discharge_home, discharge_died
  const { t5Total, t4Total, bedNewTotal, disHomeTotal, deathTotal } =
    useMemo(() => {
      const n = (v) => Number(v ?? 0) || 0;
      const pick = (o, keys) => {
        for (const k of keys)
          if (o?.[k] !== undefined && o?.[k] !== null) return o[k];
        return 0;
      };
      const isRollup = (r) =>
        String(r?.wardname || "").trim() === "รวม" &&
        (r?.subward == null || String(r?.subward).trim() === "");

      if (!Array.isArray(unifiedRows) || unifiedRows.length === 0) {
        return {
          t5Total: 0,
          t4Total: 0,
          bedNewTotal: 0,
          disHomeTotal: 0,
          deathTotal: 0,
        };
      }

      // ถ้ามีแถวรวม ใช้ค่าจากแถวรวมนั้นเลย เพื่อไม่ให้นับซ้ำ
      const roll = unifiedRows.find(isRollup);
      if (roll) {
        return {
          t5Total: n(pick(roll, ["type5", "Type5", "red5"])),
          t4Total: n(pick(roll, ["type4", "Type4", "yellow4"])),
          bedNewTotal: n(pick(roll, ["bed_new", "admit_new"])),
          disHomeTotal: n(pick(roll, ["discharge_home", "dis_home"])),
          deathTotal: n(
            pick(roll, [
              "discharge_died",
              "discharge_death",
              "dis_death",
              "death",
            ])
          ),
        };
      }

      // ถ้าไม่มีแถวรวม ให้รวมทุกแถวตามปกติ
      const sums = unifiedRows.reduce(
        (acc, r) => {
          acc.t5 += n(pick(r, ["type5", "Type5", "red5"]));
          acc.t4 += n(pick(r, ["type4", "Type4", "yellow4"]));
          acc.new += n(pick(r, ["bed_new", "admit_new"]));
          acc.home += n(pick(r, ["discharge_home", "dis_home"]));
          acc.death += n(
            pick(r, ["discharge_died", "discharge_death", "dis_death", "death"])
          );
          return acc;
        },
        { t5: 0, t4: 0, new: 0, home: 0, death: 0 }
      );

      return {
        t5Total: sums.t5,
        t4Total: sums.t4,
        bedNewTotal: sums.new,
        disHomeTotal: sums.home,
        deathTotal: sums.death,
      };
    }, [unifiedRows]);

  // โหลด dengue summary
  const fetchDengue = useCallback(async (filters, signal) => {
    setDengueLoading(true);
    setDengueError(null);
    try {
      const token = localStorage.getItem("token") || "";
      const qs = buildDateRange(filters);
      if (filters.shift) qs.set("shift", filters.shift);
      if (filters.ward) qs.set("wardname", filters.ward);
      if (filters.subward) qs.set("subward", filters.subward);
      // ถ้าจะกรองตาม department ด้วย ก็เพิ่ม:
      if (filters.department) qs.set("department", filters.department);

      const url = `${API_BASE}/api/dashboard/dengue-summary${
        qs.toString() ? `?${qs}` : ""
      }`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal,
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false)
        throw new Error(json?.message || "โหลดสรุปไข้เลือดออกไม่สำเร็จ");

      const rows = Array.isArray(json?.data) ? json.data : [];
      setDengueRows(rows);
      setDengueTotal(json?.total || null);
    } catch (e) {
      if (e.name === "AbortError") return;
      setDengueError(e.message || "ไม่สามารถโหลดสรุปไข้เลือดออกได้");
      setDengueRows([]);
      setDengueTotal(null);
    } finally {
      setDengueLoading(false);
    }
  }, []);

  // รวม Stroke: คงพยาบาลใน Stroke Unit + ค่าจาก view
  // eslint-disable-next-line no-unused-vars
  const { strokeRemainSU, strokeFromView, strokeTotal } = useMemo(() => {
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()\-_.]/g, "");

    const wardOf = (r) => strFromKeys(r, ["wardname", "ward", "ward_name"]);
    const remainOf = (r) => Number(r?.bed_remain ?? r?.remain ?? 0) || 0;

    const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const getByAliases = (row, aliases) => {
      const m = {};
      for (const [k, v] of Object.entries(row || {})) m[norm(k)] = v;
      for (const name of aliases) {
        const k = norm(name);
        if (m[k] !== undefined && m[k] !== null && m[k] !== "") return m[k];
      }
      return 0;
    };
    const strokeAliases = [
      "stroke",
      "stroke_cases",
      "stroke_total",
      "strokeall",
    ];

    const isRollup = (r) =>
      (r?.wardname == null && r?.subward == null) ||
      String(r?.wardname || "").trim() === "รวม";

    const rows = (unifiedRows || []).filter((r) => !isRollup(r));
    if (!rows.length)
      return { strokeRemainSU: 0, strokeFromView: 0, strokeTotal: 0 };

    // 1) คงพยาบาลของ Stroke Unit (รวมทุก sub-ward)
    const targetWard = norm("Stroke Unit");
    const suRemain = rows.reduce(
      (sum, r) => sum + (norm(wardOf(r)) === targetWard ? remainOf(r) : 0),
      0
    );

    // 2) stroke จาก view (ถ้ามี rollup ใช้จาก rollup, ถ้าไม่มีก็รวมรายแถว)
    const roll = unifiedRows.find(isRollup);
    const strokeFromView = roll
      ? toNum(getByAliases(roll, strokeAliases))
      : rows.reduce((sum, r) => sum + toNum(getByAliases(r, strokeAliases)), 0);

    return {
      strokeRemainSU: suRemain,
      strokeFromView,
      strokeTotal: suRemain + strokeFromView,
    };
  }, [unifiedRows]);

  // สรุป Stroke
  const strokeList = useMemo(() => {
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()\-_.]/g, "");

    const wardOf = (r) => strFromKeys(r, ["wardname", "ward", "ward_name"]);
    const subOf = (r) => strFromKeys(r, ["subward", "sub_ward", "subWard"]);
    const remainOf = (r) => Number(r?.bed_remain ?? r?.remain ?? 0) || 0;

    const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const getByAliases = (row, aliases) => {
      const m = {};
      for (const [k, v] of Object.entries(row || {})) m[norm(k)] = v;
      for (const name of aliases) {
        const k = norm(name);
        if (m[k] !== undefined && m[k] !== null && m[k] !== "") return m[k];
      }
      return 0;
    };
    const strokeAliases = [
      "stroke",
      "stroke_cases",
      "stroke_total",
      "strokeall",
    ];

    const isRollup = (r) =>
      (r?.wardname == null && r?.subward == null) ||
      String(r?.wardname || "").trim() === "รวม";

    const rows = (unifiedRows || []).filter((r) => !isRollup(r));
    if (!rows.length) return [];

    const byLabel = {};
    for (const r of rows) {
      const w = wardOf(r) || "-";
      const s = subOf(r) || "";
      const label = s ? `${w} - ${s}` : w;

      // 1) คงพยาบาลใน Stroke Unit
      if (norm(w) === norm("Stroke Unit")) {
        const rm = remainOf(r);
        if (rm > 0) byLabel[label] = (byLabel[label] || 0) + rm;
      }

      // 2) stroke จาก view ราย ward/subward (ถ้ามีในแถว)
      const sc = toNum(getByAliases(r, strokeAliases));
      if (sc > 0) byLabel[label] = (byLabel[label] || 0) + sc;
    }

    return Object.entries(byLabel)
      .sort(
        (a, b) =>
          b[1] - a[1] || a[0].localeCompare(b[0], "th", { sensitivity: "base" })
      )
      .map(([label, val]) => `${label}: ${fmt(val)}`);
  }, [unifiedRows]);

  useEffect(() => {
    const ac = new AbortController();
    fetchDengue(filters, ac.signal);
    return () => ac.abort();
  }, [fetchDengue, filters]);

  /** ---------------------- Extra bed (เปลเสริม) from View ---------------------- **/
  const { extraBedTotal, extraBedList } = useMemo(() => {
    const n = (v) => Number(v ?? 0) || 0;
    const isRollup = (r) =>
      (r?.wardname == null && r?.subward == null) ||
      String(r?.wardname || "").trim() === "รวม";

    if (!Array.isArray(unifiedRows) || unifiedRows.length === 0) {
      return { extraBedTotal: 0, extraBedList: [] };
    }

    const rows = unifiedRows.filter((r) => !isRollup(r));
    const roll = unifiedRows.find(isRollup);

    const total = roll
      ? n(roll.extra_bed)
      : rows.reduce((s, r) => s + n(r.extra_bed), 0);

    const byLabel = {};
    for (const r of rows) {
      const w = strFromKeys(r, ["wardname", "ward", "ward_name"]) || "-";
      const s = strFromKeys(r, ["subward", "sub_ward", "subWard"]) || "";
      const label = s ? `${w} - ${s}` : w;
      const eb = n(r.extra_bed);
      if (eb > 0) byLabel[label] = (byLabel[label] || 0) + eb;
    }

    const list = Object.entries(byLabel)
      .sort(
        (a, b) =>
          b[1] - a[1] || a[0].localeCompare(b[0], "th", { sensitivity: "base" })
      )
      .map(([label, val]) => `${label}: ${fmt(val)}`);

    return { extraBedTotal: total, extraBedList: list };
  }, [unifiedRows]);

  // ✅ รวมจิตเวช: bed_remain ของทุกวอร์ดที่เป็นจิตเวช + ค่าจิตเวชจากคอลัมน์ psych*
  const { psychTotal, psychList } = useMemo(() => {
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()\-_.]/g, "");

    const wardOf = (r) => strFromKeys(r, ["wardname", "ward", "ward_name"]);
    const subOf = (r) => strFromKeys(r, ["subward", "sub_ward", "subWard"]);
    const remainOf = (r) => Number(r?.bed_remain ?? r?.remain ?? 0) || 0;

    const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const getByAliases = (row, aliases) => {
      const m = {};
      for (const [k, v] of Object.entries(row || {})) m[norm(k)] = v;
      for (const name of aliases) {
        const k = norm(name);
        if (m[k] !== undefined && m[k] !== null && m[k] !== "") return m[k];
      }
      return 0;
    };

    // รองรับชื่อคอลัมน์จิตเวชหลายแบบ
    const psychAliases = [
      "psych",
      "psych_cases",
      "psych_total",
      "psychiatric",
      "psychall",
      "psy",
    ];

    const isRollup = (r) =>
      (r?.wardname == null && r?.subward == null) ||
      String(r?.wardname || "").trim() === "รวม";

    const rows = (unifiedRows || []).filter((r) => !isRollup(r));
    if (!rows.length) return { psychTotal: 0, psychList: [] };

    // -------- กติกาการนับ bed_remain วอร์ดจิตเวช --------
    // 1) “ชื่อแน่นอน” (เพิ่ม/แก้ชื่อวอร์ดจริงของคุณที่นี่ได้เลย)
    const PSYCH_REMAIN_LABELS = [
      "ปาริชาติ", // ตัวอย่างวอร์ดจริง
      "จิตเวช", // ถ้ามีวอร์ดชื่อ "จิตเวช" ตรง ๆ
      // ใส่รูปแบบ "Ward - Subward" ได้ เช่น "พิเศษ จิตเวช - ผู้ใหญ่"
      // "พิเศษ จิตเวช - ผู้ใหญ่",
    ];

    // 2) “คีย์เวิร์ด” ถ้าพบใน ward หรือ subward ให้ถือว่าเป็นจิตเวช
    const PSYCH_REMAIN_KEYWORDS = ["จิตเวช", "psych", "psychi", "mental"].map(
      norm
    );

    const parseLabels = (labels) => {
      const SINGLE = new Set();
      const COMBO = new Set();
      for (const label of labels || []) {
        const [w, s] = String(label).split(/\s*-\s*/);
        if (s) COMBO.add(`${norm(w)}|${norm(s)}`);
        else SINGLE.add(norm(w));
      }
      return { SINGLE, COMBO };
    };
    const { SINGLE, COMBO } = parseLabels(PSYCH_REMAIN_LABELS);

    const shouldCountRemain = (w, s) => {
      const wn = norm(w),
        sn = norm(s);
      return (
        SINGLE.has(wn) ||
        COMBO.has(`${wn}|${sn}`) ||
        PSYCH_REMAIN_KEYWORDS.some((k) => wn.includes(k) || sn.includes(k))
      );
    };
    // ------------------------------------------------------

    const byLabel = {};
    let total = 0;

    for (const r of rows) {
      const w = wardOf(r) || "-";
      const s = subOf(r) || "";
      const label = s ? `${w} - ${s}` : w;

      // รวม 2 อย่าง: (1) bed_remain เฉพาะวอร์ดจิตเวช (2) ค่า psych* ของแถวนั้น
      const rm = shouldCountRemain(w, s) ? remainOf(r) : 0;
      const ps = toNum(getByAliases(r, psychAliases));
      const val = rm + ps;

      if (val > 0) {
        byLabel[label] = (byLabel[label] || 0) + val;
        total += val;
      }
    }

    const list = Object.entries(byLabel)
      .sort(
        (a, b) =>
          b[1] - a[1] || a[0].localeCompare(b[0], "th", { sensitivity: "base" })
      )
      .map(([label, val]) => `${label}: ${fmt(val)}`);

    return { psychTotal: total, psychList: list };
  }, [unifiedRows]);

  // ✅ Prisoner: ดึงจาก View อย่างเดียว (คอลัมน์ prisoner*)
  const { prisonerTotal, prisonerList } = useMemo(() => {
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()\-_.]/g, "");

    const wardOf = (r) => strFromKeys(r, ["wardname", "ward", "ward_name"]);
    const subOf = (r) => strFromKeys(r, ["subward", "sub_ward", "subWard"]);

    const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const getByAliases = (row, aliases) => {
      const m = {};
      for (const [k, v] of Object.entries(row || {})) m[norm(k)] = v;
      for (const name of aliases) {
        const k = norm(name);
        if (m[k] !== undefined && m[k] !== null && m[k] !== "") return m[k];
      }
      return 0;
    };

    // เปลี่ยน/เพิ่ม alias ให้ครอบคลุมชื่อคอลัมน์จริงใน view
    const prisonerAliases = [
      "prisoner",
      "prisoner_cases",
      "prisoner_total",
      "inmate",
      "inmate_cases",
      "prisonerall",
    ];

    const isRollup = (r) =>
      (r?.wardname == null && r?.subward == null) ||
      String(r?.wardname || "").trim() === "รวม";

    if (!Array.isArray(unifiedRows) || unifiedRows.length === 0)
      return { prisonerTotal: 0, prisonerList: [] };

    const rows = unifiedRows.filter((r) => !isRollup(r));
    const roll = unifiedRows.find(isRollup);

    // รวมทั้งหมด: ถ้ามีแถว "รวม" ใช้จากรวมนั้น เพื่อกันนับซ้ำ
    const total = roll
      ? toNum(getByAliases(roll, prisonerAliases))
      : rows.reduce((s, r) => s + toNum(getByAliases(r, prisonerAliases)), 0);

    // รายการราย ward/subward
    const byLabel = {};
    for (const r of rows) {
      const w = wardOf(r) || "-";
      const s = subOf(r) || "";
      const label = s ? `${w} - ${s}` : w;
      const p = toNum(getByAliases(r, prisonerAliases));
      if (p > 0) byLabel[label] = (byLabel[label] || 0) + p;
    }

    const list = Object.entries(byLabel)
      .sort(
        (a, b) =>
          b[1] - a[1] || a[0].localeCompare(b[0], "th", { sensitivity: "base" })
      )
      .map(([label, val]) => `${label}: ${fmt(val)}`);

    return { prisonerTotal: total, prisonerList: list };
  }, [unifiedRows]);

  // ✅ รวม RN ทั้ง รพ. จาก unifiedRows (ใช้แถว "รวม" ถ้ามี)
  const { rnSum, rnExtraSum, rnAllSum } = useMemo(() => {
    const n = (v) => Number(v ?? 0) || 0;
    const isRollup = (r) =>
      (r?.wardname == null && r?.subward == null) ||
      String(r?.wardname || "").trim() === "รวม";

    if (!Array.isArray(unifiedRows) || unifiedRows.length === 0) {
      return { rnSum: 0, rnExtraSum: 0, rnAllSum: 0 };
    }

    const roll = unifiedRows.find(isRollup);
    if (roll) {
      const rn = n(roll.rn);
      const rnExtra = n(roll.rn_extra);
      return { rnSum: rn, rnExtraSum: rnExtra, rnAllSum: rn + rnExtra };
    }

    const sums = unifiedRows.reduce(
      (a, r) => ({
        rn: a.rn + n(r.rn),
        rn_extra: a.rn_extra + n(r.rn_extra),
      }),
      { rn: 0, rn_extra: 0 }
    );

    return {
      rnSum: sums.rn,
      rnExtraSum: sums.rn_extra,
      rnAllSum: sums.rn + sums.rn_extra,
    };
  }, [unifiedRows]);

  /** ----------------------------- Log view w/ paging ---------------------------- **/
  const logItems = useMemo(() => {
    const shiftStart = { morning: "07:00", afternoon: "15:00", night: "23:00" };
    const dtCandidates = [
      "datetime",
      "date_time",
      "created_at",
      "updated_at",
      "time",
    ];

    const toDisplayDateTime = (row) => {
      for (const k of dtCandidates) {
        if (row?.[k]) {
          const d = new Date(row[k]);
          if (!Number.isNaN(d))
            return { ts: d.getTime(), text: d.toLocaleDateString("th-TH") };
        }
      }
      if (row?.date) {
        const time = shiftStart[row?.shift] || "00:00";
        const dSort = new Date(`${dateKey(row.date)}T${time}:00`);
        const dText = new Date(dateKey(row.date));
        if (!Number.isNaN(dSort) && !Number.isNaN(dText))
          return {
            ts: dSort.getTime(),
            text: dText.toLocaleDateString("th-TH"),
          };
      }
      if (row?.date) {
        const d = new Date(dateKey(row.date));
        if (!Number.isNaN(d))
          return { ts: d.getTime(), text: d.toLocaleDateString("th-TH") };
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
          "bed_carry",
        ]);
        const tIn = numFromKeys(r, [
          "admit_transfer_in",
          "bed_transfer_in",
          "transfer_in",
          "receive_transfer_in",
        ]);
        const moveW = numFromKeys(r, [
          "discharge_transfer_out",
          "discharge_move_ward",
          "move_ward",
          "transfer_intra",
        ]);
        const refOut = numFromKeys(r, ["discharge_refer_out", "refer_out"]);
        const refBack = numFromKeys(r, ["discharge_refer_back", "refer_back"]);
        const death = numFromKeys(r, [
          "discharge_death",
          "discharge_died",
          "death",
        ]);
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
      .sort(
        (a, b) =>
          b.ts - a.ts ||
          b.ward.localeCompare(a.ward, "th", { sensitivity: "base" })
      );
  }, [filteredData]);

  const totalLogPages = useMemo(
    () => Math.max(1, Math.ceil(logItems.length / LOG_PAGE_SIZE)),
    [logItems.length]
  );
  const pageLogItems = useMemo(
    () =>
      logItems.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE),
    [logItems, logPage]
  );

  // reset หน้า เมื่อฟิลเตอร์เปลี่ยน
  useEffect(() => {
    setLogPage(1);
  }, [
    filteredData.length,
    filters.startDate,
    filters.endDate,
    filters.shift,
    filters.department,
    filters.ward,
    filters.subward,
    filters.month,
    filters.year,
  ]);

  // ถ้าจำนวนหน้าลดลง
  useEffect(() => {
    if (logPage > totalLogPages) setLogPage(totalLogPages);
  }, [totalLogPages, logPage]);

  /** ------------------------------- Handlers -------------------------------- **/
  const handleFilterChange = (e) =>
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));

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
    setFilters((prev) => ({
      startDate: "",
      endDate: "",
      shift: "",
      department: isAdmin || isHeadNurse ? "" : prev.department,
      ward: isAdmin || isHeadNurse ? "" : prev.ward, // ✅ ไม่ล้าง ward ของ user/supervisor
      subward: "",
      month: "",
      year: "",
    }));
  };

  /** --------------------------------- Styles --------------------------------- **/
  const COLORS = [
    "#7e3cbd",
    "#c084fc",
    "#a855f7",
    "#9333ea",
    "#8b5cf6",
    "#7c3aed",
  ];

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
            <p className={styles.dashboardSubtitle}>
              ระบบติดตามและวิเคราะห์ข้อมูลการดำเนินงาน
            </p>
            <p className={styles.dashboardSubtitle}>
              สิทธิ์ผู้ใช้งาน:
              {isAdmin && " Admin"}
              {isSupervisor && " ผู้ตรวจการ"}
              {isHeadNurse && " หัวหน้าตึก"}
              {isUser && " พยาบาลประจำ Ward"}
            </p>
          </div>
        </div>
      </div>

      {/* การ์ดสรุป */}
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

      {/* ฟิลเตอร์ */}
      <FilterPanel
        styles={styles}
        filters={filters}
        filterOptions={filterOptions}
        departments={departments}
        onChangeFilter={handleFilterChange}
        onChangeDate={handleDateChange}
        onClear={clearFilters}
        disabledFields={{
          department: isUser, // user ปกติเปลี่ยนตึกไม่ได้
          ward: isUser, // user ปกติเปลี่ยน ward ไม่ได้
        }}
      />

      {/* กราฟเดิม */}
      <div className={styles.chartsGrid}>
        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>
            <TrendingUp size={20} style={{ color: "#7e3cbd" }} /> แนวโน้ม
            Productivity และการรับผู้ป่วย
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
          <h3 className={styles.chartTitleSmall}>
            {filters.department
              ? "การกระจายตาม Ward (ใน Department ที่เลือก)"
              : "การกระจายตาม Department"}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={
                  filters.department ? wardDistribution : departmentDistribution
                }
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {(filters.department
                  ? wardDistribution
                  : departmentDistribution
                ).map((_, index) => (
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

      {/* Movement (local) */}
      <Block
        styles={styles}
        title="สรุปเคลื่อนไหวผู้ป่วย"
        loading={!filteredData.length && !error && !loading}
        error={null}
        empty={!filteredData.length}
      >
        <TableBox
          headers={[
            "ยอดยกมา",
            "รับใหม่",
            "รับย้าย",
            "กลับบ้าน",
            "ย้ายตึก",
            "Refer out",
            "Refer back",
            "เสียชีวิต",
            "คงพยาบาล",
          ]}
          rows={[
            [
              fmt(movement.carryForward),
              fmt(movement.admitNew),
              fmt(movement.admitTransferIn),
              fmt(movement.disHome),
              fmt(movement.disMoveWard),
              fmt(movement.disReferOut),
              fmt(movement.disReferBack),
              fmt(movement.disDeath),
              fmt(movement.remain),
            ],
          ]}
        />
      </Block>

      {/* View: รวมทั้งหมด + วอร์ดพิเศษ */}
      <Block
        styles={styles}
        title="รวมคงพยาบาลทั้งหมด ทุกวอร์ด"
        loading={unifiedLoading}
        error={unifiedError}
        empty={!unifiedLoading && !unifiedError && !unifiedHasData}
        footer={
          <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
            รวมวอร์ดพิเศษ: {SPECIAL_WARDS.join(", ")}
          </div>
        }
      >
        <TableBox
          headers={["วอร์ดทั้งหมด", "วอร์ดพิเศษ"]}
          rows={[[fmt(allRemain), specialFound ? fmt(specialRemain) : "-"]]}
        />
      </Block>

      {/* View: ICU */}
      <Block
        styles={styles}
        title="สรุป คงพยาบาล ICU ทุกวอร์ด"
        loading={unifiedLoading}
        error={unifiedError}
        empty={!unifiedLoading && !unifiedError && !unifiedHasData}
      >
        <TableBox
          headers={["ICU ผู้ใหญ่", "ICU เด็ก", "รวม ICU"]}
          rows={[[fmt(icuAdRemain), fmt(icuChRemain), fmt(icuAllRemain)]]}
        />
      </Block>

      {/* View: สามัญ / Semi ICU / ทารก + รวม 5 ช่อง */}
      <Block
        styles={styles}
        title="สรุป สามัญ / Semi ICU / ทารก ทุกวอร์ด"
        loading={unifiedLoading}
        error={unifiedError}
        empty={!unifiedLoading && !unifiedError && !unifiedHasData}
      >
        <TableBox
          headers={[
            "คงพยาบาล (สามัญ)",
            "คงพยาบาล (Semi ICU)",
            "คงพยาบาล (ทารก)",
          ]}
          rows={[[fmt(normalRemain), fmt(semiRemain), fmt(newbornRemain)]]}
        />
        <div style={{ height: 12 }} />
        <TableBox
          headers={[
            "ประเภทที่ 5",
            "ประเภทที่ 4",
            "รับใหม่",
            "จำหน่ายกลับบ้าน",
            "เสียชีวิต",
          ]}
          rows={[
            [
              fmt(t5Total),
              fmt(t4Total),
              fmt(bedNewTotal),
              fmt(disHomeTotal),
              fmt(deathTotal),
            ],
          ]}
        />
      </Block>

      {/* View: Ventilator */}
      <Block
        styles={styles}
        title="สรุป Ventilator ทุกวอร์ด"
        loading={unifiedLoading}
        error={unifiedError}
        empty={
          !unifiedLoading && !unifiedError && ventICU + ventAD + ventCH === 0
        }
      >
        <TableBox
          headers={["ICU (รวม)", "ผู้ใหญ่", "เด็ก", "รวมทั้งหมด"]}
          rows={[[fmt(ventICU), fmt(ventAD), fmt(ventCH), fmt(ventAll)]]}
        />
      </Block>

      {/* View: Ventilator */}
      <Block
        styles={styles}
        title="สรุป Fast track"
        loading={unifiedLoading}
        error={unifiedError}
        empty={
          !unifiedLoading && !unifiedError && ventICU + ventAD + ventCH === 0
        }
      >
        <TableBox
          headers={["ICU (รวม)", "ผู้ใหญ่", "เด็ก", "รวมทั้งหมด"]}
          rows={[[fmt(ventICU), fmt(ventAD), fmt(ventCH), fmt(ventAll)]]}
        />
      </Block>

      {/* View: ไข้เลือดออก (DF / DHF / DSS) */}
      <Block
        styles={styles}
        title="สรุปไข้เลือดออก (DF / DHF / DSS)"
        loading={dengueLoading}
        error={dengueError}
        empty={!dengueLoading && !dengueError && dengueRows.length === 0}
      >
        <TableBox
          headers={["ประเภท", "รับใหม่", "กลับบ้าน", "เสียชีวิต", "คงพยาบาล"]}
          rows={["DF", "DHF", "DSS"].map((t) => {
            const r =
              dengueRows.find(
                (x) => String(x.dengue_type).toUpperCase() === t
              ) || {};
            return [
              t,
              fmt(Number(r.admit_new || 0)),
              fmt(Number(r.discharge_home || 0)),
              fmt(Number(r.discharge_died || 0)),
              fmt(Number(r.bed_remain || 0)),
            ];
          })}
        />
        {dengueTotal && (
          <>
            <div style={{ height: 8 }} />
            <TableBox
              rows={[
                [
                  "รวม",
                  fmt(Number(dengueTotal.admit_new || 0)),
                  fmt(Number(dengueTotal.discharge_home || 0)),
                  fmt(Number(dengueTotal.discharge_died || 0)),
                  fmt(Number(dengueTotal.bed_remain || 0)),
                ],
              ]}
            />
          </>
        )}
      </Block>

      {/* Mini cards row (แนวนอน) */}
      {/* แถวการ์ดเล็ก (แนวนอน) */}
      <div className={styles.miniRow}>
        {/* Card: เปลเสริม */}
        <div className={styles.miniCard}>
          <div className={styles.miniCardTitle}>
            <span className={styles.miniIcon}>
              <Activity size={16} />
            </span>
            เปลเสริม
          </div>
          <div className={styles.miniCardValue}>{fmt(extraBedTotal)}</div>

          {!!extraBedTotal && extraBedList.length > 0 && (
            <>
              <button
                className={styles.miniCardLink}
                onClick={() => setShowExtraBedDetails((v) => !v)}
              >
                {showExtraBedDetails ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
              </button>
              {showExtraBedDetails && (
                <ul className={styles.miniCardList}>
                  {extraBedList.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Card: Stroke (รวม SU remain + stroke จาก view) */}
        <div className={styles.miniCard}>
          <div className={styles.miniCardTitle}>
            <span className={styles.miniIcon}>
              <Activity size={16} />
            </span>
            Stroke
          </div>
          <div className={styles.miniCardValue}>{fmt(strokeTotal)}</div>

          {strokeTotal > 0 && strokeList.length > 0 && (
            <>
              <button
                className={styles.miniCardLink}
                onClick={() => setShowStrokeDetails((v) => !v)}
              >
                {showStrokeDetails ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
              </button>
              {showStrokeDetails && (
                <ul className={styles.miniCardList}>
                  {strokeList.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Card: จิตเวช */}
        <div className={styles.miniCard}>
          <div className={styles.miniCardTitle}>
            <span className={styles.miniIcon}>
              <Activity size={16} />
            </span>
            จิตเวช
          </div>
          <div className={styles.miniCardValue}>{fmt(psychTotal)}</div>

          {psychTotal > 0 && psychList.length > 0 && (
            <>
              <button
                className={styles.miniCardLink}
                onClick={() => setShowPsychDetails((v) => !v)}
              >
                {showPsychDetails ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
              </button>
              {showPsychDetails && (
                <ul className={styles.miniCardList}>
                  {psychList.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Card: นักโทษ */}
        <div className={styles.miniCard}>
          <div className={styles.miniCardTitle}>
            <span className={styles.miniIcon}>
              <Activity size={16} />
            </span>
            นักโทษ
          </div>
          <div className={styles.miniCardValue}>{fmt(prisonerTotal)}</div>

          {prisonerTotal > 0 && prisonerList.length > 0 && (
            <>
              <button
                className={styles.miniCardLink}
                onClick={() => setShowPrisonerDetails((v) => !v)}
              >
                {showPrisonerDetails ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
              </button>
              {showPrisonerDetails && (
                <ul className={styles.miniCardList}>
                  {prisonerList.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      <Block
        styles={styles}
        title="สรุปกำลังพยาบาล (RN) ทุกวอร์ด"
        loading={unifiedLoading}
        error={unifiedError}
        empty={!unifiedLoading && !unifiedError && !unifiedHasData}
      >
        <TableBox
          headers={["RN", "RN เพิ่ม", "รวม RN"]}
          rows={[[fmt(rnSum), fmt(rnExtraSum), fmt(rnAllSum)]]}
        />
      </Block>

      {/* Log view + แบ่งหน้า */}
      <Block
        styles={styles}
        title="รายการตามเวลา"
        loading={false}
        error={null}
        empty={!pageLogItems.length}
      >
        <TableBox
          headers={[
            "วันที่",
            "เวร",
            "Ward",
            "Sub-ward",
            "รับใหม่",
            "รับย้าย",
            "กลับบ้าน",
            "ย้ายตึก",
            "Refer out",
            "Refer back",
            "เสียชีวิต",
            "คงพยาบาล",
            "Prod. (%)",
          ]}
          rows={pageLogItems.map((r) => [
            r.timeText,
            shiftLabel(r.shift),
            r.ward || "-",
            r.subward || "-",
            fmt(r.admitNew),
            fmt(r.transferIn),
            fmt(r.disHome),
            fmt(r.moveWard),
            fmt(r.referOut),
            fmt(r.referBack),
            fmt(r.death),
            fmt(r.remain),
            Number.isFinite(+r.productivity)
              ? Number(r.productivity).toFixed(2)
              : "-",
          ])}
        />

        {/* Pagination */}
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={() => setLogPage(1)}
            disabled={logPage === 1}
          >
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
            หน้า {logPage} / {totalLogPages} • ทั้งหมด{" "}
            {logItems.length.toLocaleString("th-TH")} รายการ
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
      </Block>
    </div>
  );
}
