import { Alert, Button, Card, Space, Typography } from "antd";
import type { Venue } from "../../types/venue";
import { VenueCardList } from "./VenueCardList";
import { VenueSearchAndFilters } from "./VenueSearchAndFilters";

type Props = {
  venues: Venue[];
  selectedVenueId?: string;
  search: string;
  counts: {
    total: number;
    live: number;
    comingSoon: number;
    results: number;
  };
  loading: boolean;
  error?: string;
  onSearchChange: (value: string) => void;
  onSelectVenue: (venueId?: string) => void;
  onCreateVenue: () => void;
};

export function VenueBrowserPanel({
  venues,
  selectedVenueId,
  search,
  counts,
  loading,
  error,
  onSearchChange,
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
          onSearchChange={onSearchChange}
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
