// HospitalUI.jsx (เวอร์ชันเต็ม + ระบบ productivity ครบ)
import { useState, useRef, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/HospitalUI.css";
import { API_BASE } from "../config";

/* ----------------------- helpers ----------------------- */
const displayZeroAsBlank = (v) => (v === 0 || v === "0" ? "" : v ?? "");
const toInt = (v) => (v === "" || v === undefined || v === null ? 0 : Number(v) || 0);

const NUMERIC_FIELDS = [
  "bed_carry", "bed_new", "bed_transfer_in",
  "discharge_home", "discharge_transfer_out", "discharge_refer_out", "discharge_refer_back", "discharge_died",
  "bed_remain",
  "type1", "type2", "type3", "type4", "type5",
  "vent_invasive", "vent_noninvasive", "hfnc", "oxygen",
  "extra_bed", "pas", "cpr", "infection", "gcs", "stroke", "psych", "prisoner", "palliative",
  "pre_op", "post_op",
  "rn", "pn", "na", "other_staff", "rn_extra", "rn_down",
];
const TEXT_FIELDS = ["incident", "head_nurse"];

const SHIFT_ORDER = ["morning", "afternoon", "night"];
function prevShiftInfo(dateStr, curShift) {
  const idx = SHIFT_ORDER.indexOf(curShift);
  if (idx === -1) return { date: dateStr, shift: curShift };
  if (idx === 0) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    return { date: d.toISOString().slice(0, 10), shift: SHIFT_ORDER[2] };
  }
  return { date: dateStr, shift: SHIFT_ORDER[idx - 1] };
}
function nextShiftInfo(dateStr, curShift) {
  const idx = SHIFT_ORDER.indexOf(curShift);
  if (idx === -1) return { date: dateStr, shift: curShift };
  if (idx === SHIFT_ORDER.length - 1) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    return { date: d.toISOString().slice(0, 10), shift: SHIFT_ORDER[0] };
  }
  return { date: dateStr, shift: SHIFT_ORDER[idx + 1] };
}

