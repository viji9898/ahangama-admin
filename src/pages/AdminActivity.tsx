import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Statistic,
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

type ActivityFilterKey =
  | "all"
  | "venue"
  | "crm"
  | "imports"
  | "interactions"
  | "usage";

type ActivityGroup = {
  key: string;
  label: string;
  items: AdminActivityItem[];
};

type ActiveUserSummary = {
  email: string;
  label: string;
  lastSeen: string;
  eventCount: number;
};

type DailyUsageUserSummary = {
  email: string;
  label: string;
  totalEvents: number;
  authEvents: number;
  lastSeen: string;
};

type DailyUsageSummary = {
  dateKey: string;
  label: string;
  users: DailyUsageUserSummary[];
};

function getUserDisplayName(activity: AdminActivityItem) {
  if (activity.entityType === "auth" && activity.entityName) {
    return String(activity.entityName);
  }

  return String(activity.actorEmail || "").toLowerCase() || "Unknown user";
}

type ActivityViewMode = "compact" | "detailed";

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

function formatDayLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
  }).format(date);
}

function getActivityFilterKey(activity: AdminActivityItem): ActivityFilterKey {
  if (activity.entityType === "auth") return "usage";
  if (activity.action === "import") return "imports";
  if (activity.entityType === "venue") return "venue";
  if (activity.entityType === "interaction") return "interactions";
  if (
    activity.entityType === "contact" ||
    activity.entityType === "touchpoint"
  ) {
    return "crm";
  }

  return "all";
}

function getActivityAccentColor(action: string) {
  return (
    {
      view: "#94a3b8",
      create: "#16a34a",
      import: "#7c3aed",
      login: "#0f766e",
      session: "#0284c7",
      logout: "#f59e0b",
      update: "#2563eb",
      delete: "#dc2626",
    }[action] || "#475569"
  );
}

function getEntityLabel(entityType: string, count = 1) {
  const baseLabel =
    {
      venue: "venue",
      contact: "contact",
      touchpoint: "inventory item",
      interaction: "interaction",
      auth: "session",
    }[entityType] || entityType;

  if (count === 1) {
    return baseLabel;
  }

  if (baseLabel === "inventory item") {
    return "inventory items";
  }

  return `${baseLabel}s`;
}

function getActivitySurfaceStyle(action: string) {
  return {
    import: {
      background: "linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(255, 255, 255, 0.9))",
      borderColor: "rgba(124, 58, 237, 0.18)",
    },
    delete: {
      background: "linear-gradient(135deg, rgba(220, 38, 38, 0.08), rgba(255, 255, 255, 0.9))",
      borderColor: "rgba(220, 38, 38, 0.18)",
    },
    create: {
      background: "linear-gradient(135deg, rgba(22, 163, 74, 0.07), rgba(255, 255, 255, 0.9))",
      borderColor: "rgba(22, 163, 74, 0.16)",
    },
    login: {
      background: "linear-gradient(135deg, rgba(15, 118, 110, 0.08), rgba(255, 255, 255, 0.92))",
      borderColor: "rgba(15, 118, 110, 0.18)",
    },
    session: {
      background: "linear-gradient(135deg, rgba(2, 132, 199, 0.07), rgba(255, 255, 255, 0.92))",
      borderColor: "rgba(2, 132, 199, 0.16)",
    },
    logout: {
      background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(255, 255, 255, 0.92))",
      borderColor: "rgba(245, 158, 11, 0.18)",
    },
    update: {
      background: "rgba(255,255,255,0.78)",
      borderColor: "rgba(15, 23, 42, 0.08)",
    },
    view: {
      background: "rgba(255,255,255,0.72)",
      borderColor: "rgba(15, 23, 42, 0.07)",
    },
  }[action] || {
    background: "rgba(255,255,255,0.78)",
    borderColor: "rgba(15, 23, 42, 0.08)",
  };
}

function getActivityPriorityLabel(action: string) {
  return {
    import: "Bulk event",
    delete: "Destructive",
    create: "New record",
    login: "Access",
    logout: "Access",
    session: "Usage",
  }[action];
}

