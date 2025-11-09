// src/pages/Dashboard/CompareDashboard.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { jwtDecode } from "jwt-decode";
import { API_BASE } from "../../config";
import styles from "../../styles/Dashboard.module.css";
import FilterPanel from "../../components/dashboard/FilterPanel";
import Block from "../../components/common/Block";

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

import {
  buildDateRange,
  dateKey,
  fmt,
  numFromKeys,
  strFromKeys,
} from "../../utils/helpers";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

/* ----------------------------- Helpers (local) ---------------------------- */
const SHIFTS = ["morning", "afternoon", "night"];
const SHIFT_TH = {
  morning: "เช้า",
  afternoon: "บ่าย",
  night: "ดึก",
  total: "รวม",
};

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_.]/g, "");

const isRollup = (r) =>
  (r?.wardname == null && r?.subward == null) ||
  String(r?.wardname || "").trim() === "รวม";

const sumVentInRow = (row) =>
  Number(row?.vent_invasive || 0) + Number(row?.vent_noninvasive || 0);

const parseLabelList = (labels) => {
  const SINGLE = new Set();
  const COMBO = new Set();
  for (const label of labels || []) {
    const [w, s] = String(label).split(/\s*-\s*/);
    if (s) COMBO.add(`${norm(w)}|${norm(s)}`);
    else SINGLE.add(norm(w));
  }
  return { SINGLE, COMBO };
};

const pickRemain = (r) => Number(r?.bed_remain ?? r?.remain ?? 0) || 0;

const sumByWardList = (rows, labels, getValue) => {
  const { SINGLE, COMBO } = parseLabelList(labels);
  let sum = 0;
  for (const r of rows) {
    const w = norm(strFromKeys(r, ["wardname", "ward", "ward_name"]));
    const s = norm(strFromKeys(r, ["subward", "sub_ward", "subWard"]));
    if (s) {
      if (COMBO.has(`${w}|${s}`)) sum += getValue(r);
    } else {
      if (SINGLE.has(w)) sum += getValue(r);
    }
  }
  return sum;
};

const avg = (arr) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

