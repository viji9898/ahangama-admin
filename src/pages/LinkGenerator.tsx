import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Typography,
  message,
} from "antd";

const BASE_URL = "https://ig.ahangama.com";
const LANDING_BASE_URL = "https://ahangama.com";
const UTM_SOURCE = "instagram";
const UTM_MEDIUM = "social";
const UTM_CAMPAIGN = "ig_launch_2026";
const DEFAULT_GOAL = "h";
const DEFAULT_VENUE = "ig-root";
const GOAL_OPTIONS = [
  { label: "Home", value: "h" },
  { label: "Google Map", value: "map" },
  { label: "Ahangama Guide", value: "guide" },
  { label: "Buy Pass", value: "pass" },
  { label: "Free Coffee", value: "coffee" },
  { label: "Surf Offer", value: "surf" },
  { label: "Stay Offer", value: "stay" },
];
const ENTRY_OPTIONS = [
  { label: "bio", value: "bio" },
  { label: "story", value: "story" },
  { label: "reel", value: "reel" },
  { label: "ad", value: "ad" },
  { label: "dm", value: "dm" },
];

function sanitizeValue(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function IgLinkGenerator() {
  const [warningOpen, setWarningOpen] = useState(true);
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [venue, setVenue] = useState(DEFAULT_VENUE);
  const [entry, setEntry] = useState("bio");
  const [creative, setCreative] = useState("google-map-v1");

  const normalizedGoal = useMemo(() => sanitizeValue(goal), [goal]);
  const normalizedVenue = useMemo(() => sanitizeValue(venue), [venue]);
  const normalizedEntry = useMemo(() => sanitizeValue(entry), [entry]);
  const normalizedCreative = useMemo(() => sanitizeValue(creative), [creative]);

  const resolvedGoal = normalizedGoal || DEFAULT_GOAL;
  const resolvedVenue = normalizedVenue || DEFAULT_VENUE;

  const utmContent = useMemo(() => {
    return [resolvedVenue, normalizedEntry, normalizedCreative]
      .filter(Boolean)
      .join("__");
  }, [normalizedCreative, normalizedEntry, resolvedVenue]);

  const generatedUrl = useMemo(() => {
    const parts = [BASE_URL, "g", resolvedGoal, "v", resolvedVenue];

    if (normalizedEntry) {
      parts.push("e", normalizedEntry);
    }

    if (normalizedCreative) {
      parts.push("c", normalizedCreative);
    }

    return parts.join("/");
  }, [normalizedCreative, normalizedEntry, resolvedGoal, resolvedVenue]);

  const landingPreviewUrl = useMemo(() => {
    const url = new URL("/", LANDING_BASE_URL);

    url.searchParams.set("utm_source", UTM_SOURCE);
    url.searchParams.set("utm_medium", UTM_MEDIUM);
    url.searchParams.set("utm_campaign", UTM_CAMPAIGN);
    url.searchParams.set("utm_content", utmContent);
    url.searchParams.set("utm_term", resolvedGoal);

    return url.toString();
  }, [resolvedGoal, utmContent]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(generatedUrl);
      message.success("Link copied");
    } catch {
      message.error("Could not copy the link");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Modal
        open={warningOpen}
        title="Beta feature"
        onOk={() => setWarningOpen(false)}
        onCancel={() => setWarningOpen(false)}
        okText="I understand"
        cancelText="Close"
      >
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          This link generator is still in testing. Do not use it for live
          campaigns yet.
        </Typography.Paragraph>
      </Modal>

      <Card
        styles={{ body: { padding: 28 } }}
        style={{
          borderRadius: 24,
          background:
            "linear-gradient(135deg, rgba(236, 253, 245, 0.96), rgba(239, 246, 255, 0.96))",
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
        }}
      >
        <Space direction="vertical" size={8}>
          <Typography.Text type="secondary">Instagram Links</Typography.Text>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Generate an ig.ahangama.com redirect link
          </Typography.Title>
          <Alert
            type="warning"
            showIcon
            message="Beta feature"
            description="This link generator is still in testing. Do not use it for live campaigns yet."
          />
          <Typography.Paragraph
            type="secondary"
            style={{ margin: 0, maxWidth: 760 }}
          >
            Build the Instagram redirect URL live from the structured goal,
            venue, entry, and creative fields.
          </Typography.Paragraph>
        </Space>
      </Card>

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={14}>
          <Card
            title="Link details"
            styles={{ body: { padding: 20 } }}
            style={{
              borderRadius: 20,
              border: "1px solid rgba(15, 23, 42, 0.06)",
              boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
            }}
          >
            <Form layout="vertical">
              <Form.Item label="Goal">
                <Select
                  value={goal}
                  onChange={setGoal}
                  options={GOAL_OPTIONS}
                />
              </Form.Item>

              <Form.Item label="Venue / Source">
                <Input
                  value={venue}
                  onChange={(event) => setVenue(event.target.value)}
                  placeholder="ig-root"
                />
              </Form.Item>

              <Form.Item label="Entry">
                <Select
                  allowClear
                  value={entry || undefined}
                  onChange={(value) => setEntry(value || "")}
                  options={ENTRY_OPTIONS}
                  placeholder="Optional"
                />
              </Form.Item>

              <Form.Item label="Creative">
                <Input
                  value={creative}
                  onChange={(event) => setCreative(event.target.value)}
                  placeholder="Optional"
                />
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Space direction="vertical" size={24} style={{ width: "100%" }}>
            <Card
              title="Generated link"
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

                <Button type="primary" onClick={copyLink}>
                  Copy link
                </Button>
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
                  <Typography.Text strong>utm_source:</Typography.Text>{" "}
                  {UTM_SOURCE}
                </Typography.Text>
                <Typography.Text>
                  <Typography.Text strong>utm_medium:</Typography.Text>{" "}
                  {UTM_MEDIUM}
                </Typography.Text>
                <Typography.Text>
                  <Typography.Text strong>utm_campaign:</Typography.Text>{" "}
                  {UTM_CAMPAIGN}
                </Typography.Text>
                <Typography.Text>
                  <Typography.Text strong>utm_content:</Typography.Text>{" "}
                  {utmContent}
                </Typography.Text>
                <Typography.Text>
                  <Typography.Text strong>utm_term:</Typography.Text>{" "}
                  {resolvedGoal}
                </Typography.Text>
                <Typography.Text>
                  <Typography.Text strong>Final URL:</Typography.Text>{" "}
                  {landingPreviewUrl}
                </Typography.Text>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
}
