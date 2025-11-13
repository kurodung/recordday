// src/pages/HospitalUI.jsx
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/HospitalUI.css";
import { API_BASE } from "../config";

/* ----------------------- Helper Functions ----------------------- */
const displayZeroAsBlank = (v) => (v == null ? "" : v);
const toInt = (v) =>
  v === "" || v === undefined || v === null ? 0 : Number(v) || 0;


const NUMERIC_FIELDS = [
  "bed_total",
  "bed_carry",
  "bed_new",
  "bed_transfer_in",
  "discharge_home",
  "discharge_transfer_out",
  "discharge_refer_out",
  "discharge_refer_back",
  "discharge_died",
  "bed_remain",
  "type1",
  "type2",
  "type3",
  "type4",
  "type5",
  "vent_invasive",
  "vent_noninvasive",
  "hfnc",
  "oxygen",
  "extra_bed",
  "pas",
  "cpr",
  "infection",
  "gcs",
  "stroke",
  "psych",
  "prisoner",
  "ft_stroke",
  "ft_sepsis",
  "ft_stemi",
  "ft_trauma",
  "palliative",
  "pre_op",
  "post_op",
  "rn",
  "pn",
  "na",
  "other_staff",
  "rn_extra",
  "rn_down",
];
const TEXT_FIELDS = ["incident", "head_nurse"];
const SHIFT_ORDER = ["morning", "afternoon", "night"];

const prevShiftInfo = (dateStr, curShift) => {
  const idx = SHIFT_ORDER.indexOf(curShift);
  if (idx === -1) return { date: dateStr, shift: curShift };
  if (idx === 0) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    return { date: d.toISOString().slice(0, 10), shift: SHIFT_ORDER[2] };
  }
  return { date: dateStr, shift: SHIFT_ORDER[idx - 1] };
};

