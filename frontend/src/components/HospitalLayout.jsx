import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import {
  FiSun,
  FiSunset,
  FiMoon,
  FiBarChart,
  FiSettings,
} from "react-icons/fi";
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
  const [subward, setsubward] = useState("");
  const [subwardOptions, setsubwardOptions] = useState([]);

  // อ่านข้อมูล user จาก token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded = jwtDecode(token);
      setUsername(decoded.username);
      setWardname(decoded.wardname);
    }
  }, []);

  // ดึงข้อมูล subward options
  useEffect(() => {
    const fetchsubwards = async () => {
      if (!username) return;
      try {
        const response = await fetch(
          `http://localhost:5000/api/subwards?username=${encodeURIComponent(
            username
          )}`
        );
        const data = await response.json();
        setsubwardOptions(data.subwards || []);
      } catch (err) {
        console.error("Failed to fetch subward options", err);
      }
    };
    fetchsubwards();
  }, [username]);

  // กำหนดค่า default subward เมื่อยังไม่มี
  useEffect(() => {
    if (subwardOptions.length > 0 && !subward) {
      setsubward((prev) => prev || subwardOptions[0]); // ป้องกัน re-set ซ้ำ
    }
  }, [subwardOptions, subward]);

  // ทำ navigate ทุกครั้งที่ activeShift, selectedDate หรือ subward เปลี่ยน
  useEffect(() => {
    if (!username) return;

    const allowedPaths = ["/main", "/lrpage"];
    const isAllowedPath = allowedPaths.includes(location.pathname);

    if (!isAllowedPath) return;

    let path = location.pathname;

    const lowerUser = username.toLowerCase();

    if (lowerUser === "lr") {
      if (subward === "ห้องคลอด") {
        path = "/lrpage";
      } else if (subward === "รอคลอด") {
        path = "/main";
      }
    } else {
      // สำหรับ user ทั่วไป บังคับให้ใช้ /main
      path = "/main";
    }

    const queryParams = new URLSearchParams({
      shift: activeShift,
      date: selectedDate,
    });

    if (subward) {
      queryParams.append("subward", subward);
    }

    navigate(`${path}?${queryParams.toString()}`, { replace: true });
  }, [
    activeShift,
    selectedDate,
    subward,
    username,
    navigate,
    location.pathname,
  ]);

  const isActiveTab = (paths) => {
    if (Array.isArray(paths)) {
      return paths.some((p) => location.pathname.includes(p));
    }
    return location.pathname.includes(paths);
  };

  const handleGeneralClick = () => {
    const lowerUser = username?.trim().toLowerCase();
    const path = lowerUser === "lr" ? "/lrpage" : "/main";
    const queryParams = new URLSearchParams({
      shift: activeShift,
      date: selectedDate,
    });
    if (subward) {
      queryParams.append("subward", subward);
    }
    navigate(`${path}?${queryParams.toString()}`);
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
          {username === "admin" && (
            <div className="sidebar-item" onClick={() => navigate("/settings")}>
              <FiSettings className="sidebar-icon" /> Settings
            </div>
          )}
        </div>

        <div className="sidebar-section-label">เวรการทำงาน</div>
        <div className="sidebar-section shift-section">
          <div
            className={`sidebar-item input-group ${
              activeShift === "morning" ? "highlighted" : ""
            }`}
            onClick={() => setActiveShift("morning")}
          >
            <FiSun className="sidebar-icon" /> เวรเช้า
          </div>

          <div
            className={`sidebar-item input-group ${
              activeShift === "afternoon" ? "highlighted" : ""
            }`}
            onClick={() => setActiveShift("afternoon")}
          >
            <FiSunset className="sidebar-icon" /> เวรบ่าย
          </div>

          <div
            className={`sidebar-item input-group ${
              activeShift === "night" ? "highlighted" : ""
            }`}
            onClick={() => setActiveShift("night")}
          >
            <FiMoon className="sidebar-icon" /> เวรดึก
          </div>
        </div>

        {subwardOptions.length > 1 ||
        (subwardOptions.length === 1 && subwardOptions[0]) ? (
          <div className="sidebar-section">
            <label className="sidebar-section-label">เลือกกลุ่ม Sup Ward</label>
            <select
              className="sidebar-item"
              style={{ backgroundColor: "#7e3cbd" }}
              value={subward}
              onChange={(e) => setsubward(e.target.value)}
            >
              {subwardOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ) : null}

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
            onClick={() => {
              if (subward) {
                navigate(
                  `/covid?subward=${encodeURIComponent(
                    subward
                  )}&shift=${activeShift}&date=${selectedDate}`
                );
              } else {
                navigate("/covid");
              }
            }}
          >
            Covid-19
          </button>

          <button
            className={`nav-tab ${isActiveTab("/dengue") ? "active" : ""}`}
            onClick={() => {
              if (subward) {
                navigate(
                  `/dengue?subward=${encodeURIComponent(
                    subward
                  )}&shift=${activeShift}&date=${selectedDate}`
                );
              } else {
                navigate("/dengue");
              }
            }}
          >
            ไข้เลือดออก
          </button>

          <button
            className={`nav-tab ${isActiveTab("/dashboard") ? "active" : ""}`}
            style={{ display: "flex", alignItems: "center" }}
            onClick={() => navigate("/dashboard")}
          >
            <FiBarChart className="sidebar-icon" />
            Dashboard
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

        {React.isValidElement(children)
          ? React.cloneElement(children, {
              username,
              wardname,
              subward,
              selectedDate,
              shift: activeShift,
            })
          : null}
      </div>
    </div>
  );
}
