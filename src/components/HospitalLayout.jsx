import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "../styles/HospitalUI.css";

export default function HospitalLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeShift, setActiveShift] = useState("morning");
  const [username, setUsername] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/"); // 🛡 ป้องกันไม่ให้เข้าโดยไม่ login
    } else {
      try {
        const decoded = jwtDecode(token);
        setUsername(decoded.wardname);
      } catch (err) {
        console.error("Invalid token", err);
        navigate("/");
      }
    }
  }, []);

  const isActiveTab = (path) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.includes(path)) return true;
    return false;
  };

  return (
    <div className="hospital-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="profile-avatar">
            <div className="avatar-letter">
              {username?.charAt(0).toUpperCase() || "N"}
            </div>
          </div>
          <div className="username">{username}</div>
        </div>

        <div className="sidebar-menu">
          <button
            className={`sidebar-button ${
              activeShift === "morning" ? "active" : ""
            }`}
            onClick={() => setActiveShift("morning")}
          >
            เวรเช้า
          </button>
          <button
            className={`sidebar-button ${
              activeShift === "afternoon" ? "active" : ""
            }`}
            onClick={() => setActiveShift("afternoon")}
          >
            เวรบ่าย
          </button>
          <button
            className={`sidebar-button ${
              activeShift === "night" ? "active" : ""
            }`}
            onClick={() => setActiveShift("night")}
          >
            เวรดึก
          </button>
        </div>

        <div className="logout-container">
          <button
            className="logout-button"
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/");
            }}
          >
            ออกจากระบบ
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="main-content">
        {/* Navigation + Content */}
        <div className="top-nav">
          <button
            className={`nav-tab ${isActiveTab("/main") ? "active" : ""}`}
            onClick={() => navigate("/main")}
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
            <label className="date-label">
              <input
                type="date"
                className="date-input"
                defaultValue={new Date().toISOString().split("T")[0]}
              />
            </label>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
