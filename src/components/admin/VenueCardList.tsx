import { Space } from "antd";
import type { Venue } from "../../types/venue";
import { EmptyVenueState } from "./EmptyVenueState";
import { VenueCardItem } from "./VenueCardItem";

type Props = {
  venues: Venue[];
  selectedVenueId?: string;
  onSelect: (venueId?: string) => void;
  onCreate: () => void;
};

export function VenueCardList({
  venues,
  selectedVenueId,
  onSelect,
  onCreate,
}: Props) {
  if (venues.length === 0) {
    return (
      <EmptyVenueState
        title="No venues found"
        description="Adjust the filters or create a new venue to start curating the directory."
        actionLabel="Create New Venue"
        onAction={onCreate}
      />
    );
  }

  return (
    <div
      style={{
        maxHeight: "calc(100vh - 280px)",
        overflowY: "auto",
        paddingRight: 4,
      }}
    >
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {venues.map((venue) => (
          <VenueCardItem
            key={venue.id || venue.slug || venue.name}
            venue={venue}
            isActive={Boolean(venue.id && venue.id === selectedVenueId)}
            onSelect={() => onSelect(venue.id)}
          />
        ))}
      </Space>
    </div>
  );
}
