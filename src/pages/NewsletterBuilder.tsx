import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CopyOutlined,
  DeleteOutlined,
  MailOutlined,
  PlusOutlined,
  SendOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useState } from "react";

const ENDPOINT = "/.netlify/functions/api-newsletters";
const AUDIENCES = [
  { label: "Circle", value: "circle" },
  { label: "Guest passes", value: "guest" },
  { label: "Hospo", value: "hospo" },
  { label: "Imported list", value: "imported" },
];

type CardItem = {
  heading?: string;
  label?: string;
  body?: string;
  imageUrl?: string;
  imageAlt?: string;
  linkLabel?: string;
  url?: string;
};

type NewsletterBlock = {
  id: string;
  type: "hero" | "feature" | "cards" | "text" | "buttons" | "divider";
  heading?: string;
  body?: string;
  label?: string;
  imageUrl?: string;
  imageAlt?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  background?: string;
  items?: CardItem[];
};

type Newsletter = {
  id?: string;
  title: string;
  subject: string;
  previewText: string;
  status: "draft" | "sent" | "archived";
  blocks: NewsletterBlock[];
  audienceSources: string[];
  updatedAt?: string;
};

type ApiPayload = {
  ok?: boolean;
  error?: string;
  newsletter?: Newsletter;
  preview?: { html?: string; text?: string };
  recipientCount?: number;
  imported?: number;
  rejected?: string[];
};

const newId = () => crypto.randomUUID();

function createBlock(type: NewsletterBlock["type"]): NewsletterBlock {
  if (type === "cards") {
    return {
      id: newId(),
      type,
      items: [
        { heading: "First story", body: "Add story details." },
        { heading: "Second story", body: "Add story details." },
      ],
    };
  }
  if (type === "buttons") {
    return {
      id: newId(),
      type,
      items: [{ label: "Explore", url: "https://ahangama.com" }],
    };
  }
  if (type === "divider") return { id: newId(), type };
  return {
    id: newId(),
    type,
    heading:
      type === "hero" ? "A busy month around Ahangama." : "Section title",
    body: "Add your content here.",
  };
}

function createNewsletter(): Newsletter {
  return {
    title: "The Ahangama Circle",
    subject: "Ahangama Circle newsletter",
    previewText: "The latest news from around Ahangama.",
    status: "draft",
    audienceSources: [],
    blocks: [createBlock("hero")],
  };
}

