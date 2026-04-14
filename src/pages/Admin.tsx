import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
  Grid,
  Input,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { TableProps } from "antd";
import { useSearchParams } from "react-router-dom";
import VenueDetail from "./VenueDetail";

import type { Venue } from "../types/venue";

type VenueFilterKey = "all" | "live" | "coming-soon" | "staff-pick";

type CreateVenueFormValues = {
  destinationSlug: string;
  name: string;
  slug: string;
  id?: string;
  live?: boolean;
  status?: string;
  categories?: string[];
};

const CREATE_ENDPOINT = "/.netlify/functions/api-venues-create";
const DELETE_ENDPOINT = "/.netlify/functions/api-venues-delete";
const LIST_ENDPOINT = "/.netlify/functions/api-venues-list";

const categoryOptions = [
  { label: "Eat", value: "eat" },
  { label: "Stays", value: "stays" },
  { label: "Wellness", value: "wellness" },
  { label: "Co-Working", value: "co-working" },
  { label: "Experiences", value: "experiences" },
  { label: "Retail", value: "retail" },
  { label: "Surf", value: "surf" },
  { label: "Transport", value: "transport" },
];

const statusOptions = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

function normalizeId(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatDateTime(value: unknown) {
  if (!value) return "—";

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Card
      size="small"
      styles={{ body: { padding: 16 } }}
      style={{
        borderRadius: 16,
        border: "1px solid rgba(15, 23, 42, 0.08)",
        boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
      }}
    >
      <Typography.Text type="secondary">{label}</Typography.Text>
      <div
        style={{
          marginTop: 8,
          fontSize: 28,
          lineHeight: 1.1,
          fontWeight: 650,
          color: accent,
        }}
      >
        {value}
      </div>
    </Card>
  );
}

