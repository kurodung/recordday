import { useState, useRef, useEffect, useMemo } from "react"; 
import { useSearchParams } from "react-router-dom";
import "../styles/HospitalUI.css";
import { API_BASE } from "../config";

/* ----------------------- Helper Functions ----------------------- */
const toInt = (v) =>
  v === "" || v === undefined || v === null ? 0 : Number(v) || 0;

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
/* ------------------------------------------------------------------------- */

export default function LRpage({ username, wardname, selectedDate, shift }) {
  const [formData, setFormData] = useState({});
  const formRef = useRef(null);
  const [searchParams] = useSearchParams();
  const subward = searchParams.get("subward");

  // 1. คำนวณคงพยาบาลแบบเรียลไทม์
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

  // 2. อัปเดต bed_remain ใน formData เมื่อ computedRemain เปลี่ยน
  useEffect(() => {
    setFormData((prev) =>
      prev.bed_remain === computedRemain
        ? prev
        : { ...prev, bed_remain: computedRemain }
    );
  }, [computedRemain]);

  // ดึงข้อมูลเดิมจาก API
  useEffect(() => {
    const fetchExistingData = async () => {
      if (!username || !wardname || !selectedDate || !shift) return;

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
          `${API_BASE}/api/lr-report?${queryParams.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (res.status === 204) {
          // 3. ถ้าไม่พบข้อมูลของเวรปัจจุบัน ให้ลองดึงของเวรก่อนหน้า (carry over)
          const prev = prevShiftInfo(selectedDate, shift);
          const prevParams = new URLSearchParams({
            date: prev.date,
            shift: prev.shift,
            wardname,
            username,
          });
          if (subward) prevParams.append("subward", subward);

          const prevRes = await fetch(
            `${API_BASE}/api/lr-report?${prevParams.toString()}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (prevRes.ok) {
            const text = await prevRes.text();
            const prevData = text ? JSON.parse(text) : null;
            if (prevData) {
              setFormData({
                username,
                wardname,
                date: selectedDate,
                shift,
                ...(subward && { subward }),
                bed_carry: prevData.bed_remain ?? 0, 
              });
              return;
            }
          }
          
          // ไม่มีข้อมูลใด ๆ → สร้างใหม่เปล่า
          setFormData((prev) => ({
            ...prev,
            username,
            wardname,
            date: selectedDate,
            shift,
            ...(subward && { subward }),
            bed_carry: 0,
          }));
          return;
        }

        if (res.ok) {
          const text = await res.text();
          const data = text ? JSON.parse(text) : {};
          setFormData({
            ...data,
            username,
            wardname,
            date: selectedDate,
            shift,
            ...(subward && { subward }),
          });
        } else {
          console.warn("โหลดข้อมูลล้มเหลว", res.status);
        }
      } catch (err) {
        console.error("โหลดข้อมูลเดิมล้มเหลว", err);
      }
    };

    fetchExistingData();
  }, [username, wardname, selectedDate, shift, subward]);

  // ดึง bed_total จาก API
  useEffect(() => {
    if (!wardname) return;

    const subwardQuery = subward
      ? `&subward=${encodeURIComponent(subward)}`
      : "";
    const url =`${API_BASE}/api/ward-report/bed-total?wardname=${encodeURIComponent(
      wardname
    )}${subwardQuery}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setFormData((prev) => ({
          ...prev,
          bed_total: data.bed_total || 0,
        }));
      })
      .catch((err) => {
        console.error("Failed to fetch bed total:", err);
      });
  }, [wardname, subward]);

  // event listener เลื่อนโฟกัส input ซ้ายขวา
  useEffect(() => {
    const handleArrowNavigation = (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const inputs = formRef.current.querySelectorAll("input");
        const inputsArray = Array.from(inputs);
        const currentIndex = inputsArray.indexOf(document.activeElement);

        if (currentIndex === -1) return;

        let nextIndex = currentIndex + (e.key === "ArrowRight" ? 1 : -1);

        if (nextIndex >= 0 && nextIndex < inputsArray.length) {
          inputsArray[nextIndex].focus();
          e.preventDefault();
        }
      }
    };

    const formEl = formRef.current;
    if (formEl) {
      formEl.addEventListener("keydown", handleArrowNavigation);
      return () => formEl.removeEventListener("keydown", handleArrowNavigation);
    }
  }, []);

  // จัดการเปลี่ยน input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // บันทึกข้อมูล
const handleSubmit = async () => {
  try {
    // ✅ ตรวจสอบ head_nurse ก่อน
    if (!formData.head_nurse || formData.head_nurse.trim() === "") {
      alert("กรุณากรอกชื่อพยาบาลหัวหน้าเวร");
      return;
    }

    const token = localStorage.getItem("token");

    const payload = {
      ...formData,
      date:
        formData.date instanceof Date
          ? formData.date.toISOString().split("T")[0]
          : formData.date,
    };

    if (subward) {
      payload.subward = subward;
    } else {
      delete payload.subward;
    }

    // ลบข้อมูลไม่ต้องการส่ง
    delete payload.productivity;
    delete payload.type;
    // ไม่ต้องลบ bed_remain แล้ว

    const method = formData.id ? "PUT" : "POST";
    const url = formData.id
      ? `${API_BASE}/api/lr-report/${formData.id}`
      : `${API_BASE}/api/lr-report`;

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (response.ok) {
      alert(method === "POST" ? "บันทึกสำเร็จ" : "อัปเดตสำเร็จ");
      window.location.reload();
    } else {
      alert("เกิดข้อผิดพลาด: " + (result.message || "ไม่ทราบสาเหตุ"));
    }
  } catch (error) {
    console.error("Error:", error);
    alert("เกิดข้อผิดพลาดในการส่งข้อมูล");
  }
};


  // ฟังก์ชันช่วยสร้าง input
  const renderInput = (
    label,
    name,
    type = "number",
    width = null,
    isReadOnly = false
  ) => (
    <div className="input-group" key={name}>
      <label className="input-label">{label}</label>
      <input
        type={type}
        name={name}
        min={type === "number" ? "0" : undefined}
        className="input-field"
        value={formData[name] ?? ""} 
        onChange={handleChange}
        style={width ? { width } : {}}
        readOnly={isReadOnly}
      />
    </div>
  );

  return (
    <div className="form-container" ref={formRef}>
      <h2
        style={{ textAlign: "center", marginBottom: "1rem", color: "#6b21a8" }}
      >
        กลุ่ม: {subward || "-"}
      </h2>
      
      {/* 🟢 ข้อมูลเตียง (ทั่วไป: general) */}
      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-label">ข้อมูลเตียง</div>
            <div className="input-group highlighted">
              {renderInput("จำนวนเตียง:", "bed_total", "number", "", true)}
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

      {/* 🔵 ชนิดการคลอด & อุปกรณ์ (อุปกรณ์: eqiment) */}
      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-header">ชนิดการคลอด</div>
            <div className="horizontal-inputs">
              {renderInput("NL:", "nl")}
              {renderInput("Forcep:", "forcep")}
              {renderInput("Vac:", "vac")}
              {renderInput("Br:", "br")}
              {renderInput("C/S:", "cs")}
            </div>
          </div>
          <div className="form-column">
            <div className="section-header eqiment">กลุ่มการให้ออกซิเจนและอุปกรณ์</div>
            <div className="horizontal-inputs">
              {renderInput("ใช้เครื่อง HFNC:", "hfnc")}
              {renderInput("ให้ออกซิเจน:", "oxygen")}
            </div>
          </div>

          <div className="form-column">
            <div className="section-header eqiment">Ventilator</div>
            <div className="horizontal-inputs">
              {renderInput("Invasive:", "vent_invasive")}
              {renderInput("Non invasive:", "vent_noninvasive")}
            </div>
          </div>

        </div>
      </div>

      {/* 🟣 ข้อมูลอื่นๆ (หมายเหตุ: note) */}
      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-header note">เปลเสริม</div>
            {renderInput("", "extra_bed")}
          </div>
          <div className="form-column">
            <div className="section-header note">PAS</div>
            {renderInput("", "pas")}
          </div>
          <div className="form-column">
            <div className="section-header note">CPR</div>
            {renderInput("", "cpr")}
          </div>
          <div className="form-column">
            <div className="section-header note">การดูแลรอบการผ่าตัด</div>
            <div className="horizontal-inputs">
              {renderInput("Pre OP:", "pre_op")}
              {renderInput("Post OP:", "post_op")}
            </div>
          </div>
          <div className="form-column" style={{}}>
            <div className="section-header note">ติดเชื้อดื้อยา(XDR/CRE/VRE)</div>
            {renderInput("", "infection", "number", "180px")}
          </div>
          <div className="form-column">
            <div className="section-header note">GCS 2T</div>
            {renderInput("", "gcs")}
          </div>
          <div className="form-column">
            <div className="section-header note">Strokeในตึก</div>
            {renderInput("", "stroke")}
          </div>
          <div className="form-column">
            <div className="section-header note">จิตเวชในตึก</div>
            {renderInput("", "psych")}
          </div>
          <div className="form-column">
            <div className="section-header note">นักโทษในตึก</div>
            {renderInput("", "prisoner")}
          </div>
        </div>
      </div>

      {/* 🟠 อัตรากำลัง (บุคลากร: staff) */}
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

      <div className="button-container">
        <button type="button" className="save-button" onClick={handleSubmit}>
          บันทึกข้อมูล
        </button>
      </div>
    </div>
  );
}