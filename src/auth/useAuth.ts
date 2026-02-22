import { useEffect, useState } from "react";

type AuthUser = {
  email?: string;
  name?: string | null;
  picture?: string | null;
};

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetch("/.netlify/functions/auth-me", { credentials: "include" })
      .then(async (r) => {
        setAuthenticated(r.ok);
        if (!r.ok) {
          setUser(null);
          return;
        }
        const data = await r.json().catch(() => ({}));
        setUser((data?.user as AuthUser) || null);
      })
      .catch(() => {
        setAuthenticated(false);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return { loading, authenticated, user };
}
