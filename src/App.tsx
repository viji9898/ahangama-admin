import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import AdminActivity from "./pages/AdminActivity";
import AdminHome from "./pages/AdminHome";
import AdminOperations from "./pages/AdminOperations";
import LinkGenerator from "./pages/LinkGenerator";
import QrLinkGenerator from "./pages/QrLinkGenerator";
import QRDashboard from "./pages/QRDashboard.jsx";
import CallLogs from "./pages/CallLogs";
import CirclePassUsers from "./pages/CirclePassUsers";
import CRM from "./pages/CRM";
import Events from "./pages/Events";
import GAAnalytics from "./pages/GAAnalytics";
import GAFreePassScans from "./pages/GAFreePassScans";
import GuestPassUsers from "./pages/GuestPassUsers";
import HospoPassProfiles from "./pages/HospoPassProfiles";
import PaidPassUsers from "./pages/PaidPassUsers";
import RetreatEnquiries from "./pages/RetreatEnquiries";
import StayEnquiries from "./pages/StayEnquiries";
import TransportEnquiries from "./pages/TransportEnquiries";
import TravelAgentsCRM from "./pages/TravelAgentsCRM";
import PublicStats from "./pages/PublicStats";
import NewsletterBuilder from "./pages/NewsletterBuilder";
import { RequireAuth } from "./auth/RequireAuth";
import AdminShell from "./pages/AdminShell";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/stats" element={<PublicStats />} />

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
          <Route path="newsletters" element={<NewsletterBuilder />} />
          <Route path="links" element={<LinkGenerator />} />
          <Route path="qr-links" element={<QrLinkGenerator />} />
          <Route path="venues" element={<Admin />} />
          <Route path="crm" element={<CRM />} />
          <Route path="travel-agents" element={<TravelAgentsCRM />} />
          <Route
            path="pass-users"
            element={<Navigate to="/admin/pass-users/paid" replace />}
          />
          <Route path="pass-users/paid" element={<PaidPassUsers />} />
          <Route path="pass-users/hospo" element={<HospoPassProfiles />} />
          <Route path="pass-users/circle" element={<CirclePassUsers />} />
          <Route path="pass-users/guest-pass" element={<GuestPassUsers />} />
          <Route
            path="enquiries"
            element={<Navigate to="/admin/enquiries/stays" replace />}
          />
          <Route path="enquiries/stays" element={<StayEnquiries />} />
          <Route path="enquiries/retreats" element={<RetreatEnquiries />} />
          <Route path="enquiries/transport" element={<TransportEnquiries />} />
          <Route path="call-logs" element={<CallLogs />} />
          <Route
            path="events"
            element={<Navigate to="/admin/events/list" replace />}
          />
          <Route path="events/add" element={<Events mode="add" />} />
          <Route path="events/list" element={<Events mode="list" />} />
          <Route path="qr" element={<QRDashboard />} />
        </Route>

        <Route
          path="/ga"
          element={
            <RequireAuth>
              <AdminShell />
            </RequireAuth>
          }
        >
          <Route index element={<GAAnalytics />} />
          <Route path="free-pass-scans" element={<GAFreePassScans />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
