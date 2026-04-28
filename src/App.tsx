import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import AdminHome from "./pages/AdminHome";
import LinkGenerator from "./pages/LinkGenerator";
import QrLinkGenerator from "./pages/QrLinkGenerator";
import QRDashboard from "./pages/QRDashboard.jsx";
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
          <Route path="links" element={<LinkGenerator />} />
          <Route path="qr-links" element={<QrLinkGenerator />} />
          <Route path="venues" element={<Admin />} />
          <Route path="qr" element={<QRDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
