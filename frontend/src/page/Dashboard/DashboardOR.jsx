import React, { useState, useEffect, useMemo } from "react";
import { API_BASE } from "../../config";
import styles from "../../styles/DashboardOR.module.css";
import stylesmain from "../../styles/Dashboard.module.css"; // 👈 ใช้อันเดียวกัน
import Block from "../../components/common/Block";
import TableBox from "../../components/common/TableBox";
import FilterPanel from "../../components/dashboard/FilterPanel";
import { RefreshCw } from "lucide-react";
import {
  fmt,
  shiftLabel,
  formatThaiDate,
  buildDateRange,
} from "../../utils/helpers";

export default function DashboardOR() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ✅ filter state
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    shift: "",
  });

  // โหลดข้อมูล OR reports
  useEffect(() => {
    const ac = new AbortController();
    const run = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token") || "";
        const qs = buildDateRange(filters); // ✅ start/end
        if (filters.shift) qs.set("shift", filters.shift);

        const res = await fetch(`${API_BASE}/api/or-reports?${qs}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: ac.signal,
        });
        if (!res.ok) throw new Error("โหลด OR reports ไม่สำเร็จ");
        const json = await res.json();
        setRows(json);
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => ac.abort();
  }, [filters]);

  // ✅ รวมยอดทุกคอลัมน์สำคัญ
  const summary = useMemo(() => {
    if (!rows.length) return {};

    const sum = (key) =>
      rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

    return {
      complex: sum("complex"),
      endoscopic: sum("endoscopic"),
      major: sum("major_surgery"),
      minor: sum("minor_surgery"),
      cast: sum("cast"),
      or_small: sum("or_small"),
      ods: sum("ods"),
      eye: sum("eye"),
      covid: sum("covid"),
      smc: sum("smc"),
      rn: sum("rn"),
      pn: sum("pn"),
      na: sum("na"),
      sb: sum("sb"),
      tn: sum("tn"),
      autoclave: sum("autoclave"),
      cssd: sum("cssd"),
      cleaner: sum("cleaner"),
    };
  }, [rows]);

  if (loading)
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw className={styles.loadingSpinner} size={24} />
        <span className={styles.loadingText}>กำลังโหลดข้อมูล OR...</span>
      </div>
    );

  if (error) return <div className={styles.errorContainer}>{error}</div>;

  // ✅ สร้าง summary cards
  const summaryCards = [
    { label: "ผ่าตัดซับซ้อน", value: fmt(summary.complex) },
    { label: "ผ่าตัดผ่านกล้อง", value: fmt(summary.endoscopic) },
    { label: "ผ่าตัดใหญ่", value: fmt(summary.major) },
    { label: "ผ่าตัดเล็ก", value: fmt(summary.minor) },
    { label: "ใส่เฝือก", value: fmt(summary.cast) },
    {
      label: "รวมบุคลากร (RN/PN/NA)",
      value: fmt((summary.rn || 0) + (summary.pn || 0) + (summary.na || 0)),
    },
    { label: "OR เล็ก", value: fmt(summary.or_small) },
    { label: "ODS", value: fmt(summary.ods) },
    { label: "ตา", value: fmt(summary.eye) },
    { label: "Covid", value: fmt(summary.covid) },
    { label: "SMC", value: fmt(summary.smc) },
    { label: "RN", value: fmt(summary.rn) },
    { label: "PN", value: fmt(summary.pn) },
    { label: "NA", value: fmt(summary.na) },
    { label: "เปล", value: fmt(summary.sb) },
    { label: "TN", value: fmt(summary.tn) },
    { label: "Autoclave", value: fmt(summary.autoclave) },
    { label: "CSSD", value: fmt(summary.cssd) },
    { label: "ทำความสะอาด", value: fmt(summary.cleaner) },
  ];

  return (
    <div className={styles.dashboardContainer}>
      {/* Header */}
      <div className={styles.dashboardHeader}>
        <h1 className={styles.dashboardTitle}>📌 Dashboard OR (ห้องผ่าตัด)</h1>
        <p className={styles.dashboardSubtitle}>
          ภาพรวมข้อมูลการผ่าตัดและกำลังคน OR
        </p>
      </div>

      {/* Filter */}
      <FilterPanel
        filters={filters}
        filterOptions={{}}
        departments={[]}
        onChangeFilter={(e) =>
          setFilters({ ...filters, [e.target.name]: e.target.value })
        }
        onChangeDate={(e) =>
          setFilters({ ...filters, [e.target.name]: e.target.value })
        }
        onClear={() => setFilters({ startDate: "", endDate: "", shift: "" })}
      />

      {/* การ์ดสรุป */}
      <div className={styles.summaryCardsGrid}>
        {summaryCards.map((card, i) => (
          <div key={i} className={styles.summaryCard}>
            <div className={styles.summaryCardLabel}>{card.label}</div>
            <div className={styles.summaryCardValue}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* ตารางรายละเอียด */}
      <Block
        styles={stylesmain}
        title="ตาราง OR รายการ"
        loading={loading}
        error={error}
        empty={!rows.length}
      >
        <div className={stylesmain.tableScroll}>
          <TableBox
            className={stylesmain.logTable} // ✅ บังคับใช้ style แบบ dashboard หลัก
            headers={[
              "วันที่",
              "เวร",
              "ซับซ้อน",
              "ผ่านกล้อง",
              "ผ่าตัดใหญ่",
              "ผ่าตัดเล็ก",
              "ใส่เฝือก",
              "OR เล็ก",
              "ODS",
              "ตา",
              "Covid",
              "SMC",
              "RN",
              "PN",
              "NA",
              "เปล",
              "TN",
              "หม้อนึ่ง",
              "พ.จ่ายกลาง",
              "พ.ทำความสะอาด",
              "หัวหน้าเวร",
            ]}
            rows={rows.map((r) => [
              formatThaiDate(r.report_date),
              shiftLabel(r.shift),
              fmt(r.complex),
              fmt(r.endoscopic),
              fmt(r.major_surgery),
              fmt(r.minor_surgery),
              fmt(r.cast),
              fmt(r.or_small),
              fmt(r.ods),
              fmt(r.eye),
              fmt(r.covid),
              fmt(r.smc),
              fmt(r.rn),
              fmt(r.pn),
              fmt(r.na),
              fmt(r.sb),
              fmt(r.tn),
              fmt(r.autoclave),
              fmt(r.cssd),
              fmt(r.cleaner),
              r.head_nurse || "-",
            ])}
          />
        </div>
      </Block>
    </div>
  );
}
