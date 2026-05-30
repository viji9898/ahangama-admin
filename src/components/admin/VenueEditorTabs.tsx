import { Button, Card, Col, Modal, Row, Space, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import type { Venue } from "../../types/venue";
import { VenueContentForm } from "./VenueContentForm";
import { VenueLocationSocialForm } from "./VenueLocationSocialForm";
import { VenueMediaForm } from "./VenueMediaForm";
import { VenueOffersForm } from "./VenueOffersForm";
import { VenueOverviewForm } from "./VenueOverviewForm";
import {
  getVenueHeroImage,
  getVenueInstagramValue,
  getVenueOffersArray,
  getVenuePrimaryCategory,
  normalizeStringArray,
  normalizeText,
} from "./venueAdminUtils";

type Props = {
  venue: Venue;
  categoryOptions: Array<{ label: string; value: string }>;
  onPatch: (patch: Partial<Venue>) => void;
  onGenerateContent: () => Promise<void>;
  generatingContent: boolean;
  onSave: () => void | Promise<void>;
  saving: boolean;
};

type SectionConfig = {
  key: string;
  label: string;
  description: string;
  summary: React.ReactNode;
  content: React.ReactNode;
};

type SectionDraftSnapshot = Record<string, unknown>;

function buildSectionSnapshot(
  venue: Venue,
  sectionKey: string,
): SectionDraftSnapshot {
  switch (sectionKey) {
    case "overview":
      return {
        name: normalizeText(venue.name),
        destinationSlug: normalizeText(venue.destinationSlug),
        slug: normalizeText(venue.slug),
        category: normalizeText(getVenuePrimaryCategory(venue)),
        categories: normalizeStringArray(venue.categories),
        area: normalizeText(venue.area),
        status: normalizeText(venue.status) || "draft",
        live: Boolean(venue.live ?? false),
        isPassVenue: Boolean(venue.isPassVenue ?? false),
        staffPick: Boolean(venue.staffPick ?? false),
        isFeatured: Boolean(venue.isFeatured ?? false),
        priorityScore:
          venue.priorityScore === null || venue.priorityScore === undefined
            ? 0
            : Number(venue.priorityScore),
        passPriority:
          venue.passPriority === null || venue.passPriority === undefined
            ? 0
            : Number(venue.passPriority),
        editorialTags: normalizeStringArray(venue.editorialTags),
      };
    case "content":
      return {
        excerpt: normalizeText(venue.excerpt),
        description: normalizeText(venue.description),
        bestFor: normalizeStringArray(venue.bestFor),
        tags: normalizeStringArray(venue.tags),
      };
    case "media":
      return {
        logo: normalizeText(venue.logo),
        image: normalizeText(venue.image),
        ogImage: normalizeText(venue.ogImage),
      };
    case "offers":
      return {
        stars: venue.stars ?? null,
        reviews: venue.reviews ?? null,
        discount: venue.discount ?? null,
        price: normalizeText(venue.price),
        hours: normalizeText(venue.hours),
        cardPerk: normalizeText(venue.cardPerk),
        offers: getVenueOffersArray(venue.offers),
        howToClaim: normalizeText(venue.howToClaim),
        restrictions: normalizeText(venue.restrictions),
      };
    case "location":
      return {
        lat: venue.lat ?? null,
        lng: venue.lng ?? null,
        mapUrl: normalizeText(venue.mapUrl),
        googlePlaceId: normalizeText(venue.googlePlaceId),
        whatsapp: normalizeText(venue.whatsapp),
        email: normalizeText(venue.email),
        instagram: normalizeText(venue.instagram),
        instagramUrl: normalizeText(venue.instagramUrl),
      };
    default:
      return {};
  }
}

function sectionSnapshotChanged(
  original: SectionDraftSnapshot | null,
  current: SectionDraftSnapshot,
) {
  if (!original) return false;
  return JSON.stringify(original) !== JSON.stringify(current);
}

const previewText = (value: unknown, fallback: string, maxLength = 56) => {
  const text = String(value || "").trim();
  if (!text) return fallback;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
};

const formatNumber = (value: number | undefined | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return String(value);
};

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 11, lineHeight: 1.2 }}>
        {label}
      </Typography.Text>
      <div style={{ lineHeight: 1.15 }}>
        <Typography.Text strong style={{ fontSize: 13 }}>
          {value}
        </Typography.Text>
      </div>
    </div>
  );
}

