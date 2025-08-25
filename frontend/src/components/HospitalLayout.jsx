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

// -------- subward priority helpers --------
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .trim();
const hasToken = (name, token) => {
  const n = norm(name),
    t = norm(token);
  return n === t || n.startsWith(t) || n.includes(t);
};

// จัดลำดับ sub-ward ให้ "อายุรกรรม*" มาก่อน "semi icu"
const sortSubwardsWithPriority = (list, ward) => {
  const PRIORITY = {
    อายุรกรรม: ["อายุรกรรม", "semi icu", "semi-icu", "semiicu"],
  };
  const wardKey = norm(ward);
  const matchedKey =
    Object.keys(PRIORITY).find((k) => wardKey.includes(norm(k))) || "";
  const tokens = (PRIORITY[matchedKey] || []).map(norm);
  const rankOf = (name) => {
    for (let i = 0; i < tokens.length; i++)
      if (hasToken(name, tokens[i])) return i;
    return Infinity;
  };
  return [...(list || [])].filter(Boolean).sort((a, b) => {
    const ra = rankOf(a),
      rb = rankOf(b);
    if (ra !== rb) return ra - rb;
    return String(a).localeCompare(String(b), "th");
  });
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

  // 👉 ตัวช่วยตัดสินใจหน้า
  const isLRUser = norm(username) === "lr";
  const isDeliveryRoom = norm(subward) === "ห้องคลอด";

  // มือถือ/เดสก์ท็อป & เมนูด้านซ้าย
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ----- viewport watcher -----
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

  // ล็อกสกอร์ล body เมื่อเมนูเปิดบนมือถือ
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

  // ปิดเมนูด้วย ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // อ่าน user จาก token
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync shift/date จาก query
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qShift = params.get("shift");
    const qDate = params.get("date");
    if (qShift) setActiveShift(qShift);
    if (qDate) setSelectedDate(qDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ดึง sub-ward
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
        const sorted = sortSubwardsWithPriority(list, wardname);
        setsubwardOptions(sorted);

        if (!subward) {
          const preferred = sorted.find((s) => hasToken(s, "อายุรกรรม"));
          setsubward(preferred || sorted[0] || "");
        } else if (!sorted.includes(subward)) {
          setsubward(sorted[0] || "");
        }
      } catch (err) {
        console.error("Failed to fetch subward options", err);
      }
    };
    fetchsubwards();
  }, [username, wardname]); // ไม่ใส่ subward กันลูป

  // sync query (เฉพาะ search string)
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
  }, [
    activeShift,
    selectedDate,
    subward,
    username,
    wardname,
    location.pathname,
    location.search,
    navigate,
  ]);

  // ✅ Auto-switch หน้าเมื่อเปลี่ยน subward ระหว่างอยู่ "แท็บทั่วไป" (/main หรือ /lrpage)
  useEffect(() => {
    const onGeneralTab = ["/main", "/lrpage"].some((p) =>
      location.pathname.startsWith(p)
    );
    if (!onGeneralTab) return;

    const base = isLRUser && isDeliveryRoom ? "/lrpage" : "/main";
    const qs = new URLSearchParams({ shift: activeShift, date: selectedDate });
    if (subward) qs.set("subward", subward);
    const target = `${base}?${qs.toString()}`;

    const current = `${location.pathname}${location.search}`;
    if (current !== target) {
      navigate(target, { replace: true });
    }
  }, [
    isLRUser,
    isDeliveryRoom,
    subward,
    activeShift,
    selectedDate,
    location.pathname,
    location.search,
    navigate,
  ]);

  const isActiveTab = (paths) => {
    if (Array.isArray(paths))
      return paths.some((p) => location.pathname.includes(p));
    return location.pathname.includes(paths);
  };

  // ⬇️ ปุ่ม "ทั่วไป" จะเลือกหน้าให้ถูกต้องตาม subward ปัจจุบัน
  const handleGeneralClick = () => {
    const base = isLRUser && isDeliveryRoom ? "/lrpage" : "/main";
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
      {/* Overlay มือถือ */}
      {isMobile && sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar custom-sidebar ${isMobile ? "mobile" : ""} ${
          sidebarOpen ? "open" : ""
        }`}
        aria-hidden={isMobile && !sidebarOpen}
      >
        <div className="sidebar-header">
          <div className="avatar-circle">
            {username?.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-title">{wardname || "Ward"}</div>
          {isMobile && (
            <button
              className="icon-button close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
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

      {/* Main */}
      <main className="main-content">
        <div className="top-nav">
          {/* ปุ่มเปิดเมนูในมือถือ */}
          {isMobile && (
            <button
              className="icon-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <FiMenu />
            </button>
          )}

          <div className="tabs-scroll">
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
              className={`nav-tab ${isActiveTab("/dashboard") ? "active" : ""}`}
              onClick={() => go("/dashboard")}
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
                  e.preventDefault(); // กันโฟกัสเฉย ๆ
                  el.showPicker(); // ✅ เปิดปฏิทินทันที (Chrome/Edge รองรับ)
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
