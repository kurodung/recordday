// src/page/Dashboard/EndoDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../config";
import styles from "../../styles/ORDashboard.module.css";
import stylesmain from "../../styles/Dashboard.module.css";
import Block from "../../components/common/Block";
import TableBox from "../../components/common/TableBox";
import FilterPanel from "../../components/dashboard/FilterPanel";
import {
  RefreshCw,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { fmt, shiftLabel, formatThaiDate, buildDateRange } from "../../utils/helpers";

export default function EndoDashboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    shift: "",
  });

  const [expanded, setExpanded] = useState({ endo: true });
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // โหลดข้อมูล Endo
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem("token") || "";
        const qs = buildDateRange(filters);
        if (filters.shift) qs.set("shift", filters.shift);

        const url = qs.toString()
          ? `${API_BASE}/api/endo-report/list?${qs.toString()}`
          : `${API_BASE}/api/endo-report/list`;

        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: ac.signal,
        });

        if (!res.ok) throw new Error("โหลด Endo reports ไม่สำเร็จ");
        const json = await res.json();
        setRows(Array.isArray(json) ? json : []);
        setPage(1);
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [filters]);

  // รวมยอด
  const summary = useMemo(() => {
    const sum = (k) => rows.reduce((a, r) => a + (Number(r?.[k]) || 0), 0);
    const complex = sum("complex");
    const upgi = sum("upgi");
    const lowgi = sum("lowgi");
    const chest = sum("chest");
    return {
      complex,
      upgi,
      lowgi,
      chest,
      total: complex + upgi + lowgi + chest,
    };
  }, [rows]);

  // แบ่งหน้า
  const totalPages = Math.ceil(rows.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const pageRows = rows.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const renderCards = () => {
    const cards = [
      {
        label: "รวมทั้งหมด",
        value: fmt(summary.total),
        icon: <Activity size={18} />,
        color: "#9333ea",
      },
      { label: "ECHO", value: fmt(summary.complex) },
      { label: "EST", value: fmt(summary.upgi) },
      { label: "HOLTER", value: fmt(summary.lowgi) },
      { label: "TEE", value: fmt(summary.chest) },
    ];
    return (
      <div className={styles.summaryCardsGrid}>
        {cards.map((c, i) => (
          <div
            key={i}
            className={styles.summaryCard}
            style={{
              backgroundColor: "white",
              borderLeft: c.color
                ? `4px solid ${c.color}`
                : "4px solid rgba(147,51,234,.2)",
            }}
          >
            <div
              className={styles.summaryCardLabel}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                color: c.color || "#374151",
              }}
            >
              {c.icon} {c.label}
            </div>
            <div
              className={styles.summaryCardValue}
              style={{ color: c.color || "#111827" }}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw className={styles.loadingSpinner} size={24} />
        <span className={styles.loadingText}>กำลังโหลดข้อมูล Endo...</span>
      </div>
    );
  }
  if (error) return <div className={styles.errorContainer}>{error}</div>;

  return (
    <div className={styles.dashboardContainer}>
      {/* Header */}
      <div className={styles.dashboardHeader}>
        <h1 className={styles.dashboardTitle}>🫀 Endoscopy Dashboard</h1>
        <p className={styles.dashboardSubtitle}>
          สรุปบริการ (ECHO, EST, HOLTER, TEE)
          {rows.length > 0 && (
            <span style={{ marginLeft: 16, opacity: 0.8 }}>
              📊 รวม {rows.length.toLocaleString("th-TH")} รายการ
            </span>
          )}
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

      {/* Cards */}
      <div style={{ marginBottom: 24 }}>{renderCards()}</div>

      {/* ตารางรายวัน */}
      <Block
        styles={stylesmain}
        title={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
            onClick={() => setExpanded((p) => ({ ...p, endo: !p.endo }))}
          >
            <span>📅 ตารางบริการรายวัน (Endo)</span>
            {expanded.endo ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        }
        loading={false}
        error={null}
        empty={!rows.length}
      >
        {expanded.endo && (
          <>
            <div className={stylesmain.tableScroll}>
              <TableBox
                className={stylesmain.logTable}
                headers={["วันที่", "เวร", "ECHO", "EST", "HOLTER", "TEE"]}
                rows={pageRows.map((r) => [
                  formatThaiDate(r.report_date || r.date),
                  shiftLabel(r.shift),
                  fmt(r.complex),
                  fmt(r.upgi),
                  fmt(r.lowgi),
                  fmt(r.chest),
                ])}
              />
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={stylesmain.pagination}>
                <button
                  className={stylesmain.pageBtn}
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                >
                  « หน้าแรก
                </button>
                <button
                  className={stylesmain.pageBtn}
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  ‹ ก่อนหน้า
                </button>
                <span className={stylesmain.pageInfo}>
                  หน้า {page} / {totalPages} • ทั้งหมด{" "}
                  {rows.length.toLocaleString("th-TH")} รายการ
                </span>
                <button
                  className={stylesmain.pageBtn}
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                >
                  ถัดไป ›
                </button>
                <button
                  className={stylesmain.pageBtn}
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                >
                  หน้าสุดท้าย »
                </button>
              </div>
            )}
          </>
        )}
      </Block>

      {/* ตารางบุคลากร */}
      <Block
        styles={stylesmain}
        title="👩‍⚕️ ตารางบุคลากร Endo"
        loading={false}
        error={null}
        empty={!rows.length}
      >
        <div className={stylesmain.tableScroll}>
          <TableBox
            className={stylesmain.logTable}
            headers={[
              "วันที่",
              "เวร",
              "RN",
              "PN",
              "NA",
              "พนักงาน",
              "เฉพาะ RN ขึ้นเสริม",
              "RN ปรับลด",
            ]}
            rows={pageRows.map((r) => [
              formatThaiDate(r.report_date || r.date),
              shiftLabel(r.shift),
              fmt(r.rn),
              fmt(r.pn),
              fmt(r.na),
              fmt(r.other_staff),
              fmt(r.rn_extra),
              fmt(r.rn_down),
            ])}
          />
        </div>
      </Block>
    </div>
  );
}
