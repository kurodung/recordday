// src/pages/MultiDayReportStatus.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "../styles/ReportStatus.module.css";

/* ---------------------- helpers ---------------------- */
const isYMD = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

const localISODate = (d = new Date()) => {
  if (typeof d === "string") return isYMD(d) ? d : "";
  const dt = new Date(d);
  if (Number.isNaN(dt)) return "";
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 10);
};

const addDays = (ymd, n) => {
  if (!isYMD(ymd)) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt)) return "";
  dt.setDate(dt.getDate() + n);
  return localISODate(dt);
};

// "YYYY-MM-DD" -> "DD/MM/YYYY"
const dmy = (ymd) =>
  isYMD(ymd) ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : "";

// true ถ้าตรงกับเสาร์/อาทิตย์
const isWeekend = (ymd) => {
  if (!isYMD(ymd)) return false;
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = new Date(y, m - 1, d).getDay(); // 0=Sun ... 6=Sat
  return wd === 0 || wd === 6;
};
/* ----------------------------------------------------- */

// ใช้ ENV ได้ ถ้าไม่ตั้งจะ fallback เป็น localhost:5000
const API_BASE =
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) ||
  "http://localhost:5000/api";

// จำนวนวอร์ดต่อหน้า
const PAGE_SIZE = 15;

