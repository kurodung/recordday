// src/pages/Covid19Page.jsx
import { useState, useRef, useEffect } from "react";
import "../styles/HospitalUI.css";

const Covid19Page = () => {
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
          <div className="form-container" ref={formRef}>
            {/* ส่วนข้อมูลเตียงและการรับผู้ป่วย */}
            <div className="form-section">
              <div className="flex-grid">
                {/* ส่วนยอดรับใหม่ - แนวนอนตามที่ต้องการ */}
                <div className="form-column">
                  <div className="section-header">จำนวนผู้ป่วย</div>
                  {/* แก้ไขตรงนี้ เพิ่มคลาส horizontal-inputs เพื่อให้แสดงผลในแนวนอน */}
                  <div className="horizontal-inputs">
                    <div className="input-group">
                      <label className="input-label">ยอดยกมา:</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">รับใหม่:</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">รับย้าย:</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">จำหน่าย:</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">รับย้าย:</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                  </div>
                </div>
    
                <div className="form-column">
                  <div className="section-header">กลุ่มอายุ</div>
                  {/* แก้ไขตรงนี้ เพิ่มคลาส horizontal-inputs เพื่อให้แสดงผลในแนวนอน */}
                  <div className="horizontal-inputs">
                    <div className="input-group">
                      <label className="input-label">ผู้ใหญ่:</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">เด็ก:</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Newborn:</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">หญิงตั้งครรภ์:</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">หลังคลอด:</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                  </div>
                </div>
    
              </div>
            </div>
    
            <div className="form-section">
              <div className="flex-grid">
                <div className="form-column">
                  <div className="section-header">ประเภท/ระดับความรุนแรง</div>
                  <div className="horizontal-inputs">
                    <div className="input-group">
                      <label className="input-label" style={{color:"red"}} >5/แดง:</label>
                      <input type="number" className="input-field" min="0"/>
                    </div>
                    <div className="input-group">
                      <label className="input-label" style={{color:"#DAA520"}}>4/เหลือง:</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                    <div className="input-group">
                      <label className="input-label" style={{color:"green"}}>3/เขียว:</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Asym/ไม่มีอาการ:</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                  </div>
                </div>
    
                <div className="form-column">
                  <div className="section-header">Ventilator</div>
                  <div className="horizontal-inputs">
                    <div className="input-group">
                      <label className="input-label">Invasive:</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">NON Invasive:</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                  </div>
                </div>

                <div className="form-column">
                  <div className="section-header">กลุ่มการให้ออกซิเจนและอุปกรณ์</div>
                  <div className="horizontal-inputs">
                    <div className="input-group">
                      <label className="input-label">ใช้เครื่อง HFNC:</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">ให้ออกซิเจน:</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                  </div>
                </div>

                <div className="form-column">
                  <div className="section-header">ห้อง/เตียงว่าง</div>
                  <div className="horizontal-inputs">
                    <div className="input-group">
                      <label className="input-label"></label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="form-section">
              <div className="flex-grid">
                <div className="form-column">
                  <div className="section-header">หัตถการ</div>
                  <div className="horizontal-inputs">
                    <div className="input-group">
                      <label className="input-label">CPR</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Pre op</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Post op</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">CRRT</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Ecmo</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Prone position</label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                  </div>
                </div>

                <div className="form-column">
                  <div className="section-header">เสียชีวิต</div>
                  <div className="horizontal-inputs">
                    <div className="input-group">
                      <label className="input-label"></label>
                      <input type="number" className="input-field" min="0" />
                    </div>
                  </div>
                </div>

                <div className="form-column">
                  <div className="section-header">บันทึกเหตุการณ์/อุบัติการณ์</div>
                  <div className="horizontal-inputs">
                    <div className="input-group">
                      <label className="input-label"></label>
                      <input type="text" className="input-field" style={{width: 250}} />
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
  );
};

export default Covid19Page;
