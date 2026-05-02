import {
  Alert,
  Button,
  Card,
  Input,
  Segmented,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import type { VenueFilterKey } from "./venueAdminUtils";

type VenueSearchInterpretation = {
  summary: string;
  chips: string[];
};

type Props = {
  search: string;
  aiQuery: string;
  filterKey: VenueFilterKey;
  categoryFilter?: string;
  onSearchChange: (value: string) => void;
  onAiQueryChange: (value: string) => void;
  onAiSearch: () => void;
  onClearAiSearch: () => void;
  onFilterChange: (value: VenueFilterKey) => void;
  onCategoryChange: (value?: string) => void;
  categoryOptions: Array<{ label: string; value: string }>;
  aiSearching: boolean;
  aiSearchActive: boolean;
  aiSearchError?: string;
  aiInterpretation?: VenueSearchInterpretation;
  counts: {
    total: number;
    live: number;
    comingSoon: number;
    results: number;
  };
};

export function VenueSearchAndFilters({
  search,
  aiQuery,
  filterKey,
  categoryFilter,
  onSearchChange,
  onAiQueryChange,
  onAiSearch,
  onClearAiSearch,
  onFilterChange,
  onCategoryChange,
  categoryOptions,
  aiSearching,
  aiSearchActive,
  aiSearchError,
  aiInterpretation,
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

      <Card
        size="small"
        styles={{ body: { padding: 14 } }}
        style={{ borderRadius: 16, background: "rgba(248,250,252,0.75)" }}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <div>
            <Typography.Text strong>Search Assistant</Typography.Text>
            <Typography.Paragraph
              type="secondary"
              style={{ margin: "4px 0 0" }}
            >
              Ask for structured filters like venues with weak copy and no tags,
              or pass venues that mention brunch but have no offer configured.
            </Typography.Paragraph>
          </div>

          <Input.Search
            allowClear
            enterButton="Run"
            placeholder="Try: pass venues that mention brunch but have no offer configured"
            value={aiQuery}
            onChange={(event) => onAiQueryChange(event.target.value)}
            onSearch={() => onAiSearch()}
            loading={aiSearching}
          />

          {aiSearchError ? (
            <Alert type="error" showIcon message={aiSearchError} />
          ) : null}

          {aiInterpretation?.summary ? (
            <Space direction="vertical" size={10} style={{ width: "100%" }}>
              <Typography.Text>{aiInterpretation.summary}</Typography.Text>
              {aiInterpretation.chips.length ? (
                <Space size={[8, 8]} wrap>
                  {aiInterpretation.chips.map((chip) => (
                    <Tag key={chip} color="gold">
                      {chip}
                    </Tag>
                  ))}
                </Space>
              ) : null}
            </Space>
          ) : null}

          {aiSearchActive ? (
            <div>
              <Button onClick={onClearAiSearch}>Clear Assistant Search</Button>
            </div>
          ) : null}
        </Space>
      </Card>

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