export default function Admin() {
  const screens = Grid.useBreakpoint();
  const isDesktop = Boolean(screens.xl);

  const [searchParams, setSearchParams] = useSearchParams();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [search, setSearch] = useState("");
  const [filterKey, setFilterKey] = useState<VenueFilterKey>("all");

  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmValue, setDeleteConfirmValue] = useState("");
  const [createForm] = Form.useForm<CreateVenueFormValues>();
  const [slugDirty, setSlugDirty] = useState(false);
  const [idDirty, setIdDirty] = useState(false);

  const createOpen = searchParams.get("addVenue") === "1";
  const selectedVenueId = normalizeId(searchParams.get("venue"));

  const selectedVenue = useMemo(
    () => venues.find((venue) => normalizeId(venue.id) === selectedVenueId),
    [selectedVenueId, venues],
  );

  useEffect(() => {
    const fetchVenues = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(LIST_ENDPOINT, {
          credentials: "include",
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error || `Failed (${response.status})`);
        }

        setVenues(Array.isArray(data?.venues) ? data.venues : []);
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
    if (!createOpen) {
      createForm.resetFields();
      setSlugDirty(false);
      setIdDirty(false);
    }
  }, [createForm, createOpen]);

  useEffect(() => {
    if (!selectedVenue) {
      setDeleteModalOpen(false);
      setDeleteConfirmValue("");
    }
  }, [selectedVenue]);

  const liveVenueCount = venues.filter(
    (venue) => (venue.live ?? true) === true,
  ).length;
  const comingSoonVenueCount = venues.filter(
    (venue) => venue.live === false,
  ).length;
  const staffPickCount = venues.filter(
    (venue) => venue.staffPick === true,
  ).length;
  const passVenueCount = venues.filter(
    (venue) => venue.isPassVenue === true,
  ).length;

  const venuesByCategoryEntries = useMemo(() => {
    const counts = new Map<string, number>();

    for (const venue of venues) {
      if ((venue.live ?? true) !== true) continue;

      for (const category of Array.isArray(venue.categories)
        ? venue.categories
        : []) {
        const key = String(category).trim().toLowerCase();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return categoryOptions
      .map((option) => [option.label, counts.get(option.value) ?? 0] as const)
      .filter(([, count]) => count > 0);
  }, [venues]);

  const filteredVenues = useMemo(() => {
    const query = search.trim().toLowerCase();

    return venues
      .filter((venue) => {
        if (filterKey === "live" && (venue.live ?? true) !== true) return false;
        if (filterKey === "coming-soon" && venue.live !== false) return false;
        if (filterKey === "staff-pick" && venue.staffPick !== true)
          return false;

        if (!query) return true;

        return [venue.name, venue.slug, venue.id, venue.area]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .slice()
      .sort((a, b) => {
        const aLive = (a.live ?? true) === true ? 1 : 0;
        const bLive = (b.live ?? true) === true ? 1 : 0;

        if (bLive !== aLive) return bLive - aLive;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }, [filterKey, search, venues]);

  const tableColumns: TableProps<Venue>["columns"] = [
    {
      title: "Venue",
      dataIndex: "name",
      render: (_, record) => (
        <Space size={12} align="start">
          {record.logo ? (
            <img
              src={record.logo}
              alt={record.name || "Venue logo"}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                objectFit: "contain",
                background: "#fff",
                border: "1px solid rgba(15, 23, 42, 0.08)",
                padding: 6,
              }}
            />
          ) : (
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "rgba(226, 232, 240, 0.7)",
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                color: "#475569",
                fontWeight: 600,
              }}
            >
              {(record.name || "V").slice(0, 1).toUpperCase()}
            </div>
          )}

          <div>
            <Typography.Text strong style={{ display: "block" }}>
              {record.name || "Untitled venue"}
            </Typography.Text>
            <Typography.Text type="secondary">
              {record.slug || "No slug"}
            </Typography.Text>
            <div style={{ marginTop: 4 }}>
              <Tag bordered={false}>{record.id || "No ID"}</Tag>
              {record.area ? <Tag bordered={false}>{record.area}</Tag> : null}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: "Status",
      width: 130,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Badge
            status={(record.live ?? true) ? "success" : "default"}
            text={(record.live ?? true) ? "Live" : "Coming soon"}
          />
          <Typography.Text type="secondary">
            {record.status || "active"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Categories",
      width: 220,
      render: (_, record) => {
        const categories = Array.isArray(record.categories)
          ? record.categories.slice(0, 2)
          : [];
        const extraCount = Math.max(
          (record.categories?.length ?? 0) - categories.length,
          0,
        );

        if (!categories.length && extraCount === 0) {
          return <Typography.Text type="secondary">—</Typography.Text>;
        }

        return (
          <Space size={[6, 6]} wrap>
            {categories.map((category) => (
              <Tag key={category}>{category}</Tag>
            ))}
            {extraCount > 0 ? <Tag>+{extraCount}</Tag> : null}
          </Space>
        );
      },
    },
    {
      title: "Updated",
      width: 160,
      render: (_, record) => (
        <Typography.Text type="secondary">
          {formatDateTime(record.updatedAt || record.updated_at)}
        </Typography.Text>
      ),
    },
  ];

  const openCreateDrawer = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("addVenue", "1");
      return next;
    });
  };

  const closeCreateDrawer = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("addVenue");
      return next;
    });
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
      if (normalizedSlug !== allValues.slug) {
        createForm.setFieldsValue({ slug: normalizedSlug });
      }
      setSlugDirty(Boolean(normalizedSlug));
      if (!idDirty) createForm.setFieldsValue({ id: normalizedSlug });
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, "id")) {
      const normalizedVenueId = slugify(String(allValues.id || ""));
      if (normalizedVenueId !== allValues.id) {
        createForm.setFieldsValue({ id: normalizedVenueId });
      }
      setIdDirty(Boolean(normalizedVenueId));
    }
  };

  const createVenue = async (values: CreateVenueFormValues) => {
    setCreateSubmitting(true);

    try {
      const payload = {
        destinationSlug: String(values.destinationSlug || "")
          .trim()
          .toLowerCase(),
        name: String(values.name || "").trim(),
        slug: slugify(String(values.slug || "")),
        id: values.id?.trim() ? slugify(values.id) : undefined,
        live: Boolean(values.live),
        status: String(values.status || "active")
          .trim()
          .toLowerCase(),
        categories: Array.isArray(values.categories)
          ? values.categories.map((value) => String(value).trim().toLowerCase())
          : [],
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

      const createdVenue: Venue | undefined = data?.venue;
      if (createdVenue?.id) {
        setVenues((current) => [
          createdVenue,
          ...current.filter(
            (venue) => normalizeId(venue.id) !== normalizeId(createdVenue.id),
          ),
        ]);
        setSearch("");
        setFilterKey("all");
        selectVenue(createdVenue.id);
      }

      message.success("Venue created.");
      closeCreateDrawer();
    } catch (createError) {
      message.error(String((createError as Error)?.message || createError));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleVenueUpdated = (updated: Partial<Venue>) => {
    const updatedId = normalizeId(updated.id);
    if (!updatedId) return;

    setVenues((current) =>
      current.map((venue) =>
        normalizeId(venue.id) === updatedId ? { ...venue, ...updated } : venue,
      ),
    );
  };

  const deleteVenue = async () => {
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

      setVenues((current) =>
        current.filter((venue) => normalizeId(venue.id) !== venueId),
      );
      setDeleteModalOpen(false);
      setDeleteConfirmValue("");
      message.success("Venue deleted.");
    } catch (deleteError) {
      message.error(String((deleteError as Error)?.message || deleteError));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const deleteMatchTarget = selectedVenue?.id || selectedVenue?.name || "";
  const canDelete = deleteConfirmValue.trim() === deleteMatchTarget;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        width: "100%",
        minWidth: 0,
        paddingBottom: 24,
      }}
    >
      <Card
        styles={{ body: { padding: 24 } }}
        style={{
          borderRadius: 20,
          background:
            "linear-gradient(135deg, rgba(255, 251, 235, 0.96), rgba(248, 250, 252, 0.98))",
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
        }}
      >
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col flex="auto">
            <Space direction="vertical" size={6}>
              <Typography.Text type="secondary">Ahangama Admin</Typography.Text>
              <Typography.Title level={2} style={{ margin: 0 }}>
                Venue Management
              </Typography.Title>
              <Typography.Paragraph
                type="secondary"
                style={{ margin: 0, maxWidth: 720 }}
              >
                Manage live listings, content updates, and new venue creation
                from one structured workspace.
              </Typography.Paragraph>
            </Space>
          </Col>

          <Col>
            <Space wrap>
              <Button onClick={refreshVenues}>Refresh</Button>
              <Button type="primary" onClick={openCreateDrawer}>
                Create New Venue
              </Button>
            </Space>
          </Col>
        </Row>

        <Row gutter={[12, 12]} style={{ marginTop: 18 }}>
          <Col xs={12} md={6}>
            <MetricCard
              label="Total venues"
              value={venues.length}
              accent="#0f172a"
            />
          </Col>
          <Col xs={12} md={6}>
            <MetricCard label="Live" value={liveVenueCount} accent="#0f766e" />
          </Col>
          <Col xs={12} md={6}>
            <MetricCard
              label="Coming soon"
              value={comingSoonVenueCount}
              accent="#9a3412"
            />
          </Col>
          <Col xs={12} md={6}>
            <MetricCard
              label="Staff picks"
              value={staffPickCount}
              accent="#7c3aed"
            />
          </Col>
        </Row>

        {venuesByCategoryEntries.length > 0 ? (
          <div style={{ marginTop: 18 }}>
            <Typography.Text type="secondary">Live by category</Typography.Text>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 8,
              }}
            >
              {venuesByCategoryEntries.map(([category, count]) => (
                <Tag key={category} color="gold">
                  {category}: {count}
                </Tag>
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 18 }}
            message="Venue list unavailable"
            description={error}
          />
        ) : null}
      </Card>

      <Row gutter={[24, 24]} align="top">
        <Col xs={24} xl={10}>
          <Card
            title="Venue index"
            extra={
              <Typography.Text type="secondary">
                {filteredVenues.length} results
              </Typography.Text>
            }
            styles={{ body: { padding: 20 } }}
            style={{
              borderRadius: 20,
              border: "1px solid rgba(15, 23, 42, 0.06)",
              boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
            }}
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Input.Search
                allowClear
                placeholder="Search by venue name, slug, id, or area"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{ width: "100%" }}
              />

              <Segmented
                block
                value={filterKey}
                onChange={(value) => setFilterKey(value as VenueFilterKey)}
                options={[
                  { label: "All", value: "all" },
                  { label: "Live", value: "live" },
                  { label: "Coming soon", value: "coming-soon" },
                  { label: "Staff picks", value: "staff-pick" },
                ]}
              />

              <Alert
                type="info"
                showIcon
                message="Structured editing"
                description={`Select a venue to edit its content in the right panel. ${passVenueCount} venues currently have pass access enabled.`}
              />

              <Table<Venue>
                columns={tableColumns}
                dataSource={filteredVenues}
                loading={loading}
                rowKey={(record) =>
                  String(record.id || record.slug || record.name || "venue")
                }
                pagination={{
                  pageSize: 12,
                  showSizeChanger: true,
                  pageSizeOptions: [12, 24, 48],
                }}
                scroll={{ x: 720, y: isDesktop ? 640 : undefined }}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        search || filterKey !== "all"
                          ? "No venues match the current filters."
                          : "No venues yet. Create the first venue to start building the directory."
                      }
                    >
                      <Button type="primary" onClick={openCreateDrawer}>
                        Create New Venue
                      </Button>
                    </Empty>
                  ),
                }}
                onRow={(record) => ({
                  onClick: () => selectVenue(record.id),
                  style: {
                    cursor: "pointer",
                    background:
                      normalizeId(record.id) === selectedVenueId
                        ? "rgba(250, 247, 242, 0.9)"
                        : undefined,
                  },
                })}
              />
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <div
            style={{
              position: isDesktop ? "sticky" : "static",
              top: isDesktop ? 24 : undefined,
            }}
          >
            {selectedVenue ? (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Card
                  styles={{ body: { padding: 24 } }}
                  style={{
                    borderRadius: 20,
                    border: "1px solid rgba(15, 23, 42, 0.06)",
                    boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)",
                  }}
                >
                  <Row gutter={[16, 16]} justify="space-between" align="middle">
                    <Col flex="auto">
                      <Space direction="vertical" size={8}>
                        <Typography.Text type="secondary">
                          Selected venue
                        </Typography.Text>
                        <Typography.Title level={3} style={{ margin: 0 }}>
                          {selectedVenue.name || "Untitled venue"}
                        </Typography.Title>
                        <Space size={[8, 8]} wrap>
                          <Tag bordered={false}>
                            {selectedVenue.id || "No ID"}
                          </Tag>
                          <Tag
                            color={
                              (selectedVenue.live ?? true) ? "green" : "default"
                            }
                          >
                            {(selectedVenue.live ?? true)
                              ? "Live"
                              : "Coming soon"}
                          </Tag>
                          {selectedVenue.status ? (
                            <Tag>{selectedVenue.status}</Tag>
                          ) : null}
                          {selectedVenue.area ? (
                            <Tag>{selectedVenue.area}</Tag>
                          ) : null}
                        </Space>
                        <Typography.Text type="secondary">
                          Last updated{" "}
                          {formatDateTime(
                            selectedVenue.updatedAt || selectedVenue.updated_at,
                          )}
                        </Typography.Text>
                      </Space>
                    </Col>

                    <Col>
                      <Space wrap>
                        <Button onClick={openCreateDrawer}>New venue</Button>
                        <Button danger onClick={() => setDeleteModalOpen(true)}>
                          Delete venue
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>

                <VenueDetail
                  venue={selectedVenue}
                  onVenueUpdated={handleVenueUpdated}
                />
              </Space>
            ) : (
              <Card
                styles={{ body: { padding: 28 } }}
                style={{
                  borderRadius: 20,
                  border: "1px solid rgba(15, 23, 42, 0.06)",
                }}
              >
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Choose a venue from the left panel to review and edit its details."
                >
                  <Button type="primary" onClick={openCreateDrawer}>
                    Create New Venue
                  </Button>
                </Empty>
              </Card>
            )}
          </div>
        </Col>
      </Row>

      <Drawer
        title="Create New Venue"
        placement="right"
        width={460}
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
            live: false,
            status: "active",
            categories: [],
          }}
          onValuesChange={handleCreateValuesChange}
          onFinish={createVenue}
        >
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Alert
              type="info"
              showIcon
              message="Guided creation"
              description="Create the shell record first, then complete imagery, curation, ratings, and location details in the editor workspace."
            />

            <Card size="small" title="Identity" style={{ borderRadius: 16 }}>
              <Form.Item
                label="Destination"
                name="destinationSlug"
                rules={[{ required: true, message: "Destination is required" }]}
              >
                <Input placeholder="ahangama" />
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
                extra="Auto-generated from the venue name until you edit it manually."
                rules={[{ required: true, message: "Slug is required" }]}
              >
                <Input placeholder="palm-hotel" />
              </Form.Item>

              <Form.Item
                label="Venue ID"
                name="id"
                extra="Defaults to the slug. Use only if you need a custom internal ID."
              >
                <Input placeholder="palm-hotel" />
              </Form.Item>
            </Card>

            <Card size="small" title="Visibility" style={{ borderRadius: 16 }}>
              <Form.Item label="Status" name="status">
                <Select options={statusOptions} />
              </Form.Item>

              <Form.Item
                label="Categories"
                name="categories"
                extra="Choose a few key categories so the venue is classified correctly from the start."
              >
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="Select categories"
                  options={categoryOptions}
                />
              </Form.Item>
            </Card>
          </Space>
        </Form>
      </Drawer>

      <Modal
        title="Delete venue"
        open={deleteModalOpen}
        onCancel={() => {
          setDeleteModalOpen(false);
          setDeleteConfirmValue("");
        }}
        onOk={() => void deleteVenue()}
        okText="Delete venue"
        okButtonProps={{
          danger: true,
          disabled: !canDelete,
          loading: deleteSubmitting,
        }}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            This permanently removes the venue record and cannot be undone.
          </Typography.Paragraph>
          <Alert
            type="warning"
            showIcon
            message="Type the venue ID to confirm"
            description={deleteMatchTarget || "No venue selected"}
          />
          <Input
            value={deleteConfirmValue}
            onChange={(event) => setDeleteConfirmValue(event.target.value)}
            placeholder={deleteMatchTarget || "Venue ID"}
          />
        </Space>
      </Modal>
    </div>
  );
}
