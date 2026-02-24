import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";

import type { Venue } from "../types/venue";

const UPDATE_ENDPOINT = "/.netlify/functions/api-venues-update";

const toFiniteNumberOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

type Props = {
  venue: Venue;
  onVenueUpdated?: (venue: Partial<Venue>) => void;
};

export function VenueLocationSocial({ venue, onVenueUpdated }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [latInput, setLatInput] = useState<number | null>(
    toFiniteNumberOrNull(venue?.lat),
  );
  const [lngInput, setLngInput] = useState<number | null>(
    toFiniteNumberOrNull(venue?.lng),
  );
  const [mapUrl, setMapUrl] = useState<string>(String(venue?.mapUrl || ""));
  const [instagramUrl, setInstagramUrl] = useState<string>(
    String(venue?.instagramUrl || ""),
  );
  const [whatsapp, setWhatsapp] = useState<string>(
    String(venue?.whatsapp || ""),
  );

  useEffect(() => {
    setLatInput(toFiniteNumberOrNull(venue?.lat));
    setLngInput(toFiniteNumberOrNull(venue?.lng));
    setMapUrl(String(venue?.mapUrl || ""));
    setInstagramUrl(String(venue?.instagramUrl || ""));
    setWhatsapp(String(venue?.whatsapp || ""));
  }, [venue]);

  useEffect(() => {
    if (!modalOpen) return;
    setLatInput(toFiniteNumberOrNull(venue?.lat));
    setLngInput(toFiniteNumberOrNull(venue?.lng));
    setMapUrl(String(venue?.mapUrl || ""));
    setInstagramUrl(String(venue?.instagramUrl || ""));
    setWhatsapp(String(venue?.whatsapp || ""));
  }, [modalOpen, venue]);

  const baseline = useMemo(() => {
    return {
      lat: toFiniteNumberOrNull(venue?.lat),
      lng: toFiniteNumberOrNull(venue?.lng),
      mapUrl: String(venue?.mapUrl || "").trim(),
      instagramUrl: String(venue?.instagramUrl || "").trim(),
      whatsapp: String(venue?.whatsapp || "").trim(),
    };
  }, [venue]);

  const current = useMemo(() => {
    return {
      lat: latInput,
      lng: lngInput,
      mapUrl: mapUrl.trim(),
      instagramUrl: instagramUrl.trim(),
      whatsapp: whatsapp.trim(),
    };
  }, [latInput, lngInput, mapUrl, instagramUrl, whatsapp]);

  const hasChanges =
    (baseline.lat ?? null) !== (current.lat ?? null) ||
    (baseline.lng ?? null) !== (current.lng ?? null) ||
    baseline.mapUrl !== current.mapUrl ||
    baseline.instagramUrl !== current.instagramUrl ||
    baseline.whatsapp !== current.whatsapp;

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
    setLatInput(baseline.lat);
    setLngInput(baseline.lng);
    setMapUrl(baseline.mapUrl);
    setInstagramUrl(baseline.instagramUrl);
    setWhatsapp(baseline.whatsapp);
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

    if (current.lat !== null && (current.lat < -90 || current.lat > 90)) {
      message.error("Latitude must be between -90 and 90.");
      return;
    }
    if (current.lng !== null && (current.lng < -180 || current.lng > 180)) {
      message.error("Longitude must be between -180 and 180.");
      return;
    }

    const payload: Record<string, unknown> = { id };
    if ((baseline.lat ?? null) !== (current.lat ?? null))
      payload.lat = current.lat;
    if ((baseline.lng ?? null) !== (current.lng ?? null))
      payload.lng = current.lng;
    if (baseline.mapUrl !== current.mapUrl)
      payload.mapUrl = current.mapUrl || null;
    if (baseline.instagramUrl !== current.instagramUrl)
      payload.instagramUrl = current.instagramUrl || null;
    if (baseline.whatsapp !== current.whatsapp)
      payload.whatsapp = current.whatsapp || null;

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

  const toNumber = (v: unknown) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  };

  const lat = toNumber(venue?.lat);
  const lng = toNumber(venue?.lng);
  const hasCoords =
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  const mapEmbedUrl = (() => {
    if (!hasCoords) return "";
    return `https://www.google.com/maps?q=${encodeURIComponent(
      `${lat},${lng}`,
    )}&z=16&output=embed`;
  })();

  return (
    <>
      <Card
        title="Location & Social"
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
              <b>Lat:</b> {venue?.lat}
            </div>
            <div>
              <b>Lng:</b> {venue?.lng}
            </div>
            <div>
              <b>Map URL:</b>{" "}
              {venue?.mapUrl ? (
                <Button
                  size="small"
                  type="link"
                  href={venue.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </Button>
              ) : (
                "—"
              )}
            </div>
          </Col>
          <Col span={12}>
            <div>
              <b>Instagram URL:</b>{" "}
              {venue?.instagramUrl ? (
                <Button
                  size="small"
                  type="link"
                  href={venue.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </Button>
              ) : (
                "—"
              )}
            </div>
            <div>
              <b>WhatsApp:</b> {venue?.whatsapp || "—"}
            </div>
          </Col>

          <Col span={24} style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Map</div>
            {hasCoords ? (
              <iframe
                title="Venue map"
                src={mapEmbedUrl}
                style={{
                  width: "100%",
                  height: 320,
                  border: 0,
                  borderRadius: 8,
                }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div style={{ color: "#888" }}>No coordinates available.</div>
            )}
          </Col>
        </Row>
      </Card>

      <Modal
        title="Edit Location & Social"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          message="Editable fields"
          description="Latitude, longitude, map URL, Instagram URL, WhatsApp."
          style={{ marginBottom: 12 }}
        />

        <Row gutter={12}>
          <Col span={12}>
            <Typography.Text strong>Latitude</Typography.Text>
            <InputNumber
              value={latInput}
              onChange={(v) => setLatInput(v === null ? null : Number(v))}
              min={-90}
              max={90}
              step={0.000001}
              style={{ width: "100%" }}
              placeholder="e.g. 6.1351"
            />
          </Col>
          <Col span={12}>
            <Typography.Text strong>Longitude</Typography.Text>
            <InputNumber
              value={lngInput}
              onChange={(v) => setLngInput(v === null ? null : Number(v))}
              min={-180}
              max={180}
              step={0.000001}
              style={{ width: "100%" }}
              placeholder="e.g. 80.1023"
            />
          </Col>
        </Row>

        <div style={{ marginTop: 12 }}>
          <Typography.Text strong>Map URL</Typography.Text>
          <Input
            value={mapUrl}
            onChange={(e) => setMapUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <Typography.Text strong>Instagram URL</Typography.Text>
          <Input
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            placeholder="https://instagram.com/..."
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <Typography.Text strong>WhatsApp</Typography.Text>
          <Input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+94..."
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
        title="Confirm Location & Social changes"
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

        {(baseline.lat ?? null) !== (current.lat ?? null) && (
          <div>
            <Typography.Text strong>Lat:</Typography.Text>{" "}
            {String(baseline.lat ?? "—")} → {String(current.lat ?? "—")}
          </div>
        )}
        {(baseline.lng ?? null) !== (current.lng ?? null) && (
          <div>
            <Typography.Text strong>Lng:</Typography.Text>{" "}
            {String(baseline.lng ?? "—")} → {String(current.lng ?? "—")}
          </div>
        )}
        {baseline.mapUrl !== current.mapUrl && (
          <div>
            <Typography.Text strong>Map URL:</Typography.Text>{" "}
            {baseline.mapUrl || "—"} → {current.mapUrl || "—"}
          </div>
        )}
        {baseline.instagramUrl !== current.instagramUrl && (
          <div>
            <Typography.Text strong>Instagram URL:</Typography.Text>{" "}
            {baseline.instagramUrl || "—"} → {current.instagramUrl || "—"}
          </div>
        )}
        {baseline.whatsapp !== current.whatsapp && (
          <div>
            <Typography.Text strong>WhatsApp:</Typography.Text>{" "}
            {baseline.whatsapp || "—"} → {current.whatsapp || "—"}
          </div>
        )}
      </Modal>
    </>
  );
}
