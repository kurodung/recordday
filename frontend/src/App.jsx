// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HospitalUI from "./page/HospitalUI";
import Covid19Page from "./page/Covid19Page";
import DenguePage from "./page/DenguePage";
import LoginPage from "./page/Login";
import LRpage from "./page/LRpage";
import Dashboard from "./page/Dashboard";
import HospitalLayout from "./components/HospitalLayout";
import MultiDayReportStatus from "./page/MultiDayReportStatus";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/main"
          element={
            <HospitalLayout>
              <HospitalUI />
            </HospitalLayout>
          }
        />
        <Route
          path="/covid"
          element={
            <HospitalLayout>
              <Covid19Page />
            </HospitalLayout>
          }
        />
        <Route
          path="/dengue"
          element={
            <HospitalLayout>
              <DenguePage />
            </HospitalLayout>
          }
        />
        <Route
          path="/lrpage"
          element={
            <HospitalLayout>
              <LRpage />
            </HospitalLayout>
          }
        />
        <Route
          path="/multi-day"
          element={
            <HospitalLayout>
              <MultiDayReportStatus />
            </HospitalLayout>
          }
        />
        <Route
          path="/dashboard"
          element={
            <HospitalLayout>
              <Dashboard />
            </HospitalLayout>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
