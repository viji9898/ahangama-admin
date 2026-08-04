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
import { makeWhatsAppUrlWithMessage } from "../components/crm/contactLinks";

const PAID_PASS_ENDPOINT = "/.netlify/functions/api-paid-pass-list";

type PaidPassTransaction = {
  id: string;
  purchase_source: string;
  customer_name: string | null;
  customer_email: string;
  customer_phone: string | null;
  product: string | null;
  amount_usd: string | number;
  currency: string | null;
  status: string | null;
  start_date: string | null;
  expiry_date: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  receipt_url: string | null;
  created_at: string;
};

type PaidPassPayload = {
  ok?: boolean;
  error?: string;
  transactions?: PaidPassTransaction[];
};

function titleizeColumn(column: string) {
  return column
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatAmount(record: PaidPassTransaction) {
  const amount = Number(record.amount_usd || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: record.currency || "USD",
  }).format(amount);
}

function makePaidPassWhatsappMessage(record: PaidPassTransaction) {
  const name = String(record.customer_name || "there").trim() || "there";
  return `Hi ${name} thanks for signing up to Ahangama Pass.`;
}

export default function PaidPassUsers() {
  const [rows, setRows] = useState<PaidPassTransaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] =
    useState<PaidPassTransaction | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const loadTransactions = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(PAID_PASS_ENDPOINT, {
          credentials: "include",
          signal: controller.signal,
        });
        const payload = (await response
          .json()
          .catch(() => ({}))) as PaidPassPayload;

        if (!response.ok || payload?.ok === false) {
          throw new Error(
            payload?.error ||
              `Failed to load paid pass transactions (${response.status})`,
          );
        }

        setRows(
          Array.isArray(payload.transactions) ? payload.transactions : [],
        );
      } catch (loadError) {
        if ((loadError as Error)?.name === "AbortError") return;
        setError(String((loadError as Error)?.message || loadError));
      } finally {
        setLoading(false);
      }
    };

    void loadTransactions();
    return () => controller.abort();
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [rows, search]);

  const totalRevenue = useMemo(
    () => filteredRows.reduce((total, row) => total + Number(row.amount_usd || 0), 0),
    [filteredRows],
  );

  const columns: ColumnsType<PaidPassTransaction> = [
    {
      title: "Name",
      dataIndex: "customer_name",
      key: "customer_name",
      render: (value: string | null) => value || "-",
    },
    {
      title: "Email",
      dataIndex: "customer_email",
      key: "customer_email",
      ellipsis: true,
    },
    {
      title: "Phone",
      dataIndex: "customer_phone",
      key: "customer_phone",
      render: (value: string | null, record) => {
        const phone = String(value || "").trim();
        const whatsappUrl = makeWhatsAppUrlWithMessage(
          phone,
          makePaidPassWhatsappMessage(record),
        );

        if (!whatsappUrl) return phone || "-";

        return (
          <Typography.Link href={whatsappUrl} target="_blank" rel="noreferrer">
            {phone}
          </Typography.Link>
        );
      },
    },
    {
      title: "Product",
      dataIndex: "product",
      key: "product",
      render: (value: string | null) => value || "-",
    },
    {
      title: "Amount",
      key: "amount_usd",
      sorter: (left, right) =>
        Number(left.amount_usd || 0) - Number(right.amount_usd || 0),
      render: (_value, record) => formatAmount(record),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (value: string | null) => (
        <Tag color="green">{titleizeColumn(value || "paid")}</Tag>
      ),
    },
    {
      title: "Purchased",
      dataIndex: "created_at",
      key: "created_at",
      sorter: (left, right) =>
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
      render: (value: string) => formatDate(value),
    },
    {
      title: "Details",
      key: "details",
      fixed: "right",
      width: 120,
      render: (_value, record) => (
        <Button type="link" onClick={() => setSelectedTransaction(record)}>
          View details
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
          <Space orientation="vertical" size={8}>
            <Typography.Text type="secondary">
              Pass Users Details
            </Typography.Text>
            <Typography.Title level={2} style={{ margin: 0 }}>
              Paid Pass
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
              Confirmed pass transactions with a positive Stripe-backed charge.
            </Typography.Paragraph>
          </Space>

          <Input.Search
            allowClear
            placeholder="Search paid transactions"
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
          title="Paid pass transactions unavailable"
          description={error}
        />
      ) : null}

      <Card
        title={`Paid transactions (${filteredRows.length})`}
        extra={
          <Typography.Text strong>
            Total: {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(totalRevenue)}
          </Typography.Text>
        }
        styles={{ body: { padding: 0 } }}
      >
        <Table<PaidPassTransaction>
          rowKey={(record) => `${record.purchase_source}-${record.id}`}
          columns={columns}
          dataSource={filteredRows}
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No paid pass transactions found."
              />
            ),
          }}
        />
      </Card>

      <Modal
        title="Paid pass transaction details"
        open={Boolean(selectedTransaction)}
        onCancel={() => setSelectedTransaction(null)}
        footer={null}
        width={860}
      >
        {selectedTransaction ? (
          <Descriptions bordered column={1} size="small">
            {Object.entries(selectedTransaction).map(([key, value]) => (
              <Descriptions.Item key={key} label={titleizeColumn(key)}>
                {key === "customer_phone" && value ? (
                  <Typography.Link
                    href={
                      makeWhatsAppUrlWithMessage(
                        String(value),
                        makePaidPassWhatsappMessage(selectedTransaction),
                      ) || undefined
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {String(value)}
                  </Typography.Link>
                ) : key === "receipt_url" && value ? (
                  <Typography.Link href={String(value)} target="_blank" rel="noreferrer">
                    View receipt
                  </Typography.Link>
                ) : key.endsWith("_date") || key === "created_at" ? (
                  formatDate(value ? String(value) : null)
                ) : (
                  String(value ?? "-")
                )}
              </Descriptions.Item>
            ))}
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
}