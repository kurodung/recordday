// src/page/Dashboard/NWCWDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../config";
import styles from "../../styles/ORDashboard.module.css";
import stylesmain from "../../styles/Dashboard.module.css";
import Block from "../../components/common/Block";
import TableBox from "../../components/common/TableBox";
import FilterPanel from "../../components/dashboard/FilterPanel";
import { RefreshCw, Activity, Users, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { fmt, shiftLabel, formatThaiDate, buildDateRange } from "../../utils/helpers";

export default function NWCWDashboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    shift: "",
  });

  const [expanded, setExpanded] = useState({ nwcw: true });
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // ---------- โหลดข้อมูล ----------
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
          ? `${API_BASE}/api/nwcw-report/list?${qs.toString()}`
          : `${API_BASE}/api/nwcw-report/list`;

        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: ac.signal,
        });

        if (!res.ok) throw new Error("โหลดข้อมูล NWCW ไม่สำเร็จ");
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

  // ---------- รวมยอด ----------
  const summary = useMemo(() => {
    const sum = (k) => rows.reduce((a, r) => a + (Number(r?.[k]) || 0), 0);
    const special = sum("special");
    const general = sum("general");
    const genspecial = sum("genspecial");
    const specialgen = sum("specialgen");
    const gengen = sum("gengen");
    const echo = sum("echo");
    const cath_lab = sum("cath_lab");
    const dialysis = sum("dialysis");
    const physio_new = sum("physio_new");
    const xray = sum("xray");
    const stay = sum("stay");
    const refer_back = sum("refer_back");
    const refer_out = sum("refer_out");

    const total =
      special + general + genspecial + specialgen + gengen +
      echo + cath_lab + dialysis + physio_new + xray +
      stay + refer_back + refer_out;

    return {
      special, general, genspecial, specialgen, gengen,
      echo, cath_lab, dialysis, physio_new, xray,
      stay, refer_back, refer_out,
      total,
    };
  }, [rows]);

  // ---------- แบ่งหน้า ----------
  const totalPages = Math.ceil(rows.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const pageRows = rows.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // ---------- สรุปบนการ์ด ----------
  const renderCards = () => {
    const cards = [
      {
        label: "รวมทั้งหมด",
        value: fmt(summary.total),
        icon: <Activity size={18} />,
        color: "#7e3cbd",
      },
      { label: "ขอเปลกลับบ้าน (พิเศษ)", value: fmt(summary.special) },
      { label: "ขอเปลกลับบ้าน (สามัญ)", value: fmt(summary.general) },
      { label: "ขอเปลย้าย (สามัญ→พิเศษ)", value: fmt(summary.genspecial) },
      { label: "ขอเปลย้าย (พิเศษ→สามัญ)", value: fmt(summary.specialgen) },
      { label: "ขอเปลย้าย (สามัญ→สามัญ)", value: fmt(summary.gengen) },
      { label: "Echo", value: fmt(summary.echo) },
      { label: "Cath lab", value: fmt(summary.cath_lab) },
      { label: "ไตเทียม", value: fmt(summary.dialysis) },
      { label: "กายภาพรายใหม่", value: fmt(summary.physio_new) },
      { label: "X-ray", value: fmt(summary.xray) },
      { label: "พักในศูนย์", value: fmt(summary.stay) },
      { label: "Refer back", value: fmt(summary.refer_back) },
      { label: "Refer out", value: fmt(summary.refer_out) },
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
                : "4px solid rgba(126,60,189,.2)",
            }}
          >
            <div
              className={styles.summaryCardLabel}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                color: c.color || "#4b0082",
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

  // ---------- Render ----------
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw className={styles.loadingSpinner} size={24} />
        <span className={styles.loadingText}>กำลังโหลดข้อมูล NWCW...</span>
      </div>
    );
  }
  if (error) return <div className={styles.errorContainer}>{error}</div>;

  return (
    <div className={styles.dashboardContainer}>
      {/* Header */}
      <div className={styles.dashboardHeader}>
        <h1 className={styles.dashboardTitle}>Dashboard ศูนย์พักนวชีวา</h1>
        <p className={styles.dashboardSubtitle}>
          สรุปข้อมูลการขอเปลและส่งต่อบริการทั้งหมด
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
            onClick={() => setExpanded((p) => ({ ...p, nwcw: !p.nwcw }))}
          >
            <span>📅 ตารางข้อมูลรายวัน</span>
            {expanded.nwcw ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        }
        loading={false}
        error={null}
        empty={!rows.length}
      >
        {expanded.nwcw && (
          <>
            <div className={stylesmain.tableScroll}>
              <TableBox
                className={stylesmain.logTable}
                headers={[
                  "วันที่",
                  "เวร",
                  "พิเศษ",
                  "สามัญ",
                  "สามัญ→พิเศษ",
                  "พิเศษ→สามัญ",
                  "สามัญ→สามัญ",
                  "Echo",
                  "Cath lab",
                  "ไตเทียม",
                  "กายภาพรายใหม่",
                  "X-ray",
                  "พักในศูนย์",
                  "Refer back",
                  "Refer out",
                ]}
                rows={pageRows.map((r) => [
                  formatThaiDate(r.report_date || r.date),
                  shiftLabel(r.shift),
                  fmt(r.special),
                  fmt(r.general),
                  fmt(r.genspecial),
                  fmt(r.specialgen),
                  fmt(r.gengen),
                  fmt(r.echo),
                  fmt(r.cath_lab),
                  fmt(r.dialysis),
                  fmt(r.physio_new),
                  fmt(r.xray),
                  fmt(r.stay),
                  fmt(r.refer_back),
                  fmt(r.refer_out),
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
        title="👩‍⚕️ ตารางบุคลากร NWCW"
        loading={false}
        error={null}
        empty={!rows.length}
      >
        <div className={stylesmain.tableScroll}>
          <TableBox
            className={stylesmain.logTable}
            headers={["วันที่", "เวร", "PN", "พนักงานเปล", "พนักงานทั่วไป", "หัวหน้าเวร"]}
            rows={pageRows.map((r) => [
              formatThaiDate(r.report_date || r.date),
              shiftLabel(r.shift),
              fmt(r.pn),
              fmt(r.stretcher),
              fmt(r.employee),
              r.head_nurse || "-",
            ])}
          />
        </div>
      </Block>
    </div>
  );
}
