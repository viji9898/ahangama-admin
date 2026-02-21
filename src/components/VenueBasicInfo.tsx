import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";

const UPDATE_ENDPOINT = "/.netlify/functions/api-venues-update";

type Props = {
  venue: any;
  onVenueUpdated?: (venue: any) => void;
};

export function VenueBasicInfo({ venue, onVenueUpdated }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [savingLive, setSavingLive] = useState(false);
  const [live, setLive] = useState<boolean>(venue?.live ?? true);

  const [name, setName] = useState<string>(String(venue?.name || ""));
  const [status, setStatus] = useState<string>(String(venue?.status || ""));
  const [area, setArea] = useState<string>(String(venue?.area || ""));

  useEffect(() => {
    setLive(venue?.live ?? true);
    setName(String(venue?.name || ""));
    setStatus(String(venue?.status || ""));
    setArea(String(venue?.area || ""));
  }, [venue]);

  useEffect(() => {
    if (!modalOpen) return;
    setName(String(venue?.name || ""));
    setStatus(String(venue?.status || ""));
    setArea(String(venue?.area || ""));
  }, [modalOpen, venue]);

  const baseline = useMemo(() => {
    return {
      name: String(venue?.name || ""),
      status: String(venue?.status || ""),
      area: String(venue?.area || ""),
    };
  }, [venue]);

  const current = useMemo(() => {
    return {
      name: name.trim(),
      status: status.trim(),
      area: area.trim(),
    };
  }, [name, status, area]);

  const hasChanges =
    current.name !== baseline.name ||
    current.status !== baseline.status ||
    current.area !== baseline.area;

  const handleReset = () => {
    setName(baseline.name);
    setStatus(baseline.status);
    setArea(baseline.area);
  };

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

  const toggleLive = async (nextLive: boolean) => {
    const id = String(venue?.id || "")
      .trim()
      .toLowerCase();
    if (!id) {
      message.error("Missing venue id");
      return;
    }

    const prev = live;
    setLive(nextLive);
    setSavingLive(true);
    try {
      const updated = await patchVenue({ id, live: nextLive });
      if (updated) onVenueUpdated?.(updated);
      message.success(nextLive ? "Marked live" : "Marked not live");
    } catch (e) {
      setLive(prev);
      message.error(String((e as Error)?.message || e));
    } finally {
      setSavingLive(false);
    }
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
    if (current.name !== baseline.name) payload.name = current.name;
    if (current.status !== baseline.status) payload.status = current.status;
    if (current.area !== baseline.area) payload.area = current.area;

    setSaving(true);
    try {
      const updated = await patchVenue(payload);
      if (updated) {
        onVenueUpdated?.(updated);
        setLive(updated?.live ?? live);
      }
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
        title="Basic Info"
        extra={
          <Space size="middle">
            <Space size={8}>
              <Typography.Text strong>Live</Typography.Text>
              <Switch
                checked={live}
                disabled={savingLive || !venue?.id}
                onChange={(checked) => void toggleLive(checked)}
              />
            </Space>
            <Button
              type="primary"
              size="small"
              onClick={() => setModalOpen(true)}
              disabled={!venue?.id}
            >
              Edit
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={32}>
          <Col span={12}>
            <div>
              <b>ID:</b> {venue?.id}
            </div>
            <div>
              <b>Destination Slug:</b> {venue?.destinationSlug}
            </div>
            <div>
              <b>Name:</b> {venue?.name}
            </div>
            <div>
              <b>Slug:</b> {venue?.slug}
            </div>
          </Col>
          <Col span={12}>
            <div>
              <b>Status:</b> {venue?.status}
            </div>
            <div>
              <b>Live:</b> {live ? "Yes" : "No"}
            </div>
            <div>
              <b>Area:</b> {venue?.area}
            </div>
            <div>
              <b>Updated At:</b> {venue?.updatedAt || venue?.updated_at}
            </div>
            <div>
              <b>Created At:</b> {venue?.createdAt || venue?.created_at}
            </div>
          </Col>
        </Row>
      </Card>

      <Modal
        title="Edit Basic Info"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          message="Restricted fields"
          description="ID, destination slug, slug, created/updated timestamps are read-only and won’t be changed."
          style={{ marginBottom: 12 }}
        />

        <div style={{ marginBottom: 12 }}>
          <Typography.Text strong>Name</Typography.Text>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Venue name"
          />
        </div>

        <Row gutter={12}>
          <Col span={12}>
            <Typography.Text strong>Status</Typography.Text>
            <Select
              value={status}
              onChange={(v) => setStatus(v)}
              style={{ width: "100%" }}
              options={[
                { value: "active", label: "active" },
                { value: "inactive", label: "inactive" },
              ]}
              placeholder="Status"
              allowClear
            />
          </Col>
          <Col span={12}>
            <Typography.Text strong>Area</Typography.Text>
            <Input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Area"
            />
          </Col>
        </Row>

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
        title="Confirm Basic Info changes"
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        okText="Save"
        okButtonProps={{ disabled: !hasChanges, loading: saving }}
        onOk={() => void handleSave()}
      >
        <div style={{ marginBottom: 8 }}>
          <Typography.Text type="secondary">
            Only editable fields will be updated.
          </Typography.Text>
        </div>

        {(current.name !== baseline.name ||
          current.status !== baseline.status ||
          current.area !== baseline.area) && (
          <div>
            {current.name !== baseline.name && (
              <div>
                <Typography.Text strong>Name:</Typography.Text> {baseline.name}{" "}
                → {current.name}
              </div>
            )}
            {current.status !== baseline.status && (
              <div>
                <Typography.Text strong>Status:</Typography.Text>{" "}
                {baseline.status} → {current.status}
              </div>
            )}
            {current.area !== baseline.area && (
              <div>
                <Typography.Text strong>Area:</Typography.Text> {baseline.area}{" "}
                → {current.area}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
