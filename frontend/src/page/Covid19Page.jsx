import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/HospitalUI.css";

const Covid19Page = ({ username, wardname, selectedDate, shift }) => {
  const formRef = useRef(null);
  const [formData, setFormData] = useState({});
  const [searchParams] = useSearchParams();
  const subward = searchParams.get("subward");

  // โหลดข้อมูลเดิม
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

        if (subward) {
          queryParams.append("subward", subward);
        }

        const res = await fetch(
          `http:/localhost:5000/api/covid-report?${queryParams.toString()}`,
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

        if (res.ok) {
          const data = await res.json();
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

      if (subward) payload.subward = subward;

      const method = formData.id ? "PUT" : "POST";
      const url = formData.id
        ? `http://localhost:5000/api/covid-report/${formData.id}`
        : `http://localhost:5000/api/covid-report`;

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

  const renderInput = (label, name, type = "number", width = null) => (
    <div className="input-group">
      {label && <label className="input-label">{label}</label>}
      <input
        type={type}
        name={name}
        min={type === "number" ? "0" : undefined}
        className="input-field"
        value={formData[name] || ""}
        onChange={handleChange}
        style={width ? { width } : {}}
      />
    </div>
  );

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

  return (
    <div className="form-container" ref={formRef}>
      {/* ตัวอย่างเรียก renderInput */}
      <h2 style={{ textAlign: "center", marginBottom: "1rem", color: "#6b21a8" }}>
        กลุ่ม: {subward || "-"}
      </h2>
      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-header">จำนวนผู้ป่วย</div>
            <div className="horizontal-inputs">
              {renderInput("ยอดยกมา:", "bed_carry")}
              {renderInput("รับใหม่:", "bed_new")}
              {renderInput("รับย้าย:", "bed_transfer_in")}
              {renderInput("จำหน่าย:", "discharge")}
              {renderInput("คงพยาบาล:", "bed_remain")}
            </div>
          </div>
          <div className="form-column">
            <div className="section-header">ช่วงอายุ</div>
            <div className="horizontal-inputs">
              {renderInput("ผู้ใหญ่:", "adult")}
              {renderInput("เด็ก:", "child")}
              {renderInput("Newborn:", "Newborn")}
              {renderInput("หญิงตั้งครรภ์:", "Pregnant")}
              {renderInput("หลังคลอด:", "Postpartum")}
            </div>
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-header">ประเภท/ระดับความรุนแรง</div>
            <div className="horizontal-inputs">
              {renderInput("5/แดง:", "red5")}
              {renderInput("4/เหลือง:", "yellow4")}
              {renderInput("3/เขียว:", "green3")}
              {renderInput("Asym/ไม่มีอาการ:", "Asym")}
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
            <div className="section-header">ใช้เครื่อง HFNC</div>
            {renderInput("", "hfnc")}
            </div>
          <div className="form-column">
            <div className="section-header">ให้ออกซิเจน</div>
            {renderInput("", "oxygen")}
          </div>
          <div className="form-column">
            <div className="section-header">ห้อง/เตียงว่าง</div>
            {renderInput("", "roombed_empty")}
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-header">หัตถการ</div>
            <div className="horizontal-inputs">
              {renderInput("CPR:", "cpr")}
              {renderInput("Pre op:", "pre_op")}
              {renderInput("Post op:", "post_op")}
              {renderInput("CRRT:", "crrt")}
              {renderInput("Ecmo:", "ecmo")}
              {renderInput("Prone position:", "prone_position")}
            </div>
          </div>
          <div className="form-column">
            <div className="section-header">เสียชีวิต</div>
            {renderInput("", "died")}
          </div>
          <div className="form-column">
            <div className="section-header">บันทึกเหตุการณ์/อุบัติการณ์</div>
            <div className="horizontal-inputs">
              {renderInput("", "incident", "text", 250)}
            </div>
          </div>
        </div>
      </div>

      <div className="button-container">
        <button className="save-button" onClick={handleSubmit}>
          บันทึกข้อมูล
        </button>
      </div>
    </div>
  );
};

export default Covid19Page;
