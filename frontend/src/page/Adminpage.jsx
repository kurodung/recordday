// src/pages/Adminpage.jsx
import React, { useState, useEffect } from "react";
import { API_BASE } from "../config";
// 1. แก้ไขการ import
import styles from "../styles/Dashboard.module.css";

export default function Adminpage() {
  const [users, setUsers] = useState([]);
  const [wards, setWards] = useState([]);
  const [form, setForm] = useState({
    username: "",
    password: "",
    role_id: 1,
    ward_id: "",
  });
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    const res = await fetch(`${API_BASE}/api/admin/users`);
    const data = await res.json();
    setUsers(data);
  };

  const fetchWards = async () => {
    const res = await fetch(`${API_BASE}/api/wards`);
    const data = await res.json();
    setWards(data);
  };

  useEffect(() => {
    fetchUsers();
    fetchWards();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdd = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      alert(data.message);
      fetchUsers();
      setForm({ username: "", password: "", role_id: 1, ward_id: "" });
    } catch {
      alert("Error adding user");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("ต้องการลบผู้ใช้นี้หรือไม่?")) return;
    await fetch(`${API_BASE}/api/admin/users/${id}`, { method: "DELETE" });
    fetchUsers();
  };

  return (
    // 2. แก้ไข className ทั้งหมด
    <div className={`${styles.dashboardContainer} ${styles.fadeIn}`}>
      <div className={styles.dashboardHeader}>
        <div className={styles.dashboardHeaderContent}>
          <div>
            <h1 className={styles.dashboardTitle}>จัดการผู้ใช้งานระบบ</h1>
            <p className={styles.dashboardSubtitle}>
              เพิ่ม / ลบ / แก้ไข ผู้ใช้ในแต่ละ Ward
            </p>
          </div>
        </div>
      </div>

      <div className={`${styles.filterSection} ${styles.slideUp}`}>
        <div className={styles.filterHeader}>
          <h2 className={styles.filterTitle}>เพิ่มผู้ใช้ใหม่</h2>
        </div>
        <div className={styles.filterGrid}>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>ชื่อผู้ใช้</label>
            <input
              name="username"
              className={styles.filterInput}
              value={form.username}
              onChange={handleChange}
            />
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>รหัสผ่าน</label>
            <input
              name="password"
              type="password"
              className={styles.filterInput}
              value={form.password}
              onChange={handleChange}
            />
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>สิทธิ์การใช้งาน</label>
            <select
              name="role_id"
              className={styles.filterSelect}
              value={form.role_id}
              onChange={handleChange}
            >
              <option value="1">User</option>
              <option value="2">GroupLeader</option>
              <option value="3">Supervisor</option>
              <option value="4">Admin</option>
            </select>
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>หน่วยงาน</label>
            <select
              name="ward_id"
              className={styles.filterSelect}
              value={form.ward_id}
              onChange={handleChange}
            >
              <option value="">เลือก Ward</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.wardname} {w.subward ? `(${w.subward})` : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            className={styles.clearFiltersBtn}
            onClick={handleAdd}
            disabled={loading}
          >
            {loading ? "กำลังบันทึก..." : "เพิ่มผู้ใช้"}
          </button>
        </div>
      </div>

      <div className={styles.chartContainer}>
        <h2 className={styles.chartTitle}>รายการผู้ใช้ทั้งหมด</h2>
        <table className={styles.logTable}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Role</th>
              <th>Ward</th>
              <th>Subward</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.role_name}</td>
                <td>{u.wardname}</td>
                <td>{u.subward}</td>
                <td>
                  <button
                    className={styles.clearFiltersBtn}
                    style={{ backgroundColor: "#ef4444" }}
                    onClick={() => handleDelete(u.id)}
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}