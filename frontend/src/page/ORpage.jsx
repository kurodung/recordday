// src/pages/ORpage.jsx
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/HospitalUI.css";
import { API_BASE } from "../config";


// แสดง 0 เป็นช่องว่าง
const displayZeroAsBlank = (v) => (v === 0 || v === "0" ? "" : v ?? "");

// แปลงเป็นจำนวนเต็ม (ค่าว่าง=>0)
const toInt = (v) =>
  v === "" || v === undefined || v === null ? 0 : Number(v) || 0;

// (เก็บไว้ก่อน เผื่อใช้ตรวจ completeness เพิ่มเติม)
const CORE_FIELDS = ["username", "wardname", "date", "shift"];

// ✅ ช่องอินพุตให้ตรงกับตาราง or_reports
const PROC_FIELDS = [
  { label: "ซับซ้อน", name: "complex" },
  { label: "ผ่านกล้อง", name: "endoscopic" },
  { label: "ผ่าตัดใหญ่", name: "major_surgery" },
  { label: "ผ่าตัดเล็ก", name: "minor_surgery" },
  { label: "เฝือก", name: "cast" },
  { label: "OR เล็ก", name: "or_small" },
  { label: "ODS", name: "ods" },
  { label: "ตา", name: "eye" },
  { label: "Covid", name: "covid" },
  { label: "smc", name: "smc" },
];

const NUMERIC_FIELDS = PROC_FIELDS.map((f) => f.name);
const TEXT_FIELDS = []; // เผื่ออนาคต

export default function ORpage({ username, wardname, selectedDate, shift }) {
  const [formData, setFormData] = useState({});
  const formRef = useRef(null);
  const [searchParams] = useSearchParams();

  // รองรับกรณีมาจาก query (เช่น /or?shift=...&date=...)
  const qsShift = searchParams.get("shift");
  const qsDate = searchParams.get("date");
  const effShift = qsShift || shift;
  const effDate = qsDate || selectedDate;

  // ---------- โหลดข้อมูลเดิม ----------
  useEffect(() => {
    const fetchExisting = async () => {
      if (!username || !wardname || !effDate || !effShift) return;

      try {
        const token = localStorage.getItem("token");
        const qs = new URLSearchParams({
          date: effDate,
          shift: effShift,
          wardname,
          username, // backend ไม่ได้ใช้ แต่ส่งไปได้ไม่เป็นไร
        });

        const res = await fetch(`${API_BASE}/api/or-report?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 204) {
          setFormData({
            username,
            wardname,
            date: effDate,
            shift: effShift,
          });
          return;
        }

        const ct = res.headers.get("content-type") || "";
        const text = await res.text();
        const data =
          ct.includes("application/json") && text ? JSON.parse(text) : {};

        // ถ้าแถวใน DB เป็นคนละเวร/วันกับที่ขอมา ให้เริ่มเปล่า
        if (data.shift && data.shift !== effShift) {
          setFormData({
            username,
            wardname,
            date: effDate,
            shift: effShift,
          });
          return;
        }

        setFormData({
          ...data,
          username,
          wardname,
          date: effDate,
          shift: effShift, // ✅ ใส่ shift เสมอ
        });
      } catch (err) {
        console.error("โหลดข้อมูล OR ล้มเหลว", err);
        setFormData({
          username,
          wardname,
          date: effDate,
          shift: effShift,
        });
      }
    };

    fetchExisting();
  }, [username, wardname, effDate, effShift]);

  // ---------- เลื่อนโฟกัส input ซ้าย/ขวา ด้วยปุ่มลูกศร ----------
  useEffect(() => {
    const handleArrowNavigation = (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const inputs = formRef.current?.querySelectorAll("input");
        const arr = inputs ? Array.from(inputs) : [];
        const currentIndex = arr.indexOf(document.activeElement);
        if (currentIndex === -1) return;

        let nextIndex = currentIndex + (e.key === "ArrowRight" ? 1 : -1);
        if (nextIndex >= 0 && nextIndex < arr.length) {
          arr[nextIndex].focus();
          e.preventDefault();
        }
      }
    };

    const el = formRef.current;
    if (el) {
      el.addEventListener("keydown", handleArrowNavigation);
      return () => el.removeEventListener("keydown", handleArrowNavigation);
    }
  }, []);

  // ---------- เปลี่ยนค่า input ----------
  const handleChange = (e) => {
    const { name, value } = e.target;
    // จำกัดให้เป็นเลขจำนวนเต็ม >= 0
    const v = value === "" ? "" : String(Math.max(0, parseInt(value || 0, 10)));
    setFormData((prev) => ({ ...prev, [name]: v }));
  };

  // ---------- เตรียม payload แบบ whitelist + แปลงชนิด ----------
  const buildPayload = () => {
    const base = {
      username,
      wardname,
      date:
        formData.date instanceof Date
          ? formData.date.toISOString().split("T")[0]
          : formData.date || effDate,
      shift: effShift,
      // ไม่มี subward สำหรับหน้า OR
    };

    const numeric = {};
    for (const k of NUMERIC_FIELDS) numeric[k] = toInt(formData[k]);

    const text = {};
    for (const k of TEXT_FIELDS) {
      const v = formData[k];
      if (v !== undefined) text[k] = v;
    }

    return { ...base, ...numeric, ...text };
  };

  // ---------- ส่งข้อมูล ----------
  const handleSubmit = async () => {
    try {
      if (!username || !wardname || !effDate || !effShift) {
        alert("ข้อมูลหลักไม่ครบ (username/wardname/date/shift)");
        return;
      }
      const token = localStorage.getItem("token");
      const payload = buildPayload();

      const method = formData.id ? "PUT" : "POST";
      const url = formData.id
        ? `${API_BASE}/api/or-report/${formData.id}`
        : `${API_BASE}/api/or-report`;

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const ct = res.headers.get("content-type") || "";
      const text = await res.text();
      const json =
        ct.includes("application/json") && text ? JSON.parse(text) : {};

      if (!res.ok) {
        console.error("POST/PUT /or-report failed:", res.status, json || text);
        alert(json?.message || `HTTP ${res.status}`);
        return;
      }

      alert(method === "POST" ? "บันทึกสำเร็จ" : "อัปเดตสำเร็จ");
      window.location.reload();
    } catch (error) {
      console.error("Error:", error);
      alert("เกิดข้อผิดพลาดในการส่งข้อมูล");
    }
  };

  // ---------- helper render ----------
  const renderInput = (label, name) => {
    const raw = formData[name];
    const display = displayZeroAsBlank(raw);
    return (
      <div className="input-group" key={name}>
        <label className="input-label">{label}:</label>
        <input
          type="number"
          min="0"
          name={name}
          className="input-field"
          value={display}
          onChange={handleChange}
        />
      </div>
    );
  };

  return (
    <div className="form-container" ref={formRef}>

      <div className="form-section">
        <div className="flex-grid">
          {/* คอลัมน์เดียว/หลายคอลัมน์ได้ตามจอ ด้วยสไตล์เดิม */}
          <div className="form-column">
            <div className="section-header">หัตถการ / ผ่าตัด</div>
            <div className="horizontal-inputs" style={{ alignItems: "center" }}>
              {PROC_FIELDS.map((f) => renderInput(f.label, f.name))}
            </div>
          </div>
        </div>
      </div>
      

      <div className="button-container">
        <button type="button" className="save-button" onClick={handleSubmit}>
          บันทึกข้อมูล
        </button>
      </div>

    

    </div>
  );
}
