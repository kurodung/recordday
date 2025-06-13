// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HospitalUI from './page/HospitalUI';
import Covid19Page from './page/Covid19Page';
import DenguePage from './page/DenguePage'; // สมมุติว่ามีหน้า Dengue

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HospitalUI />} />
        <Route path="/covid" element={<Covid19Page />} />
        <Route path="/dengue" element={<DenguePage />} />
      </Routes>
    </Router>
  );
};

export default App;
