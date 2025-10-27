import { useState, useRef, useEffect} from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/HospitalUI.css";
import { API_BASE } from "../config";

const displayZeroAsBlank = (v) => (v === 0 || v === "0" ? "" : v ?? "");

// แปลงค่าว่าง/undefined/null ให้เป็น 0
const toInt = (v) =>
  v === "" || v === undefined || v === null ? 0 : Number(v) || 0;

// ฟิลด์ตัวเลขที่อนุญาตให้ส่งเข้า DB (ปรับให้ตรง schema ของคุณได้)
const NUMERIC_FIELDS = [
  "special",
  "general",
  "genspecial",
  "specialgen",
  "gengen",
  "echo",
  "cath_lab",
  "dialysis",
  "physio_new",
  "xray",
  "stay",
  "refer_back",
  "refer_out",
  "pn",
  "stretcher",
  "employee",
];

// ฟิลด์ข้อความที่อนุญาต
const TEXT_FIELDS = ["incident", "head_nurse"];

// ฟิลด์หลักที่ต้องมีเสมอ
const CORE_FIELDS = ["username", "wardname", "date", "shift", "subward"];

export default function NWCWpage({ username, wardname, selectedDate, shift }) {
  const [formData, setFormData] = useState({});
  const formRef = useRef(null);
  const [searchParams] = useSearchParams();
  const subward = searchParams.get("subward");

  // ---------- โหลดข้อมูลเดิม ----------
  useEffect(() => {
    const fetchExistingData = async () => {
      if (!username || !wardname || !selectedDate || !shift) return;
      if (wardname.toLowerCase() === "admin") {
        // admin ไม่ใช่ ward จริง — เซ็ตค่าเริ่มต้นเฉย ๆ
        setFormData({
          username,
          wardname,
          date: selectedDate,
          shift,
          ...(subward && { subward }),
        });
        return;
      }

      try {
        const token = localStorage.getItem("token");
        const queryParams = new URLSearchParams({
          date: selectedDate,
          shift,
          wardname,
          username,
        });
        if (subward) queryParams.append("subward", subward);

        const res = await fetch(
          `${API_BASE}/api/nwcw-report?${queryParams.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (res.status === 204) {
          setFormData({
            username,
            wardname,
            date: selectedDate,
            shift,
            ...(subward && { subward }),
          });
          return;
        }

        const ct = res.headers.get("content-type") || "";
        const text = await res.text();
        if (!res.ok) {
          console.warn("โหลดข้อมูลล้มเหลว", res.status, text.slice(0, 200));
          setFormData({
            username,
            wardname,
            date: selectedDate,
            shift,
            ...(subward && { subward }),
          });
          return;
        }
        const data =
          ct.includes("application/json") && text ? JSON.parse(text) : {};

        // ถ้าแถวใน DB เป็นคนละเวร/วันกับที่ขอมา ให้เริ่มเปล่า
        if (data.shift && data.shift !== shift) {
          setFormData({
            username,
            wardname,
            date: selectedDate,
            shift,
            ...(subward && { subward }),
          });
          return;
        }

        setFormData({
          ...data,
          username,
          wardname,
          date: selectedDate,
          shift,
          ...(subward && { subward }),
        });
      } catch (err) {
        console.error("โหลดข้อมูลเดิมล้มเหลว", err);
      }
    };

    fetchExistingData();
  }, [username, wardname, selectedDate, shift, subward]);

  // ---------- เปลี่ยนค่า input ----------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ---------- เตรียม payload แบบ whitelist + แปลงชนิด ----------
  const buildPayload = () => {
    const base = {
      username,
      wardname,
      date:
        formData.date instanceof Date
          ? formData.date.toISOString().split("T")[0]
          : formData.date || selectedDate,
      shift,
      subward: subward && String(subward).trim() !== "" ? subward : null,
    };

    const numeric = {};
    for (const k of NUMERIC_FIELDS) {
      numeric[k] = toInt(formData[k]);
    }

    const text = {};
    for (const k of TEXT_FIELDS) {
      const v = formData[k];
      if (v !== undefined) text[k] = v;
    }

    // productivity ให้ backend คำนวณเอง (ไม่ส่ง) — ถ้าคอลัมน์ NOT NULL ค่อยเพิ่มสูตรฝั่ง FE
    return { ...base, ...numeric, ...text };
  };

  // ---------- ส่งข้อมูล ----------
  const handleSubmit = async () => {
    try {
      if (!username || !wardname || !selectedDate || !shift) {
        alert("ข้อมูลหลักไม่ครบ (username/wardname/date/shift)");
        return;
      }
      if (wardname.toLowerCase() === "admin") {
        alert("Admin ไม่สามารถบันทึก nwcw report ได้");
        return;
      }

      const token = localStorage.getItem("token");
      const payload = buildPayload();

      // ID จะมาจากแถวเดิมที่โหลดได้ (ถ้ามี)
      const method = formData.id ? "PUT" : "POST";
      const url = formData.id
        ? `${API_BASE}/api/nwcw-report/${formData.id}`
        : `${API_BASE}/api/nwcw-report`;

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
        console.error("POST/PUT /cl-report failed:", res.status, json || text);
        alert(json.message || `HTTP ${res.status}`);
        return;
      }

      alert(method === "POST" ? "บันทึกสำเร็จ" : "อัปเดตสำเร็จ");
      window.location.reload();
    } catch (error) {
      console.error("Error:", error);
      alert("เกิดข้อผิดพลาดในการส่งข้อมูล");
    }
  };

  const renderInput = (
    label,
    name,
    type = "number",
    width = null,
    isReadOnly = false
  ) => {
    const raw = formData[name];
    const display = displayZeroAsBlank(raw); // 👉 0 จะกลายเป็น ""
    return (
      <div className="input-group" key={name}>
        {label ? <label className="input-label">{label}</label> : null}
        <input
          type={type}
          name={name}
          min={type === "number" ? "0" : undefined}
          className="input-field"
          value={display}
          onChange={handleChange}
          style={width ? { width } : {}}
          readOnly={isReadOnly}
        />
      </div>
    );
  };

  return (
    <div className="form-container" ref={formRef}>
      <h2
        style={{ textAlign: "center", marginBottom: "1rem", color: "#6b21a8" }}
      >
        กลุ่ม: {subward || "-"}
      </h2>

      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-header">ขอเปลกลับบ้าน</div>
            <div className="horizontal-inputs">
              {renderInput("พิเศษ:", "special")}
              {renderInput("สามัญ:", "general")}
            </div>
          </div>
          <div className="form-column">
            <div className="section-header">ขอเปลย้าย</div>
            <div className="horizontal-inputs">
              {renderInput("สามัญ→พิเศษ:", "genspecial")}
              {renderInput("พิเศษ→สามัญ:", "specialgen")}
              {renderInput("สามัญ→สามัญ:", "gengen")}
            </div>
          </div>
          
        </div>
      </div>

      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-header">ขอเปลส่ง</div>
            <div className="horizontal-inputs">
              {renderInput("Echo:", "echo")}
              {renderInput("Cath lab:", "cath_lab")}
              {renderInput("ไตเทียม:", "dialysis")}
              {renderInput("กายภาพรายใหม่:", "physio_new")}
              {renderInput("x-ray:", "xray")}
            </div>
          </div>
          <div className="form-column">
            <div className="section-header">พักในศูนย์</div>
            {renderInput("", "stay")}
          </div>
          <div className="form-column">
            <div className="section-header">Refer back</div>
            {renderInput("", "refer_back")}
          </div>
          <div className="form-column">
            <div className="section-header">Refer out</div>
            {renderInput("", "refer_out")}
          </div>

        </div>
      </div>

      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-header">อัตรากำลังทั้งหมด</div>
            <div className="horizontal-inputs">
              {renderInput("PN:", "pn")}
              {renderInput("พนักงานเปล:", "stretcher")}
              {renderInput("พนักงานทั่วไป:", "employee")}
            </div>
          </div>
                    <div className="form-column">
            <div className="section-header" style={{ color: "green" }}>
              พยาบาลหัวหน้าเวร
            </div>
            <div className="horizontal-inputs">
              {renderInput("", "head_nurse", "text", 150)}
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
