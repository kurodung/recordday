// src/components/HospitalUI.jsx
import { useState, useRef, useEffect } from 'react';
import "../styles/HospitalUI.css";

export default function LRpage() {
  // ✅ ref สำหรับ form container ทั้งหมด
  const formRef = useRef(null);

  useEffect(() => {
    const handleArrowNavigation = (e) => {
      // ✅ เอาแค่ซ้าย/ขวา
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const inputs = formRef.current.querySelectorAll('input');
        const inputsArray = Array.from(inputs);
        const currentIndex = inputsArray.indexOf(document.activeElement);
  
        if (currentIndex === -1) return;
  
        let nextIndex = currentIndex;
  
        if (e.key === 'ArrowRight') {
          nextIndex = currentIndex + 1;
        } else if (e.key === 'ArrowLeft') {
          nextIndex = currentIndex - 1;
        }
  
        // ตรวจสอบ bounds
        if (nextIndex >= 0 && nextIndex < inputsArray.length) {
          inputsArray[nextIndex].focus();
          e.preventDefault();
        }
      }
    };
  
    const formEl = formRef.current;
    if (formEl) {
      formEl.addEventListener('keydown', handleArrowNavigation);
      
      return () => {
        formEl.removeEventListener('keydown', handleArrowNavigation);
      };
    }
  }, []);
  
  return (
      <div className="form-container" ref={formRef}>
        {/* ส่วนข้อมูลเตียงและการรับผู้ป่วย */}
        <div className="form-section">
          <div className="flex-grid">
            {/* ส่วนจำนวนเตียงและยอดยกมา */}
            <div className="form-column">
              <div className="section-label">ข้อมูลเตียง</div>
              <div className="input-group highlighted">
                <label className="input-label">จำนวนเตียง:</label>
                <input type="number" className="input-field" min="0" readOnly/>
              </div>
            </div>

            <div className="form-column">
              <div className="section-header">ยอดยกมา</div>
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label"></label>
                  <input type="number" className="input-field" min="0" />
                </div>
              </div>
            </div>
            
            {/* ส่วนยอดรับใหม่ - แนวนอนตามที่ต้องการ */}
            <div className="form-column">
              <div className="section-header">ยอดรับ</div>
              {/* แก้ไขตรงนี้ เพิ่มคลาส horizontal-inputs เพื่อให้แสดงผลในแนวนอน */}
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label">รับใหม่:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">รับย้าย:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
              </div>
            </div>

            <div className="form-column">
              <div className="section-header">ยอดจำหน่าย</div>
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label">กลับบ้าน:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">ย้ายออก:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">Refer out:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label" style={{ marginLeft: "-8px" }}>Refer back:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label" style={{ color: 'red' }} >เสียชีวิต:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
              </div>
            </div>
            
            {/* ส่วนจำนวนคงพยาบาล */}
            <div className="form-column">
              <div className="section-label">คงพยาบาล</div>
              <div className="input-group">
                <label className="input-label"></label>
                <input type="number" className="input-field" min="0" />
              </div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="flex-grid">
            <div className="form-column">
              <div className="section-header">ชนิดการคลอด</div>
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label">NL:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">Forcep:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">Vac:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">Br:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">C/S:</label>
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
              <div className="section-header">เปลเสริม</div>
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label"></label>
                  <input type="number" className="input-field" min="0" />
                </div>
              </div>
            </div>

            <div className="form-column">
              <div className="section-header">PAS</div>
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label"></label>
                  <input type="number" className="input-field" min="0" />
                </div>
              </div>
            </div>

            <div className="form-column">
              <div className="section-header">CPR</div>
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
              <div className="section-header">การดูแลรอบการผ่าตัด</div>
              <div className="horizontal-inputs">
              <div className="input-group">
                  <label className="input-label">Pre OP:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">Post OP:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
              </div>
            </div>

            <div className="form-column">
              <div className="section-header">ติดเชื้อดื้อยา(XDR/CRE/VRE)</div>
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label"></label>
                  <input type="number" className="input-field" min="0"  style={{ display: "block", margin: "0 auto" }}/>
                </div>
              </div>
            </div>

            <div className="form-column">
              <div className="section-header">GCS</div>
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label"></label>
                  <input type="number" className="input-field" min="0"  style={{ display: "block", margin: "0 auto" }}/>
                </div>
              </div>
            </div>

            <div className="form-column">
              <div className="section-header">Strokeในตึก</div>
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label"></label>
                  <input type="number" className="input-field" min="0"  style={{ display: "block", margin: "0 auto" }}/>
                </div>
              </div>
            </div>

            <div className="form-column">
              <div className="section-header">จิตเวชในตึก</div>
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label"></label>
                  <input type="number" className="input-field" min="0"  style={{ display: "block", margin: "0 auto" }}/>
                </div>
              </div>
            </div>

            <div className="form-column">
              <div className="section-header">นักโทษในตึก</div>
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
              <div className="section-header">อัตรากำลังทั้งหมด</div>
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label">RN:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">PN:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">NA:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">พนักงาน:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">เฉพาะ RN ขึ้นเสริม:</label>
                  <input type="number" className="input-field" min="0" />
                </div>
                <div className="input-group">
                  <div className="input-group highlighted">
                    <label className="input-label">productivity:</label>
                    <input type="number" className="input-field" min="0" />
                  </div>
                </div>
              </div>
            </div>

            <div className="form-column">
              <div className="section-header">บันทึกเหตุการณ์/อุบัติการณ์</div>
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label"></label>
                  <input type="text" className="input-field" style={{width: 250}}/>
                </div>
              </div>
            </div>

            <div className="form-column">
              <div className="section-header" style={{color:"green"}}>พยาบาลหัวหน้าเวร</div>
              <div className="horizontal-inputs">
                <div className="input-group">
                  <label className="input-label"></label>
                  <input type="text" className="input-field" style={{width: 150}} />
                </div>
              </div>
            </div>

          </div>
        </div>
        
        {/* ปุ่มบันทึก */}
        <div className="button-container">
        <button type="submit" className="save-button">บันทึกข้อมูล</button>
        </div>
      </div>
  );
}