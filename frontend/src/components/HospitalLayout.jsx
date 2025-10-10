// src/components/HospitalLayout.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import {
  FiMenu,
  FiX,
  FiSun,
  FiSunset,
  FiMoon,
  FiBarChart,
  FiSettings,
  FiCalendar,
} from "react-icons/fi";
import "../styles/HospitalUI.css";

// YYYY-MM-DD แบบ local (กัน -1 วัน)
const localISODate = (d = new Date()) => {
  const dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 10);
};

// -------- helpers --------
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .trim();
const hasToken = (name, token) => {
  const n = norm(name),
    t = norm(token);
  return n === t || n.startsWith(t) || n.includes(t);
};

const usernameToPageMap = {
  lr: (subward) => (subward === "ห้องคลอด" ? "/lrpage" : "/main"),
  or: () => "/orpage",
  hd: () => "/hdpage",
  cl: () => "/clpage",
  cu: () => "/cupage",
  stch: () => "/stchpage",
  endo: () => "/endopage",
  rt: () => "/rtpage",
  ir: () => "/irpage",
  nm: () => "/nmpage",
  sl: () => "/slpage",
  pft: () => "/pftpage",
  nwcw: () => "/nwcwpage",
  er: () => "/erpage",
  opd: () => "/opdpage",

};

// -----------------------------------------

