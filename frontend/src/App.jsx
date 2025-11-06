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
import Endopage from "./page/Endopage";
import EndoDashboard from "./page/Dashboard/EndoDashboard";
import RTpage from "./page/RTpage";
import RTDashboard from "./page/Dashboard/RTDashboard";
import IRpage from "./page/IRpage";
import IRDashboard from "./page/Dashboard/IRDashboard";
import NMpage from "./page/NMpage";
import NMDashboard from "./page/Dashboard/NMDashboard";
import SLpage from "./page/SLpage";
import SLDashboard from "./page/Dashboard/SLDashboard";
import PFTpage from "./page/PFTpage";
import PFTDashboard from "./page/Dashboard/PFTDashboard";
import NWCWpage from "./page/NWCWpage";
import NWCWDashboard from "./page/Dashboard/NWCWDashboard";
import ERpage from "./page/ERpage";
import ERDashboard from "./page/Dashboard/ERDashboard";
import OPDpage from "./page/OPDpage";
import OPDDashboard from "./page/Dashboard/OPDDashboard";
import Adminpage from "./page/Adminpage";
import CompareDashboard from "./page/Dashboard/CompareDashboard";

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
        <Route
          path="/endopage"
          element={
            <HospitalLayout>
              <Endopage />
            </HospitalLayout>
          }
        />
        <Route
          path="/dashboard-endo"
          element={
            <HospitalLayout>
              <EndoDashboard />
            </HospitalLayout>
          }
        />
        <Route
          path="/rtpage"
          element={
            <HospitalLayout>
              <RTpage />
            </HospitalLayout>
          }
        />
        <Route
          path="/dashboard-rt"
          element={
            <HospitalLayout>
              <RTDashboard />
            </HospitalLayout>
          }
        />
        <Route
          path="/irpage"
          element={
            <HospitalLayout>
              <IRpage />
            </HospitalLayout>
          }
        />
        <Route
          path="/dashboard-ir"
          element={
            <HospitalLayout>
              <IRDashboard />
            </HospitalLayout>
          }
        />
        <Route
          path="/nmpage"
          element={
            <HospitalLayout>
              <NMpage />
            </HospitalLayout>
          }
        />
        <Route
          path="/dashboard-nm"
          element={
            <HospitalLayout>
              <NMDashboard />
            </HospitalLayout>
          }
        />
        <Route
          path="/slpage"
          element={
            <HospitalLayout>
              <SLpage />
            </HospitalLayout>
          }
        />
        <Route
          path="/dashboard-sl"
          element={
            <HospitalLayout>
              <SLDashboard />
            </HospitalLayout>
          }
        />
        <Route
          path="/pftpage"
          element={
            <HospitalLayout>
              <PFTpage />
            </HospitalLayout>
          }
        />
        <Route
          path="/dashboard-pft"
          element={
            <HospitalLayout>
              <PFTDashboard />
            </HospitalLayout>
          }
        />
        <Route
          path="/nwcwpage"
          element={
            <HospitalLayout>
              <NWCWpage />
            </HospitalLayout>
          }
        />
        <Route
          path="/dashboard-nwcw"
          element={
            <HospitalLayout>
              <NWCWDashboard />
            </HospitalLayout>
          }
        />
        <Route
          path="/erpage"
          element={
            <HospitalLayout>
              <ERpage />
            </HospitalLayout>
          }
        />
        <Route
          path="/dashboard-er"
          element={
            <HospitalLayout>
              <ERDashboard />
            </HospitalLayout>
          }
        />
        <Route
          path="/opdpage"
          element={
            <HospitalLayout>
              <OPDpage />
            </HospitalLayout>
          }
        />
        <Route
          path="/dashboard-opd"
          element={
            <HospitalLayout>
              <OPDDashboard />
            </HospitalLayout>
          }
        />
        <Route
          path="/adminpage"
          element={
            <HospitalLayout>
              <Adminpage />
            </HospitalLayout>
          }
        />
        <Route
          path="/compare"
          element={
            <HospitalLayout>
              <CompareDashboard />
            </HospitalLayout>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
