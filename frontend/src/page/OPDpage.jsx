import { useState, useEffect } from "react";
import "../styles/HospitalUI.css";
import { API_BASE } from "../config";
import { ChevronDown, ChevronUp } from "lucide-react";

const displayZeroAsBlank = (v) =>
  v === 0 || v === "0" || v == null || Number.isNaN(v) ? "" : v;
const toInt = (v) =>
  v === "" || v === undefined || v === null ? 0 : Number(v) || 0;

const NUMERIC_FIELDS = [
  "treat_back",
  "admit",
  "rn",
  "pn",
  "na",
  "other_staff",
  "rn_extra",
  "rn_down",
  "inj_total",
  "inj_inject",
  "inj_wound",
  "inj_stitch",
  "inj_dialysis_mix",
];

const SUN_FIELDS = [
  "sun_obsgyn",
  "sun_Internal",
  "sun_surgery",
  "sun_ped",
  "sun_den",
  "sun_eye",
  "sun_ent",
  "sun_ortho",
  "sun_total",
];
const TEXT_FIELDS = ["incident", "head_nurse"];

// ✅ ใช้แบบเดิมไม่ดึงจาก DB
const SUBWARD_OPTIONS = [
  "GP",
  "Ped",
  "SMC Uro",
  "Med",
  "Ortho",
  "Surgery",
  "ENT",
  "EENT",
  "จักษุ",
  "นรีเวช",
  "จิตเวชเด็ก",
  "จิตเวชผู้ใหญ่",
  "คลินิกระงับปวด",
  "ห้องฉีดยา",
];