function getPrimarySummary(activity: AdminActivityItem) {
  const target =
    activity.entityName || activity.entityId || activity.entityType || "item";
  const details = activity.details || {};
  const actorLabel = activity.entityName || activity.actorEmail || "A user";

  switch (activity.action) {
    case "login":
      return `${actorLabel} signed in`;
    case "session":
      return `${actorLabel} was active in the admin`;
    case "logout":
      return `${actorLabel} signed out`;
    case "create":
      return `Created ${getEntityLabel(activity.entityType)} ${target}`;
    case "update":
      return `Updated ${target}`;
    case "delete":
      return `Deleted ${getEntityLabel(activity.entityType)} ${target}`;
    case "import": {
      const importedCount = details.importedCount;
      if (typeof importedCount === "number") {
        return `Imported ${importedCount} ${getEntityLabel(activity.entityType, importedCount)}`;
      }
      return activity.entityName || `Imported ${target}`;
    }
    case "view":
      return `Viewed ${target}`;
    default:
      return `${activity.action} ${target}`;
  }
}

function getSecondarySummary(activity: AdminActivityItem) {
  const actor = activity.actorEmail || "System";
  const details = activity.details || {};

  if (activity.action === "session") {
    return `${actor} was seen in the app today`;
  }

  if (activity.action === "login") {
    return `${actor} started a new admin session`;
  }

  if (activity.action === "logout") {
    return `${actor} ended their admin session`;
  }

  if (activity.action === "update" && activity.changedFields?.length) {
    const changeCount = activity.changedFields.length;
    return `${actor} updated ${changeCount} ${changeCount === 1 ? "field" : "fields"}`;
  }

  if (activity.action === "import" && typeof details.sourceFile === "string") {
    return `${actor} ran an import from ${details.sourceFile}`;
  }

  if (activity.action === "delete") {
    return `${actor} removed this ${getEntityLabel(activity.entityType)}`;
  }

  if (activity.action === "create") {
    return `${actor} added a new ${getEntityLabel(activity.entityType)}`;
  }

  return `${getActivityActionLabel(activity)} by ${actor}`;
}