export default function MultiDayReportStatus() {
  const today = localISODate(new Date());

  // 🔒 ช่วง = 7 วัน โดยยึด endDate (start = end-6)
  const [endDate, setEndDate] = useState(today);
  const startDate = useMemo(() => addDays(endDate, -6), [endDate]);

  // filters
  const [wardFilter, setWardFilter] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [departments, setDepartments] = useState([]); // ["อายุรกรรม", "ศัลยกรรม", ...]
  const [department, setDepartment] = useState("");   // "" = ทั้งหมด

  // data
  const [dataByWard, setDataByWard] = useState({}); // { wardname: [ {date, morning, afternoon, night} ] }
  const [summary, setSummary] = useState([]);       // [{wardname, sent, totalShifts, percent}]

  // pagination
  const [page, setPage] = useState(1);

  // หัวตาราง 7 วัน
  const dates = useMemo(() => {
    if (!isYMD(startDate) || !isYMD(endDate)) return [];
    const out = [];
    let cur = startDate;
    for (let i = 0; i < 7; i++) {
      out.push(cur);
      cur = addDays(cur, 1);
    }
    return out;
  }, [startDate, endDate]);

  // ดึงรายชื่อ department (ถ้ามี route)
  const fetchDepartments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/report-status-departments`);
      setDepartments(Array.isArray(res.data?.departments) ? res.data.departments : []);
    } catch {
      setDepartments([]); // ไม่มี route ก็ซ่อน dropdown
    }
  };

  // ดึง matrix
  const fetchData = async () => {
    if (!isYMD(startDate) || !isYMD(endDate)) {
      setDataByWard({});
      setSummary([]);
      return;
    }
    const params = new URLSearchParams({ start: startDate, end: endDate });
    if (wardFilter) params.append("wardname", wardFilter);
    if (department) params.append("department", department);

    try {
      const token = localStorage.getItem("token") || "";
      const res = await axios.get(
        `${API_BASE}/report-status-range?${params.toString()}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (res.data?.ok) {
        setDataByWard(res.data.data || {});
        setSummary(res.data.summary || []);
      } else {
        setDataByWard({});
        setSummary([]);
      }
    } catch (err) {
      console.error("fetch report-status-range error:", err);
      setDataByWard({});
      setSummary([]);
    }
  };

  useEffect(() => {
    fetchDepartments().catch(() => {});
  }, []);
  useEffect(() => {
    fetchData().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, wardFilter, department]);

  // เรียงชื่อ ward แบบไทย/อังกฤษ
  const collator = useMemo(() => new Intl.Collator("th"), []);
  const wardNames = useMemo(
    () => Object.keys(dataByWard).sort(collator.compare),
    [dataByWard, collator]
  );

  // กรองตาม onlyMissing
  const filteredWardNames = useMemo(() => {
    if (!onlyMissing) return wardNames;
    return wardNames.filter((w) => {
      const days = dataByWard[w] || [];
      return days.some((d) => !(d.morning && d.afternoon && d.night));
    });
  }, [onlyMissing, wardNames, dataByWard]);

  // รีเซ็ตหน้าให้เป็น 1 เมื่อมีการเปลี่ยนเงื่อนไข
  useEffect(() => {
    setPage(1);
  }, [onlyMissing, wardFilter, department, startDate, endDate]);

  // คำนวณหน้าและวอร์ดที่จะแสดง
  const totalPages = Math.max(1, Math.ceil(filteredWardNames.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIdx = (page - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, filteredWardNames.length);
  const pageWardNames = filteredWardNames.slice(startIdx, endIdx);

  // controls
  const goPrevWeek = () => setEndDate(addDays(endDate, -7));
  const goNextWeek = () => setEndDate(addDays(endDate, 7));
  const resetThisWeek = () => setEndDate(today);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>สถานะการส่งรายงาน 7 วัน</h2>

      {/* controls */}
      <div className={styles.controls}>
        <div className={styles.field}>
          <label>สิ้นสุด</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <button className={styles.refreshBtn} onClick={goPrevWeek}>
          ◀︎ ย้อน 7 วัน
        </button>
        <button className={styles.refreshBtn} onClick={resetThisWeek}>
          วันนี้ (7 วันล่าสุด)
        </button>
        <button className={styles.refreshBtn} onClick={goNextWeek}>
          ถัดไป 7 วัน ▶︎
        </button>

        <div className={styles.field}>
          <label>เฉพาะ Ward</label>
          <input
            placeholder="พิมพ์ชื่อ ward ตรงๆ (ไม่ใส่ก็ได้)"
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
          />
        </div>

        {departments.length > 0 && (
          <div className={styles.field}>
            <label>Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">ทั้งหมด</option>
              {departments.map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </select>
          </div>
        )}

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
          />
          แสดงเฉพาะที่ยังขาดส่ง
        </label>

        <button className={styles.refreshBtn} onClick={fetchData}>
          รีเฟรช
        </button>
      </div>

      {/* summary */}
      {/* {!!summary.length && (
        <div className={styles.summaryBar}>
          {summary.map((s) => (
            <div key={s.wardname} className={styles.summaryItem}>
              <div className={styles.summaryWard}>{s.wardname}</div>
              <div className={styles.summaryPct}>{s.percent}%</div>
              <div className={styles.summaryDetail}>
                {s.sent}/{s.totalShifts} เวร
              </div>
            </div>
          ))}
        </div>
      )} */}

      {/* matrix (table เสถียร + แสดง 15 วอร์ดต่อหน้า) */}
      {dates.length !== 7 ? (
        <div className={styles.summaryDetail}>กรุณาเลือกวันสิ้นสุด</div>
      ) : filteredWardNames.length === 0 ? (
        <div className={styles.summaryDetail}>ไม่พบ ward ตามเงื่อนไข</div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.tableMatrix}>
              <thead>
                <tr>
                  <th
                    className={`${styles.stickyCol} ${styles.stickyTop} ${styles.headLeft}`}
                  >
                    Ward / Date
                    <div className={styles.rangeHintSmall}>
                      {dmy(dates[0])} → {dmy(dates[6])}
                    </div>
                  </th>
                  {dates.map((d) => (
                    <th
                      key={d}
                      className={`${styles.stickyTop} ${
                        isWeekend(d) ? styles.weekendHead : ""
                      }`}
                    >
                      {dmy(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageWardNames.map((ward) => {
                  const days = dataByWard[ward] || [];
                  const byDate = Object.fromEntries(
                    days.map((d) => [d.date, d])
                  );
                  return (
                    <tr key={ward}>
                      <th className={`${styles.stickyCol} ${styles.wardName}`}>
                        {ward}
                      </th>
                      {dates.map((d) => {
                        const rec =
                          byDate[d] || {
                            morning: false,
                            afternoon: false,
                            night: false,
                          };
                        return (
                          <td
                            key={d}
                            className={`${styles.centerCell} ${
                              isWeekend(d) ? styles.weekendCell : ""
                            }`}
                            title={`เช้า: ${
                              rec.morning ? "✓" : "×"
                            } | บ่าย: ${rec.afternoon ? "✓" : "×"} | ดึก: ${
                              rec.night ? "✓" : "×"
                            }`}
                          >
                            <span
                              className={`${styles.dot} ${
                                rec.morning ? styles.on : styles.off
                              }`}
                              aria-label="morning"
                            />
                            <span
                              className={`${styles.dot} ${
                                rec.afternoon ? styles.on : styles.off
                              }`}
                              aria-label="afternoon"
                            />
                            <span
                              className={`${styles.dot} ${
                                rec.night ? styles.on : styles.off
                              }`}
                              aria-label="night"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          <div className={styles.pager}>
            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              ◀︎ ก่อนหน้า
            </button>
            <span className={styles.pageInfo}>
              หน้า {page} / {totalPages} &nbsp;•&nbsp; แสดง {startIdx + 1}–{endIdx} จาก {filteredWardNames.length} ward
            </span>
            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              ถัดไป ▶︎
            </button>
          </div>
        </>
      )}
    </div>
  );
}
