import { useEffect, useState } from "react";
import VenueDetail from "./VenueDetail";

import { Badge, Table, Tag } from "antd";
import "antd/dist/reset.css";

interface Venue {
  id?: string;
  destinationSlug?: string;
  name?: string;
  slug?: string;
  status?: string;
  live?: boolean;
  categories?: string[];
  emoji?: string[];
  stars?: number;
  reviews?: number;
  discount?: number;
  excerpt?: string;
  description?: string;
  bestFor?: string[];
  tags?: string[];
  cardPerk?: string;
  offers?: string[] | string;
  howToClaim?: string;
  restrictions?: string;
  area?: string;
  lat?: number;
  lng?: number;
  logo?: string;
  image?: string;
  ogImage?: string;
  mapUrl?: string;
  instagramUrl?: string;
  whatsapp?: string;
  updatedAt?: string;
  updated_at?: string;
  createdAt?: string;
  created_at?: string;
}

export default function Admin() {
  const [selectedVenue, setSelectedVenue] = useState<Venue | undefined>(
    undefined,
  );
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

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
      } catch (e) {
        setError("Failed to load venues");
      } finally {
        setLoading(false);
      }
    };
    fetchVenues();
  }, []);

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

  return (
    <div
      style={{
        padding: 40,
        display: "flex",
        gap: 32,
        maxWidth: "100vw",
        overflowX: "hidden",
      }}
    >
      <div style={{ flex: 1, minWidth: 320, maxWidth: "40vw" }}>
        {error && <div style={{ color: "red" }}>{error}</div>}
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Search venues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 300, padding: 8, fontSize: 16 }}
          />
        </div>
        <Table<Venue>
          dataSource={venues.filter((v) => {
            const q = search.trim().toLowerCase();
            if (!q) return true;
            return (
              v.name?.toLowerCase().includes(q) ||
              v.slug?.toLowerCase().includes(q) ||
              v.id?.toLowerCase().includes(q)
            );
          })}
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
        <VenueDetail venue={selectedVenue} onVenueUpdated={handleVenueUpdated} />
      </div>
    </div>
  );
}
