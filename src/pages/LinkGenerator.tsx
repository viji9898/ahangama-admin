import { useMemo, useState } from "react";
import {
  Alert,
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

const BASE_URL = "https://ig.ahangama.com";
const SURFACE_OPTIONS = [
  "reel",
  "story",
  "carousel",
  "bio",
  "post",
  "highlight",
];
const DESTINATION_OPTIONS = [
  { label: "Pass", value: "pass" },
  { label: "Guide", value: "guide" },
  { label: "Venue", value: "venue" },
];
const VENUE_CATEGORY_OPTIONS = [
  { label: "Eat", value: "eat" },
  { label: "Stays", value: "stays" },
  { label: "Experiences", value: "experiences" },
];

function slugify(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function LinkGenerator() {
  const [destination, setDestination] = useState("pass");
  const [surface, setSurface] = useState("reel");
  const [category, setCategory] = useState("eat");
  const [venueSlug, setVenueSlug] = useState("");
  const [campaignLabel, setCampaignLabel] = useState("");

  const normalizedVenueSlug = slugify(venueSlug);
  const normalizedCampaignLabel = slugify(campaignLabel);

  const validationMessage = useMemo(() => {
    if (destination === "venue" && !normalizedVenueSlug) {
      return "Venue links need a venue slug.";
    }

    return "";
  }, [destination, normalizedVenueSlug]);

  const generatedUrl = useMemo(() => {
    const parts = [BASE_URL, "to"];

    if (destination === "venue") {
      parts.push(category, normalizedVenueSlug);
    } else {
      parts.push(destination);
    }

    parts.push("s", surface);

    if (normalizedCampaignLabel) {
      parts.push("c", normalizedCampaignLabel);
    }

    return parts.join("/");
  }, [
    category,
    destination,
    normalizedCampaignLabel,
    normalizedVenueSlug,
    surface,
  ]);

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
            "linear-gradient(135deg, rgba(236, 253, 245, 0.96), rgba(239, 246, 255, 0.96))",
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
        }}
      >
        <Space direction="vertical" size={8}>
          <Typography.Text type="secondary">Instagram Links</Typography.Text>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Generate a tracked Instagram link
          </Typography.Title>
          <Typography.Paragraph
            type="secondary"
            style={{ margin: 0, maxWidth: 760 }}
          >
            Build a consistent ig.ahangama.com link for pass promotions, venue
            posts, and guide content without manually assembling the path each
            time.
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
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <div>
                <Typography.Text strong>Destination</Typography.Text>
                <Select
                  value={destination}
                  onChange={setDestination}
                  options={DESTINATION_OPTIONS}
                  style={{ width: "100%", marginTop: 8 }}
                />
              </div>

              {destination === "venue" ? (
                <>
                  <div>
                    <Typography.Text strong>Venue category</Typography.Text>
                    <Select
                      value={category}
                      onChange={setCategory}
                      options={VENUE_CATEGORY_OPTIONS}
                      style={{ width: "100%", marginTop: 8 }}
                    />
                  </div>

                  <div>
                    <Typography.Text strong>Venue slug</Typography.Text>
                    <Input
                      value={venueSlug}
                      onChange={(event) => setVenueSlug(event.target.value)}
                      placeholder="kaffi-ahangama"
                      style={{ marginTop: 8 }}
                    />
                    <Typography.Paragraph
                      type="secondary"
                      style={{ margin: "8px 0 0" }}
                    >
                      Use the venue slug from the site URL. The generator will
                      clean the value into kebab-case.
                    </Typography.Paragraph>
                  </div>
                </>
              ) : null}

              <div>
                <Typography.Text strong>Instagram surface</Typography.Text>
                <Select
                  value={surface}
                  onChange={setSurface}
                  options={SURFACE_OPTIONS.map((value) => ({
                    label: value,
                    value,
                  }))}
                  style={{ width: "100%", marginTop: 8 }}
                />
              </div>

              <div>
                <Typography.Text strong>
                  Campaign or creator label
                </Typography.Text>
                <Input
                  value={campaignLabel}
                  onChange={(event) => setCampaignLabel(event.target.value)}
                  placeholder="optional, for example summer-launch"
                  style={{ marginTop: 8 }}
                />
                <Typography.Paragraph
                  type="secondary"
                  style={{ margin: "8px 0 0" }}
                >
                  This becomes the optional{" "}
                  <Typography.Text code>/c/</Typography.Text> path segment.
                </Typography.Paragraph>
              </div>
            </Space>
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
                {validationMessage ? (
                  <Alert type="warning" showIcon message={validationMessage} />
                ) : null}

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
              </Space>
            </Card>

            <Card
              title="Format"
              styles={{ body: { padding: 20 } }}
              style={{
                borderRadius: 20,
                border: "1px solid rgba(15, 23, 42, 0.06)",
                boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
              }}
            >
              <Space direction="vertical" size={10}>
                <Typography.Text>
                  Pass or guide:{" "}
                  <Typography.Text code>
                    {BASE_URL}/to/pass/s/reel
                  </Typography.Text>
                </Typography.Text>
                <Typography.Text>
                  Venue:{" "}
                  <Typography.Text code>
                    {BASE_URL}/to/eat/kaffi-ahangama/s/story
                  </Typography.Text>
                </Typography.Text>
                <Typography.Text>
                  With campaign:{" "}
                  <Typography.Text code>
                    {BASE_URL}/to/pass/s/reel/c/summer-launch
                  </Typography.Text>
                </Typography.Text>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
}