/* ------------------------------- Component ------------------------------- */
export default function CompareDashboard({ username, wardname }) {
  // อ่านสิทธิ์จาก token (รองรับ snake/camel + string role)
  let role_id = 1,
    department_id = null;
  const token = localStorage.getItem("token");
  if (token) {
    try {
      const d = jwtDecode(token);
      role_id = d.role_id || d.role || 1;
      department_id = d.department_id || d.departmentId || null;
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

  // ฟิลเตอร์ (โฟกัสที่ช่วงวันที่ + ward/department/subward)
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    shift: "", // ไม่ใช้ในการโหลดเพราะเราดึงทุกเวรอยู่แล้ว
    department: "",
    ward: "",
    subward: "",
    month: "",
    year: "",
  });

  // โหลด options department / wards
  const [departments, setDepartments] = useState([]);
  const [wardOptions, setWardOptions] = useState([]);

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
    // เปลี่ยน department ให้เคลียร์ subward (ผู้ใช้ทั่วไปยังล็อก ward ตัวเอง)
    setFilters((f) => ({ ...f, ward: isAdmin ? "" : f.ward, subward: "" }));
    return () => ac.abort();
  }, [filters.department, isAdmin]);

  /* -------------------------- Fetch per shift data ------------------------- */
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  // เก็บ summary/dengue/detail ต่อเวร
  const [sumByShift, setSumByShift] = useState({}); // { morning: rows[], afternoon: rows[], night: rows[], total: rows[] }
  const [dengueByShift, setDengueByShift] = useState({}); // { morning: rows[], ... , total: {DF,DHF,DSS} }
  const [prodByShift, setProdByShift] = useState({}); // { morning: avg%, ... }

  const buildQS = (baseFilters, shift) => {
    const qs = buildDateRange(baseFilters);
    if (shift) qs.set("shift", shift);
    if (isAdmin && baseFilters.ward) qs.set("wardname", baseFilters.ward);
    if (baseFilters.subward) qs.set("subward", baseFilters.subward);
    if (baseFilters.department) qs.set("department", baseFilters.department);
    if (isUser && wardname) qs.set("wardname", wardname);
    return qs;
  };

  const fetchSummaryForShift = async (shift, signal) => {
    const tk = localStorage.getItem("token") || "";
    const qs = buildQS(filters, shift);
    const url = `${API_BASE}/api/dashboard/summary${
      qs.toString() ? `?${qs}` : ""
    }`;
    const res = await fetch(url, {
      headers: tk ? { Authorization: `Bearer ${tk}` } : {},
      signal,
    });
    const json = await res.json();
    if (!res.ok || json?.ok === false)
      throw new Error(json?.message || "โหลดสรุปไม่สำเร็จ");
    const rows = Array.isArray(json?.data) ? json.data : [];
    return rows;
  };

  const fetchDengueForShift = async (shift, signal) => {
    const tk = localStorage.getItem("token") || "";
    const qs = buildQS(filters, shift);
    const url = `${API_BASE}/api/dashboard/dengue-summary${
      qs.toString() ? `?${qs}` : ""
    }`;
    const res = await fetch(url, {
      headers: tk ? { Authorization: `Bearer ${tk}` } : {},
      signal,
    });
    const json = await res.json();
    if (!res.ok || json?.ok === false)
      throw new Error(json?.message || "โหลดไข้เลือดออกไม่สำเร็จ");
    const rows = Array.isArray(json?.data) ? json.data : [];
    return { rows, total: json?.total || null };
  };

  const fetchDetailForShift = async (shift, signal) => {
    // ใช้สำหรับหา Productivity เฉลี่ย
    const tk = localStorage.getItem("token") || "";
    const qs = buildQS(filters, shift);
    const url = `${API_BASE}/api/dashboard${qs.toString() ? `?${qs}` : ""}`;
    const res = await fetch(url, {
      headers: tk ? { Authorization: `Bearer ${tk}` } : {},
      signal,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || "โหลดรายละเอียดไม่สำเร็จ");
    const rows = Array.isArray(json) ? json : [];
    const nums = rows
      .map((r) => Number(r?.productivity))
      .filter((v) => Number.isFinite(v) && v > 0);
    return avg(nums);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrMsg("");
    const ac = new AbortController();
    try {
      const resultSummary = {};
      const resultDengue = {};
      const resultProd = {};

      // 3 เวร + รวม (รวม = ไม่กำหนด shift)
      const shiftsToRun = [...SHIFTS, "total"];

      await Promise.all(
        shiftsToRun.map(async (sh) => {
          const shiftParam = sh === "total" ? "" : sh;
          const [sumRows, dengueObj, prodAvg] = await Promise.all([
            fetchSummaryForShift(shiftParam, ac.signal),
            fetchDengueForShift(shiftParam, ac.signal),
            fetchDetailForShift(shiftParam, ac.signal),
          ]);
          resultSummary[sh] = sumRows;
          resultDengue[sh] = dengueObj;
          resultProd[sh] = prodAvg || 0;
        })
      );

      setSumByShift(resultSummary);
      setDengueByShift(resultDengue);
      setProdByShift(resultProd);
    } catch (e) {
      if (e.name !== "AbortError") setErrMsg(e.message || "โหลดข้อมูลล้มเหลว");
    } finally {
      setLoading(false);
    }
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, isAdmin, isUser, wardname]);

  useEffect(() => {
    const ac = new AbortController();
    loadAll();
    return () => ac.abort();
  }, [loadAll]);

  /* ------------------------- Compute metrics per shift ------------------------- */
  // คืน object metrics ต่อเวร: { allRemain, specialRemain, icuAdRemain, icuChRemain, icuAllRemain,
  // normalRemain, semiRemain, newbornRemain, t5, t4, admit, disHome, death, ventICU, ventAD, ventCH, ventAll,
  // strokeTotal, psychTotal, prisonerTotal, rn, rnExtra, rnAll, prodAvg,
  // dengue: { DF:{admit,home,death,remain}, DHF:{...}, DSS:{...} } }
  const computeMetricsFromSummary = (
    rows = [],
    prodValue = 0,
    dengueObj = { rows: [], total: null }
  ) => {
    const normalRows = (rows || []).filter((r) => !isRollup(r));
    const roll = (rows || []).find(isRollup) || {};

    // ✅ ประกาศก่อนใช้
    const prodAvg = prodValue || 0;

    // รวมคงพยาบาลทั้งหมด
    const allRemain =
      roll?.bed_remain != null
        ? Number(roll.bed_remain || 0)
        : normalRows.reduce((s, r) => s + pickRemain(r), 0);

    // วอร์ดพิเศษ
    const specialRemain = sumByWardList(normalRows, SPECIAL_WARDS, pickRemain);

    // ICU ผู้ใหญ่/เด็ก/รวม
    const icuAdRemain = sumByWardList(normalRows, ICUAD_WARDS, pickRemain);
    const icuChRemain = sumByWardList(normalRows, ICUCH_WARDS, pickRemain);
    const icuAllRemain = icuAdRemain + icuChRemain;

    // สามัญ / Semi ICU / ทารก
    const normalRemain = sumByWardList(normalRows, NORMAL_WARDS, pickRemain);
    const semiRemain = sumByWardList(normalRows, Semi_ICU, pickRemain);
    const newbornRemain = sumByWardList(normalRows, Newborn, pickRemain);

    // ประเภทผู้ป่วย (type5, type4, admit_new, discharge_home, death)
    const n = (v) => Number(v ?? 0) || 0;
    const t5 =
      roll?.type5 != null
        ? n(roll.type5)
        : normalRows.reduce((s, r) => s + n(r.type5), 0);
    const t4 =
      roll?.type4 != null
        ? n(roll.type4)
        : normalRows.reduce((s, r) => s + n(r.type4), 0);
    const admit =
      roll?.bed_new != null
        ? n(roll.bed_new)
        : normalRows.reduce((s, r) => s + n(r.bed_new), 0);
    const disHome =
      roll?.discharge_home != null
        ? n(roll.discharge_home)
        : normalRows.reduce((s, r) => s + n(r.discharge_home), 0);
    const death =
      roll?.discharge_died != null
        ? n(roll.discharge_died)
        : normalRows.reduce((s, r) => s + n(r.discharge_died), 0);

    // Ventilator
    const ventICU = sumByWardList(normalRows, ICU_Ven, sumVentInRow);
    const ventAD = sumByWardList(normalRows, AD_Ven, sumVentInRow);
    const ventCH = sumByWardList(normalRows, CH_Ven, sumVentInRow);
    const ventAll = ventICU + ventAD + ventCH;

    // Stroke: (remain ของ Stroke Unit) + ค่าจากคอลัมน์ stroke รวม
    const strokeRemainSU = sumByWardList(
      normalRows,
      ["Stroke Unit"], // ปรับชื่อให้ตรงกับหน้างานจริงได้
      pickRemain
    );
    const strokeFromView =
      roll?.stroke != null
        ? n(roll.stroke)
        : normalRows.reduce((s, r) => s + n(r.stroke), 0);
    const strokeTotal = strokeRemainSU + strokeFromView;

    // จิตเวช: รวม bed_remain ของวอร์ด/ซับวอร์ดจิตเวช + คอลัมน์ psych
    const PSYCH_REMAIN_KEYWORDS = ["จิตเวช", "psych", "psychi", "mental"].map(
      norm
    );
    const psychRemain = normalRows.reduce((sum, r) => {
      const w = norm(strFromKeys(r, ["wardname", "ward", "ward_name"]));
      const s = norm(strFromKeys(r, ["subward", "sub_ward", "subWard"]));
      const hasKW = PSYCH_REMAIN_KEYWORDS.some(
        (k) => w.includes(k) || s.includes(k)
      );
      return sum + (hasKW ? pickRemain(r) : 0);
    }, 0);
    const psychCol =
      roll?.psych != null
        ? n(roll.psych)
        : normalRows.reduce((s, r) => s + n(r.psych), 0);
    const psychTotal = psychRemain + psychCol;

    // นักโทษ: จาก prisoner column
    const prisonerTotal =
      roll?.prisoner != null
        ? n(roll.prisoner)
        : normalRows.reduce((s, r) => s + n(r.prisoner), 0);

    // RN
    const rn =
      roll?.rn != null
        ? n(roll.rn)
        : normalRows.reduce((s, r) => s + n(r.rn), 0);
    const rnExtra =
      roll?.rn_extra != null
        ? n(roll.rn_extra)
        : normalRows.reduce((s, r) => s + n(r.rn_extra), 0);
    const rnAll = rn + rnExtra;

    // Productivity (avg จาก /api/dashboard detail)
    const prodAverage = prodValue || 0;

    // Dengue (DF/DHF/DSS)
    const dengue = {
      DF: { admit: 0, home: 0, death: 0, remain: 0 },
      DHF: { admit: 0, home: 0, death: 0, remain: 0 },
      DSS: { admit: 0, home: 0, death: 0, remain: 0 },
    };
    for (const r of dengueObj?.rows || []) {
      const t = String(r?.dengue_type || "").toUpperCase();
      const bucket = dengue[t];
      if (!bucket) continue;
      bucket.admit += Number(r?.admit_new || 0);
      bucket.home += Number(r?.discharge_home || 0);
      bucket.death += Number(r?.discharge_died || 0);
      bucket.remain += Number(r?.bed_remain || 0);
    }

    return {
      allRemain,
      specialRemain,
      icuAdRemain,
      icuChRemain,
      icuAllRemain,
      normalRemain,
      semiRemain,
      newbornRemain,
      t5,
      t4,
      admit,
      disHome,
      death,
      ventICU,
      ventAD,
      ventCH,
      ventAll,
      strokeTotal,
      psychTotal,
      prisonerTotal,
      rn,
      rnExtra,
      rnAll,
      prodAvg: prodAverage,
      dengue,
    };
  };

  const metrics = useMemo(() => {
    const out = {};
    for (const k of [...SHIFTS, "total"]) {
      out[k] = computeMetricsFromSummary(
        sumByShift[k],
        prodByShift[k],
        dengueByShift[k]
      );
    }
    return out;
  }, [sumByShift, prodByShift, dengueByShift]);

  // ✅ 1. State และฟังก์ชันประกาศไว้ “เหนือ” useMemo
  const [expanded, setExpanded] = useState(null);
  const toggleRow = (index) =>
    setExpanded((prev) => (prev === index ? null : index));

  const getDetailText = (name, shiftKey) => {
    const rowsAll = sumByShift[shiftKey] || [];
    const rows = rowsAll.filter((r) => !isRollup(r)); // ตัดแถวรวม
    const lower = String(name).toLowerCase();
    const n = (v) => Number(v) || 0;

    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()\-_.]/g, "");

    // ช่วยฟังก์ชันแสดงผล
    const formatList = (list, key = "bed_remain") => {
      if (!list.length) return "-";
      return list
        .map((r) => {
          const ward = r.wardname ? r.wardname.trim() : "-";
          const sub = r.subward ? r.subward.trim() : "-";
          let value = 0;

          // ✅ ถ้าเป็นข้อมูล ventilator ให้รวม invasive + noninvasive
          if (key === "vent_invasive") {
            value =
              (Number(r.vent_invasive) || 0) +
              (Number(r.vent_noninvasive) || 0);
          } else {
            value = Number(r[key]) || 0;
          }

          return `${ward}${
            sub && sub !== ward ? " / " + sub : ""
          } (${value} คน)`;
        })
        .join(", ");
    };

    // ------------------ Dengue details (ใช้ dengueByShift แทน summary) ------------------
    const formatDengue = (rows, key) => {
      if (!rows.length) return "-";
      const n = (v) => Number(v) || 0;
      return rows
        .map((r) => {
          const ward = (r.wardname || "-").trim();
          const sub = (r.subward || "-").trim();
          return `${ward}${sub && sub !== ward ? " / " + sub : ""} (${n(
            r[key]
          )} คน)`;
        })
        .join(", ");
    };

    const dengueRowsSrc = (dengueType) => {
      const all = dengueByShift[shiftKey]?.rows || [];
      return all.filter(
        (r) => String(r.dengue_type || "").toUpperCase() === dengueType
      );
    };

    // 🏥 คงพยาบาล
    if (lower.includes("วอร์ดทั้งหมด")) return formatList(rows, "bed_remain");
    if (lower.includes("วอร์ดพิเศษ"))
      return formatList(
        rows.filter((r) => {
          const w = r.wardname || "";
          const s = r.subward || "";
          return (
            w.startsWith("พิเศษ") || (w.startsWith("เฉลิม") && s === "ผู้ใหญ่")
          );
        }),
        "bed_remain"
      );

    if (lower.includes("icu (ผู้ใหญ่)"))
      return formatList(rows.filter((r) => ICUAD_WARDS.includes(r.wardname)));
    if (lower.includes("icu (เด็ก)"))
      return formatList(rows.filter((r) => ICUCH_WARDS.includes(r.wardname)));
    if (lower.includes("semi icu"))
      return formatList(
        rows.filter((r) => {
          const sub = norm(r.subward || "");
          // ✅ ดึงเฉพาะ subward ที่มีคำว่า ICU หรือ NICU
          return sub.includes("icu") || sub.includes("nicu");
        }),
        "bed_remain"
      );

    if (lower.includes("ทารก"))
      return formatList(
        rows.filter((r) => {
          const sub = norm(r.subward || "");
          // ✅ ดึงเฉพาะ subward ที่อยู่ใน Newborn หรือมีคำว่า “ทารก” หรือ “SNB”
          return Newborn.some(
            (x) =>
              norm(sub).includes(norm(x)) ||
              norm(sub).includes("ทารก") ||
              norm(sub).includes("snb")
          );
        }),
        "bed_remain"
      );

    // 👨‍⚕️ ประเภทผู้ป่วย
    if (lower.includes("ประเภทที่ 5"))
      return formatList(
        rows.filter((r) => n(r.type5) > 0),
        "type5"
      );
    if (lower.includes("ประเภทที่ 4"))
      return formatList(
        rows.filter((r) => n(r.type4) > 0),
        "type4"
      );

    // 💨 Ventilator
    // 💨 Ventilator (ICU / ผู้ใหญ่ / เด็ก / รวม)
    const label = norm(name); // ลบช่องว่าง เครื่องหมายพิเศษออก
    const hasVent = (r) => n(r.vent_invasive) > 0 || n(r.vent_noninvasive) > 0;

    // 🔸 ICU
    if (label === "icu" || label.includes("ventilatoricu"))
      return formatList(
        rows.filter((r) => ICU_Ven.includes(r.wardname) && hasVent(r)),
        "vent_invasive"
      );

    // 🔸 ผู้ใหญ่
    if (label.includes("ผู้ใหญ่") || label.includes("adultvent"))
      return formatList(
        rows.filter((r) => AD_Ven.includes(r.wardname) && hasVent(r)),
        "vent_invasive"
      );

    // 🔸 เด็ก
    if (label.includes("เด็ก") || label.includes("childvent"))
      return formatList(
        rows.filter((r) => CH_Ven.includes(r.wardname) && hasVent(r)),
        "vent_invasive"
      );

    // 🔸 รวมทั้งหมด (เอาทุกกลุ่ม Vent มารวม)
    if (
      label === "รวม" ||
      label.includes("vent") ||
      label.includes("เครื่องช่วยหายใจ")
    ) {
      const allVentRows = rows.filter(
        (r) =>
          ICU_Ven.includes(r.wardname) ||
          AD_Ven.includes(r.wardname) ||
          CH_Ven.includes(r.wardname)
      );
      return formatList(allVentRows.filter(hasVent), "vent_invasive");
    }

    // 🦠 DF
    if (lower.includes("df - รับใหม่"))
      return formatDengue(dengueRowsSrc("DF"), "admit_new");

    if (lower.includes("df - กลับบ้าน"))
      return formatDengue(dengueRowsSrc("DF"), "discharge_home");

    if (lower.includes("df - เสียชีวิต"))
      return formatDengue(dengueRowsSrc("DF"), "discharge_died");

    if (lower.includes("df - คงพยาบาล"))
      return formatDengue(dengueRowsSrc("DF"), "bed_remain");

    // 🦠 DHF
    if (lower.includes("dhf - รับใหม่"))
      return formatDengue(dengueRowsSrc("DHF"), "admit_new");

    if (lower.includes("dhf - กลับบ้าน"))
      return formatDengue(dengueRowsSrc("DHF"), "discharge_home");

    if (lower.includes("dhf - เสียชีวิต"))
      return formatDengue(dengueRowsSrc("DHF"), "discharge_died");

    if (lower.includes("dhf - คงพยาบาล"))
      return formatDengue(dengueRowsSrc("DHF"), "bed_remain");

    // 🦠 DSS
    if (lower.includes("dss - รับใหม่"))
      return formatDengue(dengueRowsSrc("DSS"), "admit_new");

    if (lower.includes("dss - กลับบ้าน"))
      return formatDengue(dengueRowsSrc("DSS"), "discharge_home");

    if (lower.includes("dss - เสียชีวิต"))
      return formatDengue(dengueRowsSrc("DSS"), "discharge_died");

    if (lower.includes("dss - คงพยาบาล"))
      return formatDengue(dengueRowsSrc("DSS"), "bed_remain");

    // 👇 พวกนี้ค่อยตามมา
    if (lower.includes("รับใหม่"))
      return formatList(
        rows.filter((r) => n(r.bed_new) > 0),
        "bed_new"
      );

    if (lower.includes("จำหน่ายกลับบ้าน"))
      return formatList(
        rows.filter((r) => n(r.discharge_home) > 0),
        "discharge_home"
      );

    if (lower.includes("เสียชีวิต"))
      return formatList(
        rows.filter((r) => n(r.discharge_died) > 0),
        "discharge_died"
      );

    // 🧠 Stroke
    if (lower.includes("stroke"))
      return formatList(
        rows.filter((r) => n(r.stroke) > 0),
        "stroke"
      );

    // 🧍‍♂️ จิตเวช
    if (lower.includes("จิตเวช") || lower.includes("psych"))
      return formatList(
        rows.filter((r) => n(r.psych) > 0),
        "psych"
      );

    // 👮‍♂️ นักโทษ
    if (lower.includes("นักโทษ") || lower.includes("prison"))
      return formatList(
        rows.filter((r) => n(r.prisoner) > 0),
        "prisoner"
      );

    // 👩‍⚕️ RN
    if (lower.includes("rn"))
      return formatList(
        rows.filter((r) => n(r.rn) > 0 || n(r.rn_extra) > 0),
        "rn"
      );

    // 📈 Productivity
    if (lower.includes("productivity"))
      return formatList(
        rows.filter((r) => n(r.productivity) > 0),
        "productivity"
      );

    return "-";
  };

  const tableRows = useMemo(() => {
    if (!metrics?.total) return [];

    const mk = (label, pick) => [
      label,
      fmt(pick(metrics.morning)),
      fmt(pick(metrics.afternoon)),
      fmt(pick(metrics.night)),
      fmt(pick(metrics.total)),
    ];

    const groups = [
      {
        title: "คงพยาบาล",
        color: "#e0e0e0", // สีเทาอ่อน (ตามโซนผู้ป่วยในภาพ)
        items: [
          mk("วอร์ดทั้งหมด", (m) => m.allRemain),
          mk("วอร์ดพิเศษ", (m) => m.specialRemain),
          mk("ICU (ผู้ใหญ่)", (m) => m.icuAdRemain),
          mk("ICU (เด็ก)", (m) => m.icuChRemain),
          mk("Semi ICU", (m) => m.semiRemain),
          mk("ทารก", (m) => m.newbornRemain),
        ],
      },
      {
        title: "ประเภทผู้ป่วย / รับใหม่ - จำหน่าย",
        color: "#d9edf7", // สีฟ้าอ่อน ๆ
        items: [
          mk("ประเภทที่ 5", (m) => m.t5),
          mk("ประเภทที่ 4", (m) => m.t4),
          mk("รับใหม่", (m) => m.admit),
          mk("จำหน่ายกลับบ้าน", (m) => m.disHome),
          mk("เสียชีวิต", (m) => m.death),
        ],
      },
      {
        title: "Ventilator",
        color: "#ffeb99", // สีเหลืองส้มอ่อน (ตามภาพหัวข้อ Ventilator)
        items: [
          mk("ICU", (m) => m.ventICU),
          mk("ผู้ใหญ่", (m) => m.ventAD),
          mk("เด็ก", (m) => m.ventCH),
          mk("รวม", (m) => m.ventAll),
        ],
      },
      {
        title: "ไข้เลือดออก (DF / DHF / DSS)",
        color: "#ccffcc", // สีเขียวอ่อน (ตามภาพหัวข้อ DF)
        items: [
          mk("DF - รับใหม่", (m) => m.dengue.DF.admit),
          mk("DF - กลับบ้าน", (m) => m.dengue.DF.home),
          mk("DF - เสียชีวิต", (m) => m.dengue.DF.death),
          mk("DF - คงพยาบาล", (m) => m.dengue.DF.remain),
          // คุณอาจจะอยากแยกหัวข้อย่อย DHF/DSS เพื่อใส่สีต่างกันในอนาคต
          mk("DHF - รับใหม่", (m) => m.dengue.DHF.admit),
          mk("DHF - กลับบ้าน", (m) => m.dengue.DHF.home),
          mk("DHF - เสียชีวิต", (m) => m.dengue.DHF.death),
          mk("DHF - คงพยาบาล", (m) => m.dengue.DHF.remain),
          mk("DSS - รับใหม่", (m) => m.dengue.DSS.admit),
          mk("DSS - กลับบ้าน", (m) => m.dengue.DSS.home),
          mk("DSS - เสียชีวิต", (m) => m.dengue.DSS.death),
          mk("DSS - คงพยาบาล", (m) => m.dengue.DSS.remain),
        ],
      },
      {
        title: "กลุ่มเฉพาะโรค / อื่น ๆ",
        color: "#ffcccc", // สีชมพูอ่อน (ตามภาพหัวข้อ Stroke)
        items: [
          mk("รวม Stroke", (m) => m.strokeTotal),
          mk("รวม จิตเวช", (m) => m.psychTotal),
          mk("รวม นักโทษ", (m) => m.prisonerTotal),
          mk("รวม RN", (m) => m.rnAll), // เพิ่ม RN เข้ามา
          [
            "Productivity (%)",
            Number.isFinite(+metrics.morning.prodAvg)
              ? (+metrics.morning.prodAvg).toFixed(2)
              : "-",
            Number.isFinite(+metrics.afternoon.prodAvg)
              ? (+metrics.afternoon.prodAvg).toFixed(2)
              : "-",
            Number.isFinite(+metrics.night.prodAvg)
              ? (+metrics.night.prodAvg).toFixed(2)
              : "-",
            Number.isFinite(+metrics.total.prodAvg)
              ? (+metrics.total.prodAvg).toFixed(2)
              : "-",
          ],
        ],
      },
    ];

    const rows = [];
    for (const g of groups) {
      rows.push({
        type: "group",
        title: g.title,
        color: g.color,
      });
      for (const it of g.items) {
        rows.push({
          type: "item",
          color: g.color,
          cells: ["  " + it[0], ...it.slice(1)],
        });
      }
    }

    return rows;
  }, [metrics]);

  /* ------------------------------- Bar Chart ------------------------------- */
  // เลือกหัวข้อสำหรับกราฟแท่ง
  const METRIC_FIELDS = [
    { key: "allRemain", label: "คงพยาบาล - วอร์ดทั้งหมด" },
    { key: "icuAllRemain", label: "คงพยาบาล ICU - รวม" },
    { key: "normalRemain", label: "คงพยาบาล (สามัญ)" },
    { key: "semiRemain", label: "คงพยาบาล (Semi ICU)" },
    { key: "newbornRemain", label: "คงพยาบาล (ทารก)" },
    { key: "t5", label: "ประเภทที่ 5" },
    { key: "t4", label: "ประเภทที่ 4" },
    { key: "admit", label: "รับใหม่" },
    { key: "disHome", label: "จำหน่ายกลับบ้าน" },
    { key: "death", label: "เสียชีวิต" },
    { key: "ventAll", label: "Ventilator - รวม" },
    { key: "rnAll", label: "รวม RN" },
    { key: "strokeTotal", label: "รวม Stroke" },
    { key: "psychTotal", label: "รวม จิตเวช" },
    { key: "prisonerTotal", label: "รวม นักโทษ" },
    { key: "prodAvg", label: "Productivity (%)" },
  ];
  const [barMetric, setBarMetric] = useState("allRemain");
  const barData = useMemo(() => {
    if (!metrics?.total) return [];
    return [
      {
        label: SHIFT_TH.morning,
        value: metrics.morning[barMetric] || 0,
        color: "#facc15",
      }, // เหลือง
      {
        label: SHIFT_TH.afternoon,
        value: metrics.afternoon[barMetric] || 0,
        color: "#fb923c",
      }, // ส้ม
      {
        label: SHIFT_TH.night,
        value: metrics.night[barMetric] || 0,
        color: "#3b82f6",
      }, // น้ำเงิน
    ];
  }, [metrics, barMetric]);

  /* --------------------------------- UI ---------------------------------- */
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
  const clearFilters = () =>
    setFilters((prev) => ({
      startDate: "",
      endDate: "",
      shift: "",
      department: isAdmin || isHeadNurse ? "" : prev.department,
      ward: isAdmin || isHeadNurse ? "" : prev.ward,
      subward: "",
      month: "",
      year: "",
    }));

  const filterOptions = useMemo(() => {
    const uniqueWards = filters.department
      ? [...wardOptions].sort((a, b) =>
          String(a).localeCompare(String(b), "th", { sensitivity: "base" })
        )
      : []; // ในโหมด compare นี้เราไม่ได้ดึงรายแถวเพื่อทำรายการ subward แล้ว
    const years = []; // ไม่ใช้ year/month ในโหมดนี้
    return { departments, wards: uniqueWards, years, subwards: [] };
  }, [departments, wardOptions, filters.department]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <span className={styles.loadingText}>
          กำลังโหลดข้อมูลเปรียบเทียบ 3 เวร...
        </span>
      </div>
    );
  }
  if (errMsg) {
    return <div className={styles.errorContainer}>{errMsg}</div>;
  }

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.dashboardHeader}>
        <div className={styles.dashboardHeaderContent}>
          <div>
            <h1 className={styles.dashboardTitle}>
              📊 Compare Dashboard (3 เวร + รวม)
            </h1>
            <p className={styles.dashboardSubtitle}>
              สรุปทุกหัวข้อเหมือนหน้า Dashboard หลัก — เปรียบเทียบ เช้า / บ่าย /
              ดึก / รวม
            </p>
          </div>
        </div>
      </div>

      <FilterPanel
        styles={styles}
        filters={filters}
        filterOptions={filterOptions}
        departments={departments}
        onChangeFilter={handleFilterChange}
        onChangeDate={handleDateChange}
        onClear={clearFilters}
        disabledFields={{ department: isUser, ward: isUser }}
      />

      <Block
        styles={styles}
        title="ตารางสรุปทุกหัวข้อ (เช้า / บ่าย / ดึก / รวม)"
        loading={false}
        error={null}
        empty={!tableRows.length}
      >
        <div style={{ overflowX: "auto" }}>
          <table className={styles.compareTable}>
            <thead>
              <tr>
                <th></th>
                <th>เช้า</th>
                <th>บ่าย</th>
                <th>ดึก</th>
                <th>รวม</th>
                <th>รายละเอียด</th>
              </tr>
            </thead>

            <tbody>
              {tableRows.map((row, i) =>
                row.type === "group" ? (
                  <tr
                    key={`g-${i}`}
                    className={styles.groupRow}
                    style={{ "--group-color": row.color }}
                  >
                    <td colSpan={6} style={{ padding: "12px 16px" }}>
                      {row.title}
                    </td>
                  </tr>
                ) : (
                  <React.Fragment key={`r-${i}`}>
                    <tr>
                      {row.cells.map((c, j) => (
                        <td
                          key={j}
                          style={{
                            textAlign: j === 0 ? "left" : "center",
                          }}
                        >
                          {c}
                        </td>
                      ))}

                      {/* ✅ ปุ่มดูรายละเอียด */}
                      <td
                        style={{
                          background: "#f8fafc",
                          textAlign: "center",
                          cursor: "pointer",
                          fontWeight: 600,
                          color: "#7e3cbd",
                        }}
                        onClick={() => toggleRow(i)}
                      >
                        {expanded === i ? "▲" : "▼"}
                      </td>
                    </tr>

                    {/* ✅ แถวรายละเอียด */}
                    {expanded === i && (
                      <tr className={styles.expandedRow}>
                        <td colSpan={6}>
                          <div>
                            <strong>เช้า:</strong>{" "}
                            {getDetailText(row.cells[0], "morning")}
                          </div>
                          <div>
                            <strong>บ่าย:</strong>{" "}
                            {getDetailText(row.cells[0], "afternoon")}
                          </div>
                          <div>
                            <strong>ดึก:</strong>{" "}
                            {getDetailText(row.cells[0], "night")}
                          </div>
                          <div
                            style={{
                              borderTop: "1px solid #ddd",
                              marginTop: 4,
                              paddingTop: 4,
                            }}
                          >
                            <strong>รวม:</strong>{" "}
                            {getDetailText(row.cells[0], "total")}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              )}
            </tbody>
          </table>
        </div>
      </Block>

      <Block
        styles={styles}
        title={`กราฟแท่ง: ${
          METRIC_FIELDS.find((m) => m.key === barMetric)?.label || ""
        }`}
        loading={false}
        error={null}
        empty={!barData.length}
      >
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 600, marginRight: 8 }}>หัวข้อกราฟ:</label>
          <select
            value={barMetric}
            onChange={(e) => setBarMetric(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #ddd",
            }}
          >
            {METRIC_FIELDS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <ResponsiveContainer width="100%" height={360}>
  <BarChart
    data={[
      {
        label: "รวมเวร",
        morning: metrics.morning[barMetric] || 0,
        afternoon: metrics.afternoon[barMetric] || 0,
        night: metrics.night[barMetric] || 0,
      },
    ]}
    margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
  >
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="label" />
    <YAxis />
    <Tooltip
      formatter={(v) =>
        barMetric === "prodAvg"
          ? `${Number(v).toFixed(2)}%`
          : `${fmt(v)} คน`
      }
    />
    {/* ✅ legend จะโชว์ 3 สีพร้อมชื่อ */}
    <Legend verticalAlign="top" height={36} />
    <Bar dataKey="morning" name="เช้า" fill="#facc15" />
    <Bar dataKey="afternoon" name="บ่าย" fill="#fb923c" />
    <Bar dataKey="night" name="ดึก" fill="#3b82f6" />
  </BarChart>
</ResponsiveContainer>

      </Block>
    </div>
  );
}
