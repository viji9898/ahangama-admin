import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClockCircleOutlined,
  DeleteOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  TimePicker,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import type {
  EventAudience,
  EventCategory,
  EventEditorPriority,
  EventPriceType,
  EventRecord,
  EventRecurringType,
  EventSeason,
  EventStatus,
} from "../types/event";
import type { Venue } from "../types/venue";

const EVENTS_LIST_ENDPOINT = "/.netlify/functions/api-events-list";
const EVENTS_CREATE_ENDPOINT = "/.netlify/functions/api-events-create";
const S3_PRESIGN_ENDPOINT = "/.netlify/functions/api-s3-presign";
const VENUES_LIST_ENDPOINT = "/.netlify/functions/api-venues-list";
const EVENT_IMAGE_MAX_BYTES = 500 * 1024;

type EventFormValues = {
  startDate: Dayjs;
  endDate?: Dayjs;
  title: string;
  description?: string;
  category: EventCategory;
  subcategory?: string;
  venueId: string;
  startTime: Dayjs;
  endTime?: Dayjs;
  recurring?: boolean;
  recurringType?: EventRecurringType;
  dayOfWeek?: string;
  priceType: EventPriceType;
  price?: string;
  bookingUrl?: string;
  whatsappNumber?: string;
  imageUrls?: string[];
  tags?: string[];
  featured?: boolean;
  editorialPick?: boolean;
  status: EventStatus;
  source?: string;
  lastVerifiedAt?: Dayjs;
  intelligenceScore?: number;
  editorPriority: EventEditorPriority;
  editorNotes?: string;
  audience: EventAudience;
  season: EventSeason;
  featuredThisWeek?: boolean;
  notes?: string;
};

type StatusFilter = EventStatus | "all";
type EventsMode = "add" | "list";

type EventsProps = {
  mode: EventsMode;
};

const EVENT_CATEGORY_OPTIONS: {
  label: string;
  value: EventCategory;
  subcategories: string[];
}[] = [
  {
    label: "Wellness",
    value: "wellness",
    subcategories: [
      "Yoga",
      "Pilates",
      "Breathwork",
      "Ice Bath",
      "Sound Healing",
      "Meditation",
      "Ayurveda",
    ],
  },
  {
    label: "Music",
    value: "music",
    subcategories: [
      "Live Music",
      "DJ Set",
      "Acoustic Session",
      "Jazz Night",
      "Sunset Session",
    ],
  },
  {
    label: "Surf & Ocean",
    value: "surf_ocean",
    subcategories: [
      "Surf Competition",
      "Surf Lesson",
      "Surf Camp",
      "Beach Gathering",
      "Ocean Conservation",
    ],
  },
  {
    label: "Food & Drink",
    value: "food_drink",
    subcategories: [
      "Chef Collaboration",
      "Pop-up Dinner",
      "Wine Tasting",
      "Cocktail Night",
      "Brunch Event",
    ],
  },
  {
    label: "Community",
    value: "community",
    subcategories: [
      "Networking",
      "Founder Meetup",
      "Digital Nomad Meetup",
      "Community Gathering",
    ],
  },
  {
    label: "Workshops",
    value: "workshops",
    subcategories: [
      "Photography",
      "Art",
      "Cooking",
      "Creative Workshop",
      "Skill Sharing",
    ],
  },
  {
    label: "Fitness",
    value: "fitness",
    subcategories: [
      "Running Club",
      "CrossFit",
      "Pickleball",
      "Mobility",
      "Functional Fitness",
    ],
  },
  {
    label: "Nightlife",
    value: "nightlife",
    subcategories: [
      "Beach Party",
      "Club Night",
      "Sunset Party",
      "Full Moon Party",
    ],
  },
  {
    label: "Arts & Culture",
    value: "arts_culture",
    subcategories: [
      "Art Exhibition",
      "Film Screening",
      "Cultural Event",
      "Photography Exhibition",
    ],
  },
  {
    label: "Markets",
    value: "markets",
    subcategories: [
      "Artisan Market",
      "Farmers Market",
      "Vintage Market",
      "Local Makers",
    ],
  },
];

