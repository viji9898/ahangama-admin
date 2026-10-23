import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";

type AccessState = "loading" | "allowed" | "unauthenticated" | "forbidden";

export function RequireMidigamaAccess({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<AccessState>("loading");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/.netlify/functions/auth-midigama", {
      credentials: "include",
      signal: controller.signal,
    })
      .then((response) => {
        if (response.ok) setAccess("allowed");
        else if (response.status === 401) setAccess("unauthenticated");
        else setAccess("forbidden");
      })
      .catch((error: unknown) => {
        if ((error as Error).name !== "AbortError") setAccess("forbidden");
      });

    return () => controller.abort();
  }, []);

  if (access === "loading") return <div style={{ padding: 40 }}>Loading...</div>;
  if (access === "unauthenticated") return <Navigate to="/" replace />;
  if (access === "forbidden") return <Navigate to="/admin" replace />;
  return <>{children}</>;
}