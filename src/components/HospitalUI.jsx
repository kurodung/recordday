// src/components/HospitalUI.jsx
import { useState, useRef, useEffect } from 'react';
import "../styles/HospitalUI.css";

export default function HospitalUI() {
  const [activeTab, setActiveTab] = useState('tab1');

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
    <div className="hospital-container">
      {/* Left Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="profile-avatar">
            <div className="avatar-letter">N</div>
          </div>
          <div className="username">USERNAME</div>
        </div>
        
        <div className="sidebar-menu">
          <button className="sidebar-button active">เวรเช้า</button>
          <button className="sidebar-button">เวรบ่าย</button>
          <button className="sidebar-button">เวรดึก</button>
        </div>
        
        <div className="logout-container">
          <button className="logout-button">ออกจากระบบ</button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="main-content">
        {/* Top Navigation */}
        <div className="top-nav">
          <button 
            className={`nav-tab ${activeTab === 'tab1' ? 'active' : ''}`}
            onClick={() => setActiveTab('tab1')}
          >
            ทั่วไป
          </button>
          <button 
            className={`nav-tab ${activeTab === 'tab2' ? 'active' : ''}`}
            onClick={() => setActiveTab('tab2')}
          >
            Covid-19
          </button>
          <button 
            className={`nav-tab ${activeTab === 'tab3' ? 'active' : ''}`}
            onClick={() => setActiveTab('tab3')}
          >
            ไข้เลือดออก
          </button>
          <div className="date-selector">
            <svg xmlns="http://www.w3.org/2000/svg" className="calendar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="date-text">เลือกวันที่</span>
          </div>
        </div>
        
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
                <div className="section-header">ประเภทผู้ป่วย</div>
                <div className="horizontal-inputs">
                  <div className="input-group">
                    <label className="input-label">ประเภท 1:</label>
                    <input type="number" className="input-field" min="0" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">ประเภท 2:</label>
                    <input type="number" className="input-field" min="0" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">ประเภท 3:</label>
                    <input type="number" className="input-field" min="0" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">ประเภท 4:</label>
                    <input type="number" className="input-field" min="0" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">ประเภท 5:</label>
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
                    <label className="input-label">Non invasive:</label>
                    <input type="number" className="input-field" min="0" />
                  </div>
                </div>
              </div>

              <div className="form-column">
                <div className="section-header">การช่วยหายใจและออกซิเจน</div>
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
              
            </div>
          </div>

          <div className="form-section">
            <div className="flex-grid">
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
                    <label className="input-label">productivity:</label>
                    <input type="number" className="input-field" min="0" />
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
            <button className="save-button">บันทึกข้อมูล</button>
          </div>
        </div>
      </div>
    </div>
  );
}