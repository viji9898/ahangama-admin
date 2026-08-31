import {
  CheckCircleOutlined,
  InstagramOutlined,
  MailOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  WhatsAppOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Input,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { TableColumnsType } from "antd";
import { useEffect, useMemo, useState } from "react";
import type { Venue } from "../types/venue";

const LIST_ENDPOINT = "/.netlify/functions/api-venues-list";
const UPDATE_ENDPOINT = "/.netlify/functions/api-venues-update";

type ContactDraft = {
  email: string;
  whatsapp: string;
  instagram: string;
};

function contactDraft(venue: Venue): ContactDraft {
  return {
    email: String(venue.email || ""),
    whatsapp: String(venue.whatsapp || ""),
    instagram: String(venue.instagram || ""),
  };
}

function normalizeContact(value?: string) {
  return String(value || "").trim();
}

function formatContactUpdatedAt(value?: string) {
  if (!value) return "Contact info not updated yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Contact update date unavailable";
  return `Contact updated ${new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)}`;
}

export default function VenueContactInfo() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ContactDraft>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const loadVenues = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(LIST_ENDPOINT, {
          credentials: "include",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data?.ok !== true) {
          throw new Error(data?.error || `Failed (${response.status})`);
        }

        const nextVenues = (data.venues || []) as Venue[];
        setVenues(nextVenues);
        setDrafts(
          Object.fromEntries(
            nextVenues
              .filter((venue) => venue.id)
              .map((venue) => [venue.id as string, contactDraft(venue)]),
          ),
        );
      } catch (loadError) {
        if ((loadError as Error)?.name !== "AbortError") {
          setError(String((loadError as Error)?.message || loadError));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadVenues();
    return () => controller.abort();
  }, [reloadToken]);

  const filteredVenues = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return venues;
    return venues.filter((venue) =>
      [
        venue.name,
        venue.area,
        venue.category,
        venue.email,
        venue.whatsapp,
        venue.instagram,
      ].some((value) => String(value || "").toLowerCase().includes(query)),
    );
  }, [search, venues]);

  const updateDraft = (
    venueId: string,
    field: keyof ContactDraft,
    value: string,
  ) => {
    setDrafts((current) => ({
      ...current,
      [venueId]: {
        ...(current[venueId] || { email: "", whatsapp: "", instagram: "" }),
        [field]: value,
      },
    }));
  };

  const isDirty = (venue: Venue) => {
    if (!venue.id || !drafts[venue.id]) return false;
    const original = contactDraft(venue);
    const draft = drafts[venue.id];
    return (Object.keys(original) as Array<keyof ContactDraft>).some(
      (field) =>
        normalizeContact(original[field]) !== normalizeContact(draft[field]),
    );
  };

  const saveVenue = async (venue: Venue) => {
    const venueId = venue.id;
    if (!venueId || !drafts[venueId]) return;

    const draft = drafts[venueId];
    const payload = {
      id: venueId,
      email: normalizeContact(draft.email),
      whatsapp: normalizeContact(draft.whatsapp),
      instagram: normalizeContact(draft.instagram),
    };

    setSavingIds((current) => new Set(current).add(venueId));
    try {
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

      const updated = data.venue as Venue;
      setVenues((current) =>
        current.map((item) => (item.id === venueId ? updated : item)),
      );
      setDrafts((current) => ({
        ...current,
        [venueId]: contactDraft(updated),
      }));
      message.success(`${updated.name || venue.name || "Venue"} updated.`);
    } catch (saveError) {
      message.error(String((saveError as Error)?.message || saveError));
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(venueId);
        return next;
      });
    }
  };

  const columns: TableColumnsType<Venue> = [
    {
      title: "Venue",
      dataIndex: "name",
      fixed: "left",
      width: 230,
      sorter: (left, right) =>
        String(left.name || "").localeCompare(String(right.name || "")),
      render: (_, venue) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{venue.name || "Unnamed venue"}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {[venue.area, venue.category].filter(Boolean).join(" · ") || "No area"}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {formatContactUpdatedAt(venue.contactUpdatedAt)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Email",
      width: 280,
      render: (_, venue) => (
        <Input
          type="email"
          prefix={<MailOutlined />}
          placeholder="hello@venue.com"
          value={venue.id ? drafts[venue.id]?.email || "" : ""}
          onChange={(event) =>
            venue.id && updateDraft(venue.id, "email", event.target.value)
          }
        />
      ),
    },
    {
      title: "WhatsApp",
      width: 240,
      render: (_, venue) => (
        <Input
          prefix={<WhatsAppOutlined />}
          placeholder="+94 77 123 4567"
          value={venue.id ? drafts[venue.id]?.whatsapp || "" : ""}
          onChange={(event) =>
            venue.id && updateDraft(venue.id, "whatsapp", event.target.value)
          }
        />
      ),
    },
    {
      title: "Instagram",
      width: 260,
      render: (_, venue) => (
        <Input
          prefix={<InstagramOutlined />}
          placeholder="@venue or profile URL"
          value={venue.id ? drafts[venue.id]?.instagram || "" : ""}
          onChange={(event) =>
            venue.id && updateDraft(venue.id, "instagram", event.target.value)
          }
        />
      ),
    },
    {
      title: "Status",
      width: 120,
      align: "center",
      render: (_, venue) => {
        const complete = venue.id
          ? Object.values(drafts[venue.id] || {}).filter((value) =>
              normalizeContact(value),
            ).length
          : 0;
        return complete === 3 ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>
            Complete
          </Tag>
        ) : (
          <Tag>{complete}/3</Tag>
        );
      },
    },
    {
      title: "",
      fixed: "right",
      width: 110,
      align: "right",
      render: (_, venue) => (
        <Button
          type="primary"
          icon={<SaveOutlined />}
          disabled={!isDirty(venue)}
          loading={Boolean(venue.id && savingIds.has(venue.id))}
          onClick={() => void saveVenue(venue)}
        >
          Save
        </Button>
      ),
    },
  ];

  const completeCount = venues.filter((venue) => {
    const draft = venue.id ? drafts[venue.id] : undefined;
    return draft && Object.values(draft).every((value) => normalizeContact(value));
  }).length;

  return (
    <Space direction="vertical" size={18} style={{ width: "100%" }}>
      <Space
        align="end"
        wrap
        style={{ width: "100%", justifyContent: "space-between" }}
      >
        <div>
          <Typography.Text type="secondary">Venues</Typography.Text>
          <Typography.Title level={2} style={{ margin: "2px 0 0" }}>
            Contact Info
          </Typography.Title>
        </div>
        <Space>
          <Tag color="green">{completeCount} complete</Tag>
          <Tag>{venues.length - completeCount} need details</Tag>
        </Space>
      </Space>

      {error ? (
        <Alert
          type="error"
          showIcon
          message="Venue contacts unavailable"
          description={error}
          action={
            <Button size="small" onClick={() => setReloadToken((value) => value + 1)}>
              Retry
            </Button>
          }
        />
      ) : null}

      <Card styles={{ body: { padding: 0 } }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            padding: 16,
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search venues or contact details"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: "min(420px, 100%)" }}
          />
          <Button
            icon={<ReloadOutlined />}
            aria-label="Refresh venue contacts"
            title="Refresh"
            onClick={() => setReloadToken((value) => value + 1)}
          />
        </div>
        <Table<Venue>
          rowKey={(venue) => venue.id || venue.slug || venue.name || "venue"}
          columns={columns}
          dataSource={filteredVenues}
          loading={loading}
          pagination={{ pageSize: 25, showSizeChanger: true }}
          scroll={{ x: 1240 }}
          locale={{ emptyText: search ? "No matching venues" : "No venues found" }}
        />
      </Card>
    </Space>
  );
}