import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import AdminActivity from "./pages/AdminActivity";
import AdminHome from "./pages/AdminHome";
import AdminOperations from "./pages/AdminOperations";
import LinkGenerator from "./pages/LinkGenerator";
import QrLinkGenerator from "./pages/QrLinkGenerator";
import QRDashboard from "./pages/QRDashboard.jsx";
import CRM from "./pages/CRM";
import TravelAgentsCRM from "./pages/TravelAgentsCRM";
import { RequireAuth } from "./auth/RequireAuth";
import AdminShell from "./pages/AdminShell";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminShell />
            </RequireAuth>
          }
        >
          <Route index element={<AdminHome />} />
          <Route path="activity" element={<AdminActivity />} />
          <Route path="operations" element={<AdminOperations />} />
          <Route path="links" element={<LinkGenerator />} />
          <Route path="qr-links" element={<QrLinkGenerator />} />
          <Route path="venues" element={<Admin />} />
          <Route path="crm" element={<CRM />} />
          <Route path="travel-agents" element={<TravelAgentsCRM />} />
          <Route path="qr" element={<QRDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
