// src/pages/Adminpage.jsx
import React, { useState, useEffect } from "react";
import { API_BASE } from "../config";
import styles from "../styles/Dashboard.module.css";

export default function Adminpage() {
  const [users, setUsers] = useState([]);
  const [wards, setWards] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [form, setForm] = useState({
    username: "",
    password: "",
    role_id: 1,
    ward_id: "",
    department_id: "",
  });

  const [wardForm, setWardForm] = useState({
    wardname: "",
    subward: "",
    department_id: "",
  });

  const [deptForm, setDeptForm] = useState({ department_name: "" });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("users");

  // ✅ Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [wardPage, setWardPage] = useState(1);
  const wardsPerPage = 15;

  // ✅ Access management
  const [selectedUser, setSelectedUser] = useState("");
  const [userWards, setUserWards] = useState([]);
  const [newWard, setNewWard] = useState("");

  // -------------------- Fetch Data --------------------
  const fetchUsers = async () => {
    const res = await fetch(`${API_BASE}/api/users`);
    const data = await res.json();
    setUsers(data);
  };

  const fetchWards = async () => {
    const res = await fetch(`${API_BASE}/api/wards`);
    const data = await res.json();
    setWards(data);
  };

  const fetchDepartments = async () => {
    const res = await fetch(`${API_BASE}/api/departments`);
    const data = await res.json();
    setDepartments(data);
  };

  useEffect(() => {
    fetchUsers();
    fetchWards();
    fetchDepartments();
  }, []);

  // -------------------- Users --------------------
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAddUser = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      alert(data.message);
      fetchUsers();
      setForm({
        username: "",
        password: "",
        role_id: 1,
        ward_id: "",
        department_id: "",
      });
    } catch {
      alert("Error adding user");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm("ต้องการลบผู้ใช้นี้หรือไม่?")) return;
    await fetch(`${API_BASE}/api/users/${id}`, { method: "DELETE" });
    fetchUsers();
  };

  // -------------------- Pagination --------------------
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentUsers = users.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(users.length / itemsPerPage);

  const nextPage = () => setCurrentPage((p) => (p < totalPages ? p + 1 : p));
  const prevPage = () => setCurrentPage((p) => (p > 1 ? p - 1 : p));

  // Pagination สำหรับ ward
  const indexOfLastWard = wardPage * wardsPerPage;
  const indexOfFirstWard = indexOfLastWard - wardsPerPage;
  const currentWards = wards.slice(indexOfFirstWard, indexOfLastWard);
  const totalWardPages = Math.ceil(wards.length / wardsPerPage);

  const nextWardPage = () =>
    setWardPage((p) => (p < totalWardPages ? p + 1 : p));
  const prevWardPage = () => setWardPage((p) => (p > 1 ? p - 1 : p));

  // -------------------- Access (user_wards) --------------------
  const fetchUserWards = async (userId) => {
    if (!userId) return;
    const res = await fetch(`${API_BASE}/api/users/${userId}/wards`);
    const data = await res.json();
    setUserWards(data);
  };

  useEffect(() => {
    if (selectedUser) fetchUserWards(selectedUser);
  }, [selectedUser]);

  const handleAddAccess = async () => {
    if (!selectedUser || !newWard) {
      alert("กรุณาเลือกผู้ใช้และ ward");
      return;
    }
    const res = await fetch(`${API_BASE}/api/users/${selectedUser}/wards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: selectedUser, ward_id: newWard }),
    });
    const data = await res.json();
    alert(data.message);
    setNewWard("");
    fetchUserWards(selectedUser);
  };

  const handleRemoveAccess = async (id) => {
    if (!window.confirm("ต้องการลบสิทธิ์นี้หรือไม่?")) return;
    await fetch(`${API_BASE}/api/users/wards/${id}`, { method: "DELETE" });
    fetchUserWards(selectedUser);
  };

  // -------------------- Render --------------------
  return (
    <div className={`${styles.dashboardContainer} ${styles.fadeIn}`}>
      {/* Header */}
      <div className={styles.dashboardHeader}>
        <div className={styles.dashboardHeaderContent}>
          <h1 className={styles.dashboardTitle}>จัดการข้อมูลระบบ</h1>
          <p className={styles.dashboardSubtitle}>
            เพิ่ม / ลบ / แก้ไข ผู้ใช้, Ward, Department และสิทธิ์การเข้าถึง
          </p>
        </div>
      </div>

      {/* 🔹 Tab Navigation */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
        {[
          { key: "users", label: "ผู้ใช้งาน" },
          { key: "wards", label: "Wards" },
          { key: "departments", label: "Departments" },
          { key: "access", label: "สิทธิ์ผู้ใช้" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={styles.clearFiltersBtn}
            style={{
              backgroundColor: activeTab === tab.key ? "#7e3cbd" : "#e5e7eb",
              color: activeTab === tab.key ? "white" : "#374151",
              padding: "10px 20px",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 🧍 ผู้ใช้งาน */}
      {activeTab === "users" && (
        <>
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
                  <option value="4">Admin</option>
                </select>
              </div>

              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>หน่วยงาน (Ward)</label>
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

              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>ตึก / กลุ่มงาน</label>
                <select
                  name="department_id"
                  className={styles.filterSelect}
                  value={form.department_id}
                  onChange={handleChange}
                >
                  <option value="">เลือกตึก</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.department_name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className={styles.clearFiltersBtn}
                onClick={handleAddUser}
                disabled={loading}
              >
                {loading ? "กำลังบันทึก..." : "เพิ่มผู้ใช้"}
              </button>
            </div>
          </div>

          {/* ตารางผู้ใช้ */}
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
                  <th>ตึก / กลุ่มงาน</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {currentUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.username}</td>
                    <td>{u.role_name}</td>
                    <td>{u.wardname}</td>
                    <td>{u.subward}</td>
                    <td>{u.department_name || "-"}</td>
                    <td>
                      <button
                        className={styles.clearFiltersBtn}
                        style={{
                          backgroundColor: "#ef4444",
                          padding: "6px 12px",
                        }}
                        onClick={() => handleDeleteUser(u.id)}
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={prevPage}
                disabled={currentPage === 1}
              >
                ก่อนหน้า
              </button>
              <span className={styles.pageInfo}>
                หน้า {currentPage} จาก {totalPages}
              </span>
              <button
                className={styles.pageBtn}
                onClick={nextPage}
                disabled={currentPage === totalPages}
              >
                ถัดไป
              </button>
            </div>
          </div>
        </>
      )}

      {/* 🏥 Ward */}
      {activeTab === "wards" && (
        <>
          <div className={styles.filterSection}>
            <div className={styles.filterHeader}>
              <h2 className={styles.filterTitle}>เพิ่ม / แก้ไข Ward</h2>
            </div>
            <div className={styles.filterGrid}>
              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>ชื่อ Ward</label>
                <input
                  name="wardname"
                  className={styles.filterInput}
                  value={wardForm.wardname}
                  onChange={(e) =>
                    setWardForm({ ...wardForm, wardname: e.target.value })
                  }
                />
              </div>

              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>Subward</label>
                <input
                  name="subward"
                  className={styles.filterInput}
                  value={wardForm.subward}
                  onChange={(e) =>
                    setWardForm({ ...wardForm, subward: e.target.value })
                  }
                />
              </div>

              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>ตึก / กลุ่มงาน</label>
                <select
                  name="department_id"
                  className={styles.filterSelect}
                  value={wardForm.department_id}
                  onChange={(e) =>
                    setWardForm({ ...wardForm, department_id: e.target.value })
                  }
                >
                  <option value="">เลือกตึก</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.department_name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className={styles.clearFiltersBtn}
                onClick={async () => {
                  const res = await fetch(`${API_BASE}/api/wards`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(wardForm),
                  });
                  const data = await res.json();
                  alert(data.message);
                  setWardForm({
                    wardname: "",
                    subward: "",
                    department_id: "",
                  });
                  fetchWards();
                }}
              >
                เพิ่ม Ward
              </button>
            </div>
          </div>

          <div className={styles.chartContainer}>
            <h2 className={styles.chartTitle}>รายการ Ward ทั้งหมด</h2>
            <table className={styles.logTable}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ward</th>
                  <th>Subward</th>
                  <th>Department</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {currentWards.map((w) => (
                  <tr key={w.id}>
                    <td>{w.id}</td>
                    <td>{w.wardname}</td>
                    <td>{w.subward}</td>
                    <td>{w.department_name || "-"}</td>
                    <td>
                      <button
                        className={styles.clearFiltersBtn}
                        style={{
                          backgroundColor: "#ef4444",
                          padding: "6px 12px",
                        }}
                        onClick={async () => {
                          if (window.confirm("ต้องการลบ Ward นี้หรือไม่?")) {
                            await fetch(`${API_BASE}/api/wards/${w.id}`, {
                              method: "DELETE",
                            });
                            fetchWards();
                          }
                        }}
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={prevWardPage}
                disabled={wardPage === 1}
              >
                ก่อนหน้า
              </button>
              <span className={styles.pageInfo}>
                หน้า {wardPage} จาก {totalWardPages}
              </span>
              <button
                className={styles.pageBtn}
                onClick={nextWardPage}
                disabled={wardPage === totalWardPages}
              >
                ถัดไป
              </button>
            </div>
          </div>
        </>
      )}

      {/* 🏢 Department */}
      {activeTab === "departments" && (
        <>
          <div className={styles.filterSection}>
            <div className={styles.filterHeader}>
              <h2 className={styles.filterTitle}>เพิ่ม / แก้ไข Department</h2>
            </div>
            <div className={styles.filterGrid}>
              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>ชื่อ Department</label>
                <input
                  name="department_name"
                  className={styles.filterInput}
                  value={deptForm.department_name}
                  onChange={(e) =>
                    setDeptForm({ department_name: e.target.value })
                  }
                />
              </div>
              <button
                className={styles.clearFiltersBtn}
                onClick={async () => {
                  const res = await fetch(`${API_BASE}/api/departments`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(deptForm),
                  });
                  const data = await res.json();
                  alert(data.message);
                  setDeptForm({ department_name: "" });
                  fetchDepartments();
                }}
              >
                เพิ่ม Department
              </button>
            </div>
          </div>

          <div className={styles.chartContainer}>
            <h2 className={styles.chartTitle}>รายการ Department ทั้งหมด</h2>
            <table className={styles.logTable}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>ชื่อ Department</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td>{d.id}</td>
                    <td>{d.department_name}</td>
                    <td>
                      <button
                        className={styles.clearFiltersBtn}
                        style={{
                          backgroundColor: "#ef4444",
                          padding: "6px 12px",
                        }}
                        onClick={async () => {
                          if (
                            window.confirm("ต้องการลบ Department นี้หรือไม่?")
                          ) {
                            await fetch(`${API_BASE}/api/departments/${d.id}`, {
                              method: "DELETE",
                            });
                            fetchDepartments();
                          }
                        }}
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 🔐 สิทธิ์ผู้ใช้ */}
      {activeTab === "access" && (
        <>
          <div className={styles.filterSection}>
            <div className={styles.filterHeader}>
              <h2 className={styles.filterTitle}>
                สิทธิ์การเข้าถึง Ward ของผู้ใช้
              </h2>
            </div>
            <div className={styles.filterGrid}>
              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>เลือกผู้ใช้</label>
                <select
                  className={styles.filterSelect}
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  <option value="">-- เลือกผู้ใช้ --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {selectedUser && (
            <div className={styles.chartContainer}>
              <h2 className={styles.chartTitle}>Ward ที่ผู้ใช้นี้เข้าถึงได้</h2>
              <table className={styles.logTable}>
                <thead>
                  <tr>
                    <th>Ward</th>
                    <th>Subward</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {userWards.map((w) => (
                    <tr key={w.id}>
                      <td>{w.wardname}</td>
                      <td>{w.subward}</td>
                      <td>
                        <button
                          className={styles.clearFiltersBtn}
                          style={{
                            backgroundColor: "#ef4444",
                            padding: "6px 12px",
                          }}
                          onClick={() => handleRemoveAccess(w.id)}
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* เพิ่มสิทธิ์ใหม่ */}
              <div className={styles.filterGrid}>
                <div className={styles.filterItem}>
                  <label className={styles.filterLabel}>
                    เพิ่มสิทธิ์ Ward ใหม่
                  </label>
                  <select
                    className={styles.filterSelect}
                    value={newWard}
                    onChange={(e) => setNewWard(e.target.value)}
                  >
                    <option value="">เลือก Ward</option>
                    {wards.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.wardname} {w.subward && `(${w.subward})`}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className={styles.clearFiltersBtn}
                  onClick={handleAddAccess}
                >
                  เพิ่มสิทธิ์
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