function getActivityMetadata(activity: AdminActivityItem) {
  const details = activity.details || {};
  const items = [] as string[];

  if (Array.isArray(activity.changedFields) && activity.changedFields.length) {
    items.push(
      activity.changedFields.length === 1
        ? "1 field changed"
        : `${activity.changedFields.length} fields changed`,
    );
  }

  if (typeof details.interactionType === "string") {
    items.push(`Type ${details.interactionType}`);
  }
  if (typeof details.outcomeStatus === "string") {
    items.push(`Outcome ${details.outcomeStatus}`);
  }
  if (typeof details.role === "string") {
    items.push(`Role ${details.role}`);
  }
  if (typeof details.quantity === "number") {
    items.push(`Quantity ${details.quantity}`);
  }
  if (typeof details.sourceFile === "string") {
    items.push(`Source ${details.sourceFile}`);
  }
  if (typeof details.source === "string" && details.source !== "admin-ui") {
    items.push(`Via ${details.source}`);
  }

  return items;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getDayStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function getDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function getActivityGroupMeta(activity: AdminActivityItem) {
  const createdAt = new Date(activity.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    return { key: "older", label: "Older" };
  }

  const now = new Date();
  const today = getDayStart(now);
  const activityDay = getDayStart(createdAt);
  const diffDays = Math.floor(
    (today.getTime() - activityDay.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (isSameDay(now, createdAt)) {
    return { key: "today", label: "Today" };
  }
  if (diffDays === 1) {
    return { key: "yesterday", label: "Yesterday" };
  }
  if (diffDays <= 7) {
    return { key: "week", label: "Last 7 days" };
  }

  return { key: "older", label: "Older" };
}

function getActivityActionLabel(activity: AdminActivityItem) {
  const entityLabel =
    {
      venue: "venue",
      contact: "contact",
      touchpoint: "inventory",
      interaction: "interaction",
      auth: "session",
    }[activity.entityType] || activity.entityType;

  const verb =
    {
      view: "viewed",
      create: "created",
      import: "imported",
      login: "signed in",
      session: "used",
      logout: "signed out",
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
      login: "cyan",
      session: "blue",
      logout: "gold",
      update: "blue",
      delete: "red",
    }[action] || "default"
  );
}

function getActivityTarget(activity: AdminActivityItem) {
  if (activity.entityType === "auth") {
    return "/admin/activity";
  }

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
  const [search, setSearch] = useState("");
  const [filterKey, setFilterKey] =
    useState<ActivityFilterKey>("all");
  const [actorFilter, setActorFilter] = useState<string>();
  const [viewMode, setViewMode] = useState<ActivityViewMode>("compact");
  const [expandedActivityIds, setExpandedActivityIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchActivity = async () => {
      setActivityLoading(true);
      setActivityError("");

      try {
        const response = await fetch(`${ACTIVITY_ENDPOINT}?limit=250`, {
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

  const actorOptions = useMemo(() => {
    return [...new Set(activities.map((activity) => activity.actorEmail).filter(Boolean))]
      .sort((left, right) => String(left).localeCompare(String(right)))
      .map((actorEmail) => ({
        label: String(actorEmail),
        value: String(actorEmail),
      }));
  }, [activities]);

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();

    return activities.filter((activity) => {
      if (filterKey !== "all" && getActivityFilterKey(activity) !== filterKey) {
        return false;
      }

      if (actorFilter && activity.actorEmail !== actorFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        activity.entityName,
        activity.entityId,
        activity.entityType,
        activity.action,
        activity.actorEmail,
        ...getActivityDetailTags(activity),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [activities, actorFilter, filterKey, search]);

  const groupedActivities = useMemo(() => {
    const groups = new Map<string, ActivityGroup>();

    for (const activity of filteredActivities) {
      const groupMeta = getActivityGroupMeta(activity);
      const current = groups.get(groupMeta.key);

      if (current) {
        current.items.push(activity);
      } else {
        groups.set(groupMeta.key, {
          key: groupMeta.key,
          label: groupMeta.label,
          items: [activity],
        });
      }
    }

    return ["today", "yesterday", "week", "older"]
      .map((key) => groups.get(key))
      .filter((group): group is ActivityGroup => Boolean(group));
  }, [filteredActivities]);

  const summary = useMemo(() => {
    let todayCount = 0;
    let weekCount = 0;

    for (const activity of activities) {
      const groupMeta = getActivityGroupMeta(activity);
      if (groupMeta.key === "today") {
        todayCount += 1;
      }
      if (groupMeta.key === "today" || groupMeta.key === "yesterday" || groupMeta.key === "week") {
        weekCount += 1;
      }
    }

    return {
      total: activities.length,
      today: todayCount,
      last7Days: weekCount,
      showing: filteredActivities.length,
    };
  }, [activities, filteredActivities.length]);

  const activeUsersToday = useMemo(() => {
    const rows = new Map<string, ActiveUserSummary>();

    for (const activity of activities) {
      if (activity.entityType !== "auth") continue;
      if (getActivityGroupMeta(activity).key !== "today") continue;
      const email = String(activity.actorEmail || "").toLowerCase();
      if (!email) continue;

      const current = rows.get(email);
      const label = getUserDisplayName(activity);

      if (!current) {
        rows.set(email, {
          email,
          label,
          lastSeen: activity.createdAt,
          eventCount: 1,
        });
        continue;
      }

      current.eventCount += 1;
      if (activity.entityType === "auth" && activity.entityName) {
        current.label = getUserDisplayName(activity);
      }
      if (new Date(activity.createdAt).getTime() > new Date(current.lastSeen).getTime()) {
        current.lastSeen = activity.createdAt;
      }
    }

    return [...rows.values()].sort(
      (left, right) =>
        new Date(right.lastSeen).getTime() - new Date(left.lastSeen).getTime(),
    );
  }, [activities]);

  const dailyUsage = useMemo(() => {
    const today = new Date();
    const todayStart = getDayStart(today);
    const dayBuckets = new Map<string, Map<string, DailyUsageUserSummary>>();

    for (const activity of activities) {
      const dateKey = getDateKey(activity.createdAt);
      if (!dateKey) continue;

      const activityDate = new Date(activity.createdAt);
      const diffDays = Math.floor(
        (todayStart.getTime() - getDayStart(activityDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (diffDays < 0 || diffDays > 6) continue;

      const email = String(activity.actorEmail || "").toLowerCase();
      if (!email) continue;

      const users = dayBuckets.get(dateKey) || new Map<string, DailyUsageUserSummary>();
      const current = users.get(email);
      const isAuthEvent = activity.entityType === "auth";
      const label = getUserDisplayName(activity);

      if (!current) {
        users.set(email, {
          email,
          label,
          totalEvents: 1,
          authEvents: isAuthEvent ? 1 : 0,
          lastSeen: activity.createdAt,
        });
      } else {
        current.totalEvents += 1;
        current.authEvents += isAuthEvent ? 1 : 0;
        if (isAuthEvent && activity.entityName) {
          current.label = label;
        }
        if (
          new Date(activity.createdAt).getTime() >
          new Date(current.lastSeen).getTime()
        ) {
          current.lastSeen = activity.createdAt;
        }
      }

      dayBuckets.set(dateKey, users);
    }

    return [...dayBuckets.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([dateKey, users]) => ({
        dateKey,
        label: dateKey === new Date().toISOString().slice(0, 10)
          ? "Today"
          : formatDayLabel(dateKey),
        users: [...users.values()].sort(
          (left, right) =>
            new Date(right.lastSeen).getTime() -
            new Date(left.lastSeen).getTime(),
        ),
      } satisfies DailyUsageSummary));
  }, [activities]);

  const toggleExpanded = (activityId: string) => {
    setExpandedActivityIds((current) =>
      current.includes(activityId)
        ? current.filter((id) => id !== activityId)
        : [...current, activityId],
    );
  };

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
            events across the admin workspace. Filter by type or actor, then
            scan the feed in time groups instead of one long flat list.
          </Typography.Paragraph>
        </Space>
      </Card>

      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(5, minmax(120px, 1fr))",
            minWidth: 640,
          }}
        >
          <Card size="small" styles={{ body: { padding: 14 } }} style={{ borderRadius: 16 }}>
            <Statistic title="Showing" value={summary.showing} valueStyle={{ fontSize: 24 }} />
          </Card>
          <Card size="small" styles={{ body: { padding: 14 } }} style={{ borderRadius: 16 }}>
            <Statistic title="Today" value={summary.today} valueStyle={{ fontSize: 24 }} />
          </Card>
          <Card size="small" styles={{ body: { padding: 14 } }} style={{ borderRadius: 16 }}>
            <Statistic title="Last 7 days" value={summary.last7Days} valueStyle={{ fontSize: 24 }} />
          </Card>
          <Card size="small" styles={{ body: { padding: 14 } }} style={{ borderRadius: 16 }}>
            <Statistic title="Recent total" value={summary.total} valueStyle={{ fontSize: 24 }} />
          </Card>
          <Card size="small" styles={{ body: { padding: 14 } }} style={{ borderRadius: 16 }}>
            <Statistic title="Active users today" value={activeUsersToday.length} valueStyle={{ fontSize: 24 }} />
          </Card>
        </div>
      </div>

      <Card
        title="Active today"
        styles={{ body: { padding: 20 } }}
        style={{
          borderRadius: 20,
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
        }}
      >
        {activeUsersToday.length ? (
          <Space size={[8, 8]} wrap>
            {activeUsersToday.map((user) => (
              <Tag key={user.email} color="blue" style={{ padding: "6px 10px", borderRadius: 999 }}>
                {user.label} · {user.eventCount} events · last seen {formatDateTime(user.lastSeen)}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">
            No recorded user activity yet for today. New sign-ins and daily presence checks will appear here.
          </Typography.Text>
        )}
      </Card>

      <Card
        title="Daily usage"
        extra={
          <Typography.Text type="secondary">Last 7 days</Typography.Text>
        }
        styles={{ body: { padding: 20 } }}
        style={{
          borderRadius: 20,
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
        }}
      >
        {dailyUsage.length ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {dailyUsage.map((day) => (
              <div key={day.dateKey}>
                <Space align="center" size={10} style={{ marginBottom: 10 }}>
                  <Typography.Text strong>{day.label}</Typography.Text>
                  <Tag>{day.users.length} active users</Tag>
                </Space>

                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  {day.users.map((user) => (
                    <div
                      key={`${day.dateKey}:${user.email}`}
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        border: "1px solid rgba(15, 23, 42, 0.08)",
                        background: "rgba(248,250,252,0.8)",
                      }}
                    >
                      <Row justify="space-between" align="middle" gutter={[12, 12]}>
                        <Col flex="auto">
                          <Typography.Text strong style={{ display: "block" }}>
                            {user.label}
                          </Typography.Text>
                          <Typography.Text type="secondary">
                            {user.email}
                          </Typography.Text>
                        </Col>
                        <Col>
                          <Space size={[8, 8]} wrap>
                            <Tag color="blue">{user.totalEvents} events</Tag>
                            <Tag color="cyan">{user.authEvents} auth events</Tag>
                            <Tag>Last seen {formatDateTime(user.lastSeen)}</Tag>
                          </Space>
                        </Col>
                      </Row>
                    </div>
                  ))}
                </Space>
              </div>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">
            No usage history recorded yet for the last 7 days.
          </Typography.Text>
        )}
      </Card>

      <Card
        styles={{ body: { padding: 20 } }}
        style={{
          borderRadius: 20,
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
        }}
      >
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} xl={14}>
              <Input.Search
                allowClear
                size="large"
                placeholder="Search by entity, ID, actor, or activity details"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Col>
            <Col xs={24} xl={10}>
              <Segmented
                block
                value={viewMode}
                onChange={(value) => setViewMode(value as ActivityViewMode)}
                options={[
                  { label: "Compact", value: "compact" },
                  { label: "Detailed", value: "detailed" },
                ]}
              />
            </Col>
          </Row>

          <Segmented
            block
            value={filterKey}
            onChange={(value) => setFilterKey(value as ActivityFilterKey)}
            options={[
              { label: "All", value: "all" },
              { label: "Venues", value: "venue" },
              { label: "CRM", value: "crm" },
              { label: "Imports", value: "imports" },
              { label: "Usage", value: "usage" },
              { label: "Interactions", value: "interactions" },
            ]}
          />

          <Select
            allowClear
            size="large"
            placeholder="Filter by actor"
            value={actorFilter}
            options={actorOptions}
            onChange={(value) => setActorFilter(value)}
          />
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
        ) : filteredActivities.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No activity matches the current filters."
          >
            <Button
              onClick={() => {
                setSearch("");
                setFilterKey("all");
                setActorFilter(undefined);
              }}
            >
              Clear filters
            </Button>
          </Empty>
        ) : (
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            {groupedActivities.map((group) => (
              <div key={group.key}>
                <Space
                  align="center"
                  size={10}
                  style={{ marginBottom: 12 }}
                >
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    {group.label}
                  </Typography.Title>
                  <Tag>{group.items.length}</Tag>
                </Space>

                <Space direction="vertical" size={10} style={{ width: "100%" }}>
                  {group.items.map((activity) => {
                    const metadata = getActivityMetadata(activity);
                    const detailTags = getActivityDetailTags(activity);
                    const accent = getActivityAccentColor(activity.action);
                    const surfaceStyle = getActivitySurfaceStyle(activity.action);
                    const priorityLabel = getActivityPriorityLabel(activity.action);
                    const isExpanded = expandedActivityIds.includes(activity.id);
                    const showDetails = viewMode === "detailed" || isExpanded;

                    return (
                      <div
                        key={activity.id}
                        style={{
                          padding: 16,
                          borderRadius: 16,
                          border: `1px solid ${surfaceStyle.borderColor}`,
                          borderLeft: `4px solid ${accent}`,
                          background: surfaceStyle.background,
                        }}
                      >
                        <Row justify="space-between" align="top" gutter={[12, 12]}>
                          <Col flex="auto">
                            <Space direction="vertical" size={8} style={{ width: "100%" }}>
                              <Space size={[8, 8]} wrap>
                                <Tag color={getActivityActionColor(activity.action)}>
                                  {activity.action}
                                </Tag>
                                <Tag>{activity.entityType}</Tag>
                                {priorityLabel ? <Tag color="gold">{priorityLabel}</Tag> : null}
                              </Space>

                              <div>
                                <Typography.Text strong style={{ display: "block", fontSize: 16 }}>
                                  {getPrimarySummary(activity)}
                                </Typography.Text>
                                <Typography.Text type="secondary">
                                  {getSecondarySummary(activity)}
                                </Typography.Text>
                              </div>

                              {metadata.length ? (
                                <Space size={[8, 8]} wrap>
                                  {metadata.map((item) => (
                                    <Tag key={item}>{item}</Tag>
                                  ))}
                                </Space>
                              ) : null}

                              {showDetails && detailTags.length ? (
                                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                                  <Typography.Text type="secondary">
                                    Details
                                  </Typography.Text>
                                  <Space size={[8, 8]} wrap>
                                    {detailTags.map((detail) => (
                                      <Tag key={detail}>{detail}</Tag>
                                    ))}
                                  </Space>
                                </Space>
                              ) : null}
                            </Space>
                          </Col>

                          <Col>
                            <Space direction="vertical" size={8} align="end">
                              <Typography.Text type="secondary">
                                {formatDateTime(activity.createdAt)}
                              </Typography.Text>
                              <Link to={getActivityTarget(activity)}>
                                <Button size="small">Open</Button>
                              </Link>
                              {viewMode === "compact" && detailTags.length ? (
                                <Button
                                  size="small"
                                  type="text"
                                  onClick={() => toggleExpanded(activity.id)}
                                >
                                  {isExpanded ? "Hide details" : "Show details"}
                                </Button>
                              ) : null}
                            </Space>
                          </Col>
                        </Row>
                      </div>
                    );
                  })}
                </Space>
              </div>
            ))}
          </Space>
        )}
      </Card>
    </div>
  );
}
