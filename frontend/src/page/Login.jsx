import React, { useState } from "react";
import api from "../api";
import styles from "../styles/Login.module.css";
import { FaUser, FaLock, FaEye, FaEyeSlash, FaHospital } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";

// ✅ คืนค่า YYYY-MM-DD แบบ Local time (กัน -1 วัน)
const localISODate = (d = new Date()) => {
  const dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 10);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // ⚠️ ใช้ path แบบ relative ช่วยให้ทำงานได้ทั้ง proxy dev และ prod
      const res = await api.post("/api/login", form);

      // จำ token (ให้เลือกจำแบบ session ได้ในอนาคตถ้าต้องการ)
      if (remember) {
        localStorage.setItem("token", res.data.token);
      } else {
        sessionStorage.setItem("token", res.data.token);
      }

      const username = form.username.trim().toLowerCase();

      if (username === "lr") {
        navigate("/lrpage");
      } else if (username === "or") {
        const shift = "morning";
        const date = localISODate();
        navigate(
          `/orpage?shift=${encodeURIComponent(shift)}&date=${encodeURIComponent(
            date
          )}`
        );
      } else {
        // ดึง subwards ของ user
        const subRes = await api.get("/api/subwards", { params: { username } });
        const subwards = Array.isArray(subRes.data?.subwards)
          ? subRes.data.subwards
          : [];
        const subward = subwards[0] || "";

        const shift = "morning";
        const date = localISODate();

        navigate(
          `/main?shift=${encodeURIComponent(shift)}&date=${encodeURIComponent(
            date
          )}&subward=${encodeURIComponent(subward)}`
        );
      }
    } catch (err) {
      // แสดงข้อความจาก backend ถ้ามี ไม่งั้นใช้ default
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
        {/* แผงซ้าย: ภาพ/แบรนดิ้ง */}
        <div className={styles.loginLeft}>
          <div className={styles.brandWrap}>
            <div className={styles.brandIcon}></div>
          </div>
        </div>

        {/* แผงขวา: ฟอร์ม */}
        <div className={styles.loginRight}>
          <div className={styles.loginHeader}>
            <h2>ระบบรายงานประจำวัน</h2>
            <p>โรงพยาบาลมหาราชนครศรีธรรมราช</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <label htmlFor="username" className={styles.srOnly}>
              Username
            </label>
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

            <label htmlFor="password" className={styles.srOnly}>
              Password
            </label>
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
                aria-label={showPwd ? "Hide password" : "Show password"}
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
              {/* พื้นที่ลิงก์เสริม (ถ้ามี) */}
              {/* <a className={styles.link} href="/forgot">ลืมรหัสผ่าน?</a> */}
            </div>

            <button
              type="submit"
              className={styles.loginBtn}
              disabled={loading}
            >
              {loading ? (
                <span className={styles.spinner} aria-hidden="true" />
              ) : (
                "Log in"
              )}
            </button>

            {error && (
              <p className={styles.error} role="alert" aria-live="assertive">
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