const EVENT_TAG_OPTIONS = [
  "Free",
  "Paid",
  "Family Friendly",
  "Beginner Friendly",
  "Visitor Friendly",
  "Local Favourite",
  "Outdoors",
  "Indoors",
  "Morning",
  "Sunset",
  "Weekly",
  "Monthly",
].map((tag) => ({ label: tag, value: tag }));

const STATUS_OPTIONS: { label: string; value: EventStatus }[] = [
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
];

function makeClientEventId() {
  return globalThis.crypto?.randomUUID?.() || `event-${Date.now()}`;
}

function getVenueInstagramAccount(venue?: Venue | null) {
  return venue?.instagram || venue?.instagramUrl || "";
}

function getVenueGoogleUrl(venue?: Venue | null) {
  if (venue?.mapUrl) return venue.mapUrl;
  if (venue?.googlePlaceId) {
    return `https://www.google.com/maps/place/?q=place_id:${venue.googlePlaceId}`;
  }
  return "";
}

function formatReadonlyNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  } & T;

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }

  return payload;
}

function formatEventDate(value: string) {
  return dayjs(value).format("ddd D MMM YYYY").toUpperCase();
}

function formatEventTime(value: string) {
  const [hourValue = "0", minuteValue = "0"] = String(value).split(":");
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

function formatPreviewTime(value?: Dayjs) {
  return value ? value.format("h:mm A") : null;
}

function EventListingPreview({
  eventDate,
  title,
  venueName,
  startTime,
  endTime,
}: {
  eventDate?: Dayjs;
  title?: string;
  venueName?: string;
  startTime?: Dayjs;
  endTime?: Dayjs;
}) {
  const dateLabel = eventDate
    ? eventDate.format("ddd D MMM YYYY").toUpperCase()
    : "SELECT DATE";
  const titleLabel = title?.trim() || "Event title";
  const venueLabel = venueName?.trim() || "Select venue";
  const startLabel = formatPreviewTime(startTime) || "Start time";
  const endLabel = formatPreviewTime(endTime) || "End time";

  return (
    <div className="whats-on-boardItem">
      <Typography.Text className="whats-on-boardDate">
        {dateLabel}
      </Typography.Text>
      <Typography.Title level={3} className="whats-on-boardTitle">
        {titleLabel}
      </Typography.Title>
      <Typography.Text className="whats-on-boardVenue">
        {venueLabel}
      </Typography.Text>
      <div className="whats-on-boardMetaTime">
        <ClockCircleOutlined />
        <span>
          {startLabel} - {endLabel}
        </span>
      </div>
    </div>
  );
}

export default function Events({ mode }: EventsProps) {
  const [form] = Form.useForm<EventFormValues>();
  const eventImageInputRef = useRef<HTMLInputElement | null>(null);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [eventDraftId, setEventDraftId] = useState(makeClientEventId);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("published");
  const previewValues = Form.useWatch([], form) || {};
  const selectedCategory = Form.useWatch("category", form);
  const selectedVenueId = Form.useWatch("venueId", form);
  const eventImageUrls = Form.useWatch("imageUrls", form) || [];
  const recurring = Form.useWatch("recurring", form);
  const priceType = Form.useWatch("priceType", form);

  const loadEvents = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const response = await fetchJson<{ events: EventRecord[] }>(
        `${EVENTS_LIST_ENDPOINT}?${params.toString()}`,
      );
      setEvents(response.events || []);
    } catch (loadError) {
      setError(String((loadError as Error)?.message || loadError));
    } finally {
      setLoading(false);
    }
  };

  const loadVenues = async () => {
    setVenuesLoading(true);
    try {
      const response = await fetchJson<{ venues: Venue[] }>(
        VENUES_LIST_ENDPOINT,
      );
      setVenues(
        (response.venues || [])
          .filter((venue) => venue.name && (venue.live ?? true) === true)
          .sort((left, right) =>
            String(left.name).localeCompare(String(right.name)),
          ),
      );
    } catch (loadError) {
      message.error(String((loadError as Error)?.message || loadError));
    } finally {
      setVenuesLoading(false);
    }
  };

  useEffect(() => {
    if (mode !== "add") return;
    void loadVenues();
  }, [mode]);

  useEffect(() => {
    if (mode !== "list") return;
    const handle = window.setTimeout(() => {
      void loadEvents();
    }, 250);

    return () => window.clearTimeout(handle);
  }, [mode, search, statusFilter]);

  const summary = useMemo(() => {
    const today = dayjs().startOf("day");
    const upcoming = events.filter(
      (event) =>
        event.status === "published" && !dayjs(event.startDate).isBefore(today),
    ).length;

    return {
      total: events.length,
      upcoming,
      drafts: events.filter((event) => event.status === "draft").length,
    };
  }, [events]);

  const venueOptions = useMemo(
    () =>
      venues.map((venue) => ({
        value: String(venue.id || venue.slug || venue.name),
        label: venue.area
          ? `${venue.name} - ${venue.area}`
          : String(venue.name),
      })),
    [venues],
  );

  const selectedVenue = useMemo(
    () =>
      venues.find(
        (venue) =>
          String(venue.id || venue.slug || venue.name) === selectedVenueId,
      ) || null,
    [selectedVenueId, venues],
  );

  const subcategoryOptions = useMemo(
    () =>
      (
        EVENT_CATEGORY_OPTIONS.find((item) => item.value === selectedCategory)
          ?.subcategories || []
      ).map((subcategory) => ({ label: subcategory, value: subcategory })),
    [selectedCategory],
  );

  const columns: ColumnsType<EventRecord> = [
    {
      title: "Date",
      dataIndex: "startDate",
      key: "startDate",
      width: 180,
      render: (value: string) => (
        <Typography.Text strong>{formatEventDate(value)}</Typography.Text>
      ),
      sorter: (left, right) =>
        dayjs(left.startDate).valueOf() - dayjs(right.startDate).valueOf(),
    },
    {
      title: "Event",
      dataIndex: "title",
      key: "title",
      render: (_value, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{record.title}</Typography.Text>
          <Space size={6} wrap>
            <Typography.Text type="secondary">
              {record.venueName}
            </Typography.Text>
            <Tag>{record.subcategory || record.category}</Tag>
          </Space>
        </Space>
      ),
      sorter: (left, right) => left.title.localeCompare(right.title),
    },
    {
      title: "Time",
      key: "time",
      width: 180,
      render: (_value, record) => (
        <Typography.Text>
          {formatEventTime(record.startTime)}
          {record.endTime ? ` - ${formatEventTime(record.endTime)}` : ""}
        </Typography.Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: EventStatus) => (
        <Tag color={status === "published" ? "green" : "default"}>
          {status === "published" ? "Published" : "Draft"}
        </Tag>
      ),
      filters: [
        { text: "Published", value: "published" },
        { text: "Draft", value: "draft" },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: "Editorial",
      key: "editorial",
      ellipsis: true,
      render: (_value, record) => (
        <Space size={[4, 4]} wrap>
          {record.featuredThisWeek ? <Tag color="blue">This week</Tag> : null}
          {record.editorialPick ? (
            <Tag color="purple">Editor's pick</Tag>
          ) : null}
          {record.featured ? <Tag color="gold">Featured</Tag> : null}
          {record.imageUrls?.length ? (
            <Tag>{record.imageUrls.length} images</Tag>
          ) : null}
          <Tag>{record.editorPriority}</Tag>
          <Tag>{record.audience}</Tag>
        </Space>
      ),
    },
  ];

  const presignEventImage = async () => {
    const response = await fetchJson<{
      upload: {
        url: string;
        fields: Record<string, string>;
        publicUrl: string;
        maxBytes: number;
      };
    }>(S3_PRESIGN_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({ id: eventDraftId, kind: "eventImage" }),
    });

    return response.upload;
  };

  const handleEventImageChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const existingUrls = form.getFieldValue("imageUrls") || [];
    const uploadedUrls: string[] = [];
    setUploadingImages(true);

    try {
      for (const file of files) {
        if (file.type !== "image/jpeg") {
          throw new Error("Only JPG event images are allowed.");
        }
        if (file.size > EVENT_IMAGE_MAX_BYTES) {
          throw new Error(
            `Event images must be ≤ ${Math.round(EVENT_IMAGE_MAX_BYTES / 1024)}KB.`,
          );
        }

        const upload = await presignEventImage();
        const formData = new FormData();
        Object.entries(upload.fields).forEach(([key, value]) => {
          formData.append(key, value);
        });
        formData.append("file", file);

        const uploadResponse = await fetch(upload.url, {
          method: "POST",
          body: formData,
        });
        if (!uploadResponse.ok) {
          const text = await uploadResponse.text().catch(() => "");
          throw new Error(
            text || `S3 upload failed (${uploadResponse.status})`,
          );
        }

        uploadedUrls.push(upload.publicUrl);
      }

      form.setFieldValue("imageUrls", [...existingUrls, ...uploadedUrls]);
      message.success(
        uploadedUrls.length === 1
          ? "Event image uploaded."
          : `${uploadedUrls.length} event images uploaded.`,
      );
    } catch (uploadError) {
      message.error(String((uploadError as Error)?.message || uploadError));
    } finally {
      setUploadingImages(false);
    }
  };

  const removeEventImage = (url: string) => {
    form.setFieldValue(
      "imageUrls",
      eventImageUrls.filter((item) => item !== url),
    );
  };

  const handleCreateEvent = async (values: EventFormValues) => {
    setSaving(true);
    try {
      const venue = venues.find(
        (item) => String(item.id || item.slug || item.name) === values.venueId,
      );

      await fetchJson(EVENTS_CREATE_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({
          id: eventDraftId,
          startDate: values.startDate.format("YYYY-MM-DD"),
          endDate: values.endDate ? values.endDate.format("YYYY-MM-DD") : null,
          title: values.title,
          description: values.description,
          category: values.category,
          subcategory: values.subcategory,
          venueId: values.venueId,
          venueName: venue?.name || values.venueId,
          venueInstagram: getVenueInstagramAccount(venue),
          venueGoogleUrl: getVenueGoogleUrl(venue),
          venueLat: venue?.lat ?? null,
          venueLng: venue?.lng ?? null,
          startTime: values.startTime.format("HH:mm:ss"),
          endTime: values.endTime ? values.endTime.format("HH:mm:ss") : null,
          recurring: values.recurring ?? false,
          recurringType: values.recurringType,
          dayOfWeek: values.dayOfWeek,
          priceType: values.priceType,
          price: values.price,
          bookingUrl: values.bookingUrl,
          whatsappNumber: values.whatsappNumber,
          imageUrl: values.imageUrls?.[0] || null,
          imageUrls: values.imageUrls || [],
          tags: values.tags || [],
          featured: values.featured ?? false,
          editorialPick: values.editorialPick ?? false,
          status: values.status,
          source: values.source,
          lastVerifiedAt: values.lastVerifiedAt
            ? values.lastVerifiedAt.toISOString()
            : null,
          intelligenceScore: values.intelligenceScore ?? 0,
          editorPriority: values.editorPriority,
          editorNotes: values.editorNotes,
          audience: values.audience,
          season: values.season,
          featuredThisWeek: values.featuredThisWeek ?? false,
          notes: values.notes,
        }),
      });

      message.success("Event added");
      const nextEventId = makeClientEventId();
      setEventDraftId(nextEventId);
      form.resetFields();
      form.setFieldsValue({
        category: "wellness",
        priceType: "free",
        status: "draft",
        editorPriority: "medium",
        audience: "both",
        season: "shoulder",
        intelligenceScore: 0,
        imageUrls: [],
      });
      if (mode === "list") await loadEvents();
    } catch (saveError) {
      message.error(String((saveError as Error)?.message || saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Card
        styles={{ body: { padding: 28 } }}
        style={{
          borderRadius: 24,
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
        }}
      >
        <Space direction="vertical" size={8}>
          <Typography.Text type="secondary">Calendar</Typography.Text>
          <Typography.Title level={2} style={{ margin: 0 }}>
            {mode === "add" ? "Add events" : "List all events"}
          </Typography.Title>
          <Typography.Paragraph
            type="secondary"
            style={{ margin: 0, maxWidth: 760 }}
          >
            {mode === "add"
              ? "Create class-style events with venue details, images, timing, and editorial metadata."
              : "Review, search, and filter all events currently saved in the calendar."}
          </Typography.Paragraph>
        </Space>
      </Card>

      {mode === "add" ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={9}>
            <Card
              title="Event preview"
              styles={{ body: { padding: 20 } }}
              style={{
                borderRadius: 20,
                border: "1px solid rgba(15, 23, 42, 0.06)",
                boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
                position: "sticky",
                top: 24,
              }}
            >
              <EventListingPreview
                eventDate={previewValues.startDate}
                title={previewValues.title}
                venueName={selectedVenue?.name}
                startTime={previewValues.startTime}
                endTime={previewValues.endTime}
              />
            </Card>
          </Col>

          <Col xs={24} xl={15}>
            <Card
              title="Add events"
              styles={{ body: { padding: 20 } }}
              style={{
                borderRadius: 20,
                border: "1px solid rgba(15, 23, 42, 0.06)",
                boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
              }}
            >
              <Form<EventFormValues>
                form={form}
                layout="vertical"
                initialValues={{
                  category: "wellness",
                  priceType: "free",
                  status: "draft",
                  editorPriority: "medium",
                  audience: "both",
                  season: "shoulder",
                  intelligenceScore: 0,
                }}
                onFinish={handleCreateEvent}
              >

              <Typography.Title level={5}>Listing details</Typography.Title>
              <Form.Item
                label="Title"
                name="title"
                rules={[{ required: true, message: "Enter an event title" }]}
              >
                <Input placeholder="Muay Thai Adult Class" />
              </Form.Item>

              <Form.Item label="Description" name="description">
                <Input.TextArea
                  rows={3}
                  placeholder="Short editorial description for listings and emails"
                />
              </Form.Item>

              <Row gutter={12}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Category"
                    name="category"
                    rules={[{ required: true, message: "Select a category" }]}
                  >
                    <Select
                      options={EVENT_CATEGORY_OPTIONS.map(
                        ({ label, value }) => ({
                          label,
                          value,
                        }),
                      )}
                      onChange={() =>
                        form.setFieldValue("subcategory", undefined)
                      }
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Subcategory" name="subcategory">
                    <Select
                      allowClear
                      showSearch
                      placeholder="Select type"
                      options={subcategoryOptions}
                      optionFilterProp="label"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="Venue shop"
                name="venueId"
                rules={[{ required: true, message: "Select a venue shop" }]}
              >
                <Select
                  showSearch
                  loading={venuesLoading}
                  placeholder="Select a venue shop"
                  options={venueOptions}
                  optionFilterProp="label"
                  notFoundContent={
                    venuesLoading ? "Loading venues..." : "No venues found"
                  }
                />
              </Form.Item>

              {selectedVenue ? (
                <Row gutter={12}>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Instagram account">
                      <Input
                        disabled
                        value={getVenueInstagramAccount(selectedVenue)}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Google URL">
                      <Input
                        disabled
                        value={getVenueGoogleUrl(selectedVenue)}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Latitude">
                      <Input
                        disabled
                        value={formatReadonlyNumber(selectedVenue.lat)}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Longitude">
                      <Input
                        disabled
                        value={formatReadonlyNumber(selectedVenue.lng)}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              ) : null}

              <Row gutter={12}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Start date"
                    name="startDate"
                    rules={[{ required: true, message: "Select a start date" }]}
                  >
                    <DatePicker
                      placeholder="Required"
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="End date" name="endDate">
                    <DatePicker
                      placeholder="Optional"
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Start time"
                    name="startTime"
                    rules={[{ required: true, message: "Select a start time" }]}
                  >
                    <TimePicker
                      use12Hours
                      format="h:mm A"
                      minuteStep={5}
                      placeholder="Required"
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="End time" name="endTime">
                    <TimePicker
                      use12Hours
                      format="h:mm A"
                      minuteStep={5}
                      placeholder="Optional"
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col xs={24} sm={8}>
                  <Form.Item
                    label="Recurring"
                    name="recurring"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item label="Recurring type" name="recurringType">
                    <Select
                      disabled={!recurring}
                      options={[
                        { label: "Daily", value: "daily" },
                        { label: "Weekly", value: "weekly" },
                        { label: "Monthly", value: "monthly" },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item label="Day of week" name="dayOfWeek">
                    <Select
                      allowClear
                      disabled={!recurring}
                      options={[
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                        "Sunday",
                      ].map((day) => ({ label: day, value: day }))}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Typography.Title level={5}>
                Booking and promotion
              </Typography.Title>
              <Row gutter={12}>
                <Col xs={24} sm={12}>
                  <Form.Item label="Price type" name="priceType">
                    <Select
                      options={[
                        { label: "Free", value: "free" },
                        { label: "Paid", value: "paid" },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Price" name="price">
                    <Input
                      disabled={priceType === "free"}
                      placeholder="Rs 5,000"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Booking URL" name="bookingUrl">
                <Input placeholder="https://..." />
              </Form.Item>

              <Form.Item label="WhatsApp number" name="whatsappNumber">
                <Input placeholder="+94..." />
              </Form.Item>

              <Form.Item name="imageUrls" hidden>
                <Select mode="multiple" />
              </Form.Item>

              <Form.Item label="Event images">
                <input
                  ref={eventImageInputRef}
                  type="file"
                  accept="image/jpeg"
                  multiple
                  style={{ display: "none" }}
                  onChange={handleEventImageChange}
                />
                <Space direction="vertical" size={10} style={{ width: "100%" }}>
                  <Button
                    icon={<UploadOutlined />}
                    loading={uploadingImages}
                    disabled={uploadingImages}
                    onClick={() => eventImageInputRef.current?.click()}
                  >
                    Upload images
                  </Button>
                  {eventImageUrls.length ? (
                    <Row gutter={[8, 8]}>
                      {eventImageUrls.map((url) => (
                        <Col span={8} key={url}>
                          <div
                            style={{
                              position: "relative",
                              aspectRatio: "1 / 1",
                              borderRadius: 8,
                              overflow: "hidden",
                              border: "1px solid rgba(15, 23, 42, 0.08)",
                              background: "#f8fafc",
                            }}
                          >
                            <img
                              src={url}
                              alt="Event"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                            <Button
                              size="small"
                              danger
                              type="primary"
                              icon={<DeleteOutlined />}
                              aria-label="Remove event image"
                              onClick={() => removeEventImage(url)}
                              style={{
                                position: "absolute",
                                top: 6,
                                right: 6,
                              }}
                            />
                          </div>
                        </Col>
                      ))}
                    </Row>
                  ) : null}
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    JPG, up to {Math.round(EVENT_IMAGE_MAX_BYTES / 1024)}KB each
                  </Typography.Text>
                </Space>
              </Form.Item>

              <Form.Item label="Tags" name="tags">
                <Select
                  mode="tags"
                  placeholder="Add tags"
                  options={EVENT_TAG_OPTIONS}
                />
              </Form.Item>

              <Typography.Title level={5}>Publishing</Typography.Title>
              <Row gutter={12}>
                <Col xs={24} sm={12}>
                  <Form.Item label="Status" name="status">
                    <Select options={STATUS_OPTIONS} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Source" name="source">
                    <Input placeholder="Instagram, partner, direct, etc." />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col xs={24} sm={8}>
                  <Form.Item
                    label="Featured"
                    name="featured"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item
                    label="Editor's pick"
                    name="editorialPick"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item
                    label="This week"
                    name="featuredThisWeek"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Last verified" name="lastVerifiedAt">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>

              <Typography.Title level={5}>Intelligence email</Typography.Title>
              <Row gutter={12}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Intelligence score"
                    name="intelligenceScore"
                  >
                    <InputNumber min={0} max={100} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Editor priority" name="editorPriority">
                    <Select
                      options={[
                        { label: "Low", value: "low" },
                        { label: "Medium", value: "medium" },
                        { label: "High", value: "high" },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col xs={24} sm={12}>
                  <Form.Item label="Audience" name="audience">
                    <Select
                      options={[
                        { label: "Tourist", value: "tourist" },
                        { label: "Resident", value: "resident" },
                        { label: "Both", value: "both" },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Season" name="season">
                    <Select
                      options={[
                        { label: "High", value: "high" },
                        { label: "Shoulder", value: "shoulder" },
                        { label: "Low", value: "low" },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Editor notes" name="editorNotes">
                <Input.TextArea
                  rows={3}
                  placeholder="Why it matters, positioning, email angle"
                />
              </Form.Item>

              <Form.Item label="Internal notes" name="notes">
                <Input.TextArea rows={3} placeholder="Operational notes" />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={saving}
                block
              >
                Add event
              </Button>
            </Form>
          </Card>
          </Col>
        </Row>
      ) : null}

      {mode === "list" ? (
        <Row gutter={[16, 16]}>
          <Col xs={24}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={8}>
                <Card size="small" style={{ borderRadius: 16 }}>
                  <Typography.Text type="secondary">Showing</Typography.Text>
                  <Typography.Title level={3} style={{ margin: 0 }}>
                    {summary.total}
                  </Typography.Title>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small" style={{ borderRadius: 16 }}>
                  <Typography.Text type="secondary">Upcoming</Typography.Text>
                  <Typography.Title level={3} style={{ margin: 0 }}>
                    {summary.upcoming}
                  </Typography.Title>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small" style={{ borderRadius: 16 }}>
                  <Typography.Text type="secondary">Drafts</Typography.Text>
                  <Typography.Title level={3} style={{ margin: 0 }}>
                    {summary.drafts}
                  </Typography.Title>
                </Card>
              </Col>
            </Row>

            <Card
              title="List all events"
              styles={{ body: { padding: 20 } }}
              style={{
                borderRadius: 20,
                border: "1px solid rgba(15, 23, 42, 0.06)",
                boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
              }}
            >
              <Space direction="vertical" size={14} style={{ width: "100%" }}>
                <Input.Search
                  allowClear
                  size="large"
                  placeholder="Search events by title, organiser, venue, or notes"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <Segmented
                  block
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value as StatusFilter)}
                  options={[
                    { label: "Published", value: "published" },
                    { label: "All", value: "all" },
                    { label: "Draft", value: "draft" },
                  ]}
                />
              </Space>
            </Card>

            <Card
              styles={{ body: { padding: 20 } }}
              style={{
                borderRadius: 20,
                border: "1px solid rgba(15, 23, 42, 0.06)",
                boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
              }}
            >
              {error ? (
                <Alert
                  type="error"
                  showIcon
                  message="Events unavailable"
                  description={error}
                />
              ) : (
                <Table<EventRecord>
                  rowKey="id"
                  columns={columns}
                  dataSource={events}
                  loading={loading}
                  scroll={{ x: 760 }}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No events match the current filters."
                      />
                    ),
                  }}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                />
              )}
            </Card>
          </Space>
          </Col>
        </Row>
      ) : null}
    </div>
  );
}
