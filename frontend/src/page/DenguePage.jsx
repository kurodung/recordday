import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/HospitalUI.css";
import { API_BASE } from "../config";

const DenguePage = ({ username, wardname, selectedDate, shift }) => {
  const [formData, setFormData] = useState({});
  const formRef = useRef(null);
  const [searchParams] = useSearchParams();
  const subward = searchParams.get("subward");

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
          `${API_BASE}/api/dengue-report?${queryParams.toString()}`,
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
        ? `${API_BASE}/api/dengue-report/${formData.id}`
        : `${API_BASE}/api/dengue-report`;

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

  const renderInput = (label, name, type = "number") => (
    <div className="input-group">
      <label className="input-label">{label}</label>
      <input
        type={type}
        name={name}
        min="0"
        className="input-field"
        value={formData[name] || ""}
        onChange={handleChange}
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

        const nextIndex = currentIndex + (e.key === "ArrowRight" ? 1 : -1);
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
      <h2 style={{ textAlign: "center", marginBottom: "1rem", color: "#6b21a8" }}>
        กลุ่ม: {subward || "-"}
      </h2>
      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-header">จำนวนเตียง</div>
            <div className="input-group highlighted">
              {renderInput("จำนวนเตียง:", "bed_total")}
              </div>
          </div>
          <div className="form-column">
            <div className="section-header">ยอดยกมา</div>
            <div className="horizontal-inputs">
              {renderInput("DF", "carry_df")}
              {renderInput("DHF", "carry_dhf")}
              {renderInput("DSS", "carry_dss")}
            </div>
          </div>
          <div className="form-column">
            <div className="section-header">รับใหม่</div>
            <div className="horizontal-inputs">
              {renderInput("DF", "new_df")}
              {renderInput("DHF", "new_dhf")}
              {renderInput("DSS", "new_dss")}
            </div>
          </div>
          <div className="form-column">
            <div className="section-header">รับย้าย</div>
            <div className="horizontal-inputs">
              {renderInput("DF", "transfer_df")}
              {renderInput("DHF", "transfer_dhf")}
              {renderInput("DSS", "transfer_dss")}
            </div>
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="flex-grid">
          <div className="form-column">
            <div className="section-header">กลับบ้าน</div>
            <div className="horizontal-inputs">
              {renderInput("DF", "discharge_df")}
              {renderInput("DHF", "discharge_dhf")}
              {renderInput("DSS", "discharge_dss")}
            </div>
          </div>
          <div className="form-column">
            <div className="section-header">ย้ายตึก</div>
            <div className="horizontal-inputs">
              {renderInput("DF", "move_df")}
              {renderInput("DHF", "move_dhf")}
              {renderInput("DSS", "move_dss")}
            </div>
          </div>
          <div className="form-column">
            <div className="section-header">เสียชีวิต</div>
            <div className="horizontal-inputs">
              {renderInput("DF", "died_df")}
              {renderInput("DHF", "died_dhf")}
              {renderInput("DSS", "died_dss")}
            </div>
          </div>
          <div className="form-column">
            <div className="section-header">คงพยาบาล</div>
            <div className="horizontal-inputs">
              {renderInput("DF", "remain_df")}
              {renderInput("DHF", "remain_dhf")}
              {renderInput("DSS", "remain_dss")}
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

export default DenguePage;
