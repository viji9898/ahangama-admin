import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Drawer,
  Form,
  Grid,
  Input,
  Select,
  Space,
  Typography,
  message,
} from "antd";
import { useSearchParams } from "react-router-dom";
import type { Venue } from "../../types/venue";
import { VenueBrowserPanel } from "./VenueBrowserPanel";
import { VenueDeleteModal } from "./VenueDeleteModal";
import { VenueEditorPanel } from "./VenueEditorPanel";
import { VenueFocusPanel } from "./VenueFocusPanel";
import { VenueMediaUploadField } from "./VenueMediaUploadField";
import {
  VENUE_CATEGORY_OPTIONS,
  VENUE_STATUS_OPTIONS,
  type VenueFilterKey,
  getVenueCategories,
  getVenueInstagramValue,
  getVenueOffersArray,
  getVenuePrimaryCategory,
  normalizeId,
  normalizeStringArray,
  normalizeText,
  slugify,
  toNullableInteger,
  toNullableNumber,
} from "./venueAdminUtils";

type CreateVenueFormValues = {
  destinationSlug: string;
  category: string;
  name: string;
  slug: string;
  id?: string;
  logo?: string;
  image?: string;
  ogImage?: string;
  live?: boolean;
  status?: string;
};

const CREATE_ENDPOINT = "/.netlify/functions/api-venues-create";
const DELETE_ENDPOINT = "/.netlify/functions/api-venues-delete";
const LIST_ENDPOINT = "/.netlify/functions/api-venues-list";
const UPDATE_ENDPOINT = "/.netlify/functions/api-venues-update";

function buildEditableSnapshot(venue?: Venue) {
  return {
    destinationSlug: normalizeText(venue?.destinationSlug),
    category: normalizeText(getVenuePrimaryCategory(venue)),
    name: normalizeText(venue?.name),
    slug: normalizeText(venue?.slug),
    status: normalizeText(venue?.status) || "draft",
    live: Boolean(venue?.live ?? false),
    area: normalizeText(venue?.area),
    isPassVenue: Boolean(venue?.isPassVenue ?? false),
    staffPick: Boolean(venue?.staffPick ?? false),
    isFeatured: Boolean(venue?.isFeatured ?? false),
    priorityScore: toNullableNumber(venue?.priorityScore) ?? 0,
    passPriority: toNullableNumber(venue?.passPriority) ?? 0,
    editorialTags: normalizeStringArray(venue?.editorialTags),
    excerpt: normalizeText(venue?.excerpt),
    description: normalizeText(venue?.description),
    bestFor: normalizeStringArray(venue?.bestFor),
    tags: normalizeStringArray(venue?.tags),
    cardPerk: normalizeText(venue?.cardPerk),
    offers: getVenueOffersArray(venue?.offers),
    howToClaim: normalizeText(venue?.howToClaim),
    restrictions: normalizeText(venue?.restrictions),
    stars: toNullableNumber(venue?.stars),
    reviews: toNullableInteger(venue?.reviews),
    discount: toNullableNumber(venue?.discount),
    price: normalizeText(venue?.price),
    hours: normalizeText(venue?.hours),
    lat: toNullableNumber(venue?.lat),
    lng: toNullableNumber(venue?.lng),
    mapUrl: normalizeText(venue?.mapUrl),
    googlePlaceId: normalizeText(venue?.googlePlaceId),
    whatsapp: normalizeText(venue?.whatsapp),
    email: normalizeText(venue?.email),
    instagram: normalizeText(getVenueInstagramValue(venue)),
    logo: normalizeText(venue?.logo),
    image: normalizeText(venue?.image),
    ogImage: normalizeText(venue?.ogImage),
  };
}

function buildUpdatePayload(
  original: ReturnType<typeof buildEditableSnapshot>,
  current: ReturnType<typeof buildEditableSnapshot>,
) {
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(current)) {
    const previous = original[key as keyof typeof original];
    const changed =
      Array.isArray(value) || Array.isArray(previous)
        ? JSON.stringify(value) !== JSON.stringify(previous)
        : value !== previous;

    if (!changed) continue;
    payload[key] = value;
  }

  return payload;
}