export default function HospitalLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeShift, setActiveShift] = useState("morning");
  const [selectedDate, setSelectedDate] = useState(() => localISODate());
  const [username, setUsername] = useState("");
  const [wardname, setWardname] = useState("");
  const [subward, setsubward] = useState("");
  const [subwardOptions, setsubwardOptions] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // viewport watcher
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    try {
      mq.addEventListener("change", onChange);
    } catch {
      mq.addListener(onChange);
    }
    return () => {
      try {
        mq.removeEventListener("change", onChange);
      } catch {
        mq.removeListener(onChange);
      }
    };
  }, []);

  // lock scroll
  useEffect(() => {
    if (!isMobile) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, sidebarOpen]);

  // esc close sidebar
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // read user from token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || token.split(".").length !== 3) {
      navigate("/");
      return;
    }
    try {
      const decoded = jwtDecode(token);
      if (decoded?.username) {
        setUsername(decoded.username);
        setWardname(decoded.wardname);
      } else throw new Error("Username not found in token");
    } catch (error) {
      console.error("Invalid token:", error);
      localStorage.removeItem("token");
      navigate("/");
    }
  }, [navigate]);

  // sync shift/date
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qShift = params.get("shift");
    const qDate = params.get("date");
    if (qShift) setActiveShift(qShift);
    if (qDate) setSelectedDate(qDate);
  }, [location.search]);

  // fetch subwards
  useEffect(() => {
    const fetchsubwards = async () => {
      if (!username || !wardname) return;
      try {
        const token = localStorage.getItem("token") || "";
        const res = await fetch(
          `http://localhost:5000/api/subwards?username=${encodeURIComponent(
            username
          )}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        const list = Array.isArray(data?.subwards)
          ? data.subwards
          : Array.isArray(data)
          ? data
          : [];
        setsubwardOptions(list);

        if (!subward) {
          setsubward(list[0] || "");
        } else if (!list.includes(subward)) {
          setsubward(list[0] || "");
        }
      } catch (err) {
        console.error("Failed to fetch subward options", err);
      }
    };
    fetchsubwards();
  }, [username, wardname, subward]);

  // sync query
  useEffect(() => {
    if (!username || !wardname) return;
    const current = new URLSearchParams(location.search);
    const want = new URLSearchParams(location.search);
    want.set("shift", activeShift);
    want.set("date", selectedDate);
    if (subward) want.set("subward", subward);
    else want.delete("subward");
    if (current.toString() !== want.toString()) {
      navigate(`${location.pathname}?${want.toString()}`, { replace: true });
    }
  }, [activeShift, selectedDate, subward, username, wardname, location.pathname, location.search, navigate]);

  useEffect(() => {
  // หน้าที่ไม่ควรบังคับ redirect
  const skipPaths = ["/dashboard", "/dashboard-or", "/dashboard-hd", "/covid", "/dengue", "/multi-day", "/settings"];
  if (skipPaths.some((p) => location.pathname.startsWith(p))) return;

  const sub = norm(subward);
  const qs = new URLSearchParams({
    shift: activeShift,
    date: selectedDate,
    subward,
  });

  let target = null;
  if (sub === "ห้องคลอด") {
    target = `/lrpage?${qs.toString()}`;
  } else if (sub === "รอคลอด") {
    target = `/main?${qs.toString()}`;
  }

  if (target) {
    const current = `${location.pathname}${location.search}`;
    if (current !== target) {
      navigate(target, { replace: true });
    }
  }
}, [subward, activeShift, selectedDate, location.pathname, location.search, navigate]);

  const isActiveTab = (paths) => {
    if (Array.isArray(paths))
      return paths.some((p) => location.pathname.includes(p));
    return location.pathname.includes(paths);
  };

  const handleGeneralClick = () => {
    const getBasePage = usernameToPageMap[norm(username)];
    const base = getBasePage ? getBasePage(subward) : "/main";
    const qs = new URLSearchParams({ shift: activeShift, date: selectedDate });
    if (subward) qs.append("subward", subward);
    navigate(`${base}?${qs.toString()}`);
    if (isMobile) setSidebarOpen(false);
  };

  const buildQuery = () => {
    const qs = new URLSearchParams({ shift: activeShift, date: selectedDate });
    if (subward) qs.set("subward", subward);
    return `?${qs.toString()}`;
  };

  const go = (path) => {
    navigate(`${path}${buildQuery()}`);
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <div className="hospital-container">
      {isMobile && sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`sidebar custom-sidebar ${isMobile ? "mobile" : ""} ${sidebarOpen ? "open" : ""}`}
        aria-hidden={isMobile && !sidebarOpen}
      >
        <div className="sidebar-header">
          <div className="avatar-circle">
            {username?.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-title">{wardname || "Ward"}</div>
          {isMobile && (
            <button className="icon-button close" onClick={() => setSidebarOpen(false)}>
              <FiX />
            </button>
          )}
        </div>

        <div className="sidebar-section">
          {username === "admin" && (
            <div className="sidebar-item" onClick={() => go("/settings")}>
              <FiSettings className="sidebar-icon" /> Settings
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

        {subwardOptions.length > 0 && (
          <div className="sidebar-section">
            <label className="sidebar-section-label">เลือกกลุ่ม Sub Ward</label>
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
      </aside>

      <main className="main-content">
        <div className="top-nav">
          {isMobile && (
            <button className="icon-button" onClick={() => setSidebarOpen(true)}>
              <FiMenu />
            </button>
          )}

          <div className="tabs-scroll">
            <button
              className={`nav-tab ${isActiveTab(["/main", "/lrpage"]) ? "active" : ""}`}
              onClick={handleGeneralClick}
            >
              ทั่วไป
            </button>
            <button
              className={`nav-tab ${isActiveTab("/covid") ? "active" : ""}`}
              onClick={() => go("/covid")}
            >
              Covid-19
            </button>
            <button
              className={`nav-tab ${isActiveTab("/dengue") ? "active" : ""}`}
              onClick={() => go("/dengue")}
            >
              ไข้เลือดออก
            </button>
            <button
              className={`nav-tab ${isActiveTab("/multi-day") ? "active" : ""}`}
              onClick={() => go("/multi-day")}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <FiCalendar className="sidebar-icon" />
              MultiDay
            </button>
            <button
              className={`nav-tab ${isActiveTab(["/dashboard", "/dashboard-or"]) ? "active" : ""}`}
              onClick={() => {
                if (norm(wardname) === "ห้องผ่าตัด" || norm(username) === "or") {
                  go("/dashboard-or");
                } else if (norm(wardname) === "ไตเทียม" || norm(username) === "hd") {
                  go("/dashboard-hd");
                } else if (norm(wardname) === "Cath lab" || norm(username) === "cl") {
                  go("/dashboard-cl");
                } else if (norm(wardname) === "หน่วยโรคหัวใจ" || norm(username) === "cu") {
                  go("/dashboard-cu");
                } else if (norm(wardname) === "เคมีบำบัด(ตรวจรักษาพิเศษ)" || norm(username) === "stch") {
                  go("/dashboard-stch");
                } else if (norm(wardname) === "ส่องกล้อง" || norm(username) === "endo") {
                  go("/dashboard-endo");
                } else if (norm(wardname) === "รังสีรักษา" || norm(username) === "rt") {
                  go("/dashboard-rt");
                } else if (norm(wardname) === "รังสีร่วมรักษา" || norm(username) === "ir") {
                  go("/dashboard-ir");
                } else if (norm(wardname) === "เวชศาสตร์นิวเคลียร์" || norm(username) === "nm") {
                  go("/dashboard-nm");
                } else if (norm(wardname) === "Sleep lab" || norm(username) === "sl") {
                  go("/dashboard-sl");
                } else if (norm(wardname) === "สมรรถภาพปอด" || norm(username) === "pft") {
                  go("/dashboard-pft");
                } else if (norm(wardname) === "ศูนย์พักนวชีวา" || norm(username) === "nwcw") {
                  go("/dashboard-nwcw");
                } else if (norm(wardname) === "อุบัติเหตุ" || norm(username) === "er") {
                  go("/dashboard-er");
                } else if (norm(wardname) === "ผู้ป่วยนอก" || norm(username) === "opd") {
                  go("/dashboard-opd");
                } else {
                  go("/dashboard");
                }
              }}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <FiBarChart className="sidebar-icon" />
              Dashboard
            </button>
          </div>

          <div className="date-selector">
            <input
              type="date"
              className="date-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              onPointerDown={(e) => {
                const el = e.currentTarget;
                if (typeof el.showPicker === "function") {
                  e.preventDefault();
                  el.showPicker();
                }
              }}
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
      </main>
    </div>
  );
}
