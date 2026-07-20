import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  InstagramOutlined,
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
  Modal,
  Popconfirm,
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
const EVENTS_UPDATE_ENDPOINT = "/.netlify/functions/api-events-update";
const EVENTS_DELETE_ENDPOINT = "/.netlify/functions/api-events-delete";
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
  venueId?: string;
  venueName: string;
  venueInstagram?: string;
  venueGoogleUrl?: string;
  directionsUrl?: string;
  instagramUrl?: string;
  venueLat?: number | null;
  venueLng?: number | null;
  startTime: Dayjs;
  endTime?: Dayjs;
  displayTime?: string;
  recurring?: boolean;
  recurringType?: EventRecurringType;
  dayOfWeek?: string;
  priceType: EventPriceType;
  price?: string;
  bookingUrl?: string;
  whatsappNumber?: string;
  imageUrls?: string[];
  mobileImageUrl?: string;
  offerImageUrl?: string;
  offerText?: string;
  details?: string[];
  venueLinks?: string[];
  passBenefit?: { label?: string; discount?: string; perk?: string };
  tags?: string[];
  featured?: boolean;
  editorialPick?: boolean;
  status: EventStatus;
  source?: string;
  sourceKey?: string;
  lastVerifiedAt?: Dayjs;
  intelligenceScore?: number;
  editorPriority: EventEditorPriority;
  editorNotes?: string;
  audience: EventAudience;
  season: EventSeason;
  featuredThisWeek?: boolean;
  eventOrder?: number;
  notes?: string;
};

type StatusFilter = EventStatus | "all";
type EventsMode = "add" | "list";
type ImageUploadTarget = "gallery" | "mobile" | "offer";

type EventsProps = { mode: EventsMode };

const EVENT_CATEGORY_OPTIONS: {
  label: string;
  value: EventCategory;
  subcategories: string[];
}[] = [
  { label: "Wellness", value: "wellness", subcategories: ["Yoga", "Pilates", "Breathwork", "Ice Bath", "Sound Healing", "Meditation", "Ayurveda"] },
  { label: "Music", value: "music", subcategories: ["Live Music", "DJ Set", "Acoustic Session", "Jazz Night", "Sunset Session"] },
  { label: "Surf & Ocean", value: "surf_ocean", subcategories: ["Surf Competition", "Surf Lesson", "Surf Camp", "Beach Gathering", "Ocean Conservation"] },
  { label: "Food & Drink", value: "food_drink", subcategories: ["Chef Collaboration", "Pop-up Dinner", "Wine Tasting", "Cocktail Night", "Brunch Event"] },
  { label: "Community", value: "community", subcategories: ["Networking", "Founder Meetup", "Digital Nomad Meetup", "Community Gathering"] },
  { label: "Workshops", value: "workshops", subcategories: ["Photography", "Art", "Cooking", "Creative Workshop", "Skill Sharing"] },
  { label: "Fitness", value: "fitness", subcategories: ["Running Club", "CrossFit", "Pickleball", "Mobility", "Functional Fitness"] },
  { label: "Nightlife", value: "nightlife", subcategories: ["Beach Party", "Club Night", "Sunset Party", "Full Moon Party"] },
  { label: "Arts & Culture", value: "arts_culture", subcategories: ["Art Exhibition", "Film Screening", "Cultural Event", "Photography Exhibition"] },
  { label: "Markets", value: "markets", subcategories: ["Artisan Market", "Farmers Market", "Vintage Market", "Local Makers"] },
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

const WEEKDAY_OPTIONS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
].map((day) => ({ label: day, value: day }));

const INITIAL_VALUES: Partial<EventFormValues> = {
  category: "wellness",
  priceType: "free",
  status: "draft",
  editorPriority: "medium",
  audience: "both",
  season: "shoulder",
  intelligenceScore: 0,
  eventOrder: 0,
  imageUrls: [],
  details: [],
  venueLinks: [],
};

function makeClientEventId() {
  return globalThis.crypto?.randomUUID?.() || `event-${Date.now()}`;
}

function getVenueInstagramAccount(venue?: Venue | null) {
  return venue?.instagram || venue?.instagramUrl || "";
}

function getVenueGoogleUrl(venue?: Venue | null) {
  if (venue?.mapUrl) return venue.mapUrl;
  if (venue?.googlePlaceId) return `https://www.google.com/maps/place/?q=place_id:${venue.googlePlaceId}`;
  return "";
}

function formatReadonlyNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string } & T;
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `Request failed (${response.status})`);
  return payload;
}

function formatEventDate(record: EventRecord) {
  if (record.weekday && record.dayNumber && record.month) return `${record.weekday} ${record.dayNumber} ${record.month}`.toUpperCase();
  return dayjs(record.startDate).format("ddd D MMM YYYY").toUpperCase();
}

