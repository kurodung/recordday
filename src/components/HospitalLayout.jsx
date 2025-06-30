import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode"; 
import {FiSun,FiSunset,FiMoon,FiBarChart,FiSettings,} from "react-icons/fi";
import "../styles/HospitalUI.css";

export default function HospitalLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeShift, setActiveShift] = useState("morning");
  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [username, setUsername] = useState("");
  const [wardname, setWardname] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
    } else {
      try {
        const decoded = jwtDecode(token);
        setUsername(decoded.username);
        setWardname(decoded.wardname);
      } catch (err) {
        console.error("Invalid token", err);
        navigate("/");
      }
    }

    const { shift, date } = getCurrentShiftAndDate();
    setActiveShift(shift);
    setSelectedDate(date);
  }, []);

  const getCurrentShiftAndDate = () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const getFormattedDate = (date) => date.toISOString().split("T")[0];

    if (hour >= 8 && (hour < 16 || (hour === 16 && minute < 30))) {
      return { shift: "morning", date: getFormattedDate(now) };
    } else if ((hour === 16 && minute >= 30) || (hour >= 17 && hour < 24)) {
      return { shift: "afternoon", date: getFormattedDate(now) };
    } else {
      const prev = new Date(now);
      prev.setDate(now.getDate() - 1);
      return { shift: "night", date: getFormattedDate(prev) };
    }
  };

  const isActiveTab = (paths) => {
    if (Array.isArray(paths)) {
      return paths.some((p) => location.pathname.includes(p));
    }
    return location.pathname.includes(paths);
  };

  const handleGeneralClick = () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const decoded = jwtDecode(token);
      const user = decoded.username?.trim().toLowerCase();
      if (user === "lr") {
        navigate("/lrpage");
      } else {
        navigate("/main");
      }
    } catch (err) {
      navigate("/main");
    }
  };

  return (
    <div className="hospital-container">
      <div className="sidebar custom-sidebar">
        <div className="sidebar-header">
          <div className="avatar-circle">
            {username?.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-title">{wardname || "Ward"}</div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-item" onClick={() => navigate("/dashboard")}>
            <FiBarChart className="sidebar-icon" /> Dashboard
          </div>
          <div className="sidebar-item" onClick={() => navigate("/settings")}>
            <FiSettings className="sidebar-icon" /> Settings
          </div>
        </div>

        <div className="sidebar-section-label">เวรการทำงาน</div>
        <div className="sidebar-section shift-section">
          <div
            className={`sidebar-item ${
              activeShift === "morning" ? "active" : ""
            }`}
            onClick={() => setActiveShift("morning")}
          >
            <FiSun className="sidebar-icon" /> เวรเช้า
          </div>
          <div
            className={`sidebar-item ${
              activeShift === "afternoon" ? "active" : ""
            }`}
            onClick={() => setActiveShift("afternoon")}
          >
            <FiSunset className="sidebar-icon" /> เวรบ่าย
          </div>
          <div
            className={`sidebar-item ${
              activeShift === "night" ? "active" : ""
            }`}
            onClick={() => setActiveShift("night")}
          >
            <FiMoon className="sidebar-icon" /> เวรดึก
          </div>
        </div>

        <div className="logout-container" style={{ marginTop: "auto" }}>
          <button
            className="logout-button"
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/");
            }}
          >
            <i className="icon-logout" /> Log Out
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="top-nav">
          <button
            className={`nav-tab ${
              isActiveTab(["/main", "/lrpage"]) ? "active" : ""
            }`}
            onClick={handleGeneralClick}
          >
            ทั่วไป
          </button>
          <button
            className={`nav-tab ${isActiveTab("/covid") ? "active" : ""}`}
            onClick={() => navigate("/covid")}
          >
            Covid-19
          </button>
          <button
            className={`nav-tab ${isActiveTab("/dengue") ? "active" : ""}`}
            onClick={() => navigate("/dengue")}
          >
            ไข้เลือดออก
          </button>
          <div className="date-selector">
            <input
              type="date"
              className="date-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
        {/* เปลี่ยนตรงนี้ */}
        {React.isValidElement(children)
          ? React.cloneElement(children, {
              username,
              wardname,
              selectedDate,
              shift: activeShift,
            })
          : null}
      </div>
    </div>
  );
}
