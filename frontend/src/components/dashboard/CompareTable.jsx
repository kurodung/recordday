import React, { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import {
  SPECIAL_WARDS,
  ICUAD_WARDS,
  ICUCH_WARDS,
  Semi_ICU,
  Newborn,
  NORMAL_WARDS,
  ICU_Ven,
  AD_Ven,
  CH_Ven,
} from "../../constants/wards";



export default function CompareTable({ tableRows, sumByShift, styles }) {
  const [expanded, setExpanded] = useState(null);
  const toggleRow = (index) => setExpanded((prev) => (prev === index ? null : index));

  // ✅ ฟังก์ชันแยกดึงรายละเอียดต่อเวร
  // ✅ ฟังก์ชันแยกดึงรายละเอียดต่อเวร
  const getDetailText = (name, shiftKey) => {
    const rows = sumByShift[shiftKey] || [];
    const lower = String(name).toLowerCase();
    const n = (v) => Number(v) || 0;

    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()\-_.]/g, "");

    const matchWard = (r, wardList) => {
      const w = norm(r.wardname);
      const s = norm(r.subward);
      const SINGLE = wardList.map(norm);
      return SINGLE.some((x) => w.includes(x) || s.includes(x));
    };

    let targetRows = [];

    // -------- 🏥 กลุ่มคงพยาบาล --------
    if (lower.includes("วอร์ดทั้งหมด")) {
      targetRows = rows.filter(
        (r) =>
          !matchWard(r, SPECIAL_WARDS) &&
          !matchWard(r, ICUAD_WARDS) &&
          !matchWard(r, ICUCH_WARDS) &&
          !matchWard(r, Semi_ICU) &&
          !matchWard(r, Newborn)
      );
    } else if (lower.includes("วอร์ดพิเศษ")) {
      targetRows = rows.filter((r) => matchWard(r, SPECIAL_WARDS));
    } else if (lower.includes("icu - ผู้ใหญ่")) {
      targetRows = rows.filter((r) => matchWard(r, ICUAD_WARDS));
    } else if (lower.includes("icu - เด็ก")) {
      targetRows = rows.filter((r) => matchWard(r, ICUCH_WARDS));
    } else if (lower.includes("semi icu")) {
      targetRows = rows.filter((r) => matchWard(r, Semi_ICU));
    } else if (lower.includes("ทารก")) {
      targetRows = rows.filter((r) => matchWard(r, Newborn));
    }

    // -------- 🫁 กลุ่ม Ventilator --------
    else if (lower.includes("ventilator - icu")) {
      targetRows = rows.filter((r) => {
        const w = String(r.wardname || "").toLowerCase();
        const s = String(r.subward || "").toLowerCase();
        return ICU_Ven.some(
          (v) => w.includes(v.toLowerCase()) || s.includes(v.toLowerCase())
        );
      });
    } else if (lower.includes("ventilator - ผู้ใหญ่")) {
      targetRows = rows.filter((r) => {
        const w = String(r.wardname || "").toLowerCase();
        const s = String(r.subward || "").toLowerCase();
        return AD_Ven.some(
          (v) => w.includes(v.toLowerCase()) || s.includes(v.toLowerCase())
        );
      });
    } else if (lower.includes("ventilator - เด็ก")) {
      targetRows = rows.filter((r) => {
        const w = String(r.wardname || "").toLowerCase();
        const s = String(r.subward || "").toLowerCase();
        return CH_Ven.some(
          (v) => w.includes(v.toLowerCase()) || s.includes(v.toLowerCase())
        );
      });
    } else if (lower.includes("ventilator - รวม")) {
      targetRows = rows.filter(
        (r) =>
          n(r.vent_invasive) + n(r.vent_noninvasive) > 0
      );
    }

    // -------- 🧠 กลุ่มอื่น ๆ --------
    else if (lower.includes("stroke")) {
      targetRows = rows.filter((r) => n(r.stroke) > 0);
    } else if (lower.includes("จิตเวช")) {
      targetRows = rows.filter((r) => n(r.psych) > 0);
    } else if (lower.includes("นักโทษ")) {
      targetRows = rows.filter((r) => n(r.prisoner) > 0);
    }

    // -------- 🔚 สร้างข้อความแสดงผล --------
   if (!targetRows.length) return "-";

return targetRows
  .map((r) => {
    let value = 0;
    // ดึงค่าตามหัวข้อจริง ๆ ที่ตรงกับ name
    if (lower.includes("ventilator")) {
      value = n(r.vent_invasive) + n(r.vent_noninvasive);
    } else if (lower.includes("stroke")) {
      value = n(r.stroke);
    } else if (lower.includes("จิตเวช")) {
      value = n(r.psych);
    } else if (lower.includes("นักโทษ")) {
      value = n(r.prisoner);
    } else {
      // คงพยาบาล, วอร์ดพิเศษ ฯลฯ
      value = n(r.bed_remain);
    }
    return `${r.subward || r.wardname || "-"} (${value} คน)`;
  })
  .join(", ");

  };



  return (
    <div style={{ width: "100%" }}>
      <table className={styles.compareTable}>
        <thead>
          <tr>
            <th style={{ background: "#f3f4f6" }}>หัวข้อ</th>
            <th style={{ background: "#fff7cc" }}>เช้า</th>
            <th style={{ background: "#ffe5b4" }}>บ่าย</th>
            <th style={{ background: "#cce0ff" }}>ดึก</th>
            <th style={{ background: "#ede9fe" }}>รวม</th>
            <th style={{ background: "#e2e8f0" }}>รายละเอียด</th>
          </tr>
        </thead>

        <tbody>
          {tableRows.map((row, i) => {
            const name = String(row[0] || "").toLowerCase();
            const hasDetail = ["คงพยาบาล", "vent", "stroke", "จิตเวช", "นักโทษ"].some((k) =>
              name.includes(k)
            );

            return (
              <React.Fragment key={i}>
                <tr>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      style={{
                        background:
                          j === 1
                            ? "#fffbee"
                            : j === 2
                            ? "#fff0e0"
                            : j === 3
                            ? "#e7f0ff"
                            : j === 4
                            ? "#f3e8ff"
                            : "white",
                        padding: "6px 10px",
                        borderBottom: "1px solid #eee",
                        textAlign: j === 0 ? "left" : "center",
                      }}
                    >
                      {cell}
                    </td>
                  ))}

                  {/* ปุ่มดูรายละเอียด */}
                  <td
                    style={{
                      background: "#f8fafc",
                      textAlign: "center",
                      cursor: hasDetail ? "pointer" : "default",
                    }}
                    onClick={() => hasDetail && toggleRow(i)}
                  >
                    {hasDetail ? (
                      expanded === i ? (
                        <FiChevronUp color="#7e3cbd" />
                      ) : (
                        <FiChevronDown color="#7e3cbd" />
                      )
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>

                {/* แถวแสดงรายละเอียด */}
                {expanded === i && hasDetail && (
                  <tr className={styles.expandedRow}>
                    <td colSpan={6}>
                      <div>
                        <strong>เช้า:</strong> {getDetailText(row[0], "morning")}
                      </div>
                      <div>
                        <strong>บ่าย:</strong> {getDetailText(row[0], "afternoon")}
                      </div>
                      <div>
                        <strong>ดึก:</strong> {getDetailText(row[0], "night")}
                      </div>
                      <div style={{ borderTop: "1px solid #eee", marginTop: 4, paddingTop: 4 }}>
                        <strong>รวม:</strong> {getDetailText(row[0], "total")}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