export function VenueEditorTabs({
  venue,
  categoryOptions,
  onPatch,
  onGenerateContent,
  generatingContent,
  onSave,
  saving,
}: Props) {
  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(null);
  const [sectionOpenSnapshot, setSectionOpenSnapshot] =
    useState<SectionDraftSnapshot | null>(null);
  const [closePromptOpen, setClosePromptOpen] = useState(false);

  const sections = useMemo<SectionConfig[]>(() => {
    const offerCount = getVenueOffersArray(venue.offers).length;
    const booleans = [
      venue.live ? "Live" : null,
      venue.isPassVenue ? "Pass" : null,
      venue.staffPick ? "Staff pick" : null,
      venue.isFeatured ? "Featured" : null,
    ].filter(Boolean) as string[];

    return [
      {
        key: "overview",
        label: "Overview",
        description: "Core identity, category, visibility, and editorial setup.",
        summary: (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <div>
              <Typography.Text strong style={{ fontSize: 14 }}>
                {venue.name || "Untitled venue"}
              </Typography.Text>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {previewText(
                    [
                      getVenuePrimaryCategory(venue),
                      venue.area,
                      venue.destinationSlug,
                    ]
                      .filter(Boolean)
                      .join(" • "),
                    "Category, area, and destination are not set yet.",
                  )}
                </Typography.Text>
              </div>
            </div>
            <Space size={[6, 6]} wrap>
              <Tag bordered={false} style={{ marginInlineEnd: 0 }}>
                {venue.status || "draft"}
              </Tag>
              {booleans.length
                ? booleans.map((item) => (
                    <Tag
                      key={item}
                      color="blue"
                      bordered={false}
                      style={{ marginInlineEnd: 0 }}
                    >
                      {item}
                    </Tag>
                  ))
                : null}
            </Space>
            <Row gutter={[10, 8]}>
              <Col span={12}>
                <SummaryMetric label="Slug" value={venue.slug || "-"} />
              </Col>
              <Col span={12}>
                <SummaryMetric
                  label="Editorial tags"
                  value={String(venue.editorialTags?.length || 0)}
                />
              </Col>
            </Row>
          </Space>
        ),
        content: (
          <VenueOverviewForm
            venue={venue}
            categoryOptions={categoryOptions}
            onPatch={onPatch}
          />
        ),
      },
      {
        key: "content",
        label: "Content",
        description: "Excerpt, long-form copy, tags, and best-for positioning.",
        summary: (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <div>
              <Typography.Text strong style={{ fontSize: 14 }}>
                Excerpt
              </Typography.Text>
              <div>
                <Typography.Paragraph
                  style={{ margin: "2px 0 0", fontSize: 12 }}
                  type="secondary"
                >
                  {previewText(
                    venue.excerpt || venue.description,
                    "No editorial copy added yet.",
                  )}
                </Typography.Paragraph>
              </div>
            </div>
            <Row gutter={[10, 8]}>
              <Col span={12}>
                <SummaryMetric
                  label="Best for"
                  value={String(venue.bestFor?.length || 0)}
                />
              </Col>
              <Col span={12}>
                <SummaryMetric label="Tags" value={String(venue.tags?.length || 0)} />
              </Col>
            </Row>
          </Space>
        ),
        content: (
          <VenueContentForm
            venue={venue}
            onPatch={onPatch}
            onGenerateContent={onGenerateContent}
            generatingContent={generatingContent}
          />
        ),
      },
      {
        key: "media",
        label: "Media",
        description: "Hero image, logo, OG image, and uploaded asset URLs.",
        summary: (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Row gutter={[10, 8]}>
              <Col span={8}>
                <SummaryMetric
                  label="Hero"
                  value={getVenueHeroImage(venue) ? "Ready" : "Missing"}
                />
              </Col>
              <Col span={8}>
                <SummaryMetric label="Logo" value={venue.logo ? "Ready" : "Missing"} />
              </Col>
              <Col span={8}>
                <SummaryMetric
                  label="OG image"
                  value={venue.ogImage ? "Ready" : "Missing"}
                />
              </Col>
            </Row>
            <Typography.Paragraph
              style={{ margin: 0, fontSize: 12 }}
              type="secondary"
            >
              {previewText(
                getVenueHeroImage(venue) || venue.logo || venue.ogImage,
                "No media URLs saved yet.",
              )}
            </Typography.Paragraph>
          </Space>
        ),
        content: <VenueMediaForm venue={venue} onPatch={onPatch} />,
      },
      {
        key: "offers",
        label: "Offers",
        description: "Pricing, ratings, pass perks, claim rules, and offer lines.",
        summary: (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Row gutter={[10, 8]}>
              <Col span={8}>
                <SummaryMetric
                  label="Stars"
                  value={formatNumber(venue.stars ?? null)}
                />
              </Col>
              <Col span={8}>
                <SummaryMetric
                  label="Reviews"
                  value={formatNumber(venue.reviews ?? null)}
                />
              </Col>
              <Col span={8}>
                <SummaryMetric
                  label="Offers"
                  value={String(offerCount)}
                />
              </Col>
            </Row>
            <Typography.Paragraph
              style={{ margin: 0, fontSize: 12 }}
              type="secondary"
            >
              {previewText(
                venue.cardPerk || venue.howToClaim || venue.restrictions,
                "No pass perk or claim guidance added yet.",
              )}
            </Typography.Paragraph>
          </Space>
        ),
        content: <VenueOffersForm venue={venue} onPatch={onPatch} />,
      },
      {
        key: "location",
        label: "Location & Social",
        description: "Coordinates, maps, contact channels, and Instagram details.",
        summary: (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Row gutter={[10, 8]}>
              <Col span={8}>
                <SummaryMetric
                  label="Map"
                  value={venue.mapUrl ? "Linked" : "Missing"}
                />
              </Col>
              <Col span={8}>
                <SummaryMetric
                  label="WhatsApp"
                  value={venue.whatsapp ? "Added" : "Missing"}
                />
              </Col>
              <Col span={8}>
                <SummaryMetric
                  label="Instagram"
                  value={getVenueInstagramValue(venue) ? "Added" : "Missing"}
                />
              </Col>
            </Row>
            <Typography.Paragraph
              style={{ margin: 0, fontSize: 12 }}
              type="secondary"
            >
              {previewText(
                [venue.area, venue.email, getVenueInstagramValue(venue)]
                  .filter(Boolean)
                  .join(" • "),
                "No location or contact details added yet.",
              )}
            </Typography.Paragraph>
          </Space>
        ),
        content: <VenueLocationSocialForm venue={venue} onPatch={onPatch} />,
      },
    ];
  }, [
    categoryOptions,
    generatingContent,
    onGenerateContent,
    onPatch,
    venue,
  ]);

  const activeSection =
    sections.find((section) => section.key === activeSectionKey) || null;
  const activeSectionSnapshot = activeSectionKey
    ? buildSectionSnapshot(venue, activeSectionKey)
    : null;
  const activeSectionDirty = Boolean(
    activeSectionKey &&
      activeSectionSnapshot &&
      sectionSnapshotChanged(sectionOpenSnapshot, activeSectionSnapshot),
  );

  const openSection = (sectionKey: string) => {
    setSectionOpenSnapshot(buildSectionSnapshot(venue, sectionKey));
    setClosePromptOpen(false);
    setActiveSectionKey(sectionKey);
  };

  const finalizeClose = () => {
    setClosePromptOpen(false);
    setActiveSectionKey(null);
    setSectionOpenSnapshot(null);
  };

  const requestClose = () => {
    if (!activeSectionDirty) {
      finalizeClose();
      return;
    }
    setClosePromptOpen(true);
  };

  const discardSectionChanges = () => {
    if (sectionOpenSnapshot) {
      onPatch(sectionOpenSnapshot as Partial<Venue>);
    }
    finalizeClose();
  };

  const saveAndClose = async () => {
    await Promise.resolve(onSave());
    finalizeClose();
  };

  return (
    <>
      <Row gutter={[16, 16]} style={{ paddingTop: 8 }}>
        {sections.map((section) => (
          <Col xs={24} md={12} key={section.key}>
            <Card
              hoverable
              onClick={() => openSection(section.key)}
              size="small"
              styles={{ body: { padding: 12 } }}
              style={{
                height: "100%",
                borderRadius: 16,
                border: "1px solid rgba(15, 23, 42, 0.08)",
                boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",
              }}
            >
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <div>
                  <Typography.Title level={5} style={{ margin: 0, fontSize: 16 }}>
                    {section.label}
                  </Typography.Title>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {section.description}
                  </Typography.Text>
                </div>
                {section.summary}
                <div>
                  <Button size="small" onClick={() => openSection(section.key)}>
                    Edit {section.label}
                  </Button>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal
        destroyOnHidden
        width={880}
        open={Boolean(activeSection)}
        title={activeSection ? `Edit ${activeSection.label}` : "Edit section"}
        onCancel={requestClose}
        footer={
          <Button onClick={requestClose}>
            Done
          </Button>
        }
      >
        {activeSection ? (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Typography.Text type="secondary">
              Changes update the draft immediately. Use Save Changes in the main editor to publish them.
            </Typography.Text>
            {activeSection.content}
          </Space>
        ) : null}
      </Modal>

      <Modal
        destroyOnHidden
        open={closePromptOpen}
        title="Save changes before closing?"
        onCancel={() => setClosePromptOpen(false)}
        footer={[
          <Button key="keep-editing" onClick={() => setClosePromptOpen(false)}>
            Keep editing
          </Button>,
          <Button key="discard" onClick={discardSectionChanges}>
            Close without saving
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={saving}
            onClick={() => void saveAndClose()}
          >
            Save changes
          </Button>,
        ]}
      >
        <Typography.Text type="secondary">
          Save will persist the current venue draft. Closing without saving will
          discard the changes made in this section since the modal was opened.
        </Typography.Text>
      </Modal>
    </>
  );
}
