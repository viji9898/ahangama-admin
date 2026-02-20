import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loading, authenticated } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!authenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}
