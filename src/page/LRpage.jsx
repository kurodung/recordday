import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/HospitalUI.css";

export default function LRpage({ username, wardname, selectedDate, shift }) {
  const [formData, setFormData] = useState({});
  const formRef = useRef(null);
  const [searchParams] = useSearchParams();
  const subward = searchParams.get("subward");

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
          `http://localhost:5000/api/ward-report?${queryParams.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (res.status === 204) {
          setFormData((prev) => ({
            ...prev,
            username,
            wardname,
            date: selectedDate,
            shift,
            ...(subward && { subward }),
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
    const url = `http://localhost:5000/api/ward-report/bed-total?wardname=${encodeURIComponent(
      wardname
    )}${subwardQuery}`;
    console.log("Fetching bed total URL:", url);

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        console.log("Received bed total:", data.bed_total);
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

      const method = formData.id ? "PUT" : "POST";
      const url = formData.id
        ? `http://localhost:5000/api/ward-report/${formData.id}`
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
        กลุ่ม: {subward || "-"}
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
            <div className="section-header">กลุ่มการให้ออกซิเจนและอุปกรณ์</div>
            <div className="horizontal-inputs">
              {renderInput("ใช้เครื่อง HFNC:", "hfnc")}
              {renderInput("ให้ออกซิเจน:", "oxygen")}
            </div>
          </div>

          <div className="flex-grid">
            <div className="form-column">
              <div className="section-header">เปลเสริม</div>
              {renderInput("", "extra_crib")}
            </div>
            <div className="form-column">
              <div className="section-header">PAS</div>
              {renderInput("", "pas")}
            </div>

            <div className="form-column">
              <div className="section-header">CPR</div>
              {renderInput("", "cpr")}
            </div>

            <div className="form-column">
              <div className="section-header">เปลเสริม</div>
              {renderInput("", "extra_crib")}
            </div>
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="flex-grid">

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
      </div>

      {/* --- เพิ่ม input ส่วนอื่น ๆ ตามต้องการ --- */}
      {/* ตัวอย่างเดียวกับ HospitalUI */}
      {/* ... */}

      <div className="button-container">
        <button type="button" className="save-button" onClick={handleSubmit}>
          บันทึกข้อมูล
        </button>
      </div>
    </div>
  );
}
