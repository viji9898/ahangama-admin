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

const CIRCLE_ENDPOINT = "/.netlify/functions/api-circle-list";

const SUMMARY_COLUMNS = [
  "name",
  "email",
  "mobile",
  "member_type",
  "venue_name",
  "pass_type",
  "pass_status",
  "valid_until",
];

type CircleRow = Record<string, unknown> & {
  __rowKey: string;
};

type CirclePayload = {
  ok?: boolean;
  error?: string;
  columns?: string[];
  entries?: Record<string, unknown>[];
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

export default function CirclePassUsers() {
  const [rows, setRows] = useState<CircleRow[]>([]);
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<CircleRow | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const loadEntries = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(CIRCLE_ENDPOINT, {
          credentials: "include",
          signal: controller.signal,
        });
        const payload = (await response
          .json()
          .catch(() => ({}))) as CirclePayload;

        if (!response.ok || payload?.ok === false) {
          throw new Error(
            payload?.error || `Failed to load Circle entries (${response.status})`,
          );
        }

        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        const columns = Array.isArray(payload.columns)
          ? payload.columns
          : Object.keys(entries[0] || {});

        setColumnNames(columns);
        setRows(
          entries.map((entry, index) => ({
            ...entry,
            __rowKey: String(entry.id || entry.email || entry.mobile || index),
          })),
        );
      } catch (loadError) {
        if ((loadError as Error)?.name === "AbortError") return;
        setError(String((loadError as Error)?.message || loadError));
      } finally {
        setLoading(false);
      }
    };

    void loadEntries();

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

  const tableColumns = useMemo<ColumnsType<CircleRow>>(() => {
    const visibleColumns = SUMMARY_COLUMNS.filter((column) =>
      columnNames.includes(column),
    );

    return [
      ...visibleColumns.map((column) => ({
        title: titleizeColumn(column),
        dataIndex: column,
        key: column,
        ellipsis: true,
        sorter: (left: CircleRow, right: CircleRow) =>
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
        render: (_value: unknown, record: CircleRow) => (
          <Button type="link" onClick={() => setSelectedEntry(record)}>
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
              Circle
            </Typography.Title>
            <Typography.Paragraph
              type="secondary"
              style={{ margin: 0, maxWidth: 720 }}
            >
              Circle entries loaded from the Neon database configured by NETLIFY_DATABASE_URL.
            </Typography.Paragraph>
          </Space>

          <Input.Search
            allowClear
            placeholder="Search Circle entries"
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
          message="Circle entries unavailable"
          description={error}
        />
      ) : null}

      <Card
        title={`Circle entries (${filteredRows.length})`}
        styles={{ body: { padding: 0 } }}
      >
        <Table<CircleRow>
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
                description="No Circle entries found."
              />
            ),
          }}
        />
      </Card>

      <Modal
        title="Circle entry details"
        open={Boolean(selectedEntry)}
        onCancel={() => setSelectedEntry(null)}
        footer={null}
        width={860}
      >
        {selectedEntry ? (
          <Descriptions bordered column={1} size="small">
            {columnNames.map((column) => (
              <Descriptions.Item key={column} label={titleizeColumn(column)}>
                <Typography.Text style={{ wordBreak: "break-word" }}>
                  {formatCellValue(selectedEntry[column])}
                </Typography.Text>
              </Descriptions.Item>
            ))}
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
}