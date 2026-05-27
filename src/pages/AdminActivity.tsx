import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import { Link } from "react-router-dom";

const ACTIVITY_ENDPOINT = "/.netlify/functions/api-admin-activity-list";

type AdminActivityItem = {
  id: string;
  action: string;
  actorEmail?: string | null;
  entityType: string;
  entityId: string;
  entityName?: string | null;
  venueId?: string | null;
  contactId?: string | null;
  changedFields?: string[];
  details?: Record<string, unknown>;
  createdAt: string;
};

function formatDateTime(value: unknown) {
  if (!value) return "-";

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getActivityActionLabel(activity: AdminActivityItem) {
  const entityLabel =
    {
      venue: "venue",
      contact: "contact",
      touchpoint: "inventory",
      interaction: "interaction",
    }[activity.entityType] || activity.entityType;

  const verb =
    {
      view: "viewed",
      create: "created",
      import: "imported",
      update: "updated",
      delete: "deleted",
    }[activity.action] || activity.action;

  return `${verb} ${entityLabel}`;
}

function getActivityActionColor(action: string) {
  return (
    {
      view: "default",
      create: "green",
      import: "purple",
      update: "blue",
      delete: "red",
    }[action] || "default"
  );
}

function getActivityTarget(activity: AdminActivityItem) {
  if (activity.entityType === "venue") {
    const venueId = String(activity.venueId || activity.entityId || "");
    return venueId
      ? `/admin/venues?venue=${encodeURIComponent(venueId)}`
      : "/admin/venues";
  }

  if (
    activity.entityType === "contact" ||
    activity.entityType === "touchpoint" ||
    activity.entityType === "interaction"
  ) {
    return "/admin/crm";
  }

  return "/admin";
}

function getActivityDetailTags(activity: AdminActivityItem) {
  const details = activity.details || {};
  const items = [] as string[];

  if (Array.isArray(activity.changedFields) && activity.changedFields.length) {
    items.push(`Changed: ${activity.changedFields.join(", ")}`);
  }

  if (typeof details.interactionType === "string") {
    items.push(`Type: ${details.interactionType}`);
  }
  if (typeof details.outcomeStatus === "string") {
    items.push(`Outcome: ${details.outcomeStatus}`);
  }
  if (typeof details.role === "string") {
    items.push(`Role: ${details.role}`);
  }
  if (typeof details.quantity === "number") {
    items.push(`Quantity: ${details.quantity}`);
  }
  if (typeof details.importedCount === "number") {
    items.push(`Imported: ${details.importedCount}`);
  }
  if (typeof details.sourceFile === "string") {
    items.push(`Source: ${details.sourceFile}`);
  }

  return items;
}

export default function AdminActivity() {
  const [activities, setActivities] = useState<AdminActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState("");

  useEffect(() => {
    const fetchActivity = async () => {
      setActivityLoading(true);
      setActivityError("");

      try {
        const response = await fetch(`${ACTIVITY_ENDPOINT}?limit=50`, {
          credentials: "include",
        });
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          activities?: AdminActivityItem[];
        };

        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || `Failed (${response.status})`);
        }

        setActivities(Array.isArray(data?.activities) ? data.activities : []);
      } catch (fetchError) {
        setActivityError(String((fetchError as Error)?.message || fetchError));
      } finally {
        setActivityLoading(false);
      }
    };

    void fetchActivity();
  }, []);

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
        <Space direction="vertical" size={8}>
          <Typography.Text type="secondary">Admin activity</Typography.Text>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Recent activity
          </Typography.Title>
          <Typography.Paragraph
            type="secondary"
            style={{ margin: 0, maxWidth: 760 }}
          >
            Review the latest venue, CRM, inventory, interaction, and import
            events across the admin workspace.
          </Typography.Paragraph>
        </Space>
      </Card>

      <Card
        styles={{ body: { padding: 20 } }}
        style={{
          borderRadius: 20,
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
        }}
      >
        {activityLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : activityError ? (
          <Alert
            type="error"
            showIcon
            message="Activity feed unavailable"
            description={activityError}
          />
        ) : activities.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No admin activity yet."
          >
            <Link to="/admin/venues?addVenue=1">
              <Button type="primary">Create the first venue</Button>
            </Link>
          </Empty>
        ) : (
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            {activities.map((activity) => {
              const detailTags = getActivityDetailTags(activity);
              return (
                <div
                  key={activity.id}
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    border: "1px solid rgba(15, 23, 42, 0.08)",
                    background: "rgba(255,255,255,0.72)",
                  }}
                >
                  <Row justify="space-between" align="middle" gutter={[12, 12]}>
                    <Col flex="auto">
                      <Typography.Text strong style={{ display: "block" }}>
                        {activity.entityName ||
                          activity.entityId ||
                          "Untitled activity"}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        {getActivityActionLabel(activity)}
                      </Typography.Text>
                      <div style={{ marginTop: 8 }}>
                        <Space size={[8, 8]} wrap>
                          <Tag color={getActivityActionColor(activity.action)}>
                            {activity.action}
                          </Tag>
                          <Tag>{activity.entityType}</Tag>
                          {activity.actorEmail ? (
                            <Tag>{activity.actorEmail}</Tag>
                          ) : null}
                          {detailTags.map((detail) => (
                            <Tag key={detail}>{detail}</Tag>
                          ))}
                        </Space>
                      </div>
                    </Col>
                    <Col>
                      <Space direction="vertical" size={8} align="end">
                        <Typography.Text type="secondary">
                          {formatDateTime(activity.createdAt)}
                        </Typography.Text>
                        <Link to={getActivityTarget(activity)}>
                          <Button size="small">Open</Button>
                        </Link>
                      </Space>
                    </Col>
                  </Row>
                </div>
              );
            })}
          </Space>
        )}
      </Card>
    </div>
  );
}
