import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Input,
  Modal,
  Row,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";

import type { Venue } from "../types/venue";

const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:8888";
const UPDATE_ENDPOINT = `${BASE_URL}/.netlify/functions/api-venues-update`;
const SECRET = (
  import.meta.env.ADMIN_IMPORT_SECRET ||
  import.meta.env.VITE_ADMIN_IMPORT_SECRET ||
  ""
).trim();

const normalizeList = (items: unknown): string[] => {
  if (!Array.isArray(items)) return [];
  const out = items.map((s) => String(s).trim()).filter(Boolean);
  return Array.from(new Set(out));
};

export function VenueCategoriesTags({ venue }: { venue: Venue }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<string[]>(
    normalizeList(venue?.categories),
  );
  const [tags, setTags] = useState<string[]>(normalizeList(venue?.tags));
  const [emoji, setEmoji] = useState<string[]>(normalizeList(venue?.emoji));

  const [newCategory, setNewCategory] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newEmoji, setNewEmoji] = useState("");

  // Keep state in sync if venue changes
  useEffect(() => {
    setCategories(normalizeList(venue?.categories));
    setTags(normalizeList(venue?.tags));
    setEmoji(normalizeList(venue?.emoji));
  }, [venue]);

  useEffect(() => {
    if (!modalOpen) return;
    setCategories(normalizeList(venue?.categories));
    setTags(normalizeList(venue?.tags));
    setEmoji(normalizeList(venue?.emoji));
    setNewCategory("");
    setNewTag("");
    setNewEmoji("");
  }, [modalOpen, venue]);

  const baseline = useMemo(() => {
    return {
      categories: normalizeList(venue?.categories),
      tags: normalizeList(venue?.tags),
      emoji: normalizeList(venue?.emoji),
    };
  }, [venue]);

  const current = useMemo(() => {
    return {
      categories: normalizeList(categories),
      tags: normalizeList(tags),
      emoji: normalizeList(emoji),
    };
  }, [categories, tags, emoji]);

  const added = useMemo(() => {
    const diff = (a: string[], b: string[]) => a.filter((x) => !b.includes(x));
    return {
      categories: diff(current.categories, baseline.categories),
      tags: diff(current.tags, baseline.tags),
      emoji: diff(current.emoji, baseline.emoji),
    };
  }, [baseline, current]);

  const removed = useMemo(() => {
    const diff = (a: string[], b: string[]) => a.filter((x) => !b.includes(x));
    return {
      categories: diff(baseline.categories, current.categories),
      tags: diff(baseline.tags, current.tags),
      emoji: diff(baseline.emoji, current.emoji),
    };
  }, [baseline, current]);

  const hasChanges =
    added.categories.length ||
    added.tags.length ||
    added.emoji.length ||
    removed.categories.length ||
    removed.tags.length ||
    removed.emoji.length;

  const handleAddCategory = () => {
    const v = newCategory.trim();
    if (!v) return;
    setCategories((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setNewCategory("");
  };

  const handleRemoveCategory = (cat: string) => {
    setCategories((prev) => prev.filter((c) => c !== cat));
  };

  const handleAddTag = () => {
    const v = newTag.trim();
    if (!v) return;
    setTags((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setNewTag("");
  };

  const handleRemoveTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleAddEmoji = () => {
    const v = newEmoji.trim();
    if (!v) return;
    setEmoji((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setNewEmoji("");
  };

  const handleRemoveEmoji = (em: string) => {
    setEmoji((prev) => prev.filter((e) => e !== em));
  };

  const handleSave = async () => {
    if (!venue?.id) {
      message.error("Missing venue id.");
      return;
    }

    setSaving(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (SECRET) headers["x-admin-import-secret"] = SECRET;

      const res = await fetch(UPDATE_ENDPOINT, {
        method: "PATCH",
        credentials: "include",
        headers,
        body: JSON.stringify({
          id: venue.id,
          categories: current.categories,
          tags: current.tags,
          emoji: current.emoji,
        }),
      });

      if (res.ok) {
        message.success("Venue updated successfully.");
        setConfirmOpen(false);
        setModalOpen(false);
      } else {
        const text = await res.text().catch(() => "");
        message.error(text || "Failed to update venue.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      message.error(msg || "Error updating venue.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setCategories(baseline.categories);
    setTags(baseline.tags);
    setEmoji(baseline.emoji);
    setNewCategory("");
    setNewTag("");
    setNewEmoji("");
  };

  return (
    <>
      <Card
        title="Categories & Tags"
        style={{ marginBottom: 16 }}
        extra={
          <Button
            type="primary"
            size="small"
            onClick={() => setModalOpen(true)}
            disabled={!venue?.id}
          >
            Edit
          </Button>
        }
      >
        <Row gutter={32}>
          <Col span={12}>
            <div style={{ marginBottom: 12 }}>
              <b>Categories:</b>{" "}
              {categories.length ? (
                categories.map((cat) => (
                  <Tag key={cat} style={{ marginTop: 6 }}>
                    {cat}
                  </Tag>
                ))
              ) : (
                <span style={{ color: "#888" }}>None</span>
              )}
            </div>

            <div>
              <b>Tags:</b>{" "}
              {tags.length ? (
                tags.map((tag) => (
                  <Tag key={tag} style={{ marginTop: 6 }}>
                    {tag}
                  </Tag>
                ))
              ) : (
                <span style={{ color: "#888" }}>None</span>
              )}
            </div>
          </Col>

          <Col span={12}>
            <div>
              <b>Emojis:</b>{" "}
              {emoji.length ? (
                emoji.map((em, idx) => (
                  <span
                    key={`${em}-${idx}`}
                    style={{ fontSize: 24, marginRight: 6 }}
                  >
                    {em}
                  </span>
                ))
              ) : (
                <span style={{ color: "#888" }}>None</span>
              )}
            </div>
          </Col>
        </Row>
      </Card>

      <Modal
        title="Edit Categories, Tags & Emojis"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message="Tips"
            description={
              <div>
                <div>Press Enter to add quickly. Duplicates are ignored.</div>
                <div>Nothing is saved until you click Review & Save.</div>
              </div>
            }
          />

          {!SECRET ? (
            <Alert
              type="warning"
              showIcon
              message="Authentication"
              description="No import secret found in browser env. Saving will rely on your admin session cookie."
            />
          ) : null}

          <div>
            <Typography.Text strong>Categories</Typography.Text>
            <Typography.Text type="secondary">
              {" "}
              ({current.categories.length})
            </Typography.Text>
            <div style={{ margin: "8px 0", maxHeight: 90, overflowY: "auto" }}>
              {current.categories.length ? (
                current.categories.map((cat) => (
                  <Tag
                    key={cat}
                    closable
                    onClose={() => handleRemoveCategory(cat)}
                  >
                    {cat}
                  </Tag>
                ))
              ) : (
                <Typography.Text type="secondary">None</Typography.Text>
              )}
            </div>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                placeholder="Add category (e.g. cafe)"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onPressEnter={handleAddCategory}
                autoFocus
              />
              <Button onClick={handleAddCategory} type="primary">
                Add
              </Button>
            </Space.Compact>
          </div>

          <Divider style={{ margin: "4px 0" }} />

          <div>
            <Typography.Text strong>Tags</Typography.Text>
            <Typography.Text type="secondary">
              {" "}
              ({current.tags.length})
            </Typography.Text>
            <div style={{ margin: "8px 0", maxHeight: 90, overflowY: "auto" }}>
              {current.tags.length ? (
                current.tags.map((tag) => (
                  <Tag key={tag} closable onClose={() => handleRemoveTag(tag)}>
                    {tag}
                  </Tag>
                ))
              ) : (
                <Typography.Text type="secondary">None</Typography.Text>
              )}
            </div>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                placeholder="Add tag (e.g. family-friendly)"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onPressEnter={handleAddTag}
              />
              <Button onClick={handleAddTag} type="primary">
                Add
              </Button>
            </Space.Compact>
          </div>

          <Divider style={{ margin: "4px 0" }} />

          <div>
            <Typography.Text strong>Emojis</Typography.Text>
            <Typography.Text type="secondary">
              {" "}
              ({current.emoji.length})
            </Typography.Text>
            <div style={{ margin: "8px 0", maxHeight: 90, overflowY: "auto" }}>
              {current.emoji.length ? (
                current.emoji.map((em, idx) => (
                  <Tag
                    key={`${em}-${idx}`}
                    closable
                    onClose={() => handleRemoveEmoji(em)}
                  >
                    {em}
                  </Tag>
                ))
              ) : (
                <Typography.Text type="secondary">None</Typography.Text>
              )}
            </div>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                placeholder="Add emoji (e.g. 🌴)"
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value)}
                onPressEnter={handleAddEmoji}
              />
              <Button onClick={handleAddEmoji} type="primary">
                Add
              </Button>
            </Space.Compact>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button onClick={handleReset} disabled={!hasChanges}>
              Reset
            </Button>
            <Button onClick={() => setModalOpen(false)}>Close</Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              type="primary"
              loading={saving}
              disabled={!hasChanges}
            >
              Review & Save
            </Button>
          </div>
        </Space>
      </Modal>

      <Modal
        title="Confirm Update"
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message="Please confirm"
            description="These changes will be saved to the database."
          />

          <div>
            <Typography.Text strong>Summary</Typography.Text>
            <div style={{ marginTop: 6 }}>
              <div>
                <Typography.Text>Categories:</Typography.Text>{" "}
                <Typography.Text type="secondary">
                  +{added.categories.length} / -{removed.categories.length}
                </Typography.Text>
              </div>
              <div>
                <Typography.Text>Tags:</Typography.Text>{" "}
                <Typography.Text type="secondary">
                  +{added.tags.length} / -{removed.tags.length}
                </Typography.Text>
              </div>
              <div>
                <Typography.Text>Emojis:</Typography.Text>{" "}
                <Typography.Text type="secondary">
                  +{added.emoji.length} / -{removed.emoji.length}
                </Typography.Text>
              </div>
            </div>
          </div>

          <Divider style={{ margin: "4px 0" }} />

          <div>
            <Typography.Text strong>Final Values</Typography.Text>
            <div style={{ marginTop: 6 }}>
              <div style={{ marginBottom: 8 }}>
                <Typography.Text>Categories:</Typography.Text>{" "}
                <Typography.Text type="secondary">
                  {current.categories.join(", ") || "None"}
                </Typography.Text>
              </div>
              <div style={{ marginBottom: 8 }}>
                <Typography.Text>Tags:</Typography.Text>{" "}
                <Typography.Text type="secondary">
                  {current.tags.join(", ") || "None"}
                </Typography.Text>
              </div>
              <div>
                <Typography.Text>Emojis:</Typography.Text>{" "}
                <Typography.Text type="secondary">
                  {current.emoji.join(" ") || "None"}
                </Typography.Text>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button onClick={() => setConfirmOpen(false)}>Back</Button>
            <Button onClick={handleSave} type="primary" loading={saving}>
              Confirm & Save
            </Button>
          </div>
        </Space>
      </Modal>
    </>
  );
}
