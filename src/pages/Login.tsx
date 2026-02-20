import { GoogleLogin } from "@react-oauth/google";

export default function Login() {
  return (
    <div style={{ padding: 40 }}>
      <h1>admin.ahangama.com</h1>
      <p>Sign in to manage venues.</p>

      <GoogleLogin
        onSuccess={async (res) => {
          const r = await fetch("/.netlify/functions/auth-google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ idToken: res.credential }),
          });

          if (r.ok) window.location.href = "/admin";
          else alert("Not authorized");
        }}
        onError={() => alert("Login failed")}
      />
    </div>
  );
}
