// src/page/Dashboard/ERDashboard.jsx
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
  Users,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  fmt,
  shiftLabel,
  formatThaiDate,
  buildDateRange,
} from "../../utils/helpers";

export default function ERDashboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    shift: "",
  });

  const [expanded, setExpanded] = useState({ er: true });
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
          ? `${API_BASE}/api/er-report/list?${qs.toString()}`
          : `${API_BASE}/api/er-report/list`;

        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: ac.signal,
        });

        if (!res.ok) throw new Error("โหลดข้อมูล ER ไม่สำเร็จ");
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

    const treat_back = sum("treat_back");
    const admit = sum("admit");
    const wait_treat = sum("wait_treat");
    const not_wait = sum("not_wait");
    const deny_treat = sum("deny_treat");
    const opd = sum("opd");
    const refer_out = sum("refer_out");
    const refer_back = sum("refer_back");
    const death = sum("death");

    const r = sum("r");
    const e = sum("e");
    const u = sum("u");
    const l = sum("l");
    const n = sum("n");

    const ems = sum("ems");
    const forensic = sum("forensic");
    const ou = sum("ou");
    const ari = sum("ari");
    const pui = sum("pui");
    const sawb = sum("sawb");
    const cpr = sum("cpr");

    const stroke = sum("stroke");
    const stemi = sum("stemi");
    const sepsis = sum("sepsis");
    const trauma = sum("trauma");
    const ectopic = sum("ectopic");
    const pass = sum("pass");

    const rn = sum("rn");
    const pn = sum("pn");
    const emt = sum("emt");
    const employee = sum("employee");

    return {
      treat_back,
      admit,
      wait_treat,
      not_wait,
      deny_treat,
      opd,
      refer_out,
      refer_back,
      death,
      r,
      e,
      u,
      l,
      n,
      ems,
      forensic,
      ou,
      ari,
      pui,
      sawb,
      cpr,
      stroke,
      stemi,
      sepsis,
      trauma,
      ectopic,
      pass,
      rn,
      pn,
      emt,
      employee,
    };
  }, [rows]);

  // ---------- แบ่งหน้า ----------
  const totalPages = Math.ceil(rows.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const pageRows = rows.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // ---------- แสดงการ์ดสรุป ----------
  const renderCards = () => {
    const cards = [
      { label: "ตรวจกลับบ้าน", value: fmt(summary.treat_back) },
      { label: "รับไว้", value: fmt(summary.admit) },
      { label: "รอตรวจ", value: fmt(summary.wait_treat) },
      { label: "ไม่รอ", value: fmt(summary.not_wait) },
      { label: "ปฏิเสธรักษา", value: fmt(summary.deny_treat) },
      { label: "ส่ง OPD", value: fmt(summary.opd) },
      { label: "Refer out", value: fmt(summary.refer_out) },
      { label: "Refer back", value: fmt(summary.refer_back) },
      { label: "เสียชีวิต", value: fmt(summary.death) },
      { label: "EMS", value: fmt(summary.ems) },
      { label: "CPR", value: fmt(summary.cpr) },
      { label: "Stroke", value: fmt(summary.stroke) },
      { label: "STEMI", value: fmt(summary.stemi) },
      { label: "Sepsis", value: fmt(summary.sepsis) },
      { label: "Trauma", value: fmt(summary.trauma) },
      { label: "Ectopic", value: fmt(summary.ectopic) },
      { label: "Fast Pass", value: fmt(summary.pass) },
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
        <span className={styles.loadingText}>กำลังโหลดข้อมูล ER...</span>
      </div>
    );
  }
  if (error) return <div className={styles.errorContainer}>{error}</div>;

  return (
    <div className={styles.dashboardContainer}>
      {/* Header */}
      <div className={styles.dashboardHeader}>
        <h1 className={styles.dashboardTitle}>Dashboard ห้องอุบัติเหตุ (ER)</h1>
        <p className={styles.dashboardSubtitle}>
          สรุปข้อมูลการให้บริการผู้ป่วยฉุกเฉิน
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

      {/* ตารางข้อมูลรายวัน */}
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
            onClick={() => setExpanded((p) => ({ ...p, er: !p.er }))}
          >
            <span>📅 ตารางข้อมูลรายวัน</span>
            {expanded.er ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        }
        loading={false}
        error={null}
        empty={!rows.length}
      >
        {expanded.er && (
          <>
            <div className={stylesmain.tableScroll}>
              <TableBox
                className={stylesmain.logTable}
                headers={[
                  "วันที่",
                  "เวร",
                  "ตรวจกลับบ้าน",
                  "รับไว้",
                  "รอตรวจ",
                  "ไม่รอ",
                  "ปฏิเสธรักษา",
                  "OPD",
                  "Refer out",
                  "Refer back",
                  "เสียชีวิต",
                  "R",
                  "E",
                  "U",
                  "L",
                  "N",
                ]}
                rows={pageRows.map((r) => [
                  formatThaiDate(r.report_date || r.date),
                  shiftLabel(r.shift),
                  fmt(r.treat_back),
                  fmt(r.admit),
                  fmt(r.wait_treat),
                  fmt(r.not_wait),
                  fmt(r.deny_treat),
                  fmt(r.opd),
                  fmt(r.refer_out),
                  fmt(r.refer_back),
                  fmt(r.death),
                  fmt(r.r),
                  fmt(r.e),
                  fmt(r.u),
                  fmt(r.l),
                  fmt(r.n),
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

      {/* ตารางข้อมูลรายวัน (กลุ่มอาการ/เหตุการณ์) */}
      <Block
        styles={stylesmain}
        title="🧾 ตารางข้อมูลรายวัน (กลุ่มอาการ/เหตุการณ์)"
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
              "EMS",
              "นิติเวช",
              "OU",
              "ARI",
              "PUI",
              "swab",
              "CPR",
              "Stroke",
              "STEMI",
              "Sepsis",
              "Trauma",
              "Ectopic",
              "Fast Pass",
            ]}
            rows={pageRows.map((r) => [
              formatThaiDate(r.report_date || r.date),
              shiftLabel(r.shift),
              fmt(r.ems),
              fmt(r.forensic),
              fmt(r.ou),
              fmt(r.ari),
              fmt(r.pui),
              fmt(r.sawb),
              fmt(r.cpr),
              fmt(r.stroke),
              fmt(r.stemi),
              fmt(r.sepsis),
              fmt(r.trauma),
              fmt(r.ectopic),
              fmt(r.pass),
            ])}
          />
        </div>
      </Block>

      {/* ตารางบุคลากร */}
      <Block
        styles={stylesmain}
        title="👩‍⚕️ ตารางบุคลากร ER"
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
              "EMT",
              "พนักงาน",
              "หัวหน้าเวร",
            ]}
            rows={pageRows.map((r) => [
              formatThaiDate(r.report_date || r.date),
              shiftLabel(r.shift),
              fmt(r.rn),
              fmt(r.pn),
              fmt(r.emt),
              fmt(r.employee),
              r.head_nurse || "-",
            ])}
          />
        </div>
      </Block>
    </div>
  );
}
