import { useEffect, useMemo, useState } from "react";
import { EyeOutlined, LoadingOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";

const STAY_ENQUIRIES_ENDPOINT =
  "/.netlify/functions/api-stay-enquiries-list";
const STAY_ENQUIRIES_READ_ENDPOINT =
  "/.netlify/functions/api-stay-enquiries-read";
const UNREAD_COUNT_EVENT = "stay-enquiries-unread-change";

type StayEnquiry = {
  id: string;
  property_slug: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  budget: string | null;
  guest_name: string;
  email: string;
  whatsapp: string | null;
  notes: string | null;
  source: string;
  status: string;
  is_read: boolean;
  notification_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

type StayEnquiriesPayload = {
  ok?: boolean;
  error?: string;
  enquiries?: StayEnquiry[];
  unreadCount?: number;
};

function formatLabel(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusColor(status: string) {
  const normalizedStatus = status.toLowerCase();
  if (["confirmed", "completed", "booked"].includes(normalizedStatus)) {
    return "green";
  }
  if (["cancelled", "declined", "closed"].includes(normalizedStatus)) {
    return "red";
  }
  if (["pending", "new", "open"].includes(normalizedStatus)) return "gold";
  return "blue";
}

export default function StayEnquiries() {
  const [enquiries, setEnquiries] = useState<StayEnquiry[]>([]);
  const [selectedEnquiry, setSelectedEnquiry] =
    useState<StayEnquiry | null>(null);
  const [search, setSearch] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const loadEnquiries = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(STAY_ENQUIRIES_ENDPOINT, {
          credentials: "include",
          signal: controller.signal,
        });
        const payload = (await response
          .json()
          .catch(() => ({}))) as StayEnquiriesPayload;

        if (!response.ok || payload.ok === false) {
          throw new Error(
            payload.error || `Failed to load stay enquiries (${response.status})`,
          );
        }

        const loadedEnquiries = Array.isArray(payload.enquiries)
          ? payload.enquiries
          : [];
        setEnquiries(loadedEnquiries);
        const loadedUnreadCount =
          payload.unreadCount ??
          loadedEnquiries.filter((enquiry) => !enquiry.is_read).length;
        setUnreadCount(loadedUnreadCount);
        window.dispatchEvent(
          new CustomEvent(UNREAD_COUNT_EVENT, {
            detail: { unreadCount: loadedUnreadCount },
          }),
        );
      } catch (loadError) {
        if ((loadError as Error)?.name === "AbortError") return;
        setError(String((loadError as Error)?.message || loadError));
      } finally {
        setLoading(false);
      }
    };

    void loadEnquiries();
    return () => controller.abort();
  }, []);

  const filteredEnquiries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return enquiries;

    return enquiries.filter((enquiry) =>
      Object.values(enquiry).some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [enquiries, search]);

  const updateReadState = async (enquiry: StayEnquiry, isRead: boolean) => {
    setUpdatingIds((current) => new Set(current).add(enquiry.id));

    try {
      const response = await fetch(STAY_ENQUIRIES_READ_ENDPOINT, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: enquiry.id, isRead }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        enquiry?: { updated_at?: string };
      };

      if (!response.ok || payload.ok === false) {
        throw new Error(
          payload.error || `Failed to update enquiry (${response.status})`,
        );
      }

      const nextEnquiries = enquiries.map((item) =>
        item.id === enquiry.id
          ? {
              ...item,
              is_read: isRead,
              updated_at: payload.enquiry?.updated_at || item.updated_at,
            }
          : item,
      );
      const nextUnreadCount = Math.max(
        0,
        unreadCount +
          (!enquiry.is_read && isRead ? -1 : enquiry.is_read && !isRead ? 1 : 0),
      );
      setEnquiries(nextEnquiries);
      setUnreadCount(nextUnreadCount);
      setSelectedEnquiry((current) =>
        current?.id === enquiry.id
          ? {
              ...current,
              is_read: isRead,
              updated_at: payload.enquiry?.updated_at || current.updated_at,
            }
          : current,
      );
      window.dispatchEvent(
        new CustomEvent(UNREAD_COUNT_EVENT, {
          detail: { unreadCount: nextUnreadCount },
        }),
      );
    } catch (updateError) {
      message.error(String((updateError as Error)?.message || updateError));
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(enquiry.id);
        return next;
      });
    }
  };

  const columns: ColumnsType<StayEnquiry> = [
    {
      title: "Guest",
      dataIndex: "guest_name",
      key: "guest_name",
      render: (value: string, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary">{record.email}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "Property",
      dataIndex: "property_slug",
      key: "property_slug",
      render: (value: string) => formatLabel(value),
    },
    {
      title: "Stay",
      key: "stay",
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{formatDate(record.check_in)}</Typography.Text>
          <Typography.Text type="secondary">
            to {formatDate(record.check_out)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Guests",
      key: "guests",
      render: (_value, record) =>
        `${record.adults} adult${record.adults === 1 ? "" : "s"}${
          record.children
            ? `, ${record.children} child${record.children === 1 ? "" : "ren"}`
            : ""
        }`,
    },
    {
      title: "Budget",
      dataIndex: "budget",
      key: "budget",
      render: (value: string | null) => value || "-",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (value: string) => (
        <Tag color={statusColor(value)}>{formatLabel(value)}</Tag>
      ),
    },
    {
      title: "Read",
      dataIndex: "is_read",
      key: "is_read",
      width: 100,
      filters: [
        { text: "Unread", value: false },
        { text: "Read", value: true },
      ],
      onFilter: (value, record) => record.is_read === value,
      render: (value: boolean, record) => (
        <Switch
          checked={value}
          checkedChildren="Read"
          unCheckedChildren="Unread"
          loading={updatingIds.has(record.id)}
          onChange={(checked) => void updateReadState(record, checked)}
        />
      ),
    },
    {
      title: "Received",
      dataIndex: "created_at",
      key: "created_at",
      sorter: (left, right) =>
        new Date(left.created_at).getTime() -
        new Date(right.created_at).getTime(),
      defaultSortOrder: "descend",
      render: (value: string) => formatDateTime(value),
    },
    {
      title: "Details",
      key: "details",
      fixed: "right",
      width: 110,
      render: (_value, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => setSelectedEnquiry(record)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Card styles={{ body: { padding: 28 } }}>
        <Space
          align="start"
          style={{ width: "100%", justifyContent: "space-between" }}
          wrap
        >
          <Space direction="vertical" size={8}>
            <Typography.Text type="secondary">Enquiries</Typography.Text>
            <Typography.Title level={2} style={{ margin: 0 }}>
              Stays
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
              Review accommodation enquiries, requested dates, party sizes, and
              guest contact details.
            </Typography.Paragraph>
          </Space>

          <Input.Search
            allowClear
            placeholder="Search stay enquiries"
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
          message="Stay enquiries unavailable"
          description={error}
        />
      ) : null}

      <Card
        title={`Stay enquiries (${filteredEnquiries.length})`}
        styles={{ body: { padding: 0 } }}
      >
        {loading ? (
          <Space
            role="status"
            aria-live="polite"
            direction="vertical"
            align="center"
            size={12}
            style={{ display: "flex", padding: 64 }}
          >
            <LoadingOutlined spin style={{ fontSize: 32, color: "#1677ff" }} />
            <Typography.Text type="secondary">
              Loading stay enquiries...
            </Typography.Text>
          </Space>
        ) : (
          <Table<StayEnquiry>
            rowKey="id"
            columns={columns}
            dataSource={filteredEnquiries}
            scroll={{ x: 1200 }}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No stay enquiries found."
                />
              ),
            }}
          />
        )}
      </Card>

      <Modal
        title="Stay enquiry details"
        open={Boolean(selectedEnquiry)}
        onCancel={() => setSelectedEnquiry(null)}
        footer={null}
        width={860}
      >
        {selectedEnquiry ? (
          <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label="Guest name">
              {selectedEnquiry.guest_name}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={statusColor(selectedEnquiry.status)}>
                {formatLabel(selectedEnquiry.status)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Read">
              <Switch
                checked={selectedEnquiry.is_read}
                checkedChildren="Read"
                unCheckedChildren="Unread"
                loading={updatingIds.has(selectedEnquiry.id)}
                onChange={(checked) =>
                  void updateReadState(selectedEnquiry, checked)
                }
              />
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              <Typography.Link href={`mailto:${selectedEnquiry.email}`}>
                {selectedEnquiry.email}
              </Typography.Link>
            </Descriptions.Item>
            <Descriptions.Item label="WhatsApp">
              {selectedEnquiry.whatsapp ? (
                <Typography.Link href={`tel:${selectedEnquiry.whatsapp}`}>
                  {selectedEnquiry.whatsapp}
                </Typography.Link>
              ) : (
                "-"
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Property">
              {formatLabel(selectedEnquiry.property_slug)}
            </Descriptions.Item>
            <Descriptions.Item label="Budget">
              {selectedEnquiry.budget || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Check-in">
              {formatDate(selectedEnquiry.check_in)}
            </Descriptions.Item>
            <Descriptions.Item label="Check-out">
              {formatDate(selectedEnquiry.check_out)}
            </Descriptions.Item>
            <Descriptions.Item label="Adults">
              {selectedEnquiry.adults}
            </Descriptions.Item>
            <Descriptions.Item label="Children">
              {selectedEnquiry.children}
            </Descriptions.Item>
            <Descriptions.Item label="Source">
              {formatLabel(selectedEnquiry.source)}
            </Descriptions.Item>
            <Descriptions.Item label="Notification sent">
              {formatDateTime(selectedEnquiry.notification_sent_at)}
            </Descriptions.Item>
            <Descriptions.Item label="Received">
              {formatDateTime(selectedEnquiry.created_at)}
            </Descriptions.Item>
            <Descriptions.Item label="Last updated">
              {formatDateTime(selectedEnquiry.updated_at)}
            </Descriptions.Item>
            <Descriptions.Item label="Notes" span={2}>
              <Typography.Text style={{ whiteSpace: "pre-wrap" }}>
                {selectedEnquiry.notes || "-"}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Enquiry ID" span={2}>
              {selectedEnquiry.id}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
}