async function request(body?: object, id?: string) {
  const response = await fetch(
    `${ENDPOINT}${id ? `?id=${encodeURIComponent(id)}` : ""}`,
    {
      method: body ? "POST" : "GET",
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  const payload = (await response.json().catch(() => ({}))) as ApiPayload;
  if (!response.ok || payload.ok === false) {
    throw new Error(
      payload.error || `Newsletter request failed (${response.status})`,
    );
  }
  return payload;
}

function BlockEditor({
  block,
  onChange,
}: {
  block: NewsletterBlock;
  onChange: (block: NewsletterBlock) => void;
}) {
  if (block.type === "divider") {
    return (
      <Alert
        type="info"
        showIcon
        message="This block inserts a horizontal divider."
      />
    );
  }

  const update = (field: keyof NewsletterBlock, value: unknown) =>
    onChange({ ...block, [field]: value });

  if (block.type === "cards" || block.type === "buttons") {
    const items = block.items || [];
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {items.map((item, index) => (
          <Card
            key={index}
            size="small"
            title={`${block.type === "cards" ? "Card" : "Button"} ${index + 1}`}
            extra={
              <Button
                danger
                type="text"
                icon={<DeleteOutlined />}
                aria-label={`Delete item ${index + 1}`}
                onClick={() =>
                  update(
                    "items",
                    items.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              />
            }
          >
            <Space direction="vertical" size={10} style={{ width: "100%" }}>
              <Input
                value={block.type === "cards" ? item.heading : item.label}
                placeholder={
                  block.type === "cards" ? "Heading" : "Button label"
                }
                onChange={(event) => {
                  const next = [...items];
                  next[index] =
                    block.type === "cards"
                      ? { ...item, heading: event.target.value }
                      : { ...item, label: event.target.value };
                  update("items", next);
                }}
              />
              {block.type === "cards" ? (
                <>
                  <Input.TextArea
                    value={item.body}
                    rows={3}
                    placeholder="Description"
                    onChange={(event) => {
                      const next = [...items];
                      next[index] = { ...item, body: event.target.value };
                      update("items", next);
                    }}
                  />
                  <Input
                    value={item.imageUrl}
                    placeholder="Image URL"
                    onChange={(event) => {
                      const next = [...items];
                      next[index] = { ...item, imageUrl: event.target.value };
                      update("items", next);
                    }}
                  />
                </>
              ) : null}
              <Input
                value={item.url}
                placeholder="https://"
                onChange={(event) => {
                  const next = [...items];
                  next[index] = { ...item, url: event.target.value };
                  update("items", next);
                }}
              />
            </Space>
          </Card>
        ))}
        <Button
          icon={<PlusOutlined />}
          onClick={() =>
            update("items", [
              ...items,
              block.type === "cards"
                ? { heading: "New item", body: "", url: "" }
                : { label: "New button", url: "" },
            ])
          }
        >
          Add item
        </Button>
      </Space>
    );
  }

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      {block.type === "feature" ? (
        <Input
          value={block.label}
          placeholder="Label, e.g. Sponsored by"
          onChange={(event) => update("label", event.target.value)}
        />
      ) : null}
      <Input
        value={block.heading}
        placeholder="Heading"
        onChange={(event) => update("heading", event.target.value)}
      />
      <Input.TextArea
        value={block.body}
        rows={7}
        placeholder="Use a blank line between paragraphs"
        onChange={(event) => update("body", event.target.value)}
      />
      {block.type === "feature" ? (
        <>
          <Input
            value={block.imageUrl}
            placeholder="Image URL"
            onChange={(event) => update("imageUrl", event.target.value)}
          />
          <Input
            value={block.imageAlt}
            placeholder="Image description"
            onChange={(event) => update("imageAlt", event.target.value)}
          />
          <Input
            value={block.background}
            placeholder="Background colour, e.g. #f4f0e8"
            onChange={(event) => update("background", event.target.value)}
          />
        </>
      ) : null}
      {block.type === "hero" || block.type === "feature" ? (
        <Row gutter={12}>
          <Col span={10}>
            <Input
              value={block.ctaLabel}
              placeholder="Button label"
              onChange={(event) => update("ctaLabel", event.target.value)}
            />
          </Col>
          <Col span={14}>
            <Input
              value={block.ctaUrl}
              placeholder="Button URL"
              onChange={(event) => update("ctaUrl", event.target.value)}
            />
          </Col>
        </Row>
      ) : null}
    </Space>
  );
}

export default function NewsletterBuilder() {
  const [newsletter, setNewsletter] = useState<Newsletter>(createNewsletter);
  const [selectedBlockId, setSelectedBlockId] = useState<string>();
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewWidth, setPreviewWidth] = useState<"Desktop" | "Mobile">(
    "Mobile",
  );
  const [recipientCount, setRecipientCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [confirmSubject, setConfirmSubject] = useState("");
  const [addType, setAddType] = useState<NewsletterBlock["type"]>("feature");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(async () => {
      try {
        const payload = await request({ action: "preview", ...newsletter });
        if (active) setPreviewHtml(payload.preview?.html || "");
      } catch (previewError) {
        if (active) {
          setError(String((previewError as Error).message || previewError));
        }
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [newsletter]);

  const loadNewsletter = async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const payload = await request(undefined, id);
      if (payload.newsletter) {
        setNewsletter(payload.newsletter);
        setSelectedBlockId(payload.newsletter.blocks[0]?.id);
      }
      setPreviewHtml(payload.preview?.html || "");
      setRecipientCount(payload.recipientCount || 0);
    } catch (loadError) {
      setError(String((loadError as Error).message || loadError));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = await request({ action: "save", ...newsletter });
      if (payload.newsletter) {
        setNewsletter(payload.newsletter);
        await loadNewsletter(payload.newsletter.id!);
      }
      message.success("Draft saved");
    } catch (saveError) {
      setError(String((saveError as Error).message || saveError));
    } finally {
      setSaving(false);
    }
  };

  const changeAudiences = async (values: string[]) => {
    setNewsletter((current) => ({ ...current, audienceSources: values }));
    try {
      const payload = await request({
        action: "count",
        audienceSources: values,
      });
      setRecipientCount(payload.recipientCount || 0);
    } catch (countError) {
      setError(String((countError as Error).message || countError));
    }
  };

  const updateBlock = (updated: NewsletterBlock) => {
    setNewsletter((current) => ({
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === updated.id ? updated : block,
      ),
    }));
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= newsletter.blocks.length) return;
    const blocks = [...newsletter.blocks];
    [blocks[index], blocks[destination]] = [blocks[destination], blocks[index]];
    setNewsletter({ ...newsletter, blocks });
  };

  const selectedBlock = newsletter.blocks.find(
    (block) => block.id === selectedBlockId,
  );
  const readOnly = newsletter.status === "sent";

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <Card>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Typography.Text type="secondary">Email campaigns</Typography.Text>
            <Typography.Title level={2} style={{ margin: "4px 0 0" }}>
              Newsletters
            </Typography.Title>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                const next = createNewsletter();
                setNewsletter(next);
                setSelectedBlockId(next.blocks[0].id);
              }}
            >
              New newsletter
            </Button>
          </Col>
        </Row>
      </Card>

      {error ? (
        <Alert
          type="error"
          showIcon
          closable
          message={error}
          onClose={() => setError("")}
        />
      ) : null}

      <Spin spinning={loading}>
        <Row gutter={[18, 18]}>
          <Col xs={24} xl={12}>
            <Card
              title="Compose"
              extra={
                <Tag color={readOnly ? "green" : "gold"}>
                  {newsletter.status}
                </Tag>
              }
            >
              <Form layout="vertical" disabled={readOnly}>
                <Form.Item label="Internal title" required>
                  <Input
                    value={newsletter.title}
                    onChange={(event) =>
                      setNewsletter({
                        ...newsletter,
                        title: event.target.value,
                      })
                    }
                  />
                </Form.Item>
                <Form.Item label="Email subject" required>
                  <Input
                    value={newsletter.subject}
                    onChange={(event) =>
                      setNewsletter({
                        ...newsletter,
                        subject: event.target.value,
                      })
                    }
                  />
                </Form.Item>
                <Form.Item label="Inbox preview text">
                  <Input
                    value={newsletter.previewText}
                    onChange={(event) =>
                      setNewsletter({
                        ...newsletter,
                        previewText: event.target.value,
                      })
                    }
                  />
                </Form.Item>
                <Form.Item label="Recipients">
                  <Checkbox.Group
                    options={AUDIENCES}
                    value={newsletter.audienceSources}
                    onChange={(values) =>
                      void changeAudiences(values as string[])
                    }
                  />
                  <div style={{ marginTop: 10 }}>
                    <Tag color="blue">
                      {recipientCount.toLocaleString()} unique recipients
                    </Tag>
                    <Button type="link" onClick={() => setImportOpen(true)}>
                      Import list
                    </Button>
                  </div>
                </Form.Item>
              </Form>

              <Divider titlePlacement="left">Content blocks</Divider>
              <Space.Compact style={{ width: "100%", marginBottom: 14 }}>
                <Select
                  style={{ flex: 1 }}
                  value={addType}
                  onChange={setAddType}
                  options={[
                    ["Hero", "hero"],
                    ["Feature", "feature"],
                    ["Cards", "cards"],
                    ["Text", "text"],
                    ["Buttons", "buttons"],
                    ["Divider", "divider"],
                  ].map(([label, value]) => ({ label, value }))}
                />
                <Button
                  disabled={readOnly}
                  icon={<PlusOutlined />}
                  onClick={() => {
                    const block = createBlock(addType);
                    setNewsletter({
                      ...newsletter,
                      blocks: [...newsletter.blocks, block],
                    });
                    setSelectedBlockId(block.id);
                  }}
                >
                  Add block
                </Button>
              </Space.Compact>

              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                {newsletter.blocks.map((block, index) => (
                  <Card
                    key={block.id}
                    size="small"
                    type={selectedBlockId === block.id ? "inner" : undefined}
                    title={`${index + 1}. ${block.type}${block.heading ? ` · ${block.heading}` : ""}`}
                    onClick={() => setSelectedBlockId(block.id)}
                    extra={
                      <Space size={0}>
                        <Button
                          type="text"
                          icon={<ArrowUpOutlined />}
                          disabled={readOnly || index === 0}
                          onClick={(event) => {
                            event.stopPropagation();
                            moveBlock(index, -1);
                          }}
                        />
                        <Button
                          type="text"
                          icon={<ArrowDownOutlined />}
                          disabled={
                            readOnly || index === newsletter.blocks.length - 1
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            moveBlock(index, 1);
                          }}
                        />
                        <Button
                          type="text"
                          icon={<CopyOutlined />}
                          disabled={readOnly}
                          onClick={(event) => {
                            event.stopPropagation();
                            const copy = { ...block, id: newId() };
                            const blocks = [...newsletter.blocks];
                            blocks.splice(index + 1, 0, copy);
                            setNewsletter({ ...newsletter, blocks });
                            setSelectedBlockId(copy.id);
                          }}
                        />
                        <Popconfirm
                          title="Delete this block?"
                          onConfirm={() =>
                            setNewsletter({
                              ...newsletter,
                              blocks: newsletter.blocks.filter(
                                (item) => item.id !== block.id,
                              ),
                            })
                          }
                        >
                          <Button
                            danger
                            type="text"
                            icon={<DeleteOutlined />}
                            disabled={readOnly}
                            onClick={(event) => event.stopPropagation()}
                          />
                        </Popconfirm>
                      </Space>
                    }
                  />
                ))}
              </Space>

              {selectedBlock ? (
                <>
                  <Divider titlePlacement="left">
                    Edit {selectedBlock.type}
                  </Divider>
                  <BlockEditor block={selectedBlock} onChange={updateBlock} />
                </>
              ) : null}

              <Divider />
              <Space wrap>
                <Button
                  type="primary"
                  loading={saving}
                  disabled={readOnly}
                  onClick={() => void save()}
                >
                  Save draft
                </Button>
                <Button
                  icon={<MailOutlined />}
                  disabled={!newsletter.id || readOnly}
                  onClick={async () => {
                    try {
                      await request({ action: "test" }, newsletter.id);
                      message.success("Test email sent to your admin email");
                    } catch (sendError) {
                      setError(String((sendError as Error).message));
                    }
                  }}
                >
                  Send test
                </Button>
                <Button
                  danger
                  icon={<SendOutlined />}
                  disabled={!newsletter.id || readOnly || !recipientCount}
                  onClick={() => setSendOpen(true)}
                >
                  Send to {recipientCount.toLocaleString()}
                </Button>
              </Space>
            </Card>
          </Col>

          <Col xs={24} xl={12}>
            <Card
              title="Email preview"
              extra={
                <Segmented
                  options={["Desktop", "Mobile"]}
                  value={previewWidth}
                  onChange={(value) =>
                    setPreviewWidth(value as "Desktop" | "Mobile")
                  }
                />
              }
            >
              {previewHtml ? (
                <div
                  style={{
                    overflow: "auto",
                    background: "#e5e7eb",
                    padding: 12,
                    textAlign: "center",
                  }}
                >
                  <iframe
                    title="Newsletter preview"
                    sandbox="allow-popups"
                    srcDoc={previewHtml}
                    style={{
                      width: previewWidth === "Mobile" ? 390 : 640,
                      maxWidth: "100%",
                      height: 760,
                      border: 0,
                      background: "white",
                    }}
                  />
                </div>
              ) : (
                <Empty description="Generating preview…" />
              )}
            </Card>
          </Col>
        </Row>
      </Spin>

      <Modal
        title="Import recipients"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        onOk={async () => {
          try {
            const recipients = importText
              .split(/\n|,/)
              .map((value) => value.trim())
              .filter(Boolean);
            const payload = await request({ action: "import", recipients });
            message.success(`${payload.imported || 0} recipients imported`);
            setImportOpen(false);
            setImportText("");
            if (newsletter.audienceSources.includes("imported"))
              void changeAudiences(newsletter.audienceSources);
          } catch (importError) {
            setError(String((importError as Error).message));
          }
        }}
        okText="Import"
      >
        <Typography.Paragraph type="secondary">
          Enter one email per line or paste a comma-separated list. Imported
          recipients are deduplicated.
        </Typography.Paragraph>
        <Input.TextArea
          rows={10}
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
          placeholder="person@example.com"
        />
      </Modal>

      <Modal
        title="Confirm newsletter send"
        open={sendOpen}
        onCancel={() => setSendOpen(false)}
        okButtonProps={{
          danger: true,
          disabled: confirmSubject !== newsletter.subject,
        }}
        okText={`Send to ${recipientCount.toLocaleString()}`}
        onOk={async () => {
          try {
            await request({ action: "send", confirmSubject }, newsletter.id);
            message.success("Newsletter accepted by SendGrid");
            setSendOpen(false);
            setConfirmSubject("");
            await loadNewsletter(newsletter.id!);
          } catch (sendError) {
            setError(String((sendError as Error).message));
          }
        }}
      >
        <Alert
          type="warning"
          showIcon
          message="This cannot be undone"
          description={`The newsletter will be sent to ${recipientCount.toLocaleString()} unique recipients.`}
        />
        <Typography.Paragraph style={{ marginTop: 18 }}>
          Type the subject exactly to confirm:
        </Typography.Paragraph>
        <Typography.Text code>{newsletter.subject}</Typography.Text>
        <Input
          style={{ marginTop: 10 }}
          value={confirmSubject}
          onChange={(event) => setConfirmSubject(event.target.value)}
        />
      </Modal>
    </Space>
  );
}