function mergeVenueUpdate(venue: Venue) {
  const next = { ...venue };
  const category = getVenuePrimaryCategory(venue);
  if (category) next.categories = [category];
  if (next.instagram && !next.instagramUrl) {
    next.instagramUrl = next.instagram;
  }
  return next;
}

export function VenueAdminPage() {
  const screens = Grid.useBreakpoint();
  const [searchParams, setSearchParams] = useSearchParams();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [draftVenue, setDraftVenue] = useState<Venue | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterKey, setFilterKey] = useState<VenueFilterKey>("all");
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(
    undefined,
  );
  const [reloadToken, setReloadToken] = useState(0);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmValue, setDeleteConfirmValue] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [focusDrawerOpen, setFocusDrawerOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm] = Form.useForm<CreateVenueFormValues>();
  const [slugDirty, setSlugDirty] = useState(false);
  const [idDirty, setIdDirty] = useState(false);
  const createSlug = Form.useWatch("slug", createForm);
  const createId = Form.useWatch("id", createForm);
  const createLogo = Form.useWatch("logo", createForm);
  const createImage = Form.useWatch("image", createForm);
  const createOgImage = Form.useWatch("ogImage", createForm);

  const createOpen = searchParams.get("addVenue") === "1";
  const selectedVenueId = normalizeId(searchParams.get("venue"));
  const createVenueId = normalizeId(createId || createSlug);

  const selectedVenue = useMemo(
    () => venues.find((venue) => normalizeId(venue.id) === selectedVenueId),
    [selectedVenueId, venues],
  );

  useEffect(() => {
    const fetchVenues = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(LIST_ENDPOINT, { credentials: "include" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || `Failed (${response.status})`);
        }
        setVenues(
          Array.isArray(data?.venues) ? data.venues.map(mergeVenueUpdate) : [],
        );
      } catch (fetchError) {
        setError(String((fetchError as Error)?.message || fetchError));
      } finally {
        setLoading(false);
      }
    };

    void fetchVenues();
  }, [reloadToken]);

  useEffect(() => {
    if (loading) return;

    const hasSelectedVenue = venues.some(
      (venue) => normalizeId(venue.id) === selectedVenueId,
    );
    if (hasSelectedVenue) return;

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const fallbackId = normalizeId(venues[0]?.id);
      if (fallbackId) next.set("venue", fallbackId);
      else next.delete("venue");
      return next;
    });
  }, [loading, selectedVenueId, setSearchParams, venues]);

  useEffect(() => {
    setDraftVenue(selectedVenue ? mergeVenueUpdate(selectedVenue) : undefined);
    setSaveState("idle");
  }, [selectedVenue]);

  useEffect(() => {
    if (!createOpen) {
      createForm.resetFields();
      setSlugDirty(false);
      setIdDirty(false);
    }
  }, [createForm, createOpen]);

  useEffect(() => {
    if (saveState !== "saved") return;
    const timer = window.setTimeout(() => setSaveState("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [saveState]);

  const counts = useMemo(() => {
    const total = venues.length;
    const live = venues.filter((venue) => venue.live === true).length;
    const comingSoon = venues.filter((venue) => venue.live === false).length;
    return { total, live, comingSoon };
  }, [venues]);

  const categoryOptions = useMemo(() => {
    const dynamicCategories = Array.from(
      new Set(venues.flatMap((venue) => getVenueCategories(venue))),
    )
      .filter(Boolean)
      .map((value) => ({ label: value, value }));

    const merged = [...VENUE_CATEGORY_OPTIONS, ...dynamicCategories];
    return merged.filter(
      (option, index) =>
        merged.findIndex((candidate) => candidate.value === option.value) ===
        index,
    );
  }, [venues]);

  const filteredVenues = useMemo(() => {
    const query = search.trim().toLowerCase();

    return venues
      .filter((venue) => {
        if (filterKey === "live" && venue.live !== true) return false;
        if (filterKey === "coming-soon" && venue.live !== false) return false;
        if (filterKey === "staff-pick" && venue.staffPick !== true)
          return false;

        if (categoryFilter) {
          const categories = getVenueCategories(venue).map((item) =>
            item.toLowerCase(),
          );
          if (!categories.includes(categoryFilter.toLowerCase())) return false;
        }

        if (!query) return true;

        const searchable = [
          venue.name,
          venue.slug,
          venue.id,
          venue.area,
          venue.excerpt,
          ...getVenueCategories(venue),
          ...(venue.tags || []),
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());

        return searchable.some((value) => value.includes(query));
      })
      .slice()
      .sort((a, b) => {
        const featuredDelta =
          Number(b.isFeatured ?? false) - Number(a.isFeatured ?? false);
        if (featuredDelta !== 0) return featuredDelta;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }, [categoryFilter, filterKey, search, venues]);

  const originalSnapshot = useMemo(
    () => buildEditableSnapshot(selectedVenue),
    [selectedVenue],
  );
  const draftSnapshot = useMemo(
    () => buildEditableSnapshot(draftVenue),
    [draftVenue],
  );
  const dirty = Boolean(
    selectedVenue &&
    JSON.stringify(originalSnapshot) !== JSON.stringify(draftSnapshot),
  );

  const patchVenue = async (payload: Record<string, unknown>) => {
    const response = await fetch(UPDATE_ENDPOINT, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok !== true) {
      throw new Error(data?.error || `Failed (${response.status})`);
    }
    return mergeVenueUpdate((data?.venue || {}) as Venue);
  };

  const selectVenue = (venueId?: string) => {
    const normalized = normalizeId(venueId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (normalized) next.set("venue", normalized);
      else next.delete("venue");
      return next;
    });
  };

  const refreshVenues = () => {
    setReloadToken((current) => current + 1);
  };

  const updateVenueInState = (updated: Venue) => {
    const updatedId = normalizeId(updated.id);
    if (!updatedId) return;
    setVenues((current) =>
      current.map((venue) =>
        normalizeId(venue.id) === updatedId
          ? mergeVenueUpdate({ ...venue, ...updated })
          : venue,
      ),
    );
    if (normalizeId(selectedVenue?.id) === updatedId) {
      setDraftVenue(
        mergeVenueUpdate({
          ...(draftVenue || selectedVenue || {}),
          ...updated,
        }),
      );
    }
  };

  const handleDraftPatch = (patch: Partial<Venue>) => {
    setDraftVenue((current) =>
      current ? mergeVenueUpdate({ ...current, ...patch }) : current,
    );
    if (saveState !== "idle") setSaveState("idle");
  };

  const handleCancelDraft = () => {
    setDraftVenue(selectedVenue ? mergeVenueUpdate(selectedVenue) : undefined);
    setSaveState("idle");
  };

  const handleSave = async () => {
    const venueId = normalizeId(selectedVenue?.id);
    if (!venueId || !selectedVenue || !draftVenue) {
      message.error("No venue selected.");
      return;
    }

    const payload = buildUpdatePayload(originalSnapshot, draftSnapshot);
    if (Object.keys(payload).length === 0) {
      message.info("No changes to save.");
      return;
    }

    setSaving(true);
    setSaveState("saving");
    try {
      const updated = await patchVenue({ id: venueId, ...payload });
      updateVenueInState(updated);
      setSaveState("saved");
      message.success("Venue updated.");
    } catch (saveError) {
      setSaveState("idle");
      message.error(String((saveError as Error)?.message || saveError));
    } finally {
      setSaving(false);
    }
  };

  const openCreateDrawer = (prefill?: Partial<CreateVenueFormValues>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("addVenue", "1");
      return next;
    });

    window.setTimeout(() => {
      createForm.setFieldsValue({
        destinationSlug: "ahangama",
        status: "draft",
        live: false,
        ...prefill,
      });
    }, 0);
  };

  const closeCreateDrawer = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("addVenue");
      return next;
    });
  };

  const handleCreateValuesChange = (
    changedValues: Partial<{ name: string; slug: string; id: string }>,
    allValues: CreateVenueFormValues,
  ) => {
    if (
      Object.prototype.hasOwnProperty.call(changedValues, "name") &&
      !slugDirty
    ) {
      const generatedSlug = slugify(String(allValues.name || ""));
      createForm.setFieldsValue({
        slug: generatedSlug,
        ...(idDirty ? {} : { id: generatedSlug }),
      });
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, "slug")) {
      const normalizedSlug = slugify(String(allValues.slug || ""));
      if (normalizedSlug !== allValues.slug)
        createForm.setFieldsValue({ slug: normalizedSlug });
      setSlugDirty(Boolean(normalizedSlug));
      if (!idDirty) createForm.setFieldsValue({ id: normalizedSlug });
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, "id")) {
      const normalizedId = slugify(String(allValues.id || ""));
      if (normalizedId !== allValues.id)
        createForm.setFieldsValue({ id: normalizedId });
      setIdDirty(Boolean(normalizedId));
    }
  };

  const handleCreateVenue = async (values: CreateVenueFormValues) => {
    setCreateSubmitting(true);
    try {
      const category = normalizeText(values.category).toLowerCase();
      const payload = {
        destinationSlug: normalizeText(values.destinationSlug).toLowerCase(),
        category,
        categories: category ? [category] : [],
        name: normalizeText(values.name),
        slug: slugify(values.slug || ""),
        id: values.id?.trim() ? slugify(values.id) : undefined,
        logo: normalizeText(values.logo) || null,
        image: normalizeText(values.image) || null,
        ogImage: normalizeText(values.ogImage) || null,
        live: Boolean(values.live),
        status: normalizeText(values.status).toLowerCase() || "draft",
      };

      const response = await fetch(CREATE_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok !== true) {
        throw new Error(data?.error || `Failed (${response.status})`);
      }

      const created = mergeVenueUpdate((data?.venue || {}) as Venue);
      setVenues((current) => [
        created,
        ...current.filter(
          (venue) => normalizeId(venue.id) !== normalizeId(created.id),
        ),
      ]);
      closeCreateDrawer();
      selectVenue(created.id);
      setSearch("");
      setCategoryFilter(undefined);
      setFilterKey("all");
      message.success("Venue created.");
    } catch (createError) {
      message.error(String((createError as Error)?.message || createError));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleDuplicate = () => {
    if (!selectedVenue) return;
    const baseSlug = slugify(
      `${selectedVenue.slug || selectedVenue.name || "venue"}-copy`,
    );
    openCreateDrawer({
      destinationSlug: selectedVenue.destinationSlug || "ahangama",
      category: getVenuePrimaryCategory(selectedVenue),
      name: `${selectedVenue.name || "Venue"} Copy`,
      slug: baseSlug,
      id: baseSlug,
      logo: selectedVenue.logo,
      image: selectedVenue.image,
      ogImage: selectedVenue.ogImage,
      status: "draft",
      live: false,
    });
  };

  const handlePreview = () => {
    if (!selectedVenue?.mapUrl) {
      message.info("No preview URL available for this venue.");
      return;
    }
    window.open(selectedVenue.mapUrl, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async () => {
    const venueId = normalizeId(selectedVenue?.id);
    if (!venueId) {
      message.error("Missing venue id");
      return;
    }

    setDeleteSubmitting(true);
    try {
      const response = await fetch(
        `${DELETE_ENDPOINT}?id=${encodeURIComponent(venueId)}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok !== true) {
        throw new Error(data?.error || `Failed (${response.status})`);
      }

      const remainingVenues = venues.filter(
        (venue) => normalizeId(venue.id) !== venueId,
      );
      setVenues(remainingVenues);
      setFocusDrawerOpen(false);
      setDeleteModalOpen(false);
      setDeleteConfirmValue("");
      message.success("Venue deleted.");

      const fallbackId = normalizeId(remainingVenues[0]?.id);
      selectVenue(fallbackId);
    } catch (deleteError) {
      message.error(String((deleteError as Error)?.message || deleteError));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const gridTemplateColumns = screens.lg
    ? "minmax(320px, 0.95fr) minmax(420px, 1.35fr)"
    : "1fr";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        width: "100%",
        minWidth: 0,
      }}
    >
      <Card
        styles={{ body: { padding: 24 } }}
        style={{
          borderRadius: 24,
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
          background:
            "linear-gradient(135deg, rgba(255,251,235,0.96), rgba(248,250,252,0.98))",
        }}
      >
        <Space
          style={{ width: "100%", justifyContent: "space-between" }}
          align="start"
          wrap
        >
          <div>
            <Typography.Text type="secondary">Ahangama Admin</Typography.Text>
            <Typography.Title level={2} style={{ margin: "4px 0 8px" }}>
              Venue Curation Workspace
            </Typography.Title>
            <Typography.Paragraph
              type="secondary"
              style={{ margin: 0, maxWidth: 760 }}
            >
              Browse the venue library, open the selected venue in a focus
              drawer when you need a richer snapshot, and edit content directly
              in a live editor.
            </Typography.Paragraph>
          </div>

          <Space>
            <Button
              onClick={() => setFocusDrawerOpen(true)}
              disabled={!selectedVenue}
            >
              Open Focus
            </Button>
            <Button onClick={refreshVenues}>Refresh</Button>
            <Button type="primary" onClick={() => openCreateDrawer()}>
              Create New Venue
            </Button>
          </Space>
        </Space>
      </Card>

      {error ? (
        <Alert
          type="error"
          showIcon
          message="Venue data unavailable"
          description={error}
        />
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns,
          gap: 24,
          alignItems: "start",
        }}
      >
        <div style={{ position: screens.xl ? "sticky" : "static", top: 24 }}>
          <VenueBrowserPanel
            venues={filteredVenues}
            selectedVenueId={selectedVenueId}
            search={search}
            filterKey={filterKey}
            categoryFilter={categoryFilter}
            counts={{
              total: counts.total,
              live: counts.live,
              comingSoon: counts.comingSoon,
              results: filteredVenues.length,
            }}
            categoryOptions={categoryOptions}
            loading={loading}
            error={error}
            onSearchChange={setSearch}
            onFilterChange={setFilterKey}
            onCategoryChange={setCategoryFilter}
            onSelectVenue={selectVenue}
            onCreateVenue={() => openCreateDrawer()}
          />
        </div>

        <div style={{ position: screens.xl ? "sticky" : "static", top: 24 }}>
          <VenueEditorPanel
            venue={draftVenue}
            categoryOptions={categoryOptions}
            dirty={dirty}
            saving={saving}
            saveState={saveState}
            onPatch={handleDraftPatch}
            onCancel={handleCancelDraft}
            onSave={handleSave}
            onCreate={() => openCreateDrawer()}
          />
        </div>
      </div>

      <Drawer
        title="Create New Venue"
        placement="right"
        width={420}
        open={createOpen}
        onClose={closeCreateDrawer}
        destroyOnClose
        footer={
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <Button
              onClick={() => {
                createForm.resetFields();
                setSlugDirty(false);
                setIdDirty(false);
              }}
            >
              Reset
            </Button>
            <Space>
              <Button onClick={closeCreateDrawer}>Cancel</Button>
              <Button
                type="primary"
                loading={createSubmitting}
                onClick={() => createForm.submit()}
              >
                Create venue
              </Button>
            </Space>
          </Space>
        }
      >
        <Form<CreateVenueFormValues>
          form={createForm}
          layout="vertical"
          initialValues={{
            destinationSlug: "ahangama",
            category: "eat",
            live: false,
            status: "draft",
          }}
          onValuesChange={handleCreateValuesChange}
          onFinish={handleCreateVenue}
        >
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Alert
              type="info"
              showIcon
              message="Create with media already attached"
              description="You can upload logo, hero, and OG images before creating the venue. Uploads are stored under the current venue ID or slug."
            />

            <Card size="small" title="Identity" style={{ borderRadius: 18 }}>
              <Form.Item
                label="Destination slug"
                name="destinationSlug"
                rules={[{ required: true, message: "Destination is required" }]}
              >
                <Input placeholder="ahangama" />
              </Form.Item>
              <Form.Item
                label="Category"
                name="category"
                rules={[{ required: true, message: "Category is required" }]}
              >
                <Select options={categoryOptions} />
              </Form.Item>
              <Form.Item
                label="Venue name"
                name="name"
                rules={[{ required: true, message: "Name is required" }]}
              >
                <Input placeholder="Palm Hotel" />
              </Form.Item>
              <Form.Item
                label="Slug"
                name="slug"
                rules={[{ required: true, message: "Slug is required" }]}
                extra="Auto-generated from the venue name until you edit it manually."
              >
                <Input placeholder="palm-hotel" />
              </Form.Item>
              <Form.Item
                label="Venue ID"
                name="id"
                extra="Defaults to the slug."
              >
                <Input placeholder="palm-hotel" />
              </Form.Item>
            </Card>

            <Card size="small" title="Visibility" style={{ borderRadius: 18 }}>
              <Form.Item label="Status" name="status">
                <Select options={VENUE_STATUS_OPTIONS} />
              </Form.Item>
            </Card>

            <Card size="small" title="Media" style={{ borderRadius: 18 }}>
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Typography.Text type="secondary">
                  Uploads use the venue ID shown above. Changing the ID later will not move files that were already uploaded.
                </Typography.Text>

                <VenueMediaUploadField
                  kind="image"
                  venueId={createVenueId}
                  value={createImage}
                  compact
                  onUploaded={(url) => createForm.setFieldsValue({ image: url })}
                />
                <VenueMediaUploadField
                  kind="logo"
                  venueId={createVenueId}
                  value={createLogo}
                  compact
                  onUploaded={(url) => createForm.setFieldsValue({ logo: url })}
                />
                <VenueMediaUploadField
                  kind="ogImage"
                  venueId={createVenueId}
                  value={createOgImage}
                  compact
                  onUploaded={(url) => createForm.setFieldsValue({ ogImage: url })}
                />

                <Form.Item label="Logo URL" name="logo">
                  <Input placeholder="https://..." />
                </Form.Item>
                <Form.Item label="Hero image URL" name="image">
                  <Input placeholder="https://..." />
                </Form.Item>
                <Form.Item label="OG image URL" name="ogImage">
                  <Input placeholder="https://..." />
                </Form.Item>
              </Space>
            </Card>
          </Space>
        </Form>
      </Drawer>

      <Drawer
        title={selectedVenue?.name || "Venue Focus"}
        placement="left"
        width={screens.md ? 560 : "100%"}
        open={focusDrawerOpen}
        onClose={() => setFocusDrawerOpen(false)}
      >
        <VenueFocusPanel
          venue={selectedVenue}
          onPreview={handlePreview}
          onDuplicate={handleDuplicate}
          onDelete={() => setDeleteModalOpen(true)}
          onCreate={() => openCreateDrawer()}
        />
      </Drawer>

      <VenueDeleteModal
        open={deleteModalOpen}
        venue={selectedVenue}
        confirmValue={deleteConfirmValue}
        deleting={deleteSubmitting}
        onChangeConfirmValue={setDeleteConfirmValue}
        onCancel={() => {
          setDeleteModalOpen(false);
          setDeleteConfirmValue("");
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