export default function OPDpage({ username, wardname, selectedDate, shift }) {
  const [formData, setFormData] = useState({});
  const [sunData, setSunData] = useState({});
  const [expanded, setExpanded] = useState({ sun: false });
  const [selectedSubward, setSelectedSubward] = useState("");

  // โหลดสถานะขยาย/ย่อจาก localStorage
  useEffect(() => {
    const saved = localStorage.getItem("expandedSun");
    if (saved) setExpanded({ sun: saved === "true" });
  }, []);

  useEffect(() => {
    localStorage.setItem("expandedSun", expanded.sun);
  }, [expanded.sun]);

  /* ---------------------- โหลดข้อมูล OPD ---------------------- */
  useEffect(() => {
    if (!username || !wardname || !selectedDate || !shift) return;
    const token = localStorage.getItem("token");

    const fetchData = async () => {
      try {
        // ✅ โหลดข้อมูล OPD เฉพาะเมื่อเลือก subward
        if (selectedSubward) {
          const params = new URLSearchParams({
            date: selectedDate,
            shift,
            wardname,
            username,
            subward: selectedSubward,
          });

          const res = await fetch(`${API_BASE}/api/opd-report?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (res.ok && res.status !== 204) {
            const data = await res.json();
            setFormData({
              ...data,
              username,
              wardname,
              date: selectedDate,
              shift,
              subward: selectedSubward,
            });
          } else {
            setFormData({
              username,
              wardname,
              date: selectedDate,
              shift,
              subward: selectedSubward,
            });
          }
        }

        // ✅ โหลดข้อมูลศูนย์ Admit วันอาทิตย์ เสมอ
        const sunParams = new URLSearchParams({
          date: selectedDate,
          shift,
          wardname,
        });
        const sunRes = await fetch(
          `${API_BASE}/api/opd-sun-report?${sunParams}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (sunRes.ok && sunRes.status !== 204) {
          const sun = await sunRes.json();
          setSunData(sun);
        } else {
          setSunData({
            username,
            wardname,
            date: selectedDate,
            shift,
          });
        }
      } catch (err) {
        console.error("โหลดข้อมูล opd/sun ล้มเหลว:", err);
      }
    };

    fetchData();
  }, [username, wardname, selectedDate, shift, selectedSubward]);

  /* ---------------------- คำนวณรวมศูนย์ Admit ---------------------- */
  useEffect(() => {
    const total =
      toInt(sunData.sun_obsgyn) +
      toInt(sunData.sun_Internal) +
      toInt(sunData.sun_surgery) +
      toInt(sunData.sun_ped) +
      toInt(sunData.sun_den) +
      toInt(sunData.sun_eye) +
      toInt(sunData.sun_ent) +
      toInt(sunData.sun_ortho);
    setSunData((p) => ({ ...p, sun_total: total }));
  }, [
    sunData.sun_obsgyn,
    sunData.sun_Internal,
    sunData.sun_surgery,
    sunData.sun_ped,
    sunData.sun_den,
    sunData.sun_eye,
    sunData.sun_ent,
    sunData.sun_ortho,
  ]);

  /* ---------------------- handleChange ---------------------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };
  const handleSunChange = (e) => {
    const { name, value } = e.target;
    setSunData((p) => ({ ...p, [name]: value }));
  };

  /* ---------------------- build payload ---------------------- */
  const buildPayload = () => {
    const base = {
      username,
      wardname,
      date: selectedDate,
      shift,
      subward: selectedSubward,
    };
    const numeric = {};
    for (const k of NUMERIC_FIELDS) numeric[k] = toInt(formData[k] ?? 0);
    const text = {};
    for (const k of TEXT_FIELDS)
      if (formData[k] !== undefined) text[k] = formData[k];
    return { ...base, ...numeric, ...text };
  };

  /* ---------------------- submit OPD ---------------------- */
  const handleSubmit = async () => {
    try {
      if (!selectedSubward || selectedSubward.trim() === "") {
        alert("กรุณาเลือก Subward ก่อนบันทึกข้อมูล");
        return;
      }

      const token = localStorage.getItem("token");
      const payload = buildPayload();

      const res = await fetch(`${API_BASE}/api/opd-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("POST /opd-report failed:", res.status, text);
        alert("บันทึกข้อมูล OPD ล้มเหลว");
        return;
      }

      alert("✅ บันทึกข้อมูลสำเร็จสำหรับ " + selectedSubward);
      window.location.reload();
    } catch (err) {
      console.error("Error:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  /* ---------------------- submit ศูนย์ Admit ---------------------- */
  const handleSubmitSun = async () => {
    try {
      const token = localStorage.getItem("token");
      const payload = {
        username,
        wardname,
        date: selectedDate,
        shift,
        ...SUN_FIELDS.reduce(
          (obj, k) => ({ ...obj, [k]: toInt(sunData[k] ?? 0) }),
          {}
        ),
      };

      const res = await fetch(`${API_BASE}/api/opd-sun-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("POST /opd-sun-report failed:", res.status, text);
        alert("บันทึกข้อมูลศูนย์ Admit ล้มเหลว");
        return;
      }

      alert("✅ บันทึกข้อมูลศูนย์ Admit วันอาทิตย์สำเร็จ");
      window.location.reload();
    } catch (err) {
      console.error("Error:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลศูนย์ Admit");
    }
  };

  /* ---------------------- render input ---------------------- */
  const renderInput = (
    label,
    name,
    type = "number",
    width = null,
    readOnly = false
  ) => {
    const raw = formData[name];
    const display = displayZeroAsBlank(raw);
    return (
      <div className="input-group" key={name}>
        {label && <label className="input-label">{label}</label>}
        <input
          type={type}
          name={name}
          min={type === "number" ? "0" : undefined}
          className="input-field"
          value={display}
          onChange={handleChange}
          style={width ? { width } : {}}
          readOnly={readOnly}
        />
      </div>
    );
  };

  const renderSunInput = (label, name, readOnly = false) => {
    const raw = sunData[name];
    const display = displayZeroAsBlank(raw);
    return (
      <div className="input-group" key={name}>
        {label && <label className="input-label">{label}</label>}
        <input
          type="number"
          name={name}
          min="0"
          className="input-field"
          value={display}
          onChange={handleSunChange}
          readOnly={readOnly}
        />
      </div>
    );
  };

  /* ---------------------- UI ---------------------- */
  return (
    <div className="form-container">
      <h2
        style={{ textAlign: "center", marginBottom: "1rem", color: "#6b21a8" }}
      >
        กลุ่ม: {selectedSubward || "-"}
      </h2>

      {/* OPD */}
      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-header">OPD</div>
            <div className="horizontal-inputs">
              <div className="input-group">
                <label className="input-label">Subward:</label>
                <select
                  className="input-field"
                  value={selectedSubward}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedSubward(val);
                    setFormData({});
                  }}
                  style={{ width: "160px", fontSize: "1rem", height: "38px" }}
                >
                  <option value="">-- เลือกหน่วย --</option>
                  {SUBWARD_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {renderInput("ตรวจกลับ:", "treat_back")}
              {renderInput("รับไว้:", "admit")}
            </div>
          </div>

          <div className="form-column">
            <div className="section-header">อัตรากำลังทั้งหมด</div>
            <div className="horizontal-inputs">
              {renderInput("RN:", "rn")}
              {renderInput("PN:", "pn")}
              {renderInput("NA:", "na")}
              {renderInput("พนักงาน:", "other_staff")}
              {renderInput("เฉพาะ RN ขึ้นเสริม:", "rn_extra")}
              {renderInput("RN ปรับลด:", "rn_down")}
            </div>
          </div>

          <div className="form-column">
            <div className="section-header">💉 ห้องฉีดยา</div>
            <div className="horizontal-inputs">
              {renderInput("ยอดบริการ:", "inj_total")}
              {renderInput("ฉีดยา:", "inj_inject")}
              {renderInput("ทำแผล:", "inj_wound")}
              {renderInput("ตัดไหม:", "inj_stitch")}
              {renderInput("ผสมยาล้างไต:", "inj_dialysis_mix")}
            </div>
          </div>

          <div className="form-column">
            <div className="section-header">บันทึกเหตุการณ์/อุบัติการณ์</div>
            <div className="horizontal-inputs">
              {renderInput("", "incident", "text", 200)}
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
          💾 บันทึกข้อมูล OPD
        </button>
      </div>

      {/* ศูนย์ Admit */}
      <div className="form-section">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
          }}
          onClick={() => setExpanded((p) => ({ ...p, sun: !p.sun }))}
        >
          <span style={{ fontWeight: "bold", color: "#6b21a8" }}>
            📅 ศูนย์ Admit วันอาทิตย์
          </span>
          {expanded.sun ? <ChevronUp /> : <ChevronDown />}
        </div>

        {expanded.sun && (
          <>
            <div className="horizontal-inputs flex-wrap">
              {renderSunInput("สูติ-นรีเวช:", "sun_obsgyn")}
              {renderSunInput("อายุรกรรม:", "sun_Internal")}
              {renderSunInput("ศัลยกรรม:", "sun_surgery")}
              {renderSunInput("กุมาร:", "sun_ped")}
              {renderSunInput("ทันตกรรม:", "sun_den")}
              {renderSunInput("ตา:", "sun_eye")}
              {renderSunInput("ENT:", "sun_ent")}
              {renderSunInput("Ortho:", "sun_ortho")}
              {renderSunInput("รวมทั้งหมด:", "sun_total", true)}
            </div>

            <div className="button-container">
              <button
                type="button"
                className="save-button"
                onClick={handleSubmitSun}
              >
                💾 บันทึกข้อมูล
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
