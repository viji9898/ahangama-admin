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
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";

import type { Venue } from "../types/venue";

const UPDATE_ENDPOINT = "/.netlify/functions/api-venues-update";

const normalizeList = (items: unknown): string[] => {
  if (!Array.isArray(items)) return [];
  const out = items.map((s) => String(s).trim()).filter(Boolean);
  return Array.from(new Set(out));
};

const toListText = (items: unknown) => normalizeList(items).join("\n");
const toListArray = (text: string) =>
  Array.from(
    new Set(
      text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );

type Props = {
  venue: Venue;
  onVenueUpdated?: (venue: Partial<Venue>) => void;
};

export function VenueDescription({ venue, onVenueUpdated }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [excerpt, setExcerpt] = useState<string>(String(venue?.excerpt || ""));
  const [description, setDescription] = useState<string>(
    String(venue?.description || ""),
  );
  const [bestForText, setBestForText] = useState<string>(
    toListText(venue?.bestFor),
  );
  const [howToClaim, setHowToClaim] = useState<string>(
    String(venue?.howToClaim || ""),
  );
  const [restrictions, setRestrictions] = useState<string>(
    String(venue?.restrictions || ""),
  );

  useEffect(() => {
    setExcerpt(String(venue?.excerpt || ""));
    setDescription(String(venue?.description || ""));
    setBestForText(toListText(venue?.bestFor));
    setHowToClaim(String(venue?.howToClaim || ""));
    setRestrictions(String(venue?.restrictions || ""));
  }, [venue]);

  useEffect(() => {
    if (!modalOpen) return;
    setExcerpt(String(venue?.excerpt || ""));
    setDescription(String(venue?.description || ""));
    setBestForText(toListText(venue?.bestFor));
    setHowToClaim(String(venue?.howToClaim || ""));
    setRestrictions(String(venue?.restrictions || ""));
  }, [modalOpen, venue]);

  const baseline = useMemo(() => {
    return {
      excerpt: String(venue?.excerpt || "").trim(),
      description: String(venue?.description || "").trim(),
      bestFor: normalizeList(venue?.bestFor),
      howToClaim: String(venue?.howToClaim || "").trim(),
      restrictions: String(venue?.restrictions || "").trim(),
    };
  }, [venue]);

  const current = useMemo(() => {
    return {
      excerpt: excerpt.trim(),
      description: description.trim(),
      bestFor: toListArray(bestForText),
      howToClaim: howToClaim.trim(),
      restrictions: restrictions.trim(),
    };
  }, [excerpt, description, bestForText, howToClaim, restrictions]);

  const hasChanges = useMemo(() => {
    const sameArray = (a: string[], b: string[]) =>
      a.length === b.length && a.every((x, i) => x === b[i]);
    return !(
      baseline.excerpt === current.excerpt &&
      baseline.description === current.description &&
      sameArray(baseline.bestFor, current.bestFor) &&
      baseline.howToClaim === current.howToClaim &&
      baseline.restrictions === current.restrictions
    );
  }, [baseline, current]);

  const patchVenue = async (payload: Record<string, unknown>) => {
    const r = await fetch(UPDATE_ENDPOINT, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data?.ok !== true) {
      throw new Error(data?.error || `Failed (${r.status})`);
    }
    return data?.venue;
  };

  const handleReset = () => {
    setExcerpt(baseline.excerpt);
    setDescription(baseline.description);
    setBestForText(baseline.bestFor.join("\n"));
    setHowToClaim(baseline.howToClaim);
    setRestrictions(baseline.restrictions);
  };

  const handleSave = async () => {
    const id = String(venue?.id || "")
      .trim()
      .toLowerCase();
    if (!id) {
      message.error("Missing venue id");
      return;
    }
    if (!hasChanges) {
      message.info("No changes to save.");
      return;
    }

    const payload: Record<string, unknown> = { id };
    if (baseline.excerpt !== current.excerpt) payload.excerpt = current.excerpt;
    if (baseline.description !== current.description)
      payload.description = current.description;
    if (JSON.stringify(baseline.bestFor) !== JSON.stringify(current.bestFor))
      payload.bestFor = current.bestFor;
    if (baseline.howToClaim !== current.howToClaim)
      payload.howToClaim = current.howToClaim;
    if (baseline.restrictions !== current.restrictions)
      payload.restrictions = current.restrictions;

    setSaving(true);
    try {
      const updated = await patchVenue(payload);
      if (updated) onVenueUpdated?.(updated);
      message.success("Venue updated successfully.");
      setConfirmOpen(false);
      setModalOpen(false);
    } catch (e) {
      message.error(String((e as Error)?.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card
        title="Description"
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
            <div>
              <b>Excerpt:</b> {venue?.excerpt || "—"}
            </div>
            <div>
              <b>Description:</b> {venue?.description || "—"}
            </div>
            <div>
              <b>Best For:</b>{" "}
              {normalizeList(venue?.bestFor).length
                ? normalizeList(venue?.bestFor).join(", ")
                : "—"}
            </div>
          </Col>
          <Col span={12}>
            <div>
              <b>How To Claim:</b> {venue?.howToClaim || "—"}
            </div>
            <div>
              <b>Restrictions:</b> {venue?.restrictions || "—"}
            </div>
          </Col>
        </Row>
      </Card>

      <Modal
        title="Edit Description"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          message="Editable fields"
          description="Excerpt, description, best for, how to claim, restrictions."
          style={{ marginBottom: 12 }}
        />

        <div style={{ marginBottom: 12 }}>
          <Typography.Text strong>Excerpt</Typography.Text>
          <Input.TextArea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            placeholder="Short excerpt"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <Typography.Text strong>Description</Typography.Text>
          <Input.TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="Full description"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <Typography.Text strong>Best For (one per line)</Typography.Text>
          <Input.TextArea
            value={bestForText}
            onChange={(e) => setBestForText(e.target.value)}
            rows={3}
            placeholder="Couples\nFamilies"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <Typography.Text strong>How to claim</Typography.Text>
          <Input.TextArea
            value={howToClaim}
            onChange={(e) => setHowToClaim(e.target.value)}
            rows={3}
            placeholder="How to claim"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <Typography.Text strong>Restrictions</Typography.Text>
          <Input.TextArea
            value={restrictions}
            onChange={(e) => setRestrictions(e.target.value)}
            rows={3}
            placeholder="Restrictions"
          />
        </div>

        <Divider style={{ margin: "12px 0" }} />

        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Button onClick={handleReset} disabled={saving || !hasChanges}>
            Reset
          </Button>
          <Space>
            <Button onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="primary"
              onClick={() => setConfirmOpen(true)}
              disabled={!hasChanges || saving}
              loading={saving}
            >
              Review & Save
            </Button>
          </Space>
        </Space>
      </Modal>

      <Modal
        title="Confirm Description changes"
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        okText="Save"
        okButtonProps={{ disabled: !hasChanges, loading: saving }}
        onOk={() => void handleSave()}
      >
        <div style={{ marginBottom: 8 }}>
          <Typography.Text type="secondary">
            Only changed fields will be updated.
          </Typography.Text>
        </div>

        {baseline.excerpt !== current.excerpt && (
          <div>
            <Typography.Text strong>Excerpt:</Typography.Text>{" "}
            {baseline.excerpt || "—"} → {current.excerpt || "—"}
          </div>
        )}
        {baseline.description !== current.description && (
          <div>
            <Typography.Text strong>Description:</Typography.Text>{" "}
            {baseline.description ? "(updated)" : "(empty)"} →{" "}
            {current.description ? "(updated)" : "(empty)"}
          </div>
        )}
        {JSON.stringify(baseline.bestFor) !==
          JSON.stringify(current.bestFor) && (
          <div>
            <Typography.Text strong>Best For:</Typography.Text>{" "}
            {baseline.bestFor.length ? baseline.bestFor.join(", ") : "—"} →{" "}
            {current.bestFor.length ? current.bestFor.join(", ") : "—"}
          </div>
        )}
        {baseline.howToClaim !== current.howToClaim && (
          <div>
            <Typography.Text strong>How to claim:</Typography.Text>{" "}
            {baseline.howToClaim || "—"} → {current.howToClaim || "—"}
          </div>
        )}
        {baseline.restrictions !== current.restrictions && (
          <div>
            <Typography.Text strong>Restrictions:</Typography.Text>{" "}
            {baseline.restrictions ? "(updated)" : "(empty)"} →{" "}
            {current.restrictions ? "(updated)" : "(empty)"}
          </div>
        )}
      </Modal>
    </>
  );
}
