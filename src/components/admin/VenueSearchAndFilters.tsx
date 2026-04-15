import { Card, Input, Segmented, Select, Space, Statistic } from "antd";
import type { VenueFilterKey } from "./venueAdminUtils";

type Props = {
  search: string;
  filterKey: VenueFilterKey;
  categoryFilter?: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: VenueFilterKey) => void;
  onCategoryChange: (value?: string) => void;
  categoryOptions: Array<{ label: string; value: string }>;
  counts: {
    total: number;
    live: number;
    comingSoon: number;
    results: number;
  };
};

export function VenueSearchAndFilters({
  search,
  filterKey,
  categoryFilter,
  onSearchChange,
  onFilterChange,
  onCategoryChange,
  categoryOptions,
  counts,
}: Props) {
  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <Input.Search
        allowClear
        size="large"
        placeholder="Search venues, areas, tags, or slugs"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />

      <Segmented
        block
        value={filterKey}
        onChange={(value) => onFilterChange(value as VenueFilterKey)}
        options={[
          { label: "All", value: "all" },
          { label: "Live", value: "live" },
          { label: "Coming Soon", value: "coming-soon" },
          { label: "Staff Picks", value: "staff-pick" },
        ]}
      />

      <Select
        allowClear
        size="large"
        placeholder="Filter by category"
        value={categoryFilter}
        options={categoryOptions}
        onChange={(value) => onCategoryChange(value)}
      />

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        }}
      >
        <Card
          size="small"
          styles={{ body: { padding: 14 } }}
          style={{ borderRadius: 16 }}
        >
          <Statistic title="Results" value={counts.results} />
        </Card>
        <Card
          size="small"
          styles={{ body: { padding: 14 } }}
          style={{ borderRadius: 16 }}
        >
          <Statistic title="Total" value={counts.total} />
        </Card>
        <Card
          size="small"
          styles={{ body: { padding: 14 } }}
          style={{ borderRadius: 16 }}
        >
          <Statistic title="Live" value={counts.live} />
        </Card>
        <Card
          size="small"
          styles={{ body: { padding: 14 } }}
          style={{ borderRadius: 16 }}
        >
          <Statistic title="Coming Soon" value={counts.comingSoon} />
        </Card>
      </div>
    </Space>
  );
}
