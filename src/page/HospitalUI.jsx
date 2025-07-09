import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/HospitalUI.css";

export default function HospitalUI({
  username,
  wardname,
  selectedDate,
  shift,
}) {
  const [formData, setFormData] = useState({ bed_total: 50 });
  const formRef = useRef(null);
  const [searchParams] = useSearchParams();
  const supward = searchParams.get("supward");

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

        if (supward) {
          queryParams.append("supward", supward);
        }

        const res = await fetch(
          `http://localhost:5000/api/ward-report?${queryParams.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (res.status === 204) {
          setFormData({
            bed_total: 50,
            username,
            wardname,
            date: selectedDate,
            shift,
            ...(supward && { supward }),
          });
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
            ...(supward && { supward }),
          });
        } else {
          console.warn("โหลดข้อมูลล้มเหลว", res.status);
        }
      } catch (err) {
        console.error("โหลดข้อมูลเดิมล้มเหลว", err);
      }
    };

    fetchExistingData();
  }, [username, wardname, selectedDate, shift, supward]);

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem("token");

      const payload = {
        ...formData,
        date:
          formData.date instanceof Date
            ? formData.date.toISOString().split("T")[0]
            : formData.date,
      };

      // ส่ง supward เฉพาะถ้ามี
      if (supward) {
        payload.supward = supward;
      } else {
        delete payload.supward;
      }

      delete payload.productivity;
      delete payload.type;

      const method = formData.id ? "PUT" : "POST";
      const url = formData.id
        ? `http://localhost:5000/api/hospital/${formData.id}`
        : "http://localhost:5000/api/ward-report";

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

  const renderInput = (
    label,
    name,
    type = "number",
    width = null,
    isReadOnly = false
  ) => (
    <div className="input-group">
      <label className="input-label">{label}</label>
      <input
        type={type}
        name={name}
        min={type === "number" ? "0" : undefined}
        className="input-field"
        value={formData[name] || ""}
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
        กลุ่ม: {supward || "-"}
      </h2>
      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-label">ข้อมูลเตียง</div>
            <div className="input-group highlighted">
              {renderInput("จำนวนเตียง:", "bed_total", "number", "", true)}
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
            {renderInput("", "bed_remain")}
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-header">ประเภทผู้ป่วย</div>
            <div className="horizontal-inputs">
              {["5", "4", "3", "2", "1"].map((n) =>
                renderInput(`ประเภท ${n}:`, `type${n}`, "number", null, false)
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
            <div className="section-header">PAS</div>
            {renderInput("", "pas")}
          </div>
          <div className="form-column">
            <div className="section-header">CPR</div>
            {renderInput("", "cpr")}
          </div>
          <div className="form-column" style={{}}>
            <div className="section-header">ติดเชื้อดื้อยา(XDR/CRE/VRE)</div>
            {renderInput("", "infection", "number", "180px")}
          </div>
          <div className="form-column">
            <div className="section-header">GCS 2T</div>
            {renderInput("", "gcs")}
          </div>
          <div className="form-column">
            <div className="section-header">Strokeในตึก</div>
            {renderInput("", "stroke")}
          </div>
          <div className="form-column">
            <div className="section-header">จิตเวชในตึก</div>
            {renderInput("", "psych")}
          </div>
          <div className="form-column">
            <div className="section-header">นักโทษในตึก</div>
            {renderInput("", "prisoner")}
          </div>
          <div className="form-column">
            <div className="section-header">การดูแลรอบการผ่าตัด</div>
            <div className="horizontal-inputs">
              {renderInput("Pre OP:", "pre_op")}
              {renderInput("Post OP:", "post_op")}
            </div>
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
              {renderInput("", "incident", "text", 250)}
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