/* ================================================================ */
export default function HospitalUI({
  username,
  wardname,
  selectedDate,
  shift,
}) {
  const [formData, setFormData] = useState({});
  const [bedTotal, setBedTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const formRef = useRef(null);
  const [searchParams] = useSearchParams();

  /* -------------------- Subward memory -------------------- */
  const subwardFromURL = searchParams.get("subward");
  const savedSubward = localStorage.getItem("lastSubward");
  const subward = subwardFromURL || savedSubward || null;

  useEffect(() => {
    const currentWard = localStorage.getItem("lastWard");
    if (currentWard !== wardname) {
      localStorage.removeItem("lastSubward");
      localStorage.setItem("lastWard", wardname);
    }
  }, [wardname]);

  useEffect(() => {
    if (subward) localStorage.setItem("lastSubward", subward);
  }, [subward]);

  /* -------------------- Load existing data -------------------- */
  const fetchExistingData = useCallback(async () => {
    setLoading(true);
    if (!wardname || !selectedDate || !shift) {
      setLoading(false);
      return;
    }

    const token = localStorage.getItem("token");
    const effectiveUsername =
      username || localStorage.getItem("username") || "";
    const queryParams = new URLSearchParams({
      date: selectedDate,
      shift,
      wardname,
    });
    if (subward) queryParams.append("subward", subward);
    if (effectiveUsername) queryParams.append("username", effectiveUsername);

    try {
      const res = await fetch(`${API_BASE}/api/ward-report?${queryParams}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      // ✅ ถ้าไม่พบข้อมูล → ลองดึงของเวรก่อนหน้า (carry over)
      if (res.status === 204) {
        const prev = prevShiftInfo(selectedDate, shift);
        const prevParams = new URLSearchParams({
          date: prev.date,
          shift: prev.shift,
          wardname,
        });
        if (subward) prevParams.append("subward", subward);
        if (effectiveUsername) prevParams.append("username", effectiveUsername);

        const prevRes = await fetch(
          `${API_BASE}/api/ward-report?${prevParams}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );

        if (prevRes.ok) {
          const text = await prevRes.text();
          const prevData = text ? JSON.parse(text) : null;
          if (prevData) {
            setFormData({
              username: effectiveUsername,
              wardname,
              date: selectedDate,
              shift,
              ...(subward ? { subward } : {}),
              bed_carry: prevData.bed_remain ?? prevData.bed_carry ?? 0,
            });
            setLoading(false);
            return;
          }
        }

        // ไม่มีข้อมูลใด ๆ → สร้างใหม่เปล่า
        setFormData({
          username: effectiveUsername,
          wardname,
          date: selectedDate,
          shift,
          ...(subward ? { subward } : {}),
        });
        setLoading(false);
        return;
      }

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      setFormData({
        ...data,
        username: effectiveUsername,
        wardname,
        date: selectedDate,
        shift,
        ...(subward ? { subward } : {}),
      });
    } catch {
      const cached = localStorage.getItem("latestWardData");
      setFormData(
        cached
          ? JSON.parse(cached)
          : {
              username: username || localStorage.getItem("username") || "",
              wardname,
              date: selectedDate,
              shift,
              ...(subward ? { subward } : {}),
            }
      );
    } finally {
      setLoading(false);
    }
  }, [username, wardname, selectedDate, shift, subward]);

  // ✅ ป้องกัน React เรียก API ก่อน props พร้อม
  useEffect(() => {
    // ถ้าข้อมูลหลักยังไม่พร้อม (เช่น wardname, shift, date ยังเป็น undefined)
    if (!wardname || !selectedDate || !shift) return;

    // ✅ delay 150ms เพื่อให้ localStorage, token และ subward โหลดทัน
    const timer = setTimeout(() => {
      fetchExistingData();
    }, 150);

    return () => clearTimeout(timer);
  }, [wardname, selectedDate, shift, subward, fetchExistingData]);

  /* -------------------- Fetch bed total -------------------- */
  useEffect(() => {
    if (!wardname || wardname.toLowerCase() === "admin") {
      setBedTotal(0);
      return;
    }

    const params = new URLSearchParams({ wardname });
    if (subward && subward.trim() !== "" && subward !== "null")
      params.append("subward", subward);

    fetch(`${API_BASE}/api/ward-report/bed-total?${params}`)
      .then((res) => res.json())
      .then((data) => setBedTotal(data?.bed_total ?? 0))
      .catch(() => setBedTotal(0));
  }, [wardname, subward]);

  /* -------------------- Compute bed remain -------------------- */
  const computedRemain = useMemo(() => {
    const carry = toInt(formData.bed_carry);
    const newIn = toInt(formData.bed_new);
    const trIn = toInt(formData.bed_transfer_in);
    const out =
      toInt(formData.discharge_home) +
      toInt(formData.discharge_transfer_out) +
      toInt(formData.discharge_refer_out) +
      toInt(formData.discharge_refer_back) +
      toInt(formData.discharge_died);
    return Math.max(0, carry + newIn + trIn - out);
  }, [formData]);

  useEffect(() => {
    setFormData((prev) =>
      prev.bed_remain === computedRemain
        ? prev
        : { ...prev, bed_remain: computedRemain }
    );
  }, [computedRemain]);

  /* -------------------- Input Handlers -------------------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const buildPayload = () => {
    const base = {
      username:
        formData.username || username || localStorage.getItem("username") || "",
      wardname,
      date:
        formData.date instanceof Date
          ? formData.date.toISOString().split("T")[0]
          : formData.date || selectedDate,
      shift,
      subward: subward?.trim() ? subward : null,
    };

    const numeric = {};
    for (const k of NUMERIC_FIELDS) {
      if (k === "bed_total") {
        numeric[k] = toInt(bedTotal);
      } else {
        const val = formData[k];
        if (val !== "" && val !== null && val !== undefined)
          numeric[k] = toInt(val);
      }
    }

    const text = Object.fromEntries(
      TEXT_FIELDS.map((k) => [k, formData[k] ?? ""])
    );
    return { ...base, ...numeric, ...text };
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem("token");
      const payload = buildPayload();
      localStorage.setItem("latestWardData", JSON.stringify(payload));

      const method = formData.id ? "PUT" : "POST";
      const url = formData.id
        ? `${API_BASE}/api/ward-report/${formData.id}`
        : `${API_BASE}/api/ward-report`;

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) return alert(data.message || "บันทึกไม่สำเร็จ");

      if (data.is_complete === 1) {
        alert("✅ บันทึกสำเร็จ");
      } else {
        alert(
          "✅ บันทึกแล้ว แต่ต้องกรอก 0 ให้ครบทุกช่องเพื่อยืนยันข้อมูลให้สมบูรณ์"
        );
      }

      setTimeout(() => fetchExistingData(), 500);
    } catch {
      alert("เกิดข้อผิดพลาดในการส่งข้อมูล");
    }
  };

  /* -------------------- Render -------------------- */
  const renderInput = (
    label,
    name,
    type = "number",
    width,
    readOnly = false
  ) => (
    <div className="input-group" key={name}>
      {label && <label className="input-label">{label}</label>}
      <input
        type={type}
        name={name}
        min={type === "number" ? "0" : undefined}
        className="input-field"
        value={displayZeroAsBlank(formData[name])}
        onChange={handleChange}
        style={width ? { width } : {}}
        readOnly={readOnly}
      />
    </div>
  );

  /* -------------------- UI -------------------- */
  return (
    <div className="form-container" ref={formRef}>
      <h2
        style={{ textAlign: "center", marginBottom: "1rem", color: "#6b21a8" }}
      >
        กลุ่ม: {subward || "-"}
      </h2>

      {/* --- ข้อมูลเตียง --- */}
      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-label">ข้อมูลเตียง</div>
            <div className="input-group highlighted">
              <label className="input-label">จำนวนเตียง:</label>
              <input
                type="number"
                value={bedTotal ?? ""}
                className="input-field"
                readOnly
              />
            </div>
          </div>
          <div className="form-column">
            <div className="section-header general">ยอดยกมา</div>
            {renderInput("", "bed_carry")}
          </div>
          <div className="form-column">
            <div className="section-header general">ยอดรับ</div>
            <div className="horizontal-inputs">
              {renderInput("รับใหม่:", "bed_new")}
              {renderInput("รับย้าย:", "bed_transfer_in")}
            </div>
          </div>
          <div className="form-column">
            <div className="section-header general">ยอดจำหน่าย</div>
            <div className="horizontal-inputs">
              {renderInput("กลับบ้าน:", "discharge_home")}
              {renderInput("ย้ายตึก:", "discharge_transfer_out")}
              {renderInput("Refer out:", "discharge_refer_out")}
              {renderInput("Refer back:", "discharge_refer_back")}
              {renderInput("เสียชีวิต:", "discharge_died")}
            </div>
          </div>
          <div className="form-column">
            <div className="section-label">คงพยาบาล</div>
            <div className="input-group highlighted">
              {renderInput("", "bed_remain", "number", null, true)}
            </div>
          </div>
        </div>
      </div>

      {/* ส่วนอื่น ๆ */}
      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-header patient">ประเภทผู้ป่วย</div>
            <div className="horizontal-inputs">
              {["5", "4", "3", "2", "1"].map((n) =>
                renderInput(`ประเภท ${n}:`, `type${n}`, "number")
              )}
            </div>
          </div>

          <div className="form-column">
            <div className="section-header eqiment">Ventilator</div>
            <div className="horizontal-inputs">
              {renderInput("Invasive:", "vent_invasive")}
              {renderInput("Non invasive:", "vent_noninvasive")}
            </div>
          </div>

          <div className="form-column">
            <div className="section-header eqiment">
              กลุ่มการให้ออกซิเจนและอุปกรณ์
            </div>
            <div className="horizontal-inputs">
              {renderInput("ใช้เครื่อง HFNC:", "hfnc")}
              {renderInput("ให้ออกซิเจน:", "oxygen")}
            </div>
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            {" "}
            <div className="section-header">เปลเสริม</div>{" "}
            {renderInput("", "extra_bed")}{" "}
          </div>
          <div className="form-column">
            {" "}
            <div className="section-header">PAS</div> {renderInput("", "pas")}{" "}
          </div>
          <div className="form-column">
            {" "}
            <div className="section-header">CPR</div> {renderInput("", "cpr")}{" "}
          </div>
          <div className="form-column">
            {" "}
            <div className="section-header note">การดูแลรอบการผ่าตัด</div>{" "}
            <div className="horizontal-inputs">
              {" "}
              {renderInput("Pre OP:", "pre_op")}{" "}
              {renderInput("Post OP:", "post_op")}{" "}
            </div>
          </div>
          <div className="form-column">
            {" "}
            <div className="section-header">
              ติดเชื้อดื้อยา(XDR/CRE/VRE)
            </div>{" "}
            {renderInput("", "infection", "number", "150px")}{" "}
          </div>
          <div className="form-column">
            {" "}
            <div className="section-header">GCS 2T</div>{" "}
            {renderInput("", "gcs")}{" "}
          </div>
          <div className="form-column">
            {" "}
            <div className="section-header note">Strokeในตึก</div>{" "}
            {renderInput("", "stroke")}{" "}
          </div>
          <div className="form-column">
            {" "}
            <div className="section-header note">จิตเวชในตึก</div>{" "}
            {renderInput("", "psych")}{" "}
          </div>
          <div className="form-column">
            {" "}
            <div className="section-header note">นักโทษในตึก</div>{" "}
            {renderInput("", "prisoner")}{" "}
          </div>
          <div className="form-column">
            <div className="section-header general">Fast track</div>
            <div className="horizontal-inputs">
              {renderInput("Stroke:", "ft_stroke")}
              {renderInput("Sepsis shock:", "ft_sepsis")}
              {renderInput("STEMI:", "ft_stemi")}
              {renderInput("Trauma:", "ft_trauma")}
            </div>
          </div>
          <div className="form-column">
            <div className="section-header">Palliative</div>
            {renderInput("", "palliative")}
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-header staff">อัตรากำลังทั้งหมด</div>
            <div className="horizontal-inputs">
              {renderInput("RN:", "rn")}
              {renderInput("PN:", "pn")}
              {renderInput("NA:", "na")}
              {renderInput("พนักงาน:", "other_staff")}
              {renderInput("เฉพาะ RN ขึ้นเสริม:", "rn_extra")}
              {renderInput("RN ปรับลด:", "rn_down")}
              <div className="input-group highlighted">
                {renderInput(
                  "productivity:",
                  "productivity",
                  "number",
                  "100px",
                  true
                )}
              </div>
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

      <div
        className="button-container"
        style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          className="save-button"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
        </button>

        {/* 🟣 ข้อความแจ้งเตือนอยู่ด้านล่าง */}
        <div
          style={{
            marginTop: "10px",
            backgroundColor: "#f3e8ff",
            borderRadius: "8px",
            padding: "6px 12px",
            color: "#ff0000",
            fontSize: "16px",
            maxWidth: "80%",
          }}
        >
          ⚠️ กรุณากรอก 0 ให้ครบทุกช่องเพื่อยืนยันว่ากรอกข้อมูลถูกต้อง
        </div>
      </div>
    </div>
  );
}
