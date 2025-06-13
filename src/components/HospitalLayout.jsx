// src/components/HospitalLayout.jsx
import { useState } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/HospitalUI.css";

export default function HospitalLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeShift, setActiveShift] = useState('morning');

  // ฟังก์ชันตรวจสอบว่าหน้าไหนกำลัง active อยู่
  const isActiveTab = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.includes(path)) return true;
    return false;
  };

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
          <button 
            className={`sidebar-button ${activeShift === 'morning' ? 'active' : ''}`}
            onClick={() => setActiveShift('morning')}
          >
            เวรเช้า
          </button>
          <button 
            className={`sidebar-button ${activeShift === 'afternoon' ? 'active' : ''}`}
            onClick={() => setActiveShift('afternoon')}
          >
            เวรบ่าย
          </button>
          <button 
            className={`sidebar-button ${activeShift === 'night' ? 'active' : ''}`}
            onClick={() => setActiveShift('night')}
          >
            เวรดึก
          </button>
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
            className={`nav-tab ${isActiveTab('/') ? 'active' : ''}`}
            onClick={() => navigate('/')}>ทั่วไป</button>
          <button
            className={`nav-tab ${isActiveTab('/covid') ? 'active' : ''}`}
            onClick={() => navigate('/covid')}>Covid-19</button>
          <button
            className={`nav-tab ${isActiveTab('/dengue') ? 'active' : ''}`}
            onClick={() => navigate('/dengue')}>ไข้เลือดออก</button>

          <div className="date-selector">
            <label className="date-label">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="calendar-icon"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <input
                type="date"
                className="date-input"
                defaultValue={new Date().toISOString().split("T")[0]}
              />
            </label>
          </div>



        </div>
        
        {/* Content Area - จะแสดงเนื้อหาที่ส่งเข้ามาผ่าน children */}
        <div className="content-wrapper">
          {children}
        </div>
      </div>
    </div>
  );
}