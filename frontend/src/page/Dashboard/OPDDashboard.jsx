// src/page/Dashboard/OPDDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../config";
import styles from "../../styles/ORDashboard.module.css";
import stylesmain from "../../styles/Dashboard.module.css";
import Block from "../../components/common/Block";
import TableBox from "../../components/common/TableBox";
import FilterPanel from "../../components/dashboard/FilterPanel";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { fmt, shiftLabel, formatThaiDate, buildDateRange } from "../../utils/helpers";

export default function OPDDashboard() {
  const [rows, setRows] = useState([]);
  const [rowsSun, setRowsSun] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    shift: "",
  });

  const [expanded, setExpanded] = useState({ opd: true, sun: false });
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // ---------- โหลดข้อมูล ----------
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const qs = buildDateRange(filters);
        if (filters.shift) qs.set("shift", filters.shift);

        const urlMain = qs.toString()
          ? `${API_BASE}/api/opd-report/list?${qs.toString()}`
          : `${API_BASE}/api/opd-report/list`;

        const urlSun = qs.toString()
          ? `${API_BASE}/api/opd-sun-report/list?${qs.toString()}`
          : `${API_BASE}/api/opd-sun-report/list`;

        const [resMain, resSun] = await Promise.all([
          fetch(urlMain, { signal: ac.signal }),
          fetch(urlSun, { signal: ac.signal }),
        ]);

        if (!resMain.ok) throw new Error("โหลดข้อมูล OPD ไม่สำเร็จ");

        const jsonMain = await resMain.json();
        const jsonSun = resSun.ok ? await resSun.json() : [];

        setRows(Array.isArray(jsonMain) ? jsonMain : []);
        setRowsSun(Array.isArray(jsonSun) ? jsonSun : []);
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
    return {
      treat_back: sum("treat_back"),
      admit: sum("admit"),
      rn: sum("rn"),
      pn: sum("pn"),
      na: sum("na"),
      other_staff: sum("other_staff"),
    };
  }, [rows]);

  // ---------- แบ่งหน้า ----------
  const totalPages = Math.ceil(rows.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const pageRows = rows.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // ---------- แสดงการ์ดสรุป ----------
  const renderCards = () => {
    const cards = [
      { label: "ตรวจกลับ", value: fmt(summary.treat_back) },
      { label: "รับไว้", value: fmt(summary.admit) },
      { label: "RN", value: fmt(summary.rn) },
      { label: "PN", value: fmt(summary.pn) },
      { label: "NA", value: fmt(summary.na) },
      { label: "พนักงาน", value: fmt(summary.other_staff) },
    ];
    return (
      <div className={styles.summaryCardsGrid}>
        {cards.map((c, i) => (
          <div key={i} className={styles.summaryCard}>
            <div className={styles.summaryCardLabel}>{c.label}</div>
            <div className={styles.summaryCardValue}>{c.value}</div>
          </div>
        ))}
      </div>
    );
  };

  // ---------- Render ----------
  if (loading)
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw className={styles.loadingSpinner} size={24} />
        <span className={styles.loadingText}>กำลังโหลดข้อมูล OPD...</span>
      </div>
    );
  if (error) return <div className={styles.errorContainer}>{error}</div>;

  return (
    <div className={styles.dashboardContainer}>
      {/* Header */}
      <div className={styles.dashboardHeader}>
        <h1 className={styles.dashboardTitle}>Dashboard ห้องตรวจผู้ป่วยนอก (OPD)</h1>
      </div>

      {/* Filter */}
      <FilterPanel
        filters={filters}
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

      {/* ---------- 1️⃣ ตารางข้อมูลรายวัน ---------- */}
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
            onClick={() => setExpanded((p) => ({ ...p, opd: !p.opd }))}
          >
            <span>📅 ตารางข้อมูลรายวัน</span>
            {expanded.opd ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        }
        loading={false}
        error={null}
        empty={!rows.length}
      >
        {expanded.opd && (
          <>
            <div className={stylesmain.tableScroll}>
              <TableBox
                className={stylesmain.logTable}
                headers={[
                  "วันที่",
                  "เวร",
                  "Subward",
                  "ตรวจกลับ",
                  "รับไว้",
                  "RN",
                  "PN",
                  "NA",
                  "พนักงาน",
                  "หัวหน้าเวร",
                ]}
                rows={pageRows.map((r) => [
                  formatThaiDate(r.report_date),
                  shiftLabel(r.shift),
                  r.subward || "-", // ✅ เพิ่มแสดงชื่อ subward
                  fmt(r.treat_back),
                  fmt(r.admit),
                  fmt(r.rn),
                  fmt(r.pn),
                  fmt(r.na),
                  fmt(r.other_staff),
                  r.head_nurse || "-",
                ])}
              />
            </div>

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

      {/* ---------- 2️⃣ ตารางศูนย์ Admit วันอาทิตย์ ---------- */}
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
            onClick={() => setExpanded((p) => ({ ...p, sun: !p.sun }))}
          >
            <span>📅 ตารางศูนย์ Admit วันอาทิตย์</span>
            {expanded.sun ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        }
        loading={false}
        error={null}
        empty={!rowsSun.length}
      >
        {expanded.sun && (
          <div className={stylesmain.tableScroll}>
            <TableBox
              className={stylesmain.logTable}
              headers={[
                "วันที่",
                "เวร",
                "สูติ-นรีเวช",
                "อายุรกรรม",
                "ศัลยกรรม",
                "กุมารเวช",
                "ทันตกรรม",
                "จักษุ",
                "หู คอ จมูก",
                "ออร์โธปิดิกส์",
                "รวมทั้งหมด",
              ]}
              rows={rowsSun.map((r) => [
                formatThaiDate(r.report_date),
                shiftLabel(r.shift),
                fmt(r.sun_obsgyn),
                fmt(r.sun_Internal),
                fmt(r.sun_surgery),
                fmt(r.sun_ped),
                fmt(r.sun_den),
                fmt(r.sun_eye),
                fmt(r.sun_ent),
                fmt(r.sun_ortho),
                fmt(r.sun_total),
              ])}
            />
          </div>
        )}
      </Block>
    </div>
  );
}
