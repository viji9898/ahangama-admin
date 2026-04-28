import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Input,
  Row,
  Select,
  Space,
  Typography,
  message,
} from "antd";

const REDIRECT_BASE_URL = "https://qr.ahangama.com";
const LANDING_BASE_URL = "https://ahangama.com";
const CAMPAIGN_NAME = "qr_launch_2026";
const GOAL_OPTIONS = [
  { label: "Hero CTA (h)", value: "h" },
  { label: "Buy", value: "buy" },
  { label: "Launch", value: "launch" },
  { label: "Promo", value: "promo" },
];
const SURFACE_OPTIONS = [
  { label: "PS - Post Stand", value: "ps" },
  { label: "PLST - Plastic Stand", value: "plst" },
];

function slugify(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function QrLinkGenerator() {
  const [venue, setVenue] = useState("");
  const [surface, setSurface] = useState("ps");
  const [creative, setCreative] = useState("");
  const [goal, setGoal] = useState("h");

  const normalizedVenue = useMemo(() => slugify(venue), [venue]);
  const normalizedSurface = useMemo(() => slugify(surface), [surface]);
  const normalizedCreative = useMemo(() => slugify(creative), [creative]);

  const utmContent = useMemo(() => {
    return [normalizedVenue, normalizedSurface, normalizedCreative]
      .filter(Boolean)
      .join("__");
  }, [normalizedCreative, normalizedSurface, normalizedVenue]);

  const validationMessage = useMemo(() => {
    if (!normalizedVenue) {
      return "Venue is required to build utm_content.";
    }

    if (!normalizedSurface) {
      return "Surface is required to build utm_content.";
    }

    return "";
  }, [normalizedSurface, normalizedVenue]);

  const generatedPath = useMemo(() => {
    const parts = ["g", goal, "v", normalizedVenue, "s", normalizedSurface];

    if (normalizedCreative) {
      parts.push("c", normalizedCreative);
    }

    return `/${parts.join("/")}`;
  }, [goal, normalizedCreative, normalizedSurface, normalizedVenue]);

  const generatedUrl = useMemo(() => {
    const url = new URL(generatedPath, REDIRECT_BASE_URL);

    return url.toString();
  }, [generatedPath]);

  const redirectPreviewUrl = useMemo(() => {
    const url = new URL("/", LANDING_BASE_URL);

    url.searchParams.set("utm_source", "qr");
    url.searchParams.set("utm_medium", "offline");
    url.searchParams.set("utm_campaign", CAMPAIGN_NAME);
    url.searchParams.set("utm_content", utmContent);
    url.searchParams.set("utm_term", goal);

    return url.toString();
  }, [goal, utmContent]);

  const copyLink = async () => {
    if (validationMessage) {
      message.error(validationMessage);
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedUrl);
      message.success("Link copied");
    } catch {
      message.error("Could not copy the link");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Card
        styles={{ body: { padding: 28 } }}
        style={{
          borderRadius: 24,
          background:
            "linear-gradient(135deg, rgba(255, 247, 237, 0.96), rgba(254, 249, 195, 0.9))",
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
        }}
      >
        <Space direction="vertical" size={8}>
          <Typography.Text type="secondary">QR Links</Typography.Text>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Generate a qr.ahangama.com redirect link
          </Typography.Title>
          <Typography.Paragraph
            type="secondary"
            style={{ margin: 0, maxWidth: 760 }}
          >
            Build the structured redirect path used by the live QR redirect
            function. The tool also previews the final ahangama.com URL that the
            redirect code will produce.
          </Typography.Paragraph>
        </Space>
      </Card>

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={14}>
          <Card
            title="QR redirect details"
            styles={{ body: { padding: 20 } }}
            style={{
              borderRadius: 20,
              border: "1px solid rgba(15, 23, 42, 0.06)",
              boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
            }}
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <div>
                <Typography.Text strong>Campaign</Typography.Text>
                <Input
                  value={CAMPAIGN_NAME}
                  readOnly
                  style={{ marginTop: 8 }}
                />
              </div>

              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Typography.Text strong>Venue</Typography.Text>
                  <Input
                    value={venue}
                    onChange={(event) => setVenue(event.target.value)}
                    placeholder="viji-test"
                    style={{ marginTop: 8 }}
                  />
                </Col>
                <Col xs={24} md={12}>
                  <Typography.Text strong>Surface</Typography.Text>
                  <Select
                    value={surface}
                    onChange={setSurface}
                    options={SURFACE_OPTIONS}
                    style={{ width: "100%", marginTop: 8 }}
                  />
                </Col>
              </Row>

              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Typography.Text strong>Creative</Typography.Text>
                  <Input
                    value={creative}
                    onChange={(event) => setCreative(event.target.value)}
                    placeholder="optional"
                    style={{ marginTop: 8 }}
                  />
                </Col>
                <Col xs={24} md={12}>
                  <Typography.Text strong>Goal</Typography.Text>
                  <Select
                    value={goal}
                    onChange={setGoal}
                    options={GOAL_OPTIONS}
                    style={{ width: "100%", marginTop: 8 }}
                  />
                </Col>
              </Row>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Space direction="vertical" size={24} style={{ width: "100%" }}>
            <Card
              title="Generated redirect URL"
              styles={{ body: { padding: 20 } }}
              style={{
                borderRadius: 20,
                border: "1px solid rgba(15, 23, 42, 0.06)",
                boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
              }}
            >
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Input.TextArea
                  value={generatedUrl}
                  readOnly
                  autoSize={{ minRows: 4, maxRows: 6 }}
                />
                <Button
                  type="primary"
                  onClick={copyLink}
                  disabled={Boolean(validationMessage)}
                >
                  Copy link
                </Button>
                {validationMessage ? (
                  <Typography.Text type="danger">
                    {validationMessage}
                  </Typography.Text>
                ) : null}
              </Space>
            </Card>

            <Card
              title="Redirect preview"
              styles={{ body: { padding: 20 } }}
              style={{
                borderRadius: 20,
                border: "1px solid rgba(15, 23, 42, 0.06)",
                boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
              }}
            >
              <Space direction="vertical" size={8}>
                <Typography.Text>
                  <Typography.Text strong>utm_source:</Typography.Text> qr
                </Typography.Text>
                <Typography.Text>
                  <Typography.Text strong>utm_medium:</Typography.Text> offline
                </Typography.Text>
                <Typography.Text>
                  <Typography.Text strong>utm_campaign:</Typography.Text>{" "}
                  {CAMPAIGN_NAME}
                </Typography.Text>
                <Typography.Text>
                  <Typography.Text strong>utm_content:</Typography.Text>{" "}
                  {utmContent || "-"}
                </Typography.Text>
                <Typography.Text>
                  <Typography.Text strong>utm_term:</Typography.Text> {goal}
                </Typography.Text>
                <Typography.Text>
                  <Typography.Text strong>Final URL:</Typography.Text>{" "}
                  {redirectPreviewUrl}
                </Typography.Text>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
}
