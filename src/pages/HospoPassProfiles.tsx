import { useEffect, useMemo, useState } from "react";
import { Alert, Card, Empty, Input, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";

const HOSPO_PROFILES_ENDPOINT =
  "/.netlify/functions/api-hospo-pass-profiles-list";

type HospoProfileRow = Record<string, unknown> & {
  __rowKey: string;
};

type HospoProfilesPayload = {
  ok?: boolean;
  error?: string;
  columns?: string[];
  profiles?: Record<string, unknown>[];
};

function titleizeColumn(column: string) {
  return column
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCellValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") {
    return <Tag color={value ? "green" : "default"}>{value ? "Yes" : "No"}</Tag>;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export default function HospoPassProfiles() {
  const [rows, setRows] = useState<HospoProfileRow[]>([]);
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const loadProfiles = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(HOSPO_PROFILES_ENDPOINT, {
          credentials: "include",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as HospoProfilesPayload;

        if (!response.ok || payload?.ok === false) {
          throw new Error(
            payload?.error || `Failed to load Hospo pass profiles (${response.status})`,
          );
        }

        const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
        const columns = Array.isArray(payload.columns)
          ? payload.columns
          : Object.keys(profiles[0] || {});

        setColumnNames(columns);
        setRows(
          profiles.map((profile, index) => ({
            ...profile,
            __rowKey: String(profile.id || profile.uuid || profile.email || index),
          })),
        );
      } catch (loadError) {
        if ((loadError as Error)?.name === "AbortError") return;
        setError(String((loadError as Error)?.message || loadError));
      } finally {
        setLoading(false);
      }
    };

    void loadProfiles();

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

  const columns = useMemo<ColumnsType<HospoProfileRow>>(
    () =>
      columnNames.map((column) => ({
        title: titleizeColumn(column),
        dataIndex: column,
        key: column,
        ellipsis: true,
        sorter: (left, right) =>
          String(left[column] ?? "").localeCompare(String(right[column] ?? "")),
        render: (value: unknown) => (
          <Typography.Text style={{ maxWidth: 320 }} ellipsis={{ tooltip: String(value ?? "") }}>
            {formatCellValue(value)}
          </Typography.Text>
        ),
      })),
    [columnNames],
  );

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
            <Typography.Text type="secondary">Pass Users Details</Typography.Text>
            <Typography.Title level={2} style={{ margin: 0 }}>
              Hospo
            </Typography.Title>
            <Typography.Paragraph
              type="secondary"
              style={{ margin: 0, maxWidth: 720 }}
            >
              Profiles loaded from hospo_pass_profiles in the Neon database configured by NETLIFY_DATABASE_URL.
            </Typography.Paragraph>
          </Space>

          <Input.Search
            allowClear
            placeholder="Search Hospo profiles"
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
          message="Hospo profiles unavailable"
          description={error}
        />
      ) : null}

      <Card title={`Hospo profiles (${filteredRows.length})`} styles={{ body: { padding: 0 } }}>
        <Table<HospoProfileRow>
          rowKey="__rowKey"
          columns={columns}
          dataSource={filteredRows}
          loading={loading}
          scroll={{ x: Math.max(columnNames.length * 180, 760) }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No Hospo profiles found."
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}