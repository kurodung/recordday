import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "../styles/ReportStatus.module.css";
import { API_BASE } from "../config";

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

// แยก label "Ward / Subward" -> [ward, subward]
const splitGroup = (label) => {
  const i = label.indexOf(" / ");
  if (i === -1) return [label, ""];
  return [label.slice(0, i), label.slice(i + 3)];
};
/* ----------------------------------------------------- */

// จำนวนรายการต่อหน้า
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
  const [department, setDepartment] = useState(""); // "" = ทั้งหมด
  const [includeSubward, setIncludeSubward] = useState(true); // ✅ รวม Subward

  // data
  // หมายเหตุ: dataByWard = dataByGroup (key คือ "WARD" หรือ "WARD / SUBWARD")
  const [dataByWard, setDataByWard] = useState({});

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
      const res = await axios.get(`${API_BASE}/api/report-status-departments`);
      setDepartments(
        Array.isArray(res.data?.departments) ? res.data.departments : []
      );
    } catch {
      setDepartments([]); // ไม่มี route ก็ซ่อน dropdown
    }
  };

  // ดึง matrix
  const fetchData = async () => {
    if (!isYMD(startDate) || !isYMD(endDate)) {
      setDataByWard({});
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ start: startDate, end: endDate });
    if (wardFilter) params.append("wardname_like", wardFilter);
    if (department) params.append("department", department);
    if (includeSubward) params.append("includeSubward", "1");

    try {
      const token = localStorage.getItem("token") || "";
      const res = await axios.get(
        `${API_BASE}/api/report-status-range?${params.toString()}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal, // ⬅️ สำคัญ
        }
      );
      setDataByWard(res.data?.ok ? res.data.data || {} : {});
    } catch (err) {
      if (err.name !== "CanceledError" && err.code !== "ERR_CANCELED") {
        console.error("fetch report-status-range error:", err);
        setDataByWard({});
      }
    }

    return () => controller.abort();
  };

  useEffect(() => {
    fetchDepartments().catch(() => {});
  }, []);
  useEffect(() => {
    fetchData().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, wardFilter, department, includeSubward]);

  // เรียงชื่อ: ให้บรรทัด "Ward รวม" มาก่อน ตามด้วย "Ward / Subward" ของ ward เดียวกัน
  const collator = useMemo(() => new Intl.Collator("th"), []);
  const groupNames = useMemo(() => {
    const keys = Object.keys(dataByWard);
    keys.sort((a, b) => {
      const [wa, sa] = splitGroup(a);
      const [wb, sb] = splitGroup(b);
      const c = collator.compare(wa, wb);
      if (c !== 0) return c;
      // ว่าง (บรรทัดรวม ward) มาก่อน
      if (!sa && sb) return -1;
      if (sa && !sb) return 1;
      return collator.compare(sa, sb);
    });
    return keys;
  }, [dataByWard, collator]);

  // กรองตาม onlyMissing
  const filteredNames = useMemo(() => {
    let names = groupNames;

    // ✅ ถ้ามี subward ของ ward ไหน ให้ซ่อน ward หลักนั้นออก
    const hasSubward = new Set();
    groupNames.forEach((g) => {
      const [ward, sub] = splitGroup(g);
      if (sub) hasSubward.add(ward);
    });

    names = names.filter((g) => {
      const [ward, sub] = splitGroup(g);
      // ถ้ามี subward อยู่แล้ว และอันนี้คือ ward รวม → ซ่อน
      if (!sub && hasSubward.has(ward)) return false;
      return true;
    });

    if (onlyMissing) {
      names = names.filter((g) => {
        const days = dataByWard[g] || [];
        return days.some((d) => !(d.morning && d.afternoon && d.night));
      });
    }

    return names;
  }, [onlyMissing, groupNames, dataByWard]);

  // รีเซ็ตหน้าให้เป็น 1 เมื่อมีการเปลี่ยนเงื่อนไข
  useEffect(() => {
    setPage(1);
  }, [onlyMissing, wardFilter, department, includeSubward, startDate, endDate]);

  // คำนวณหน้าและรายการที่จะแสดง
  const totalPages = Math.max(1, Math.ceil(filteredNames.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIdx = (page - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, filteredNames.length);
  const pageNames = filteredNames.slice(startIdx, endIdx);

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
          <label>ค้นหา Ward</label>
          <input
            placeholder="ชื่อที่ต้องการค้นหา"
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
            checked={includeSubward}
            onChange={(e) => setIncludeSubward(e.target.checked)}
          />
          รวม Subward
        </label>

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

      {/* matrix (table เสถียร + 15 รายการต่อหน้า) */}
      {dates.length !== 7 ? (
        <div className={styles.summaryDetail}>กรุณาเลือกวันสิ้นสุด</div>
      ) : filteredNames.length === 0 ? (
        <div className={styles.summaryDetail}>ไม่พบข้อมูลตามเงื่อนไข</div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.tableMatrix}>
              <thead>
                <tr>
                  <th
                    className={`${styles.stickyCol} ${styles.stickyTop} ${styles.headLeft}`}
                  >
                    Ward / Subward / Date
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
                {pageNames.map((label) => {
                  const days = dataByWard[label] || [];
                  const byDate = Object.fromEntries(
                    days.map((d) => [d.date, d])
                  );
                  return (
                    <tr key={label}>
                      <th className={`${styles.stickyCol} ${styles.wardName}`}>
                        {label}
                      </th>
                      {dates.map((d) => {
                        const rec = byDate[d] || {
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
                            title={`เช้า: ${rec.morning ? "✓" : "×"} | บ่าย: ${
                              rec.afternoon ? "✓" : "×"
                            } | ดึก: ${rec.night ? "✓" : "×"}`}
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
              หน้า {page} / {totalPages} &nbsp;•&nbsp; แสดง {startIdx + 1}–
              {endIdx} จาก {filteredNames.length} แถว
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
