import React, { useState } from 'react';
import axios from 'axios';
import styles from '../styles/Login.module.css';
import { FaUser, FaLock } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom'; // ✅ เพิ่ม useNavigate

const Login = () => {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate(); // ✅ ใช้งาน navigate

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
  e.preventDefault();
  try {
    const res = await axios.post('http://localhost:5000/api/login', form);
    localStorage.setItem('token', res.data.token);
    setError('');

    const username = form.username.toLowerCase();

    if (username === 'lr') {
      navigate('/lrpage'); // ✅ ไปหน้า LR
    } else {
      // ✅ ดึง subwards ของ user จาก backend
      const subRes = await axios.get('http://localhost:5000/api/subwards', {
        params: { username },
      });

      const subwards = subRes.data.subwards || [];
      const subward = subwards.length > 0 ? subwards[0] : '';

      const shift = 'morning';
      const date = new Date().toISOString().split('T')[0];

      // ✅ ส่งไปพร้อม shift, date, subward
      navigate(`/main?shift=${shift}&date=${date}&subward=${subward}`);
    }
  } catch (err) {
    setError('Invalid username or password');
    console.error('Login error:', err);
  }
};

  

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginBox}>
        <div className={styles.loginLeft}>{/* ภาพพื้นหลัง */}</div>
        <div className={styles.loginRight}>
          <div className={styles.loginHeader}>
            <h2>ระบบรายงานประจำวัน</h2>
            <p>โรงพยาบาลมหาราชนครศรีธรรมราช</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <FaUser className={styles.icon} />
              <input
                name="username"
                type="text"
                placeholder="Username"
                value={form.username}
                onChange={handleChange}
                required
              />
            </div>
            <div className={styles.inputGroup}>
              <FaLock className={styles.icon} />
              <input
                name="password"
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>
            <button type="submit" className={styles.loginBtn}>Log in</button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
