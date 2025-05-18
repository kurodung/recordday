// src/components/HospitalUI.jsx
import { useState } from 'react';
import "../styles/HospitalUI.css";

export default function HospitalUI() {
  const [activeTab, setActiveTab] = useState('tab1');
  
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
            ใช้เลือดออก
          </button>
          <div className="date-selector">
            <svg xmlns="http://www.w3.org/2000/svg" className="calendar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="date-text">เลือกวันที่</span>
          </div>
        </div>
        
        {/* Form Content */}
        <div className="form-container">
          {/* Top Row - จำนวนเตียง, ยอดยกมา, ยอดรับ */}
          <div className="form-section">
            <div className="bed-stats">
              <div className="input-group">
                <label className="input-label">จำนวนเตียง :</label>
                <input type="text" className="input-field" />
              </div>
              
              <div className="input-group">
                <label className="input-label">ยอดยกมา :</label>
                <input type="text" className="input-field" />
              </div>
              
              <div className="admission-group">
                <div className="group-title">ยอดรับ</div>
                <div className="input-group nested">
                  <label className="input-label nested">รับใหม่ :</label>
                  <input type="text" className="input-field" />
                </div>
                <div className="input-group nested">
                  <label className="input-label nested">รับย้าย :</label>
                  <input type="text" className="input-field" />
                </div>
              </div>
            </div>
          </div>

          {/* Middle Row - ยอดจำหน่าย */}
          <div className="form-section">
            <div className="section-title">ยอดจำหน่าย</div>
            <div className="discharge-stats">
              <div className="input-group">
                <label className="input-label">กลับบ้าน :</label>
                <input type="text" className="input-field" />
              </div>
              <div className="input-group">
                <label className="input-label">ย้ายติด :</label>
                <input type="text" className="input-field" />
              </div>
              <div className="input-group">
                <label className="input-label">Refer out :</label>
                <input type="text" className="input-field" />
              </div>
              <div className="input-group">
                <label className="input-label">Refer back :</label>
                <input type="text" className="input-field" />
              </div>
              <div className="input-group">
                <label className="input-label">กลับบ้าน :</label>
                <input type="text" className="input-field" />
              </div>
            </div>

            <div className="input-group total-care">
              <label className="input-label">คงพยาบาล :</label>
              <input type="text" className="input-field" />
            </div>
          </div>
          
          {/* Bottom Row - ประเภท */}
          <div className="form-section">
            <div className="section-title">ประเภท</div>
            <div className="patient-categories">
              <div className="input-group">
                <label className="input-label small">1 :</label>
                <input type="text" className="input-field" />
              </div>
              <div className="input-group">
                <label className="input-label small">2 :</label>
                <input type="text" className="input-field" />
              </div>
              <div className="input-group">
                <label className="input-label small">3 :</label>
                <input type="text" className="input-field" />
              </div>
              <div className="input-group">
                <label className="input-label small">4 :</label>
                <input type="text" className="input-field" />
              </div>
              <div className="input-group">
                <label className="input-label small">5 :</label>
                <input type="text" className="input-field" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}