// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HospitalUI from "./page/HospitalUI";
import Covid19Page from "./page/Covid19Page";
import DenguePage from "./page/DenguePage";
import LoginPage from "./page/Login";
import LRpage from "./page/LRpage";
import Dashboard from "./page/Dashboard/Dashboard";
import HospitalLayout from "./components/HospitalLayout";
import MultiDayReportStatus from "./page/MultiDayReportStatus";
import ORpage from "./page/ORpage";
import ORDashboard from "./page/Dashboard/ORDashboard";
import HDpage from "./page/HDpage";
import HDDashboard from "./page/Dashboard/HDDashboard";
import CLpage from "./page/CLpage";
import CLDashboard from "./page/Dashboard/CLDashboard";
import CUpage from "./page/CUpage";
import CUDashboard from "./page/Dashboard/CUDashboard";
import Stchpage from "./page/Stchpage";
import StchDashboard from "./page/Dashboard/StchDashboard";

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
        <Route
          path="/orpage"
          element={
            <HospitalLayout>
              <ORpage />
            </HospitalLayout>
          }
        />
        <Route
          path="/dashboard-or"
          element={
            <HospitalLayout>
              <ORDashboard />
            </HospitalLayout>
          }
        />
        <Route
          path="/hdpage"
          element={
            <HospitalLayout>
              <HDpage />
            </HospitalLayout>
          }
        />
        <Route
          path="/dashboard-hd"
          element={
            <HospitalLayout>
              <HDDashboard />
            </HospitalLayout>
          }
        />
        <Route
          path="/clpage"
          element={
            <HospitalLayout>
              <CLpage />
            </HospitalLayout>
          }
        />
        <Route
          path="/dashboard-cl"
          element={
            <HospitalLayout>
              <CLDashboard />
            </HospitalLayout>
          }
        />
        <Route
          path="/cupage"
          element={
            <HospitalLayout>
              <CUpage />
            </HospitalLayout>
          }
        />
        <Route
          path="/dashboard-cu"
          element={
            <HospitalLayout>
              <CUDashboard />
            </HospitalLayout>
          }
        />
        <Route
          path="/stchpage"
          element={
            <HospitalLayout>
              <Stchpage />
            </HospitalLayout>
          }
        />
        <Route
          path="/dashboard-stch"
          element={
            <HospitalLayout>
              <StchDashboard />
            </HospitalLayout>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