/* ======================================================== */
export default function HospitalUI({ username, wardname, selectedDate, shift }) {
  const [formData, setFormData] = useState({});
  const formRef = useRef(null);
  const [searchParams] = useSearchParams();
  const subward = searchParams.get("subward");

  const [bedTotal, setBedTotal] = useState(null);
  const [productivity, setProductivity] = useState(null); // ✅ เพิ่ม
  const [loading, setLoading] = useState(false);

  /* ----------------------- โหลดข้อมูลเวร ----------------------- */
  useEffect(() => {
    const fetchExistingData = async () => {
      setFormData({});
      setLoading(true);
      if (!wardname || !selectedDate || !shift) {
        setLoading(false);
        return;
      }

      if (wardname.toLowerCase() === "admin") {
        setFormData({
          username, wardname, date: selectedDate, shift,
          ...(subward ? { subward } : {}),
        });
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem("token");
        const effectiveUsername = username || localStorage.getItem("username") || "";
        const queryParams = new URLSearchParams({ date: selectedDate, shift, wardname });
        if (subward) queryParams.append("subward", subward);
        if (effectiveUsername) queryParams.append("username", effectiveUsername);

        const res = await fetch(`${API_BASE}/api/ward-report?${queryParams.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (res.status === 204) {
          const prev = prevShiftInfo(selectedDate, shift);
          const prevParams = new URLSearchParams({ date: prev.date, shift: prev.shift, wardname });
          if (subward) prevParams.append("subward", subward);
          if (effectiveUsername) prevParams.append("username", effectiveUsername);

          const r2 = await fetch(`${API_BASE}/api/ward-report?${prevParams.toString()}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });

          if (r2.ok) {
            const ct2 = r2.headers.get("content-type") || "";
            const text2 = await r2.text();
            const prevData = ct2.includes("application/json") && text2 ? JSON.parse(text2) : null;
            if (prevData) {
              setFormData({
                username: effectiveUsername || username,
                wardname, date: selectedDate, shift,
                ...(subward ? { subward } : {}),
                bed_carry: prevData.bed_remain ?? prevData.bed_carry ?? 0,
              });
              setLoading(false);
              return;
            }
          }

          setFormData({
            username: effectiveUsername || username, wardname, date: selectedDate, shift,
            ...(subward ? { subward } : {}),
          });
          setLoading(false);
          return;
        }

        const ct = res.headers.get("content-type") || "";
        const text = await res.text();
        const data = ct.includes("application/json") && text ? JSON.parse(text) : {};
        setFormData({
          ...data,
          username: effectiveUsername || username, wardname, date: selectedDate, shift,
          ...(subward ? { subward } : {}),
        });
      } catch (err) {
        console.error("โหลดข้อมูลเดิมล้มเหลว", err);
        setFormData({
          username: username || localStorage.getItem("username") || "",
          wardname, date: selectedDate, shift,
          ...(subward ? { subward } : {}),
        });
      } finally {
        setLoading(false);
      }
    };
    fetchExistingData();
  }, [username, wardname, selectedDate, shift, subward]);

  /* ----------------------- ดึงจำนวนเตียง ----------------------- */
  useEffect(() => {
    if (!wardname || wardname.toLowerCase() === "admin") {
      setBedTotal(0);
      return;
    }
    const params = new URLSearchParams({ wardname });
    if (subward) params.append("subward", subward);
    fetch(`${API_BASE}/api/ward-report/bed-total?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setBedTotal(data.bed_total ?? 0))
      .catch((err) => {
        console.error("Failed to fetch bed total:", err);
        setBedTotal(0);
      });
  }, [wardname, subward]);

  /* ✅ ------------------- ดึง productivity จาก backend ------------------- */
useEffect(() => {
  if (!wardname || !selectedDate || !shift) return;
  const fetchProductivity = async () => {
    try {
      const params = new URLSearchParams({ date: selectedDate, shift, wardname });
      const res = await fetch(
        `${API_BASE}/api/ward-report/productivity?${params.toString()}&_=${Date.now()}`,
        { headers: { "Cache-Control": "no-cache" } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProductivity(data.productivity ?? 0); // ✅ แก้ให้มีแค่บรรทัดนี้
    } catch (err) {
      console.error("Failed to fetch productivity:", err);
    }
  };
  fetchProductivity();
}, [wardname, subward, selectedDate, shift]);



  /* ----------------------- คำนวณ bed_remain ----------------------- */
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
    let remain = carry + newIn + trIn - out;
    if (remain < 0) remain = 0;
    return remain;
  }, [formData.bed_carry, formData.bed_new, formData.bed_transfer_in,
      formData.discharge_home, formData.discharge_transfer_out,
      formData.discharge_refer_out, formData.discharge_refer_back,
      formData.discharge_died, bedTotal]);

  useEffect(() => {
    setFormData((prev) =>
      prev.bed_remain === computedRemain ? prev : { ...prev, bed_remain: computedRemain }
    );
  }, [computedRemain]);

  /* ---------- handle change ---------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /* ---------- build payload ---------- */
  const buildPayload = () => {
    const base = {
      username: formData.username || username || localStorage.getItem("username") || "",
      wardname,
      date:
        formData.date instanceof Date
          ? formData.date.toISOString().split("T")[0]
          : formData.date || selectedDate,
      shift,
      subward: subward && String(subward).trim() !== "" ? subward : null,
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

  /* ---------- handle submit (เดิมของคุณ + อัปเดต productivity หลังบันทึก) ---------- */
  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem("token");
      const payload = buildPayload();

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
      if (!res.ok) {
        alert(data.message || "บันทึกไม่สำเร็จ");
        return;
      }

      alert("✅ บันทึกสำเร็จ");

      // ✅ ดึง productivity ใหม่หลังบันทึก
      const params = new URLSearchParams({
        date: payload.date,
        shift: payload.shift,
        wardname: payload.wardname,
      });
      const prodRes = await fetch(`${API_BASE}/api/ward-report/productivity?${params.toString()}`);
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProductivity(prodData.productivity ?? 0);
        setFormData((prev) => ({ ...prev, productivity: prodData.productivity ?? 0 }));
      }

      window.location.reload();
    } catch (err) {
      console.error("Error:", err);
      alert("เกิดข้อผิดพลาดในการส่งข้อมูล");
    }
  };

  /* ---------- render input ---------- */
  const renderInput = (label, name, type = "number", width = null, isReadOnly = false) => {
    const raw = formData[name];
    const display = displayZeroAsBlank(raw);
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
            <div className="section-header">ยอดยกมา</div>
            {renderInput("", "bed_carry")}
          </div>

          <div className="form-column">
            <div className="section-header">ยอดรับ</div>
            <div className="horizontal-inputs">
              {renderInput("รับใหม่:", "bed_new")}
              {renderInput("รับย้าย:", "bed_transfer_in")}
            </div>
          </div>

          <div className="form-column">
            <div className="section-header">ยอดจำหน่าย</div>
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
            {renderInput("", "bed_remain", "number", null, true)}
          </div>
        </div>
      </div>

      {/* ส่วนอื่น ๆ */}
      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-header">ประเภทผู้ป่วย</div>
            <div className="horizontal-inputs">
              {["5", "4", "3", "2", "1"].map((n) =>
                renderInput(`ประเภท ${n}:`, `type${n}`, "number")
              )}
            </div>
          </div>

          <div className="form-column">
            <div className="section-header">Ventilator</div>
            <div className="horizontal-inputs">
              {renderInput("Invasive:", "vent_invasive")}
              {renderInput("Non invasive:", "vent_noninvasive")}
            </div>
          </div>

          <div className="form-column">
            <div className="section-header">กลุ่มการให้ออกซิเจนและอุปกรณ์</div>
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
            <div className="section-header">การดูแลรอบการผ่าตัด</div>{" "}
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
            {renderInput("", "infection", "number", "180px")}{" "}
          </div>
          <div className="form-column">
            {" "}
            <div className="section-header">GCS 2T</div>{" "}
            {renderInput("", "gcs")}{" "}
          </div>
          <div className="form-column">
            {" "}
            <div className="section-header">Strokeในตึก</div>{" "}
            {renderInput("", "stroke")}{" "}
          </div>
          <div className="form-column">
            {" "}
            <div className="section-header">จิตเวชในตึก</div>{" "}
            {renderInput("", "psych")}{" "}
          </div>
          <div className="form-column">
            {" "}
            <div className="section-header">นักโทษในตึก</div>{" "}
            {renderInput("", "prisoner")}{" "}
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
            <div className="section-header">อัตรากำลังทั้งหมด</div>
            <div className="horizontal-inputs">
              {renderInput("RN:", "rn")}
              {renderInput("PN:", "pn")}
              {renderInput("NA:", "na")}
              {renderInput("พนักงาน:", "other_staff")}
              {renderInput("เฉพาะ RN ขึ้นเสริม:", "rn_extra")}
              {renderInput("RN ปรับลด:", "rn_down")}
              <div className="input-group highlighted">
                {renderInput("productivity:", "productivity", "number", "100px", true)}
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

      <div className="button-container">
        <button type="button" className="save-button" onClick={handleSubmit}>
          บันทึกข้อมูล
        </button>
      </div>
    </div>
  );
}