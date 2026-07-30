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

const RETREAT_ENQUIRIES_ENDPOINT =
  "/.netlify/functions/api-retreat-enquiries-list";
const RETREAT_ENQUIRIES_READ_ENDPOINT =
  "/.netlify/functions/api-retreat-enquiries-read";
const UNREAD_COUNT_EVENT = "retreat-enquiries-unread-change";

type RetreatEnquiry = {
  id: string;
  preferred_venue: string;
  retreat_style: string;
  start_date: string;
  end_date: string;
  expected_guests: number;
  organiser_name: string;
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

type RetreatEnquiriesPayload = {
  ok?: boolean;
  error?: string;
  enquiries?: RetreatEnquiry[];
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

export default function RetreatEnquiries() {
  const [enquiries, setEnquiries] = useState<RetreatEnquiry[]>([]);
  const [selectedEnquiry, setSelectedEnquiry] =
    useState<RetreatEnquiry | null>(null);
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
        const response = await fetch(RETREAT_ENQUIRIES_ENDPOINT, {
          credentials: "include",
          signal: controller.signal,
        });
        const payload = (await response
          .json()
          .catch(() => ({}))) as RetreatEnquiriesPayload;

        if (!response.ok || payload.ok === false) {
          throw new Error(
            payload.error ||
              `Failed to load retreat enquiries (${response.status})`,
          );
        }

        const loadedEnquiries = Array.isArray(payload.enquiries)
          ? payload.enquiries
          : [];
        const loadedUnreadCount =
          payload.unreadCount ??
          loadedEnquiries.filter((enquiry) => !enquiry.is_read).length;
        setEnquiries(loadedEnquiries);
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

  const updateReadState = async (enquiry: RetreatEnquiry, isRead: boolean) => {
    setUpdatingIds((current) => new Set(current).add(enquiry.id));

    try {
      const response = await fetch(RETREAT_ENQUIRIES_READ_ENDPOINT, {
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

      const nextUnreadCount = Math.max(
        0,
        unreadCount +
          (!enquiry.is_read && isRead ? -1 : enquiry.is_read && !isRead ? 1 : 0),
      );
      setEnquiries((current) =>
        current.map((item) =>
          item.id === enquiry.id
            ? {
                ...item,
                is_read: isRead,
                updated_at: payload.enquiry?.updated_at || item.updated_at,
              }
            : item,
        ),
      );
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

  const columns: ColumnsType<RetreatEnquiry> = [
    {
      title: "Organiser",
      dataIndex: "organiser_name",
      key: "organiser_name",
      render: (value: string, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary">{record.email}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "Venue",
      dataIndex: "preferred_venue",
      key: "preferred_venue",
      render: (value: string) => formatLabel(value),
    },
    {
      title: "Style",
      dataIndex: "retreat_style",
      key: "retreat_style",
      render: (value: string) => formatLabel(value),
    },
    {
      title: "Dates",
      key: "dates",
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{formatDate(record.start_date)}</Typography.Text>
          <Typography.Text type="secondary">
            to {formatDate(record.end_date)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Guests",
      dataIndex: "expected_guests",
      key: "expected_guests",
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
              Retreats
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
              Review retreat plans, preferred venues, dates, group sizes, and
              organiser contact details.
            </Typography.Paragraph>
          </Space>

          <Input.Search
            allowClear
            placeholder="Search retreat enquiries"
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
          message="Retreat enquiries unavailable"
          description={error}
        />
      ) : null}

      <Card
        title={`Retreat enquiries (${filteredEnquiries.length})`}
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
              Loading retreat enquiries...
            </Typography.Text>
          </Space>
        ) : (
          <Table<RetreatEnquiry>
            rowKey="id"
            columns={columns}
            dataSource={filteredEnquiries}
            scroll={{ x: 1300 }}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No retreat enquiries found."
                />
              ),
            }}
          />
        )}
      </Card>

      <Modal
        title="Retreat enquiry details"
        open={Boolean(selectedEnquiry)}
        onCancel={() => setSelectedEnquiry(null)}
        footer={null}
        width={860}
      >
        {selectedEnquiry ? (
          <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label="Organiser">
              {selectedEnquiry.organiser_name}
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
            <Descriptions.Item label="Preferred venue">
              {formatLabel(selectedEnquiry.preferred_venue)}
            </Descriptions.Item>
            <Descriptions.Item label="Retreat style">
              {formatLabel(selectedEnquiry.retreat_style)}
            </Descriptions.Item>
            <Descriptions.Item label="Start date">
              {formatDate(selectedEnquiry.start_date)}
            </Descriptions.Item>
            <Descriptions.Item label="End date">
              {formatDate(selectedEnquiry.end_date)}
            </Descriptions.Item>
            <Descriptions.Item label="Expected guests">
              {selectedEnquiry.expected_guests}
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
