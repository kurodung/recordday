// src/pages/ORpage.jsx
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/HospitalUI.css";
import { API_BASE } from "../config";

const displayZeroAsBlank = (v) => (v === 0 || v === "0" ? "" : v ?? "");
const toInt = (v) =>
  v === "" || v === undefined || v === null ? 0 : Number(v) || 0;

export default function ORpage({ username, wardname, selectedDate, shift }) {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const formRef = useRef(null);
  const [searchParams] = useSearchParams();

  const qsShift = searchParams.get("shift");
  const qsDate = searchParams.get("date");
  const effShift = qsShift || shift;
  const effDate = qsDate || selectedDate;

  useEffect(() => {
    const fetchExisting = async () => {
      if (!username || !wardname || !effDate || !effShift) return;
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const qs = new URLSearchParams({
          date: effDate,
          shift: effShift,
          wardname,
          username,
        });
        const res = await fetch(`${API_BASE}/api/or-report?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 204) {
          setFormData({ username, wardname, date: effDate, shift: effShift });
          setLoading(false);
          return;
        }

        const ct = res.headers.get("content-type") || "";
        const text = await res.text();
        const data =
          ct.includes("application/json") && text ? JSON.parse(text) : {};
        if (data.shift && data.shift !== effShift) {
          setFormData({ username, wardname, date: effDate, shift: effShift });
          setLoading(false);
          return;
        }

        setFormData({
          ...data,
          username,
          wardname,
          date: effDate,
          shift: effShift,
        });
      } catch (err) {
        console.error("โหลดข้อมูล OR ล้มเหลว", err);
        setFormData({ username, wardname, date: effDate, shift: effShift });
      } finally {
        setLoading(false);
      }
    };
    fetchExisting();
  }, [username, wardname, effDate, effShift]);

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

  // ✅ handleChange รองรับทั้ง number และ text
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    if (type === "number") {
      const v =
        value === "" ? "" : String(Math.max(0, parseInt(value || 0, 10)));
      setFormData((prev) => ({ ...prev, [name]: v }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const buildPayload = () => {
    const base = {
      username,
      wardname,
      date:
        formData.date instanceof Date
          ? formData.date.toISOString().split("T")[0]
          : formData.date || effDate,
      shift: effShift,
    };

    // ฟิลด์ตัวเลข
    const numericFields = [
      "complex",
      "endoscopic",
      "major_surgery",
      "minor_surgery",
      "cast",
      "or_small",
      "ods",
      "eye",
      "covid",
      "smc",
      "rn",
      "pn",
      "na",
      "sb",
      "tn",
      "autoclave",
      "cssd",
      "cleaner",
    ];

    // ฟิลด์ข้อความ
    const textFields = ["head_nurse"];

    const numeric = {};
    for (const k of numericFields) numeric[k] = toInt(formData[k]);

    const text = {};
    for (const k of textFields) text[k] = formData[k] ?? "";

    return { ...base, ...numeric, ...text };
  };

  const handleSubmit = async () => {
    try {
      if (!username || !wardname || !effDate || !effShift) {
        alert("ข้อมูลหลักไม่ครบ (username/wardname/date/shift)");
        return;
      }

      // ✅ เพิ่มตรงนี้
      if (!formData.head_nurse || formData.head_nurse.trim() === "") {
        alert("กรุณากรอกชื่อพยาบาลหัวหน้าเวร");
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

  // ✅ renderInput รองรับ extraClass
  const renderInput = (
    label,
    name,
    type = "number",
    width = null,
    readOnly = false,
    extraClass = ""
  ) => {
    const raw = formData[name];
    const display = type === "number" ? displayZeroAsBlank(raw) : raw ?? "";
    return (
      <div className="input-group" key={name} style={width ? { width } : {}}>
        {label && (
          <label className="input-label" htmlFor={name}>
            {label}
          </label>
        )}
        <input
          id={name}
          type={type}
          min={type === "number" ? "0" : undefined}
          step="1"
          inputMode={type === "number" ? "numeric" : undefined}
          pattern={type === "number" ? "[0-9]*" : undefined}
          name={name}
          className={`input-field ${extraClass}`}
          value={display}
          onChange={handleChange}
          onWheel={(e) => e.currentTarget.blur()}
          readOnly={readOnly}
        />
      </div>
    );
  };

  return (
    <div className="form-container" ref={formRef}>
      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-header">ผ่าตัดซับซ้อน</div>
            {renderInput("", "complex")}
          </div>
          <div className="form-column">
            <div className="section-header">ผ่านกล้อง</div>
            {renderInput("", "endoscopic")}
          </div>
          <div className="form-column">
            <div className="section-header">ผ่าตัดใหญ่</div>
            {renderInput("", "major_surgery")}
          </div>
          <div className="form-column">
            <div className="section-header">ผ่าตัดเล็ก</div>
            {renderInput("", "minor_surgery")}
          </div>
          <div className="form-column">
            <div className="section-header">ใส่เฝือก</div>
            {renderInput("", "cast")}
          </div>
          <div className="form-column">
            <div className="section-header">OR เล็ก</div>
            {renderInput("", "or_small")}
          </div>
          <div className="form-column">
            <div className="section-header">ODS</div>
            {renderInput("", "ods")}
          </div>
          <div className="form-column">
            <div className="section-header">ตา</div>
            {renderInput("", "eye")}
          </div>
          <div className="form-column">
            <div className="section-header">Covid</div>
            {renderInput("", "covid")}
          </div>
          <div className="form-column">
            <div className="section-header">SMC</div>
            {renderInput("", "smc")}
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-header">RN(63)</div>
            {renderInput("", "rn")}
          </div>
          <div className="form-column">
            <div className="section-header">PN(6)</div>
            {renderInput("", "pn")}
          </div>
          <div className="form-column">
            <div className="section-header">NA(24)</div>
            {renderInput("", "na")}
          </div>
          <div className="form-column">
            <div className="section-header">พ.เปล(24)</div>
            {renderInput("", "sb")}
          </div>
          <div className="form-column">
            <div className="section-header">TN(5)</div>
            {renderInput("", "tn")}
          </div>
          <div className="form-column">
            <div className="section-header">หม้อนึ่ง(3)</div>
            {renderInput("", "autoclave")}
          </div>
          <div className="form-column">
            <div className="section-header">พ.จ่ายกลาง(13)</div>
            {renderInput("", "cssd")}
          </div>
          <div className="form-column">
            <div className="section-header">พ.ทำความสะอาด(5)</div>
            {renderInput("", "cleaner", "number", null, false, "input-medium")}
          </div>

          <div className="form-column">
            <div className="section-header" style={{ color: "green" }}>
              พยาบาลหัวหน้าเวร
            </div>
            <div className="horizontal-inputs">
              {renderInput("", "head_nurse", "text", null, false, "input-wide")}
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
