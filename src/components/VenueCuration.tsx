import {
  Alert,
  Button,
  Card,
  Col,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";

import { EDITORIAL_TAGS } from "../constants/editorialTags";
import type { PowerBackup as VenuePowerBackup, Venue } from "../types/venue";

const UPDATE_ENDPOINT = "/.netlify/functions/api-venues-update";

const allowedPowerBackup = [
  "generator",
  "inverter",
  "none",
  "unknown",
] as const;

type PowerBackup = (typeof allowedPowerBackup)[number];

const toPowerBackup = (value: unknown): PowerBackup => {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  return (allowedPowerBackup as readonly string[]).includes(v)
    ? (v as PowerBackup)
    : "unknown";
};

const normalizeList = (items: unknown): string[] => {
  if (!Array.isArray(items)) return [];
  const out = items.map((s) => String(s).trim()).filter(Boolean);
  return Array.from(new Set(out));
};

type Props = {
  venue: Venue;
  onVenueUpdated?: (venue: Partial<Venue>) => void;
};

export function VenueCuration({ venue, onVenueUpdated }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const vocab = useMemo(() => normalizeList(Array.from(EDITORIAL_TAGS)), []);

  const [editorialTags, setEditorialTags] = useState<string[]>(
    normalizeList(venue?.editorialTags),
  );
  const [isPassVenue, setIsPassVenue] = useState<boolean>(
    Boolean(venue?.isPassVenue ?? false),
  );
  const [staffPick, setStaffPick] = useState<boolean>(
    Boolean(venue?.staffPick ?? false),
  );
  const [priorityScore, setPriorityScore] = useState<number>(
    Number(venue?.priorityScore ?? 0) || 0,
  );
  const [laptopFriendly, setLaptopFriendly] = useState<boolean>(
    Boolean(venue?.laptopFriendly ?? false),
  );
  const [powerBackup, setPowerBackup] = useState<PowerBackup>(
    toPowerBackup(venue?.powerBackup as VenuePowerBackup),
  );

  useEffect(() => {
    setEditorialTags(normalizeList(venue?.editorialTags));
    setIsPassVenue(Boolean(venue?.isPassVenue ?? false));
    setStaffPick(Boolean(venue?.staffPick ?? false));
    setPriorityScore(Number(venue?.priorityScore ?? 0) || 0);
    setLaptopFriendly(Boolean(venue?.laptopFriendly ?? false));
    setPowerBackup(toPowerBackup(venue?.powerBackup as VenuePowerBackup));
  }, [venue]);

  useEffect(() => {
    if (!modalOpen) return;
    setEditorialTags(normalizeList(venue?.editorialTags));
    setIsPassVenue(Boolean(venue?.isPassVenue ?? false));
    setStaffPick(Boolean(venue?.staffPick ?? false));
    setPriorityScore(Number(venue?.priorityScore ?? 0) || 0);
    setLaptopFriendly(Boolean(venue?.laptopFriendly ?? false));
    setPowerBackup(toPowerBackup(venue?.powerBackup as VenuePowerBackup));
  }, [modalOpen, venue]);

  const baseline = useMemo(() => {
    return {
      editorialTags: normalizeList(venue?.editorialTags),
      isPassVenue: Boolean(venue?.isPassVenue ?? false),
      staffPick: Boolean(venue?.staffPick ?? false),
      priorityScore: Number(venue?.priorityScore ?? 0) || 0,
      laptopFriendly: Boolean(venue?.laptopFriendly ?? false),
      powerBackup: toPowerBackup(venue?.powerBackup as VenuePowerBackup),
    };
  }, [venue]);

  const current = useMemo(() => {
    return {
      editorialTags: normalizeList(editorialTags),
      isPassVenue: Boolean(isPassVenue),
      staffPick: Boolean(staffPick),
      priorityScore: Number(priorityScore) || 0,
      laptopFriendly: Boolean(laptopFriendly),
      powerBackup,
    };
  }, [
    editorialTags,
    isPassVenue,
    staffPick,
    priorityScore,
    laptopFriendly,
    powerBackup,
  ]);

  const hasChanges = useMemo(() => {
    return !(
      JSON.stringify(baseline.editorialTags) ===
        JSON.stringify(current.editorialTags) &&
      baseline.isPassVenue === current.isPassVenue &&
      baseline.staffPick === current.staffPick &&
      baseline.priorityScore === current.priorityScore &&
      baseline.laptopFriendly === current.laptopFriendly &&
      baseline.powerBackup === current.powerBackup
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
    setEditorialTags(baseline.editorialTags);
    setIsPassVenue(baseline.isPassVenue);
    setStaffPick(baseline.staffPick);
    setPriorityScore(baseline.priorityScore);
    setLaptopFriendly(baseline.laptopFriendly);
    setPowerBackup(baseline.powerBackup);
  };

  const handleSave = async () => {
    const id = String(venue?.id || "")
      .trim()
      .toLowerCase();
    if (!id) {
      message.error("Missing venue id");
      return;
    }

    if (current.priorityScore < 0) {
      message.error("Priority score must be >= 0");
      return;
    }

    if (!hasChanges) {
      message.info("No changes to save.");
      return;
    }

    const payload: Record<string, unknown> = { id };

    if (
      JSON.stringify(baseline.editorialTags) !==
      JSON.stringify(current.editorialTags)
    )
      payload.editorialTags = current.editorialTags;
    if (baseline.isPassVenue !== current.isPassVenue)
      payload.isPassVenue = current.isPassVenue;
    if (baseline.staffPick !== current.staffPick)
      payload.staffPick = current.staffPick;
    if (baseline.priorityScore !== current.priorityScore)
      payload.priorityScore = current.priorityScore;
    if (baseline.laptopFriendly !== current.laptopFriendly)
      payload.laptopFriendly = current.laptopFriendly;
    if (baseline.powerBackup !== current.powerBackup)
      payload.powerBackup = current.powerBackup;

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
        title="Curation"
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
              <b>Staff Pick:</b> {baseline.staffPick ? "Yes" : "No"}
            </div>
            <div>
              <b>Priority Score:</b> {baseline.priorityScore}
            </div>
            <div>
              <b>Pass Venue:</b> {baseline.isPassVenue ? "Yes" : "No"}
            </div>
          </Col>
          <Col span={12}>
            <div>
              <b>Laptop Friendly:</b> {baseline.laptopFriendly ? "Yes" : "No"}
            </div>
            <div>
              <b>Power Backup:</b> {baseline.powerBackup}
            </div>
            <div>
              <b>Editorial Tags:</b>{" "}
              {baseline.editorialTags.length
                ? baseline.editorialTags.join(", ")
                : "—"}
            </div>
          </Col>
        </Row>
      </Card>

      <Modal
        title="Edit Curation"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          message="Editable fields"
          description="Editorial tags, staff pick, priority score, pass venue, laptop-friendly, and power backup."
          style={{ marginBottom: 12 }}
        />

        <div style={{ marginBottom: 12 }}>
          <Typography.Text strong>Editorial Tags</Typography.Text>
          <Select
            mode="multiple"
            value={editorialTags}
            onChange={(v) => setEditorialTags(normalizeList(v))}
            options={vocab.map((t) => ({ label: t, value: t }))}
            style={{ width: "100%" }}
            placeholder="Select tags"
          />
        </div>

        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col span={12}>
            <Space>
              <Typography.Text strong>Staff Pick</Typography.Text>
              <Switch checked={staffPick} onChange={(v) => setStaffPick(v)} />
            </Space>
          </Col>
          <Col span={12}>
            <Space>
              <Typography.Text strong>Pass Venue</Typography.Text>
              <Switch
                checked={isPassVenue}
                onChange={(v) => setIsPassVenue(v)}
              />
            </Space>
          </Col>
        </Row>

        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col span={12}>
            <Typography.Text strong>Priority Score</Typography.Text>
            <InputNumber
              value={priorityScore}
              onChange={(v) => setPriorityScore(v === null ? 0 : Number(v))}
              min={0}
              step={1}
              style={{ width: "100%" }}
              placeholder="0"
            />
          </Col>
          <Col span={12}>
            <Typography.Text strong>Power Backup</Typography.Text>
            <Select
              value={powerBackup}
              onChange={(v) => setPowerBackup(v as PowerBackup)}
              options={allowedPowerBackup.map((v) => ({ label: v, value: v }))}
              style={{ width: "100%" }}
            />
          </Col>
        </Row>

        <div style={{ marginBottom: 12 }}>
          <Space>
            <Typography.Text strong>Laptop Friendly</Typography.Text>
            <Switch
              checked={laptopFriendly}
              onChange={(v) => setLaptopFriendly(v)}
            />
          </Space>
        </div>

        <Space style={{ justifyContent: "space-between", width: "100%" }}>
          <Button onClick={handleReset} disabled={saving}>
            Reset
          </Button>
          <Space>
            <Button onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="primary"
              onClick={() => setConfirmOpen(true)}
              disabled={saving || !hasChanges}
            >
              Save
            </Button>
          </Space>
        </Space>

        <Modal
          title="Confirm changes"
          open={confirmOpen}
          onCancel={() => setConfirmOpen(false)}
          onOk={() => void handleSave()}
          confirmLoading={saving}
          okText="Save"
        >
          Save these curation changes?
        </Modal>
      </Modal>
    </>
  );
}
