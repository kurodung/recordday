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
  const [supward, setSupward] = useState("");
  const [supwardOptions, setSupwardOptions] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded = jwtDecode(token);
      setUsername(decoded.username);
      setWardname(decoded.wardname);
    }
  }, []);

  useEffect(() => {
    const fetchSupwards = async () => {
      if (!username) return;
      try {
        const response = await fetch(
          `http://localhost:5000/api/supwards?username=${encodeURIComponent(
            username
          )}`
        );
        const data = await response.json();
        setSupwardOptions(data.supwards || []);
      } catch (err) {
        console.error("Failed to fetch supward options", err);
      }
    };
    fetchSupwards();
  }, [username]);

  useEffect(() => {
    if (!username) return;
    if (!supward && supwardOptions.length > 0) {
      const defaultSupward = supwardOptions[0];
      setSupward(defaultSupward);
  
      let path = "/main";
      if (username.toLowerCase() === "lr") {
        if (defaultSupward === "ห้องคลอด") {
          path = "/lrpage";
        } else if (defaultSupward === "รอคลอด") {
          path = "/main";
        }
      }
  
      navigate(
        `${path}?supward=${encodeURIComponent(
          defaultSupward
        )}&shift=${activeShift}&date=${selectedDate}`,
        { replace: true }
      );
    }
  }, [username, supward, supwardOptions, activeShift, selectedDate, navigate]);
  

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
    if (supward) {
      queryParams.append("supward", supward);
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
          <div className="sidebar-item" onClick={() => navigate("/dashboard")}>
            {" "}
            <FiBarChart className="sidebar-icon" /> Dashboard{" "}
          </div>
          {username === "admin" && (
            <div className="sidebar-item" onClick={() => navigate("/settings")}>
              {" "}
              <FiSettings className="sidebar-icon" /> Settings{" "}
            </div>
          )}
        </div>

        <div className="sidebar-section-label">เวรการทำงาน</div>
        <div className="sidebar-section shift-section">
        <div
  className={`sidebar-item input-group ${activeShift === "morning" ? "highlighted" : ""}`}
  onClick={() => setActiveShift("morning")}
>
  <FiSun className="sidebar-icon" /> เวรเช้า
</div>

<div
  className={`sidebar-item input-group ${activeShift === "afternoon" ? "highlighted" : ""}`}
  onClick={() => setActiveShift("afternoon")}
>
  <FiSunset className="sidebar-icon" /> เวรบ่าย
</div>

<div
  className={`sidebar-item input-group ${activeShift === "night" ? "highlighted" : ""}`}
  onClick={() => setActiveShift("night")}
>
  <FiMoon className="sidebar-icon" /> เวรดึก
</div>

        </div>

        {supwardOptions.length > 0 && (
          <div className="sidebar-section">
            <label className="sidebar-section-label">เลือกกลุ่ม Sup Ward</label>
            <select
              className="sidebar-item"
              style={{ backgroundColor: "#7e3cbd" }}
              value={supward}
              onChange={(e) => {
                const newSupward = e.target.value;
                setSupward(newSupward);
                let path = location.pathname;

                // เช็ค username และ supward เพื่อตัดสินใจเปลี่ยน path
                if (username.toLowerCase() === "lr") {
                  if (newSupward === "ห้องคลอด") {
                    path = "/lrpage";
                  } else if (newSupward === "รอคลอด") {
                    path = "/main";
                  }
                }

                navigate(
                  `${path}?supward=${encodeURIComponent(
                    newSupward
                  )}&shift=${activeShift}&date=${selectedDate}`
                );
              }}
            >
              {supwardOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}

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
              if (supward) {
                navigate(
                  `/covid?supward=${encodeURIComponent(
                    supward
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
              if (supward) {
                navigate(
                  `/dengue?supward=${encodeURIComponent(
                    supward
                  )}&shift=${activeShift}&date=${selectedDate}`
                );
              } else {
                navigate("/dengue");
              }
            }}
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

        {React.isValidElement(children)
          ? React.cloneElement(children, {
              username,
              wardname,
              supward,
              selectedDate,
              shift: activeShift,
            })
          : null}
      </div>
    </div>
  );
}
