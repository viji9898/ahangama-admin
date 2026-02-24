import { useEffect, useMemo, useState } from "react";
import VenueDetail from "./VenueDetail";

import {
  Badge,
  Button,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import { useSearchParams } from "react-router-dom";

import type { Venue } from "../types/venue";

export default function Admin() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedVenue, setSelectedVenue] = useState<Venue | undefined>(
    undefined,
  );
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addForm] = Form.useForm();

  const addOpen = searchParams.get("addVenue") === "1";

  useEffect(() => {
    const fetchVenues = async () => {
      setLoading(true);
      setError("");
      try {
        const r = await fetch("/.netlify/functions/api-venues-list", {
          credentials: "include",
        });
        const data = await r.json();
        setVenues(data.venues || []);
      } catch {
        setError("Failed to load venues");
      } finally {
        setLoading(false);
      }
    };
    fetchVenues();
  }, []);

  useEffect(() => {
    if (!addOpen) addForm.resetFields();
  }, [addOpen, addForm]);

  const openAddModal = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("addVenue", "1");
      return next;
    });
  };

  const closeAddModal = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("addVenue");
      return next;
    });
  };

  const createVenue = async (values: {
    destinationSlug: string;
    name: string;
    slug: string;
    id?: string;
  }) => {
    setAddSubmitting(true);
    try {
      const payload = {
        destinationSlug: String(values.destinationSlug || "")
          .trim()
          .toLowerCase(),
        name: String(values.name || "").trim(),
        slug: String(values.slug || "")
          .trim()
          .toLowerCase(),
        id: values.id?.trim() ? values.id.trim().toLowerCase() : undefined,
        live: false,
        status: "active",
      };

      const r = await fetch("/.netlify/functions/api-venues-create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.ok !== true) {
        throw new Error(data?.error || `Failed (${r.status})`);
      }

      const created: Venue | undefined = data?.venue;
      if (created?.id) {
        setVenues((prev) => [
          created,
          ...prev.filter((v) => v.id !== created.id),
        ]);
        setSelectedVenue(created);
      }
      message.success("Venue created.");
      closeAddModal();
    } catch (e) {
      message.error(String((e as Error)?.message || e));
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleVenueUpdated = (updated: Partial<Venue>) => {
    const updatedId = String(updated?.id || "").trim();
    if (!updatedId) return;

    setVenues((prev) =>
      prev.map((v) => (v.id === updatedId ? { ...v, ...updated } : v)),
    );
    setSelectedVenue((prev) =>
      prev?.id === updatedId ? { ...prev, ...updated } : prev,
    );
  };

  const liveVenueCount = venues.filter((v) => (v.live ?? true) === true).length;
  const onlineVenueCount = venues.filter((v) => v.live === false).length;

  const tableVenues = useMemo(() => {
    const filtered = venues.filter((v) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        v.name?.toLowerCase().includes(q) ||
        v.slug?.toLowerCase().includes(q) ||
        v.id?.toLowerCase().includes(q)
      );
    });

    return filtered.slice().sort((a, b) => {
      const aLive = (a.live ?? true) === true ? 1 : 0;
      const bLive = (b.live ?? true) === true ? 1 : 0;
      return bLive - aLive;
    });
  }, [venues, search]);

  const venuesByCategoryEntries = useMemo(() => {
    const desired = [
      { key: "eat", label: "eat" },
      { key: "stays", label: "stays" },
      { key: "wellness", label: "wellness" },
      { key: "co-working", label: "Co-Working" },
      { key: "experiences", label: "Experiences" },
      { key: "retail", label: "retail" },
      { key: "surf", label: "surf" },
      { key: "transport", label: "Transport" },
    ];

    const counts = new Map<string, number>();
    for (const venue of venues) {
      const isLive = (venue.live ?? true) === true;
      if (!isLive) continue;

      const categories = Array.isArray(venue.categories)
        ? venue.categories
        : [];
      for (const cat of categories) {
        const key = String(cat).trim().toLowerCase();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return desired
      .map((d) => [d.label, counts.get(d.key) ?? 0] as const)
      .filter(([, n]) => n > 0);
  }, [venues]);

  return (
    <div
      style={{
        flexDirection: "column",
        gap: 16,
        width: "100%",
        display: "flex",
        maxWidth: "100vw",
        overflowX: "hidden",
      }}
    >
      <div style={{ width: "100%" }}>
        {error && <div style={{ color: "red", marginBottom: 8 }}>{error}</div>}
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Input
            placeholder="Search venues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 360 }}
          />
          <div style={{ fontSize: 12, color: "#888" }}>
            Live venues: <b>{liveVenueCount}</b>
            <span style={{ margin: "0 8px" }}>•</span>
            Coming Soon: <b>{onlineVenueCount}</b>
            <div style={{ marginTop: 4 }}>
              <div style={{ maxWidth: 720 }}>
                <div style={{ marginBottom: 4 }}>Live by category:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {venuesByCategoryEntries.length === 0 ? (
                    <span>—</span>
                  ) : (
                    venuesByCategoryEntries.map(([cat, n], idx) => {
                      const colors = [
                        "magenta",
                        "red",
                        "volcano",
                        "orange",
                        "gold",
                        "lime",
                        "green",
                        "cyan",
                        "blue",
                        "geekblue",
                        "purple",
                      ] as const;
                      return (
                        <Tag key={cat} color={colors[idx % colors.length]}>
                          {cat}: {n}
                        </Tag>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
          <Button type="primary" onClick={openAddModal}>
            Add Venue
          </Button>
        </Space>
      </div>

      <div
        style={{
          display: "flex",
          gap: 22,
          width: "100%",
          maxWidth: "100vw",
          overflowX: "hidden",
        }}
      >
        <div style={{ flex: 1, minWidth: 320, maxWidth: "40vw" }}>
          <Table<Venue>
            dataSource={tableVenues}
            rowKey="id"
            loading={loading}
            style={{ marginTop: 20, maxWidth: "40vw" }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
            }}
            scroll={{ y: 600 }}
            onRow={(record) => ({
              onClick: () => setSelectedVenue(record),
              style: { cursor: "pointer" },
            })}
          >
            <Table.Column<Venue>
              title="Live"
              dataIndex="live"
              width={60}
              render={(_, record) => (
                <span style={{ fontSize: 22, lineHeight: 1 }}>
                  <Badge status={(record.live ?? true) ? "success" : "error"} />
                </span>
              )}
            />
            <Table.Column<Venue>
              title="Logo"
              dataIndex="logo"
              width={75}
              render={(logo) =>
                logo ? (
                  <img
                    src={logo}
                    alt="logo"
                    style={{
                      width: 28,
                      height: 28,
                      objectFit: "contain",
                      borderRadius: 4,
                    }}
                  />
                ) : null
              }
            />
            <Table.Column<Venue> title="Name" dataIndex="name" />

            {/* <Table.Column<Venue> title="ID" dataIndex="id" />
          <Table.Column<Venue> title="Slug" dataIndex="slug" /> */}
            <Table.Column<Venue>
              title="Categories"
              dataIndex="categories"
              render={(cats?: string[]) =>
                cats && cats.length
                  ? cats.map((c: string) => <Tag key={c}>{c}</Tag>)
                  : null
              }
            />
          </Table>
        </div>

        <div style={{ flex: 1, minWidth: 400, maxWidth: "50vw" }}>
          <VenueDetail
            venue={selectedVenue}
            onVenueUpdated={handleVenueUpdated}
          />
        </div>
      </div>

      <Modal
        title="Add New Venue"
        open={addOpen}
        onCancel={closeAddModal}
        footer={null}
        destroyOnClose
      >
        <Form
          form={addForm}
          layout="vertical"
          initialValues={{ destinationSlug: "ahangama" }}
          onFinish={createVenue}
        >
          <Form.Item
            label="Destination"
            name="destinationSlug"
            rules={[{ required: true, message: "Destination is required" }]}
          >
            <Input placeholder="ahangama" />
          </Form.Item>

          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: "Name is required" }]}
          >
            <Input placeholder="Venue name" />
          </Form.Item>

          <Form.Item
            label="Slug"
            name="slug"
            rules={[{ required: true, message: "Slug is required" }]}
          >
            <Input placeholder="e.g. cafe-123" />
          </Form.Item>

          <Form.Item label="ID (optional)" name="id">
            <Input placeholder="Defaults to slug" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={addSubmitting}>
            Create
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