function formatEventTime(value?: string | null) {
  if (!value) return "";
  const [hourValue = "0", minuteValue = "0"] = String(value).split(":");
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const period = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${period}`;
}

function getEventCategoryLabel(value?: EventCategory) {
  return EVENT_CATEGORY_OPTIONS.find((option) => option.value === value)?.label || "Wellness";
}

function eventToFormValues(record: EventRecord): EventFormValues {
  return {
    startDate: dayjs(record.dayKey || record.startDate),
    endDate: record.endDate ? dayjs(record.endDate) : undefined,
    title: record.title,
    description: record.description || undefined,
    category: record.category,
    subcategory: record.subcategory || undefined,
    venueId: record.venueId || undefined,
    venueName: record.venueName,
    venueInstagram: record.venueInstagram || undefined,
    venueGoogleUrl: record.venueGoogleUrl || undefined,
    directionsUrl: record.directionsUrl || record.venueGoogleUrl || undefined,
    instagramUrl: record.instagramUrl || record.venueInstagram || undefined,
    venueLat: record.venueLat ?? null,
    venueLng: record.venueLng ?? null,
    startTime: dayjs(record.startTime, "HH:mm:ss"),
    endTime: record.endTime ? dayjs(record.endTime, "HH:mm:ss") : undefined,
    displayTime: record.displayTime || undefined,
    recurring: record.recurring,
    recurringType: record.recurringType || undefined,
    dayOfWeek: record.dayOfWeek || undefined,
    priceType: record.priceType,
    price: record.price || undefined,
    bookingUrl: record.bookingUrl || undefined,
    whatsappNumber: record.whatsappNumber || undefined,
    imageUrls: record.imageUrls || [],
    mobileImageUrl: record.mobileImageUrl || undefined,
    offerImageUrl: record.offerImageUrl || undefined,
    offerText: record.offerText || undefined,
    details: record.details || [],
    venueLinks: record.venueLinks || [],
    passBenefit: {
      label: record.passBenefit?.label || undefined,
      discount: record.passBenefit?.discount || undefined,
      perk: record.passBenefit?.perk || undefined,
    },
    tags: record.tags || [],
    featured: record.featured,
    editorialPick: record.editorialPick,
    status: record.status,
    source: record.source || undefined,
    sourceKey: record.sourceKey || undefined,
    lastVerifiedAt: record.lastVerifiedAt ? dayjs(record.lastVerifiedAt) : undefined,
    intelligenceScore: record.intelligenceScore,
    editorPriority: record.editorPriority,
    editorNotes: record.editorNotes || undefined,
    audience: record.audience,
    season: record.season,
    featuredThisWeek: record.featuredThisWeek,
    eventOrder: record.eventOrder,
    notes: record.notes || undefined,
  };
}

function EventListingPreview({
  eventDate,
  title,
  venueName,
  category,
  description,
  imageUrls,
  instagramUrl,
  directionsUrl,
  startTime,
  displayTime,
}: {
  eventDate?: Dayjs;
  title?: string;
  venueName?: string;
  category?: EventCategory;
  description?: string;
  imageUrls?: string[];
  instagramUrl?: string;
  directionsUrl?: string;
  startTime?: Dayjs;
  displayTime?: string;
}) {
  const weekday = eventDate ? eventDate.format("dddd") : "Tuesday";
  const dayNumber = eventDate ? eventDate.format("DD") : "07";
  const month = eventDate ? eventDate.format("MMMM") : "July";
  const titleLabel = title?.trim() || "BREATHWORK";
  const venueLabel = venueName?.trim() || "Ember & Ice";
  const timeLabel = displayTime?.trim() || (startTime ? startTime.format("h.mma").toUpperCase() : "10.00AM");
  const categoryLabel = getEventCategoryLabel(category);
  const descriptionLabel = description?.trim() || "Breathwork session with Ember & Ice.";
  const previewImage = imageUrls?.[0] || "https://ahangama.com/Images%20for%20Events%20Calendar/Ember%20&%20Ice%20-%20Breathworking%20Image_.png";
  const instagramHref = instagramUrl || "https://www.instagram.com/emberandiceahangama";
  const directionsHref = directionsUrl || "https://www.google.com/maps/search/?api=1&query=Ember%20%26%20Ice%20Ahangama";
  const actions = (
    <>
      <a href={instagramHref} target="_blank" rel="noreferrer" aria-label="Open Instagram"><InstagramOutlined /></a>
      <a href={directionsHref} target="_blank" rel="noreferrer" aria-label="Open directions"><EnvironmentOutlined /></a>
    </>
  );

  return (
    <div className="event-preview-stack">
      <div>
        <Typography.Text className="event-preview-label">Desktop</Typography.Text>
        <div className="event-preview-desktop-frame">
          <section className="event-feature">
            <div className="event-feature__date">
              <div className="event-feature__weekday">{weekday}</div>
              <div className="event-feature__day">{dayNumber}</div>
              <div className="event-feature__month">{month}</div>
            </div>
            <div className="event-feature__media">
              <img src={previewImage} alt={`${titleLabel} at ${venueLabel}`} />
              <div className="event-feature__dots" aria-hidden="true"><span className="is-active" /><span /><span /></div>
            </div>
            <div className="event-feature__content">
              <h2>{titleLabel}</h2>
              <p className="event-feature__venue">{venueLabel}</p>
              <div className="event-feature__meta"><span><ClockCircleOutlined />{timeLabel}</span><span className="event-feature__dot">·</span><span>{categoryLabel}</span></div>
              <p className="event-feature__description">{descriptionLabel}</p>
              <div className="event-feature__actions">{actions}</div>
            </div>
          </section>
        </div>
      </div>
      <div>
        <Typography.Text className="event-preview-label">Mobile</Typography.Text>
        <section className="mobile-event">
          <div className="mobile-event__date"><span className="mobile-event__weekday">{weekday}</span><div className="mobile-event__day">{dayNumber}</div><span className="mobile-event__month">{month}</span></div>
          <div className="mobile-event__card">
            <div className="mobile-event__imageWrap"><img src={previewImage} alt={`${titleLabel} at ${venueLabel}`} /><div className="mobile-event__dots" aria-hidden="true"><span className="is-active" /><span /><span /></div></div>
            <div className="mobile-event__content">
              <h2>{titleLabel}</h2>
              <p className="mobile-event__venue">{venueLabel}</p>
              <div className="mobile-event__meta"><span><ClockCircleOutlined />{timeLabel}</span><span className="mobile-event__dot">·</span><span>{categoryLabel}</span></div>
              <p className="mobile-event__description">{descriptionLabel}</p>
              <div className="mobile-event__actions">{actions}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function Events({ mode }: EventsProps) {
  const [form] = Form.useForm<EventFormValues>();
  const eventImageInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetRef = useRef<ImageUploadTarget>("gallery");
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [eventDraftId, setEventDraftId] = useState<string>(makeClientEventId);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("published");
  const previewValues = Form.useWatch([], form) || {};
  const selectedCategory = Form.useWatch("category", form);
  const selectedVenueId = Form.useWatch("venueId", form);
  const eventImageUrls = Form.useWatch("imageUrls", form) || [];
  const mobileImageUrl = Form.useWatch("mobileImageUrl", form);
  const offerImageUrl = Form.useWatch("offerImageUrl", form);
  const recurring = Form.useWatch("recurring", form);
  const recurringType = Form.useWatch("recurringType", form);
  const startDate = Form.useWatch("startDate", form);
  const priceType = Form.useWatch("priceType", form);

  const loadEvents = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await fetchJson<{ events: EventRecord[] }>(`${EVENTS_LIST_ENDPOINT}?${params.toString()}`);
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
      const response = await fetchJson<{ venues: Venue[] }>(VENUES_LIST_ENDPOINT);
      setVenues((response.venues || []).filter((venue) => venue.name && (venue.live ?? true) === true).sort((left, right) => String(left.name).localeCompare(String(right.name))));
    } catch (loadError) {
      message.error(String((loadError as Error)?.message || loadError));
    } finally {
      setVenuesLoading(false);
    }
  };

  useEffect(() => { void loadVenues(); }, []);
  useEffect(() => {
    if (mode !== "list") return;
    const handle = window.setTimeout(() => { void loadEvents(); }, 250);
    return () => window.clearTimeout(handle);
  }, [mode, search, statusFilter]);
  useEffect(() => {
    if (mode === "add") form.setFieldsValue(INITIAL_VALUES);
  }, [form, mode]);
  useEffect(() => {
    if (!recurring || recurringType !== "weekly") {
      form.setFieldValue("dayOfWeek", undefined);
      return;
    }

    if (startDate && !form.getFieldValue("dayOfWeek")) {
      form.setFieldValue("dayOfWeek", startDate.format("dddd"));
    }
  }, [form, recurring, recurringType, startDate]);

  const summary = useMemo(() => {
    const today = dayjs().startOf("day");
    const upcoming = events.filter((event) => event.status === "published" && !dayjs(event.dayKey || event.startDate).isBefore(today)).length;
    return { total: events.length, upcoming, drafts: events.filter((event) => event.status === "draft").length };
  }, [events]);

  const selectedVenue = useMemo(() => venues.find((venue) => String(venue.id || venue.slug || venue.name) === selectedVenueId) || null, [selectedVenueId, venues]);
  const venueOptions = useMemo(() => {
    const options = venues.map((venue) => ({ value: String(venue.id || venue.slug || venue.name), label: venue.area ? `${venue.name} - ${venue.area}` : String(venue.name) }));
    if (editingEvent?.venueId && !options.some((option) => option.value === editingEvent.venueId)) options.unshift({ value: editingEvent.venueId, label: editingEvent.venueName });
    return options;
  }, [editingEvent, venues]);
  const subcategoryOptions = useMemo(() => (EVENT_CATEGORY_OPTIONS.find((item) => item.value === selectedCategory)?.subcategories || []).map((subcategory) => ({ label: subcategory, value: subcategory })), [selectedCategory]);

  const presignEventImage = async () => {
    const response = await fetchJson<{ upload: { url: string; fields: Record<string, string>; publicUrl: string; maxBytes: number } }>(S3_PRESIGN_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({ id: editingEvent?.id || eventDraftId, kind: "eventImage" }),
    });
    return response.upload;
  };

  const openUpload = (target: ImageUploadTarget) => {
    uploadTargetRef.current = target;
    eventImageInputRef.current?.click();
  };

  const handleEventImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const target = uploadTargetRef.current;
    event.target.value = "";
    if (!files.length) return;
    const uploadedUrls: string[] = [];
    setUploadingImages(true);
    try {
      for (const file of files) {
        if (file.type !== "image/jpeg") throw new Error("Only JPG event images are allowed.");
        if (file.size > EVENT_IMAGE_MAX_BYTES) throw new Error(`Event images must be <= ${Math.round(EVENT_IMAGE_MAX_BYTES / 1024)}KB.`);
        const upload = await presignEventImage();
        const formData = new FormData();
        Object.entries(upload.fields).forEach(([key, value]) => formData.append(key, value));
        formData.append("file", file);
        const uploadResponse = await fetch(upload.url, { method: "POST", body: formData });
        if (!uploadResponse.ok) {
          const text = await uploadResponse.text().catch(() => "");
          throw new Error(text || `S3 upload failed (${uploadResponse.status})`);
        }
        uploadedUrls.push(upload.publicUrl);
      }
      if (target === "gallery") form.setFieldValue("imageUrls", [...eventImageUrls, ...uploadedUrls]);
      else if (target === "mobile") form.setFieldValue("mobileImageUrl", uploadedUrls[0]);
      else form.setFieldValue("offerImageUrl", uploadedUrls[0]);
      message.success(uploadedUrls.length === 1 ? "Event image uploaded." : `${uploadedUrls.length} event images uploaded.`);
    } catch (uploadError) {
      message.error(String((uploadError as Error)?.message || uploadError));
    } finally {
      setUploadingImages(false);
    }
  };

  const handleVenueChange = (value?: string) => {
    const venue = venues.find((item) => String(item.id || item.slug || item.name) === value);
    if (!venue) return;
    form.setFieldsValue({
      venueName: venue.name,
      venueInstagram: getVenueInstagramAccount(venue),
      venueGoogleUrl: getVenueGoogleUrl(venue),
      directionsUrl: getVenueGoogleUrl(venue),
      instagramUrl: getVenueInstagramAccount(venue),
      venueLat: venue.lat ?? null,
      venueLng: venue.lng ?? null,
    });
  };

  const buildPayload = (values: EventFormValues) => {
    const imageUrls = values.imageUrls || [];
    return {
      id: editingEvent?.id || eventDraftId,
      startDate: values.startDate.format("YYYY-MM-DD"),
      endDate: values.endDate ? values.endDate.format("YYYY-MM-DD") : null,
      title: values.title,
      description: values.description,
      category: values.category,
      subcategory: values.subcategory,
      venueId: values.venueId,
      venueName: values.venueName,
      venueInstagram: values.venueInstagram,
      venueGoogleUrl: values.venueGoogleUrl,
      venueLat: values.venueLat ?? null,
      venueLng: values.venueLng ?? null,
      directionsUrl: values.directionsUrl,
      instagramUrl: values.instagramUrl,
      startTime: values.startTime.format("HH:mm:ss"),
      endTime: values.endTime ? values.endTime.format("HH:mm:ss") : null,
      displayTime: values.displayTime,
      recurring: values.recurring ?? false,
      recurringType: values.recurringType,
      dayOfWeek: values.recurring && values.recurringType === "weekly"
        ? values.dayOfWeek || values.startDate.format("dddd")
        : undefined,
      priceType: values.priceType,
      price: values.price,
      bookingUrl: values.bookingUrl,
      whatsappNumber: values.whatsappNumber,
      imageUrl: imageUrls[0] || null,
      imageUrls,
      mobileImageUrl: values.mobileImageUrl,
      offerImageUrl: values.offerImageUrl,
      offerText: values.offerText,
      details: values.details || [],
      venueLinks: values.venueLinks || [],
      passBenefit: values.passBenefit,
      tags: values.tags || [],
      featured: values.featured ?? false,
      editorialPick: values.editorialPick ?? false,
      status: values.status,
      source: values.source,
      sourceKey: values.sourceKey,
      lastVerifiedAt: values.lastVerifiedAt ? values.lastVerifiedAt.toISOString() : null,
      intelligenceScore: values.intelligenceScore ?? 0,
      editorPriority: values.editorPriority,
      editorNotes: values.editorNotes,
      audience: values.audience,
      season: values.season,
      featuredThisWeek: values.featuredThisWeek ?? false,
      eventOrder: values.eventOrder ?? 0,
      notes: values.notes,
      rawEvent: editingEvent?.rawEvent || {},
    };
  };

  const handleSubmit = async (values: EventFormValues) => {
    setSaving(true);
    try {
      await fetchJson(editingEvent ? EVENTS_UPDATE_ENDPOINT : EVENTS_CREATE_ENDPOINT, {
        method: editingEvent ? "PUT" : "POST",
        body: JSON.stringify(buildPayload(values)),
      });
      message.success(editingEvent ? "Event updated" : "Event added");
      form.resetFields();
      form.setFieldsValue(INITIAL_VALUES);
      setEditingEvent(null);
      setEditModalOpen(false);
      setEventDraftId(makeClientEventId());
      if (mode === "list") await loadEvents();
    } catch (saveError) {
      message.error(String((saveError as Error)?.message || saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (record: EventRecord) => {
    setEditingEvent(record);
    setEventDraftId(record.id);
    form.resetFields();
    form.setFieldsValue(eventToFormValues(record));
    setEditModalOpen(true);
  };

  const handleDelete = async (record: EventRecord) => {
    setDeletingId(record.id);
    try {
      await fetchJson(`${EVENTS_DELETE_ENDPOINT}?id=${encodeURIComponent(record.id)}`, { method: "DELETE" });
      message.success("Event deleted");
      await loadEvents();
    } catch (deleteError) {
      message.error(String((deleteError as Error)?.message || deleteError));
    } finally {
      setDeletingId("");
    }
  };

  const renderImagePreview = (url?: string, label = "Image") => url ? (
    <div style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(15, 23, 42, 0.08)", background: "#f8fafc" }}>
      <img src={url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </div>
  ) : null;

  const renderEventForm = (submitLabel: string) => (
    <Form<EventFormValues> form={form} layout="vertical" initialValues={INITIAL_VALUES} onFinish={handleSubmit}>
      <input ref={eventImageInputRef} type="file" accept="image/jpeg" multiple style={{ display: "none" }} onChange={handleEventImageChange} />
      <Typography.Title level={5}>Listing details</Typography.Title>
      <Form.Item label="Title" name="title" rules={[{ required: true, message: "Enter an event title" }]}><Input placeholder="Kurundu Sundown Session" /></Form.Item>
      <Form.Item label="Description" name="description"><Input.TextArea rows={3} placeholder="Short editorial description for listings and emails" /></Form.Item>
      <Row gutter={12}>
        <Col xs={24} sm={12}><Form.Item label="Category" name="category" rules={[{ required: true, message: "Select a category" }]}><Select options={EVENT_CATEGORY_OPTIONS.map(({ label, value }) => ({ label, value }))} onChange={() => form.setFieldValue("subcategory", undefined)} /></Form.Item></Col>
        <Col xs={24} sm={12}><Form.Item label="Subcategory" name="subcategory"><Select allowClear showSearch placeholder="Select type" options={subcategoryOptions} optionFilterProp="label" /></Form.Item></Col>
      </Row>
      <Row gutter={12}>
        <Col xs={24} sm={12}><Form.Item label="Venue" name="venueId"><Select allowClear showSearch loading={venuesLoading} placeholder="Select a venue" options={venueOptions} optionFilterProp="label" onChange={handleVenueChange} notFoundContent={venuesLoading ? "Loading venues..." : "No venues found"} /></Form.Item></Col>
        <Col xs={24} sm={12}><Form.Item label="Venue name" name="venueName" rules={[{ required: true, message: "Enter a venue name" }]}><Input placeholder="Hakuna Matata" /></Form.Item></Col>
      </Row>
      <Row gutter={12}>
        <Col xs={24} sm={12}><Form.Item label="Instagram URL" name="instagramUrl"><Input placeholder="https://www.instagram.com/..." /></Form.Item></Col>
        <Col xs={24} sm={12}><Form.Item label="Directions URL" name="directionsUrl"><Input placeholder="https://maps.app.goo.gl/..." /></Form.Item></Col>
        <Col xs={24} sm={12}><Form.Item label="Venue Instagram snapshot" name="venueInstagram"><Input placeholder="@venue or URL" /></Form.Item></Col>
        <Col xs={24} sm={12}><Form.Item label="Venue Google snapshot" name="venueGoogleUrl"><Input placeholder="Google Maps URL" /></Form.Item></Col>
        <Col xs={24} sm={12}><Form.Item label="Latitude" name="venueLat"><InputNumber style={{ width: "100%" }} placeholder={formatReadonlyNumber(selectedVenue?.lat)} /></Form.Item></Col>
        <Col xs={24} sm={12}><Form.Item label="Longitude" name="venueLng"><InputNumber style={{ width: "100%" }} placeholder={formatReadonlyNumber(selectedVenue?.lng)} /></Form.Item></Col>
      </Row>
      <Row gutter={12}>
        <Col xs={24} sm={12}><Form.Item label="Start date" name="startDate" rules={[{ required: true, message: "Select a start date" }]}><DatePicker placeholder="Required" style={{ width: "100%" }} /></Form.Item></Col>
        <Col xs={24} sm={12}><Form.Item label="End date" name="endDate"><DatePicker placeholder="Optional" style={{ width: "100%" }} /></Form.Item></Col>
      </Row>
      <Row gutter={12}>
        <Col xs={24} sm={12}><Form.Item label="Start time" name="startTime" rules={[{ required: true, message: "Select a start time" }]}><TimePicker use12Hours format="h:mm A" minuteStep={5} placeholder="Required" style={{ width: "100%" }} /></Form.Item></Col>
        <Col xs={24} sm={12}><Form.Item label="End time" name="endTime"><TimePicker use12Hours format="h:mm A" minuteStep={5} placeholder="Optional" style={{ width: "100%" }} /></Form.Item></Col>
      </Row>
      <Form.Item label="Display time" name="displayTime"><Input placeholder="Happy Hour: 5:00 PM - 7:00 PM" /></Form.Item>
      <Row gutter={12}>
        <Col xs={24} sm={8}><Form.Item label="Recurring" name="recurring" valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={24} sm={8}><Form.Item label="Recurring type" name="recurringType"><Select disabled={!recurring} options={[{ label: "Daily", value: "daily" }, { label: "Weekly", value: "weekly" }, { label: "Monthly", value: "monthly" }]} /></Form.Item></Col>
        {recurring && recurringType === "weekly" ? <Col xs={24} sm={8}><Form.Item label="Repeat day" name="dayOfWeek" rules={[{ required: true, message: "Select a repeat day" }]}><Select options={WEEKDAY_OPTIONS} /></Form.Item></Col> : null}
      </Row>

      <Typography.Title level={5}>Images and offer</Typography.Title>
      <Form.Item name="imageUrls" hidden><Select mode="multiple" /></Form.Item>
      <Form.Item name="mobileImageUrl" hidden><Input /></Form.Item>
      <Form.Item name="offerImageUrl" hidden><Input /></Form.Item>
      <Space direction="vertical" size={12} style={{ width: "100%", marginBottom: 20 }}>
        <Space wrap>
          <Button icon={<UploadOutlined />} loading={uploadingImages} onClick={() => openUpload("gallery")}>Upload gallery image</Button>
          <Button icon={<UploadOutlined />} loading={uploadingImages} onClick={() => openUpload("mobile")}>Replace mobile image</Button>
          <Button icon={<UploadOutlined />} loading={uploadingImages} onClick={() => openUpload("offer")}>Replace offer image</Button>
        </Space>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>JPG uploads are stored in S3 under this event id, up to {Math.round(EVENT_IMAGE_MAX_BYTES / 1024)}KB each.</Typography.Text>
        {eventImageUrls.length ? <Row gutter={[8, 8]}>{eventImageUrls.map((url) => <Col xs={12} sm={8} key={url}><div style={{ position: "relative" }}>{renderImagePreview(url, "Event")}<Button size="small" danger type="primary" icon={<DeleteOutlined />} aria-label="Remove event image" onClick={() => form.setFieldValue("imageUrls", eventImageUrls.filter((item) => item !== url))} style={{ position: "absolute", top: 6, right: 6 }} /></div></Col>)}</Row> : null}
        <Row gutter={[8, 8]}>{mobileImageUrl ? <Col xs={12}>{renderImagePreview(mobileImageUrl, "Mobile event")}</Col> : null}{offerImageUrl ? <Col xs={12}>{renderImagePreview(offerImageUrl, "Offer")}</Col> : null}</Row>
      </Space>
      <Form.Item label="Offer text" name="offerText"><Input.TextArea rows={2} placeholder="20% off cocktails" /></Form.Item>

      <Typography.Title level={5}>Booking and promotion</Typography.Title>
      <Row gutter={12}>
        <Col xs={24} sm={12}><Form.Item label="Price type" name="priceType"><Select options={[{ label: "Free", value: "free" }, { label: "Paid", value: "paid" }]} /></Form.Item></Col>
        <Col xs={24} sm={12}><Form.Item label="Price" name="price"><Input disabled={priceType === "free"} placeholder="Rs 5,000" /></Form.Item></Col>
      </Row>
      <Form.Item label="Booking URL" name="bookingUrl"><Input placeholder="https://..." /></Form.Item>
      <Form.Item label="WhatsApp number" name="whatsappNumber"><Input placeholder="+94..." /></Form.Item>
      <Form.Item label="Details" name="details"><Select mode="tags" tokenSeparators={["\n"]} placeholder="Add detail lines" /></Form.Item>
      <Form.Item label="Venue links" name="venueLinks"><Select mode="tags" placeholder="Add venue links" /></Form.Item>
      <Row gutter={12}>
        <Col xs={24} sm={8}><Form.Item label="Pass label" name={["passBenefit", "label"]}><Input placeholder="Ahangama Pass" /></Form.Item></Col>
        <Col xs={24} sm={8}><Form.Item label="Pass discount" name={["passBenefit", "discount"]}><Input placeholder="10% off" /></Form.Item></Col>
        <Col xs={24} sm={8}><Form.Item label="Pass perk" name={["passBenefit", "perk"]}><Input placeholder="10% off the daily special" /></Form.Item></Col>
      </Row>
      <Form.Item label="Tags" name="tags"><Select mode="tags" placeholder="Add tags" options={EVENT_TAG_OPTIONS} /></Form.Item>

      <Typography.Title level={5}>Publishing</Typography.Title>
      <Row gutter={12}>
        <Col xs={24} sm={12}><Form.Item label="Status" name="status"><Select options={STATUS_OPTIONS} /></Form.Item></Col>
        <Col xs={24} sm={12}><Form.Item label="Event order" name="eventOrder"><InputNumber style={{ width: "100%" }} /></Form.Item></Col>
        <Col xs={24} sm={12}><Form.Item label="Source" name="source"><Input placeholder="Instagram, partner, direct, seed, etc." /></Form.Item></Col>
        <Col xs={24} sm={12}><Form.Item label="Source key" name="sourceKey"><Input placeholder="Stable seed/source key" /></Form.Item></Col>
      </Row>
      <Row gutter={12}>
        <Col xs={24} sm={8}><Form.Item label="Featured" name="featured" valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={24} sm={8}><Form.Item label="Editor's pick" name="editorialPick" valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={24} sm={8}><Form.Item label="This week" name="featuredThisWeek" valuePropName="checked"><Switch /></Form.Item></Col>
      </Row>
      <Form.Item label="Last verified" name="lastVerifiedAt"><DatePicker style={{ width: "100%" }} /></Form.Item>
      <Typography.Title level={5}>Intelligence email</Typography.Title>
      <Row gutter={12}>
        <Col xs={24} sm={12}><Form.Item label="Intelligence score" name="intelligenceScore"><InputNumber min={0} max={100} style={{ width: "100%" }} /></Form.Item></Col>
        <Col xs={24} sm={12}><Form.Item label="Editor priority" name="editorPriority"><Select options={[{ label: "Low", value: "low" }, { label: "Medium", value: "medium" }, { label: "High", value: "high" }]} /></Form.Item></Col>
      </Row>
      <Row gutter={12}>
        <Col xs={24} sm={12}><Form.Item label="Audience" name="audience"><Select options={[{ label: "Tourist", value: "tourist" }, { label: "Resident", value: "resident" }, { label: "Both", value: "both" }]} /></Form.Item></Col>
        <Col xs={24} sm={12}><Form.Item label="Season" name="season"><Select options={[{ label: "High", value: "high" }, { label: "Shoulder", value: "shoulder" }, { label: "Low", value: "low" }]} /></Form.Item></Col>
      </Row>
      <Form.Item label="Editor notes" name="editorNotes"><Input.TextArea rows={3} placeholder="Why it matters, positioning, email angle" /></Form.Item>
      <Form.Item label="Internal notes" name="notes"><Input.TextArea rows={3} placeholder="Operational notes" /></Form.Item>
      <Button type="primary" htmlType="submit" size="large" loading={saving} block>{submitLabel}</Button>
    </Form>
  );

  const columns: ColumnsType<EventRecord> = [
    {
      title: "Event",
      dataIndex: "title",
      key: "title",
      render: (_value, record) => (
        <Space size={12} align="start">
          {record.imageUrl ? <img src={record.imageUrl} alt="" style={{ width: 58, height: 58, objectFit: "cover", borderRadius: 8 }} /> : null}
          <Space direction="vertical" size={2}>
            <Typography.Text strong>{record.title}</Typography.Text>
            <Typography.Text type="secondary">{record.venueName}</Typography.Text>
            <Space size={6} wrap><Tag>{record.subcategory || getEventCategoryLabel(record.category)}</Tag>{record.offerText ? <Tag color="orange">Offer</Tag> : null}{record.passBenefit ? <Tag color="green">Pass</Tag> : null}</Space>
          </Space>
        </Space>
      ),
      sorter: (left, right) => left.title.localeCompare(right.title),
    },
    {
      title: "Date",
      key: "date",
      width: 210,
      render: (_value, record) => <Space direction="vertical" size={2}><Typography.Text strong>{formatEventDate(record)}</Typography.Text><Typography.Text type="secondary">{record.displayTime || formatEventTime(record.startTime)}</Typography.Text></Space>,
      sorter: (left, right) => dayjs(left.dayKey || left.startDate).valueOf() - dayjs(right.dayKey || right.startDate).valueOf(),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: EventStatus) => <Tag color={status === "published" ? "green" : "default"}>{status === "published" ? "Published" : "Draft"}</Tag>,
      filters: [{ text: "Published", value: "published" }, { text: "Draft", value: "draft" }],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: "Editorial",
      key: "editorial",
      ellipsis: true,
      render: (_value, record) => <Space size={[4, 4]} wrap>{record.featuredThisWeek ? <Tag color="blue">This week</Tag> : null}{record.editorialPick ? <Tag color="purple">Editor's pick</Tag> : null}{record.featured ? <Tag color="gold">Featured</Tag> : null}{record.imageUrls?.length ? <Tag>{record.imageUrls.length} images</Tag> : null}<Tag>Order {record.eventOrder}</Tag><Tag>{record.audience}</Tag></Space>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 160,
      fixed: "right",
      render: (_value, record) => <Space><Button icon={<EditOutlined />} onClick={() => handleEdit(record)}>Edit</Button><Popconfirm title="Delete this event?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(record)}><Button danger icon={<DeleteOutlined />} loading={deletingId === record.id} /></Popconfirm></Space>,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Card styles={{ body: { padding: 28 } }} style={{ borderRadius: 24, border: "1px solid rgba(15, 23, 42, 0.06)", boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)" }}>
        <Space direction="vertical" size={8}>
          <Typography.Text type="secondary">Calendar</Typography.Text>
          <Typography.Title level={2} style={{ margin: 0 }}>{mode === "add" ? "Add events" : "Manage events"}</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: 0, maxWidth: 760 }}>{mode === "add" ? "Create calendar events with S3-hosted images, venue links, offers, and editorial metadata." : "Review seeded and newly-added events, update metadata, replace S3 images, and soft-delete stale rows."}</Typography.Paragraph>
        </Space>
      </Card>

      {mode === "add" ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <Card title="Event preview" styles={{ body: { padding: 20 } }} style={{ borderRadius: 20, border: "1px solid rgba(15, 23, 42, 0.06)", boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)", position: "sticky", top: 24 }}>
              <EventListingPreview eventDate={previewValues.startDate} title={previewValues.title} venueName={previewValues.venueName || selectedVenue?.name} category={previewValues.category} description={previewValues.description} imageUrls={eventImageUrls} instagramUrl={previewValues.instagramUrl || getVenueInstagramAccount(selectedVenue)} directionsUrl={previewValues.directionsUrl || getVenueGoogleUrl(selectedVenue)} startTime={previewValues.startTime} displayTime={previewValues.displayTime} />
            </Card>
          </Col>
          <Col xs={24} xl={12}><Card title="Add event" styles={{ body: { padding: 20 } }} style={{ borderRadius: 20, border: "1px solid rgba(15, 23, 42, 0.06)", boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)" }}>{renderEventForm("Add event")}</Card></Col>
        </Row>
      ) : null}

      {mode === "list" ? (
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={8}><Card size="small" style={{ borderRadius: 16 }}><Typography.Text type="secondary">Showing</Typography.Text><Typography.Title level={3} style={{ margin: 0 }}>{summary.total}</Typography.Title></Card></Col>
                <Col xs={24} sm={8}><Card size="small" style={{ borderRadius: 16 }}><Typography.Text type="secondary">Upcoming</Typography.Text><Typography.Title level={3} style={{ margin: 0 }}>{summary.upcoming}</Typography.Title></Card></Col>
                <Col xs={24} sm={8}><Card size="small" style={{ borderRadius: 16 }}><Typography.Text type="secondary">Drafts</Typography.Text><Typography.Title level={3} style={{ margin: 0 }}>{summary.drafts}</Typography.Title></Card></Col>
              </Row>
              <Card title="List all events" styles={{ body: { padding: 20 } }} style={{ borderRadius: 20, border: "1px solid rgba(15, 23, 42, 0.06)", boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)" }}>
                <Space direction="vertical" size={14} style={{ width: "100%" }}><Input.Search allowClear size="large" placeholder="Search events by title, venue, offer, details, or source" value={search} onChange={(event) => setSearch(event.target.value)} /><Segmented block value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} options={[{ label: "Published", value: "published" }, { label: "All", value: "all" }, { label: "Draft", value: "draft" }]} /></Space>
              </Card>
              <Card styles={{ body: { padding: 20 } }} style={{ borderRadius: 20, border: "1px solid rgba(15, 23, 42, 0.06)", boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)" }}>
                {error ? <Alert type="error" showIcon message="Events unavailable" description={error} /> : <Table<EventRecord> rowKey="id" columns={columns} dataSource={events} loading={loading} scroll={{ x: 1020 }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No events match the current filters." /> }} pagination={{ pageSize: 10, showSizeChanger: false }} />}
              </Card>
            </Space>
          </Col>
        </Row>
      ) : null}

      <Modal title={editingEvent ? `Edit ${editingEvent.title}` : "Edit event"} open={editModalOpen} onCancel={() => { setEditModalOpen(false); setEditingEvent(null); form.resetFields(); }} footer={null} width={920} destroyOnHidden>
        {renderEventForm("Save event")}
      </Modal>
    </div>
  );
}
