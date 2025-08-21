// src/pages/MultiDayReportStatus.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "../styles/ReportStatus.module.css";

/* ---------------------- helpers: safe date ---------------------- */
const isYMD = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** คืน YYYY-MM-DD แบบ local time
 *  - รับ Date หรือ string
 *  - ถ้า string รูปแบบถูกต้อง -> คืนค่าเดิม
 *  - ถ้า invalid -> คืน ""
 */
const localISODate = (d = new Date()) => {
  if (typeof d === "string") return isYMD(d) ? d : "";
  const dt = new Date(d);
  if (Number.isNaN(dt)) return "";
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 10);
};

/** บวก/ลบวันจาก YYYY-MM-DD (invalid -> "") */
const addDays = (ymd, n) => {
  if (!isYMD(ymd)) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt)) return "";
  dt.setDate(dt.getDate() + n);
  return localISODate(dt);
};
/* --------------------------------------------------------------- */

// ใช้ ENV ได้ ถ้าไม่ตั้งจะ fallback เป็น localhost:5000
const API_BASE =
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) ||
  "http://localhost:5000/api";

export default function MultiDayReportStatus() {
  const today = localISODate(new Date());
  const weekAgo = addDays(today, -6);

  // state
  const [start, setStart] = useState(weekAgo);
  const [end, setEnd] = useState(today);
  const [wardFilter, setWardFilter] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);

  // data
  const [dataByWard, setDataByWard] = useState({}); // { wardname: [ {date, morning, afternoon, night} ] }
  const [summary, setSummary] = useState([]);       // [{wardname, sent, totalShifts, percent}]

  // list วันที่หัวตาราง
  const dates = useMemo(() => {
    if (!isYMD(start) || !isYMD(end)) return [];
    const s = start <= end ? start : end;
    const e = start <= end ? end : start;

    const out = [];
    let cur = s;
    let guard = 0;
    while (cur && cur <= e && guard < 400) {
      out.push(cur);
      cur = addDays(cur, 1);
      guard++;
    }
    return out;
  }, [start, end]);

  // fetch
  const fetchData = async () => {
    if (!isYMD(start) || !isYMD(end)) {
      setDataByWard({});
      setSummary([]);
      return;
    }
    const s = start <= end ? start : end;
    const e = start <= end ? end : start;

    const params = new URLSearchParams({ start: s, end: e });
    if (wardFilter) params.append("wardname", wardFilter);

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
    fetchData().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, wardFilter]);

  const wardNames = useMemo(() => Object.keys(dataByWard), [dataByWard]);

  const filteredWardNames = useMemo(() => {
    if (!onlyMissing) return wardNames;
    return wardNames.filter((w) => {
      const days = dataByWard[w] || [];
      return days.some((d) => !(d.morning && d.afternoon && d.night));
    });
  }, [onlyMissing, wardNames, dataByWard]);

  const resetLast7Days = () => {
    const t = localISODate(new Date());
    setStart(addDays(t, -6));
    setEnd(t);
  };

  const rangeHint =
    !isYMD(start) || !isYMD(end)
      ? "กรุณาเลือกช่วงวันที่ให้ครบ"
      : start > end
      ? `ช่วงวันที่สลับกัน (จะแสดงเป็น ${end || "?"} → ${start || "?"})`
      : "";

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>สถานะการส่งรายงานหลายวัน (Compliance Matrix)</h2>

      {/* controls */}
      <div className={styles.controls}>
        <div className={styles.field}>
          <label>เริ่ม</label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label>สิ้นสุด</label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label>เฉพาะ Ward</label>
          <input
            placeholder="พิมพ์ชื่อ ward ตรงๆ (ไม่ใส่ก็ได้)"
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
          />
        </div>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
          />
          แสดงเฉพาะที่ยังขาดส่ง
        </label>
        <button
          className={styles.refreshBtn}
          onClick={fetchData}
          disabled={!isYMD(start) || !isYMD(end)}
          title={!isYMD(start) || !isYMD(end) ? "กรุณาเลือกช่วงวันที่ให้ครบ" : ""}
        >
          รีเฟรช
        </button>
        <button className={styles.refreshBtn} onClick={resetLast7Days}>
          ล้างวันที่ (7 วันล่าสุด)
        </button>
      </div>

      {/* hint */}
      {rangeHint && (
        <div className={styles.summaryDetail} style={{ marginBottom: 8 }}>
          {rangeHint}
        </div>
      )}

      {/* summary */}
      {!!summary.length && (
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
      )}

      {/* matrix */}
      {dates.length === 0 ? (
        <div className={styles.summaryDetail}>กรุณาเลือกช่วงวันที่</div>
      ) : (
        <div className={styles.matrix}>
          <div className={`${styles.cell} ${styles.sticky} ${styles.headerLeft}`}>
            Ward / Date
          </div>
          {dates.map((d) => (
            <div key={d} className={`${styles.cell} ${styles.stickyTop}`}>
              {d}
            </div>
          ))}

          {filteredWardNames.map((ward) => {
            const days = dataByWard[ward] || [];
            const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
            return (
              <React.Fragment key={ward}>
                <div className={`${styles.cell} ${styles.sticky} ${styles.wardCell}`}>
                  {ward}
                </div>
                {dates.map((d) => {
                  const rec = byDate[d] || {
                    morning: false,
                    afternoon: false,
                    night: false,
                  };
                  return (
                    <div
                      key={d}
                      className={`${styles.cell} ${styles.centeredCell}`}
                      title={`เช้า: ${rec.morning ? "✓" : "×"} | บ่าย: ${
                        rec.afternoon ? "✓" : "×"
                      } | ดึก: ${rec.night ? "✓" : "×"}`}
                    >
                      <div className={styles.dotGroup}>
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
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}