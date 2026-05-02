import { Alert, Button, Card, Space, Typography } from "antd";
import type { Venue } from "../../types/venue";
import { VenueCardList } from "./VenueCardList";
import { VenueSearchAndFilters } from "./VenueSearchAndFilters";
import type { VenueFilterKey } from "./venueAdminUtils";

type Props = {
  venues: Venue[];
  selectedVenueId?: string;
  search: string;
  aiQuery: string;
  filterKey: VenueFilterKey;
  categoryFilter?: string;
  counts: {
    total: number;
    live: number;
    comingSoon: number;
    results: number;
  };
  categoryOptions: Array<{ label: string; value: string }>;
  loading: boolean;
  error?: string;
  onSearchChange: (value: string) => void;
  onAiQueryChange: (value: string) => void;
  onAiSearch: () => void;
  onClearAiSearch: () => void;
  onFilterChange: (value: VenueFilterKey) => void;
  onCategoryChange: (value?: string) => void;
  aiSearching: boolean;
  aiSearchActive: boolean;
  aiSearchError?: string;
  aiInterpretation?: {
    summary: string;
    chips: string[];
  };
  onSelectVenue: (venueId?: string) => void;
  onCreateVenue: () => void;
};

export function VenueBrowserPanel({
  venues,
  selectedVenueId,
  search,
  aiQuery,
  filterKey,
  categoryFilter,
  counts,
  categoryOptions,
  loading,
  error,
  onSearchChange,
  onAiQueryChange,
  onAiSearch,
  onClearAiSearch,
  onFilterChange,
  onCategoryChange,
  aiSearching,
  aiSearchActive,
  aiSearchError,
  aiInterpretation,
  onSelectVenue,
  onCreateVenue,
}: Props) {
  return (
    <Card
      loading={loading}
      styles={{ body: { padding: 20 } }}
      style={{
        borderRadius: 24,
        border: "1px solid rgba(15, 23, 42, 0.06)",
        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
      }}
    >
      <Space direction="vertical" size={18} style={{ width: "100%" }}>
        <Space
          style={{ width: "100%", justifyContent: "space-between" }}
          align="start"
        >
          <div>
            <Typography.Text type="secondary">Venue browser</Typography.Text>
            <Typography.Title level={4} style={{ margin: "4px 0 0" }}>
              Browse and scan
            </Typography.Title>
          </div>
          <Button type="primary" onClick={onCreateVenue}>
            New Venue
          </Button>
        </Space>

        {error ? <Alert type="error" showIcon message={error} /> : null}

        <VenueSearchAndFilters
          search={search}
          aiQuery={aiQuery}
          filterKey={filterKey}
          categoryFilter={categoryFilter}
          onSearchChange={onSearchChange}
          onAiQueryChange={onAiQueryChange}
          onAiSearch={onAiSearch}
          onClearAiSearch={onClearAiSearch}
          onFilterChange={onFilterChange}
          onCategoryChange={onCategoryChange}
          categoryOptions={categoryOptions}
          aiSearching={aiSearching}
          aiSearchActive={aiSearchActive}
          aiSearchError={aiSearchError}
          aiInterpretation={aiInterpretation}
          counts={counts}
        />

        <VenueCardList
          venues={venues}
          selectedVenueId={selectedVenueId}
          onSelect={onSelectVenue}
          onCreate={onCreateVenue}
        />
      </Space>
    </Card>
  );
}
