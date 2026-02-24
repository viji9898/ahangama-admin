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

// DB stores discount as fraction (0.1) but UI uses percent (10)
const discountDbToPercent = (v: unknown): number | null => {
  const n = toFiniteNumberOrNull(v);
  if (n === null) return null;
  // Back-compat: if values were previously stored as percent (e.g. 10), keep displaying as 10.
  return n <= 1 ? n * 100 : n;
};

const discountPercentToDb = (percent: number | null): number | null => {
  const n = toFiniteNumberOrNull(percent);
  if (n === null) return null;
  return n / 100;
};

const normalizeOffersText = (offers: unknown) => {
  if (Array.isArray(offers)) return offers.map(String).join("\n");
  if (typeof offers === "string") return offers;
  return "";
};

const normalizeOffersArray = (offersText: string) => {
  const lines = offersText
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(lines));
};

type Props = {
  venue: Venue;
  onVenueUpdated?: (venue: Partial<Venue>) => void;
};

export function VenueRatingsOffers({ venue, onVenueUpdated }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [stars, setStars] = useState<number | null>(
    typeof venue?.stars === "number" ? venue.stars : (venue?.stars ?? null),
  );
  const [reviews, setReviews] = useState<number | null>(
    typeof venue?.reviews === "number"
      ? venue.reviews
      : (venue?.reviews ?? null),
  );
  const [discountPercent, setDiscountPercent] = useState<number | null>(
    discountDbToPercent(venue?.discount),
  );
  const [cardPerk, setCardPerk] = useState<string>(
    String(venue?.cardPerk || ""),
  );
  const [offersText, setOffersText] = useState<string>(
    normalizeOffersText(venue?.offers),
  );
  const [howToClaim, setHowToClaim] = useState<string>(
    String(venue?.howToClaim || ""),
  );
  const [restrictions, setRestrictions] = useState<string>(
    String(venue?.restrictions || ""),
  );

  useEffect(() => {
    setStars(
      typeof venue?.stars === "number" ? venue.stars : (venue?.stars ?? null),
    );
    setReviews(
      typeof venue?.reviews === "number"
        ? venue.reviews
        : (venue?.reviews ?? null),
    );
    setDiscountPercent(discountDbToPercent(venue?.discount));
    setCardPerk(String(venue?.cardPerk || ""));
    setOffersText(normalizeOffersText(venue?.offers));
    setHowToClaim(String(venue?.howToClaim || ""));
    setRestrictions(String(venue?.restrictions || ""));
  }, [venue]);

  useEffect(() => {
    if (!modalOpen) return;
    setStars(
      typeof venue?.stars === "number" ? venue.stars : (venue?.stars ?? null),
    );
    setReviews(
      typeof venue?.reviews === "number"
        ? venue.reviews
        : (venue?.reviews ?? null),
    );
    setDiscountPercent(discountDbToPercent(venue?.discount));
    setCardPerk(String(venue?.cardPerk || ""));
    setOffersText(normalizeOffersText(venue?.offers));
    setHowToClaim(String(venue?.howToClaim || ""));
    setRestrictions(String(venue?.restrictions || ""));
  }, [modalOpen, venue]);

  const baseline = useMemo(() => {
    return {
      stars: venue?.stars ?? null,
      reviews: venue?.reviews ?? null,
      discountPercent: discountDbToPercent(venue?.discount),
      cardPerk: String(venue?.cardPerk || ""),
      offers: normalizeOffersArray(normalizeOffersText(venue?.offers)),
      howToClaim: String(venue?.howToClaim || ""),
      restrictions: String(venue?.restrictions || ""),
    };
  }, [venue]);

  const current = useMemo(() => {
    return {
      stars,
      reviews,
      discountPercent,
      cardPerk: cardPerk.trim(),
      offers: normalizeOffersArray(offersText),
      howToClaim: howToClaim.trim(),
      restrictions: restrictions.trim(),
    };
  }, [
    stars,
    reviews,
    discountPercent,
    cardPerk,
    offersText,
    howToClaim,
    restrictions,
  ]);

  const hasChanges = useMemo(() => {
    const sameArray = (a: string[], b: string[]) =>
      a.length === b.length && a.every((x, i) => x === b[i]);
    return !(
      (baseline.stars ?? null) === (current.stars ?? null) &&
      (baseline.reviews ?? null) === (current.reviews ?? null) &&
      (baseline.discountPercent ?? null) ===
        (current.discountPercent ?? null) &&
      baseline.cardPerk === current.cardPerk &&
      sameArray(baseline.offers, current.offers) &&
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
    setStars(baseline.stars ?? null);
    setReviews(baseline.reviews ?? null);
    setDiscountPercent(baseline.discountPercent ?? null);
    setCardPerk(baseline.cardPerk);
    setOffersText(baseline.offers.join("\n"));
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
    if ((baseline.stars ?? null) !== (current.stars ?? null))
      payload.stars = current.stars;
    if ((baseline.reviews ?? null) !== (current.reviews ?? null))
      payload.reviews = current.reviews;
    if (
      (baseline.discountPercent ?? null) !== (current.discountPercent ?? null)
    )
      payload.discount = discountPercentToDb(current.discountPercent);
    if (baseline.cardPerk !== current.cardPerk)
      payload.cardPerk = current.cardPerk;
    if (JSON.stringify(baseline.offers) !== JSON.stringify(current.offers))
      payload.offers = current.offers;
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

  const formatPercent = (v: unknown) => {
    const n = toFiniteNumberOrNull(v);
    if (n === null) return "—";
    const rounded = Math.round(n * 100) / 100;
    return `${rounded}%`;
  };

  const formatDiscountFromDb = (v: unknown) =>
    formatPercent(discountDbToPercent(v));

  return (
    <>
      <Card
        title="Ratings & Offers"
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
              <b>Stars:</b> {venue?.stars ?? "—"}
            </div>
            <div>
              <b>Reviews:</b> {venue?.reviews ?? "—"}
            </div>
            <div>
              <b>Discount:</b> {formatDiscountFromDb(venue?.discount)}
            </div>
            <div>
              <b>Card Perk:</b> {venue?.cardPerk || "—"}
            </div>
          </Col>

          <Col span={12}>
            <div style={{ marginBottom: 8 }}>
              <b>Offers:</b>{" "}
              {Array.isArray(venue?.offers)
                ? (venue?.offers as unknown[]).map(String).join(", ")
                : venue?.offers
                  ? String(venue.offers)
                  : "—"}
            </div>
            <div style={{ marginBottom: 8 }}>
              <b>How to claim:</b> {venue?.howToClaim || "—"}
            </div>
            <div>
              <b>Restrictions:</b> {venue?.restrictions || "—"}
            </div>
          </Col>
        </Row>
      </Card>

      <Modal
        title="Edit Ratings & Offers"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          message="Editable fields"
          description="Stars, reviews, discount, card perk, offers, how-to-claim, and restrictions."
          style={{ marginBottom: 12 }}
        />

        <Row gutter={12}>
          <Col span={8}>
            <Typography.Text strong>Stars</Typography.Text>
            <InputNumber
              value={stars}
              onChange={(v) => setStars(v === null ? null : Number(v))}
              min={0}
              max={5}
              step={0.1}
              style={{ width: "100%" }}
              placeholder="e.g. 4.5"
            />
          </Col>
          <Col span={8}>
            <Typography.Text strong>Reviews</Typography.Text>
            <InputNumber
              value={reviews}
              onChange={(v) => setReviews(v === null ? null : Number(v))}
              min={0}
              step={1}
              style={{ width: "100%" }}
              placeholder="e.g. 120"
            />
          </Col>
          <Col span={8}>
            <Typography.Text strong>Discount</Typography.Text>
            <InputNumber
              value={discountPercent}
              onChange={(v) =>
                setDiscountPercent(v === null ? null : Number(v))
              }
              min={0}
              step={0.5}
              style={{ width: "100%" }}
              placeholder="e.g. 10"
              addonAfter="%"
            />
          </Col>
        </Row>

        <div style={{ marginTop: 12 }}>
          <Typography.Text strong>Card Perk</Typography.Text>
          <Input
            value={cardPerk}
            onChange={(e) => setCardPerk(e.target.value)}
            placeholder="Card perk"
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <Typography.Text strong>Offers (one per line)</Typography.Text>
          <Input.TextArea
            value={offersText}
            onChange={(e) => setOffersText(e.target.value)}
            rows={4}
            placeholder="Offer 1\nOffer 2"
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <Typography.Text strong>How to claim</Typography.Text>
          <Input.TextArea
            value={howToClaim}
            onChange={(e) => setHowToClaim(e.target.value)}
            rows={3}
            placeholder="How to claim"
          />
        </div>

        <div style={{ marginTop: 12 }}>
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
        title="Confirm Ratings & Offers changes"
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

        {(baseline.stars ?? null) !== (current.stars ?? null) && (
          <div>
            <Typography.Text strong>Stars:</Typography.Text>{" "}
            {String(baseline.stars ?? "—")} → {String(current.stars ?? "—")}
          </div>
        )}
        {(baseline.reviews ?? null) !== (current.reviews ?? null) && (
          <div>
            <Typography.Text strong>Reviews:</Typography.Text>{" "}
            {String(baseline.reviews ?? "—")} → {String(current.reviews ?? "—")}
          </div>
        )}
        {(baseline.discountPercent ?? null) !==
          (current.discountPercent ?? null) && (
          <div>
            <Typography.Text strong>Discount:</Typography.Text>{" "}
            {formatPercent(baseline.discountPercent)} →{" "}
            {formatPercent(current.discountPercent)}
          </div>
        )}
        {baseline.cardPerk !== current.cardPerk && (
          <div>
            <Typography.Text strong>Card Perk:</Typography.Text>{" "}
            {baseline.cardPerk || "—"} → {current.cardPerk || "—"}
          </div>
        )}
        {JSON.stringify(baseline.offers) !== JSON.stringify(current.offers) && (
          <div>
            <Typography.Text strong>Offers:</Typography.Text>{" "}
            {baseline.offers.length ? baseline.offers.join(", ") : "—"} →{" "}
            {current.offers.length ? current.offers.join(", ") : "—"}
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
            {baseline.restrictions || "—"} → {current.restrictions || "—"}
          </div>
        )}
      </Modal>
    </>
  );
}
