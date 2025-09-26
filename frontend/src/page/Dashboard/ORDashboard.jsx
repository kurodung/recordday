import React, { useState, useEffect, useMemo } from "react";
import { API_BASE } from "../../config";
import styles from "../../styles/ORDashboard.module.css";
import stylesmain from "../../styles/Dashboard.module.css";
import Block from "../../components/common/Block";
import TableBox from "../../components/common/TableBox";
import FilterPanel from "../../components/dashboard/FilterPanel";
import {
  RefreshCw,
  TrendingUp,
  Users,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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

  // ✅ state สำหรับพับ/ขยายตาราง
  const [expandedTables, setExpandedTables] = useState({
    surgery: true,
    staff: true,
    support: true,
  });

  // ✅ Pagination states
  const [currentPage, setCurrentPage] = useState({
    surgery: 1,
    staff: 1,
    support: 1,
  });

  const ITEMS_PER_PAGE = 10; // จำนวนรายการต่อหน้า

  // โหลดข้อมูล OR reports
  useEffect(() => {
    const ac = new AbortController();
    const run = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token") || "";
        const qs = buildDateRange(filters);
        if (filters.shift) qs.set("shift", filters.shift);

        const res = await fetch(`${API_BASE}/api/or-reports?${qs}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: ac.signal,
        });
        if (!res.ok) throw new Error("โหลด OR reports ไม่สำเร็จ");
        const json = await res.json();
        setRows(json);

        // Reset pagination เมื่อข้อมูลเปลี่ยน
        setCurrentPage({ surgery: 1, staff: 1, support: 1 });
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => ac.abort();
  }, [filters]);

  // ✅ คำนวณข้อมูลแบ่งหน้าสำหรับแต่ละตาราง
  const paginationData = useMemo(() => {
    const createPagination = (tableName) => {
      const page = currentPage[tableName];
      const totalItems = rows.length;
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
      const startIndex = (page - 1) * ITEMS_PER_PAGE;
      const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
      const pageRows = rows.slice(startIndex, endIndex);

      return {
        page,
        totalPages,
        totalItems,
        startIndex,
        endIndex,
        pageRows,
      };
    };

    return {
      surgery: createPagination("surgery"),
      staff: createPagination("staff"),
      support: createPagination("support"),
    };
  }, [rows, currentPage]);

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
      totalSurgery:
        sum("complex") +
        sum("endoscopic") +
        sum("major_surgery") +
        sum("minor_surgery"),
      totalStaff: sum("rn") + sum("pn") + sum("na"),
      totalSupport: sum("autoclave") + sum("cssd") + sum("cleaner"),
    };
  }, [rows]);

  const toggleTable = (tableName) => {
    setExpandedTables((prev) => ({
      ...prev,
      [tableName]: !prev[tableName],
    }));
  };

  const setPage = (tableName, page) => {
    setCurrentPage((prev) => ({
      ...prev,
      [tableName]: page,
    }));
  };

  // ✅ Component สำหรับ Pagination
  const renderPagination = (tableName) => {
    const { page, totalPages, totalItems } = paginationData[tableName];

    if (totalPages <= 1) return null;

    return (
      <div className={stylesmain.pagination}>
        <button
          className={stylesmain.pageBtn}
          onClick={() => setPage(tableName, 1)}
          disabled={page === 1}
        >
          « หน้าแรก
        </button>
        <button
          className={stylesmain.pageBtn}
          onClick={() => setPage(tableName, Math.max(1, page - 1))}
          disabled={page === 1}
        >
          ‹ ก่อนหน้า
        </button>

        <span className={stylesmain.pageInfo}>
          หน้า {page} / {totalPages} • ทั้งหมด{" "}
          {totalItems.toLocaleString("th-TH")} รายการ
        </span>

        <button
          className={stylesmain.pageBtn}
          onClick={() => setPage(tableName, Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
        >
          ถัดไป ›
        </button>
        <button
          className={stylesmain.pageBtn}
          onClick={() => setPage(tableName, totalPages)}
          disabled={page === totalPages}
        >
          หน้าสุดท้าย »
        </button>
      </div>
    );
  };

  if (loading)
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw className={styles.loadingSpinner} size={24} />
        <span className={styles.loadingText}>กำลังโหลดข้อมูล OR...</span>
      </div>
    );

  if (error) return <div className={styles.errorContainer}>{error}</div>;

  // ✅ จัดกลุ่มการ์ดสรุปให้ดูง่าย
  const keyMetrics = [
    {
      label: "🏥 รวมผ่าตัดทั้งหมด",
      value: fmt(summary.totalSurgery),
      icon: <Activity size={20} />,
      color: "#dc2626",
    },
    {
      label: "👥 รวมบุคลากรพยาบาล(rn+pn+na)",
      value: fmt(summary.totalStaff),
      icon: <Users size={20} />,
      color: "#059669",
    },
    {
      label: "🔧 รวมบุคลากรสนับสนุน",
      value: fmt(summary.totalSupport),
      icon: <TrendingUp size={20} />,
      color: "#9333ea",
    },
  ];

  const surgeryDetails = [
    { label: "ผ่าตัดซับซ้อน", value: fmt(summary.complex), highlight: true },
    { label: "ผ่าตัดผ่านกล้อง", value: fmt(summary.endoscopic) },
    { label: "ผ่าตัดใหญ่", value: fmt(summary.major), highlight: true },
    { label: "ผ่าตัดเล็ก", value: fmt(summary.minor) },
    { label: "ใส่เฝือก", value: fmt(summary.cast) },
    { label: "OR เล็ก", value: fmt(summary.or_small) },
    { label: "ODS", value: fmt(summary.ods) },
    { label: "ตา", value: fmt(summary.eye) },
    { label: "Covid", value: fmt(summary.covid) },
    { label: "SMC", value: fmt(summary.smc) },
  ];

  const staffDetails = [
    { label: "RN", value: fmt(summary.rn), highlight: true },
    { label: "PN", value: fmt(summary.pn), highlight: true },
    { label: "NA", value: fmt(summary.na), highlight: true },
    { label: "พ.เปล", value: fmt(summary.sb) },
    { label: "TN", value: fmt(summary.tn) },
  ];

  const supportDetails = [
    { label: "หม้อนึ่ง", value: fmt(summary.autoclave) },
    { label: "พ.จ่ายกลาง", value: fmt(summary.cssd) },
    { label: "พ.ทำความสะอาด", value: fmt(summary.cleaner) },
  ];

  const renderCardSection = (title, cards, bgColor = "white") => (
    <div style={{ marginBottom: "24px" }}>
      <h3
        style={{
          fontSize: "18px",
          fontWeight: "600",
          marginBottom: "16px",
          color: "#374151",
          borderLeft: "4px solid #9333ea",
          paddingLeft: "12px",
        }}
      >
        {title}
      </h3>
      <div className={styles.summaryCardsGrid}>
        {cards.map((card, i) => (
          <div
            key={i}
            className={styles.summaryCard}
            style={{
              backgroundColor: bgColor,
              border: card.highlight
                ? "2px solid #ffffffff"
                : "1px solid rgba(147, 51, 234, 0.15)",
              ...(card.color && { borderLeft: `4px solid ${card.color}` }),
            }}
          >
            <div
              className={styles.summaryCardLabel}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: card.color || "#000000ff",
              }}
            >
              {card.icon}
              {card.label}
            </div>
            <div
              className={styles.summaryCardValue}
              style={{
                color: card.color || "#111827",
                fontSize: card.icon ? "28px" : "24px",
              }}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ✅ Function สำหรับสร้างตารางแยกส่วนพร้อม pagination
  const renderSectionTable = (
    title,
    headers,
    dataExtractor,
    tableName,
    color = "#9333ea"
  ) => {
    const { pageRows, totalItems } = paginationData[tableName];

    return (
      <Block
        styles={stylesmain}
        title={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              userSelect: "none",
            }}
            onClick={() => toggleTable(tableName)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {title}
              {totalItems > 0 && (
                <span
                  style={{
                    backgroundColor: color,
                    color: "white",
                    padding: "4px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: "600",
                  }}
                >
                  {totalItems} รายการ
                </span>
              )}
            </div>
            {expandedTables[tableName] ? (
              <ChevronUp size={20} />
            ) : (
              <ChevronDown size={20} />
            )}
          </div>
        }
        loading={loading}
        error={error}
        empty={!rows.length}
      >
        {expandedTables[tableName] && (
          <>
            <div className={stylesmain.tableScroll}>
              <TableBox
                className={stylesmain.logTable}
                headers={headers}
                rows={pageRows.map(dataExtractor)}
              />
            </div>
            {renderPagination(tableName)}
          </>
        )}
      </Block>
    );
  };

  return (
    <div className={styles.dashboardContainer}>
      {/* Header */}
      <div className={styles.dashboardHeader}>
        <h1 className={styles.dashboardTitle}>📌 Dashboard OR (ห้องผ่าตัด)</h1>
        <p className={styles.dashboardSubtitle}>
          ภาพรวมข้อมูลการผ่าตัดและกำลังคน OR
          {rows.length > 0 && (
            <span style={{ marginLeft: "16px", opacity: 0.8 }}>
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

      {/* การ์ดสรุปหลัก */}
      {renderCardSection("📈 สรุปภาพรวม", keyMetrics)}

      {/* รายละเอียดการผ่าตัด */}
      {renderCardSection("🏥 รายละเอียดการผ่าตัด", surgeryDetails, "#ffffff")}

      {/* รายละเอียดบุคลากร */}
      {renderCardSection("👥 บุคลากรพยาบาล", staffDetails, "#ffffff")}

      {/* รายละเอียดสนับสนุน */}
      {renderCardSection("🔧 บุคลากรสนับสนุน", supportDetails, "#ffffff")}

      {/* ตารางแยกส่วน - การผ่าตัด */}
      {renderSectionTable(
        "🏥 ตารางการผ่าตัดรายวัน",
        [
          "📅 วันที่",
          "⏰ เวร",
          "🔴 ซับซ้อน",
          "🔍 ผ่านกล้อง",
          "🏥 ผ่าตัดใหญ่",
          "⚡ ผ่าตัดเล็ก",
          "🦴 ใส่เฝือก",
          "🏠 OR เล็ก",
          "💊 ODS",
          "👁️ ตา",
          "😷 Covid",
          "🏢 SMC",
        ],
        (r) => [
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
        ],
        "surgery",
        "#dc2626"
      )}

      {/* ตารางแยกส่วน - บุคลากรพยาบาล */}
      {renderSectionTable(
        "👥 ตารางบุคลากรพยาบาลรายวัน",
        [
          "📅 วันที่",
          "⏰ เวร",
          "👩‍⚕️ RN",
          "👨‍⚕️ PN",
          "👩‍🔬 NA",
          "🛏️ พ.เปล",
          "🚑 TN",
          "👑 หัวหน้าเวร",
        ],
        (r) => [
          formatThaiDate(r.report_date),
          shiftLabel(r.shift),
          fmt(r.rn),
          fmt(r.pn),
          fmt(r.na),
          fmt(r.sb),
          fmt(r.tn),
          r.head_nurse || "-",
        ],
        "staff",
        "#059669"
      )}

      {/* ตารางแยกส่วน - บุคลากรสนับสนุน */}
      {renderSectionTable(
        "🔧 ตารางบุคลากรสนับสนุนรายวัน",
        [
          "📅 วันที่",
          "⏰ เวร",
          "🔥 หม้อนึ่ง",
          "📦 พ.จ่ายกลาง",
          "🧽 พ.ทำความสะอาด",
        ],
        (r) => [
          formatThaiDate(r.report_date),
          shiftLabel(r.shift),
          fmt(r.autoclave),
          fmt(r.cssd),
          fmt(r.cleaner),
        ],
        "support",
        "#9333ea"
      )}
    </div>
  );
}
