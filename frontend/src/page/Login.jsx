import React, { useState } from "react";
import api from "../api";
import styles from "../styles/Login.module.css";
import { FaUser, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode"; // ✅ 1. Import jwt-decode

// คืนค่า YYYY-MM-DD แบบ Local time (กัน -1 วัน)
const localISODate = (d = new Date()) => {
  const dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 10);
};

// 🗺️ Mapping user → หน้า
const userPageMap = {
  lr: "/lrpage",
  or: "/orpage",
  hd: "/hdpage",
  cl: "/clpage",
  cu: "/cupage",
  stch: "/stchpage",
  endo: "/endopage",
  rt: "/rtpage",
  ir: "/irpage",
  nm: "/nmpage",
  sl: "/slpage",
  pft: "/pftpage",
  nwcw: "/nwcwpage",
  er: "/erpage",
  opd: "/opdpage",


  // เพิ่ม user อื่น ๆ ได้ตรงนี้ เช่น
  // nicu: "/nicipage",
  // pp: "/pppage",
};

// 🗺️ Mapping wardname → หน้า (ใช้ตอน decode token ได้ ถ้าต้องการรองรับหลาย user/ward)
// eslint-disable-next-line no-unused-vars
const wardPageMap = {
  "ห้องคลอด": "/lrpage",
  "ห้องผ่าตัด": "/orpage",
  "ไตเทียม": "/hdpage",
  "Cath lab": "/clpage",
  "หน่วยโรคหัวใจ": "/cupage",
  "เคมีบำบัด(ตรวจรักษาพิเศษ)": "/stchpage",
  "ส่องกล้อง": "/endopage",
  "รังสีรักษา": "/rtpage",
  "รังสีร่วมรักษา": "/irpage",
  "เวชศาสตร์นิวเคลียร์": "/nmpage",
  "Sleep lab": "/slpage",
  "สมรรถภาพปอด": "/pftpage",
  "ศูนย์พักนวชีวา": "/nwcwpage",
  "อุบัติเหตุ": "/erpage",
  "ผู้ป่วยนอก": "/opdpage",


};

const Login = () => {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // ✅ 2. อัปเดต handleSubmit ทั้งหมด
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/api/login", form);
      const token = res.data.token;

      // เก็บ token
      if (remember) {
        localStorage.setItem("token", token);
      } else {
        sessionStorage.setItem("token", token);
      }

      // --- 💡 ตรรกะใหม่เริ่มตรงนี้ 💡 ---
      
      // ถอดรหัส token เพื่อดูข้อมูล Role
      const user = jwtDecode(token); 
      
      const shift = "morning";
      const date = localISODate();

      // 1. ตรวจสอบ Role พิเศษก่อน (Admin, Supervisor)
      if (user.role === 'Admin' || user.role === 'Supervisor') {
        // ❗️ คุณต้องสร้างหน้า /admindashboard เอง
        navigate(`/adminpage`);
        return;
      }

      // 2. ตรวจสอบ GroupLeader
      if (user.role === 'GroupLeader') {
        // ❗️ คุณต้องสร้างหน้า /departmentdashboard เอง
        // เราส่ง departmentId ที่เราเก็บไว้ใน token ไป
        navigate(`/departmentdashboard/${user.departmentId}?shift=${shift}&date=${date}`); 
        return;
      }

      // 3. ถ้าเป็น Role 'User' (หรือ Role อื่นๆ) ให้ใช้ตรรกะเดิม
      const username = user.username.trim().toLowerCase();
      
      // ✅ 3.1 ใช้ userPageMap (เหมือนเดิม)
      if (userPageMap[username]) {
        navigate(
          `${userPageMap[username]}?shift=${encodeURIComponent(
            shift
          )}&date=${encodeURIComponent(date)}`
        );
        return;
      }

      // ✅ 3.2 ไปหน้า /main (ลบการเรียก /api/subwards ที่ไม่จำเป็น)
      // เราดึง subward มาจาก token ได้เลย (ที่ตั้งค่าไว้ใน authRoutes.js)
      const subward = user.subWard || ""; 

      navigate(
        `/main?shift=${encodeURIComponent(shift)}&date=${encodeURIComponent(
          date
        )}&subward=${encodeURIComponent(subward)}`
      );

    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Invalid username or password";
      setError(msg);
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginBox}>
        {/* Panel ซ้าย: Branding */}
        <div className={styles.loginLeft}>
          <div className={styles.brandWrap}>
            <div className={styles.brandIcon}></div>
          </div>
        </div>

        {/* Panel ขวา: ฟอร์ม */}
        <div className={styles.loginRight}>
          <div className={styles.loginHeader}>
            <h2>ระบบรายงานประจำวัน</h2>
            <p>โรงพยาบาลมหาราชนครศรีธรรมราช</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <div className={styles.inputGroup}>
              <FaUser className={styles.icon} />
              <input
                id="username"
                name="username"
                type="text"
                placeholder="Username"
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                autoFocus
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <FaLock className={styles.icon} />
              <input
                id="password"
                name="password"
                type={showPwd ? "text" : "password"}
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className={styles.togglePwd}
                onClick={() => setShowPwd((s) => !s)}
              >
                {showPwd ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <div className={styles.formRow}>
              <label className={styles.rememberMe}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                จดจำการเข้าสู่ระบบ
              </label>
            </div>

            <button
              type="submit"
              className={styles.loginBtn}
              disabled={loading}
            >
              {loading ? (
                <span className={styles.spinner} />
              ) : (
                "Log in"
              )}
            </button>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
