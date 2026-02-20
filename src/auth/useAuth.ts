import { useEffect, useState } from "react";

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch("/.netlify/functions/auth-me", { credentials: "include" })
      .then((r) => setAuthenticated(r.ok))
      .finally(() => setLoading(false));
  }, []);

  return { loading, authenticated };
}
