import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { Alert, Button, Card, Space, Spin, Typography } from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

type LoginErrorCode = "not_authorized" | "login_failed" | "network_error";

function getErrorMessage(code: LoginErrorCode) {
  switch (code) {
    case "not_authorized":
      return "This Google account is not authorized for Ahangama admin.";
    case "login_failed":
      return "Google sign-in failed. Please try again.";
    case "network_error":
      return "Could not reach the authentication service. Please try again.";
  }
}

export default function Login() {
  const navigate = useNavigate();
  const { loading: authLoading, authenticated, user } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<LoginErrorCode | null>(null);

  const signedInLabel = useMemo(() => {
    const email = user?.email?.trim();
    if (email) return `Signed in as ${email}`;
    return "You’re already signed in.";
  }, [user?.email]);

  async function exchangeIdToken(credential: string) {
    const r = await fetch("/.netlify/functions/auth-google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ idToken: credential }),
    });

    if (!r.ok) throw new Error("not_authorized");
  }

  async function handleGoogleSuccess(res: CredentialResponse) {
    setErrorCode(null);

    if (!res.credential) {
      setErrorCode("login_failed");
      return;
    }

    try {
      setSubmitting(true);
      await exchangeIdToken(res.credential);
      navigate("/admin", { replace: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setErrorCode(
        message === "not_authorized" ? "not_authorized" : "network_error",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoogleError() {
    setErrorCode("login_failed");
  }

  async function handleLogout() {
    setErrorCode(null);
    try {
      setSubmitting(true);
      await fetch("/.netlify/functions/auth-logout", {
        method: "POST",
        credentials: "include",
      });
      window.location.href = "/";
    } catch {
      setErrorCode("network_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        backgroundColor: "#fbfaf7",
        backgroundImage:
          "radial-gradient(900px 500px at 15% 15%, rgba(255, 237, 213, 0.55), rgba(255, 255, 255, 0)), radial-gradient(900px 500px at 85% 20%, rgba(204, 251, 241, 0.35), rgba(255, 255, 255, 0)), linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.9))",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Typography.Title
            level={2}
            style={{ margin: 0, fontWeight: 650, letterSpacing: 0.2 }}
          >
            Ahangama
          </Typography.Title>
          <Typography.Text type="secondary" style={{ letterSpacing: 0.3 }}>
            Admin Dashboard
          </Typography.Text>
        </div>

        <Spin
          spinning={authLoading || submitting}
          tip={submitting ? "Signing you in…" : ""}
        >
          <Card
            styles={{
              body: {
                padding: 28,
              },
            }}
            style={{
              borderRadius: 16,
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
              border: "1px solid rgba(15, 23, 42, 0.06)",
              backdropFilter: "saturate(1.1)",
            }}
          >
            <Space direction="vertical" size={24} style={{ width: "100%" }}>
              {errorCode && (
                <Alert
                  type="error"
                  showIcon
                  message="Authentication error"
                  description={getErrorMessage(errorCode)}
                />
              )}

              {authenticated ? (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Alert type="success" showIcon message={signedInLabel} />
                  <Button
                    type="primary"
                    size="large"
                    block
                    style={{ height: 48, borderRadius: 12 }}
                    onClick={() => navigate("/admin", { replace: true })}
                  >
                    Continue to dashboard
                  </Button>
                  <Button type="text" block onClick={handleLogout}>
                    Sign out
                  </Button>
                </Space>
              ) : (
                <div style={{ width: "100%" }}>
                  <div
                    style={{
                      width: "100%",
                      minHeight: 52,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                    aria-label="Sign in with Google"
                  >
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      width="100%"
                      size="large"
                      shape="pill"
                      theme="outline"
                      text="continue_with"
                      useOneTap={false}
                    />
                  </div>
                  <Typography.Paragraph
                    type="secondary"
                    style={{ margin: "16px 0 0", textAlign: "center" }}
                  >
                    Authorized Team Members Only
                  </Typography.Paragraph>
                </div>
              )}
            </Space>
          </Card>
        </Spin>

        <Typography.Paragraph
          type="secondary"
          style={{ margin: "18px 0 0", textAlign: "center" }}
        >
          Powered by{" "}
          <Typography.Link href="https://viji.com" target="_blank">
            Viji
          </Typography.Link>
        </Typography.Paragraph>
      </div>
    </div>
  );
}
