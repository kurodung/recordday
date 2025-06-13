// src/components/DenguePage.jsx
import { useState, useRef, useEffect } from "react";
import HospitalLayout from "../components/HospitalLayout";
import "../styles/HospitalUI.css";

export default function DenguePage() {
  const formRef = useRef(null);

  useEffect(() => {
    const handleArrowNavigation = (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const inputs = formRef.current.querySelectorAll("input");
        const inputsArray = Array.from(inputs);
        const currentIndex = inputsArray.indexOf(document.activeElement);

        if (currentIndex === -1) return;

        let nextIndex = currentIndex;

        if (e.key === "ArrowRight") {
          nextIndex = currentIndex + 1;
        } else if (e.key === "ArrowLeft") {
          nextIndex = currentIndex - 1;
        }

        if (nextIndex >= 0 && nextIndex < inputsArray.length) {
          inputsArray[nextIndex].focus();
          e.preventDefault();
        }
      }
    };

    const formEl = formRef.current;
    if (formEl) {
      formEl.addEventListener("keydown", handleArrowNavigation);

      return () => {
        formEl.removeEventListener("keydown", handleArrowNavigation);
      };
    }
  }, []);

  return (
    <HospitalLayout>
      {/* Form Content */}
      <div className="form-container" ref={formRef}>
        {/* ส่วนข้อมูลเตียงและการรับผู้ป่วย */}
        <div className="form-section">
          <div className="flex-grid">
            {/* ส่วนจำนวนเตียงและยอดยกมา */}
            <div className="form-column">
              <div className="section-label">ข้อมูลเตียง</div>
              <div className="input-group highlighted">
                <label className="input-label">จำนวนเตียง:</label>
                <input type="number" className="input-field" min="0" readOnly />
              </div>
            </div>

            {/* ส่วนยอดรับใหม่ - แนวนอนตามที่ต้องการ */}
            <div className="form-column">
              <div className="section-header">ยอดยกมา</div>
              {/* แก้ไขตรงนี้ เพิ่มคลาส horizontal-inputs เพื่อให้แสดงผลในแนวนอน */}
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label">DF:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">DHF:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">DSS:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
              </div>
            </div>

            <div className="form-column">
              <div className="section-header">รับใหม่</div>
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label">DF:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">DHF:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">DSS:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
              </div>
            </div>

            <div className="form-column">
              <div className="section-header">รับย้าย</div>
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label">DF:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">DHF:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">DSS:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="flex-grid">
            <div className="form-column">
              <div className="section-header">กลับบ้าน</div>
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label">DF:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">DHF:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">DSS:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
              </div>
            </div>

            <div className="form-column">
              <div className="section-header">ย้ายตึก</div>
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label">DF:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">DHF:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">DSS:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
              </div>
            </div>

            <div className="form-column">
              <div className="section-header">เสียชีวิต</div>
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label">DF:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">DHF:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">DSS:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
              </div>
            </div>

            <div className="form-column">
              <div className="section-header">คงพยาบาล</div>
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label">DF:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">DHF:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">DSS:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ปุ่มบันทึก */}
        <div className="button-container">
          <button className="save-button">บันทึกข้อมูล</button>
        </div>
      </div>
    </HospitalLayout>
  );
}
