import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";

const GUEST_PASS_ENDPOINT = "/.netlify/functions/api-guest-pass-list";

const SUMMARY_COLUMNS = [
  "full_name",
  "email",
  "phone",
  "country",
  "destination",
  "source_hotel_slug",
  "whatsapp_opt_in",
  "created_at",
];

type GuestPassRow = Record<string, unknown> & {
  __rowKey: string;
};

type GuestPassPayload = {
  ok?: boolean;
  error?: string;
  columns?: string[];
  guests?: Record<string, unknown>[];
};

function titleizeColumn(column: string) {
  return column
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCellValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") {
    return (
      <Tag color={value ? "green" : "default"}>{value ? "Yes" : "No"}</Tag>
    );
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export default function GuestPassUsers() {
  const [rows, setRows] = useState<GuestPassRow[]>([]);
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<GuestPassRow | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const loadGuests = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(GUEST_PASS_ENDPOINT, {
          credentials: "include",
          signal: controller.signal,
        });
        const payload = (await response
          .json()
          .catch(() => ({}))) as GuestPassPayload;

        if (!response.ok || payload?.ok === false) {
          throw new Error(
            payload?.error || `Failed to load Guest Pass entries (${response.status})`,
          );
        }

        const guests = Array.isArray(payload.guests) ? payload.guests : [];
        const columns = Array.isArray(payload.columns)
          ? payload.columns
          : Object.keys(guests[0] || {});

        setColumnNames(columns);
        setRows(
          guests.map((guest, index) => ({
            ...guest,
            __rowKey: String(guest.id || guest.email || guest.phone || index),
          })),
        );
      } catch (loadError) {
        if ((loadError as Error)?.name === "AbortError") return;
        setError(String((loadError as Error)?.message || loadError));
      } finally {
        setLoading(false);
      }
    };

    void loadGuests();

    return () => controller.abort();
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) =>
      columnNames.some((column) =>
        String(row[column] ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [columnNames, rows, search]);

  const tableColumns = useMemo<ColumnsType<GuestPassRow>>(() => {
    const visibleColumns = SUMMARY_COLUMNS.filter((column) =>
      columnNames.includes(column),
    );

    return [
      ...visibleColumns.map((column) => ({
        title: titleizeColumn(column),
        dataIndex: column,
        key: column,
        ellipsis: true,
        sorter: (left: GuestPassRow, right: GuestPassRow) =>
          String(left[column] ?? "").localeCompare(String(right[column] ?? "")),
        render: (value: unknown) => (
          <Typography.Text
            style={{ maxWidth: 320 }}
            ellipsis={{ tooltip: String(value ?? "") }}
          >
            {formatCellValue(value)}
          </Typography.Text>
        ),
      })),
      {
        title: "Details",
        key: "details",
        fixed: "right",
        width: 120,
        render: (_value: unknown, record: GuestPassRow) => (
          <Button type="link" onClick={() => setSelectedGuest(record)}>
            View details
          </Button>
        ),
      },
    ];
  }, [columnNames]);

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
        <Space
          align="start"
          style={{ width: "100%", justifyContent: "space-between" }}
          wrap
        >
          <Space direction="vertical" size={8}>
            <Typography.Text type="secondary">
              Pass Users Details
            </Typography.Text>
            <Typography.Title level={2} style={{ margin: 0 }}>
              Guest Pass
            </Typography.Title>
            <Typography.Paragraph
              type="secondary"
              style={{ margin: 0, maxWidth: 720 }}
            >
              Guest Pass entries loaded from pass_guests in the Neon database configured by NETLIFY_DATABASE_URL.
            </Typography.Paragraph>
          </Space>

          <Input.Search
            allowClear
            placeholder="Search Guest Pass entries"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 280 }}
          />
        </Space>
      </Card>

      {error ? (
        <Alert
          type="error"
          showIcon
          message="Guest Pass entries unavailable"
          description={error}
        />
      ) : null}

      <Card
        title={`Guest Pass entries (${filteredRows.length})`}
        styles={{ body: { padding: 0 } }}
      >
        <Table<GuestPassRow>
          rowKey="__rowKey"
          columns={tableColumns}
          dataSource={filteredRows}
          loading={loading}
          scroll={{ x: 1120 }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No Guest Pass entries found."
              />
            ),
          }}
        />
      </Card>

      <Modal
        title="Guest Pass details"
        open={Boolean(selectedGuest)}
        onCancel={() => setSelectedGuest(null)}
        footer={null}
        width={860}
      >
        {selectedGuest ? (
          <Descriptions bordered column={1} size="small">
            {columnNames.map((column) => (
              <Descriptions.Item key={column} label={titleizeColumn(column)}>
                <Typography.Text style={{ wordBreak: "break-word" }}>
                  {formatCellValue(selectedGuest[column])}
                </Typography.Text>
              </Descriptions.Item>
            ))}
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
}