import { Tabs } from "antd";
import type { Venue } from "../../types/venue";
import { VenueContentForm } from "./VenueContentForm";
import { VenueLocationSocialForm } from "./VenueLocationSocialForm";
import { VenueMediaForm } from "./VenueMediaForm";
import { VenueOffersForm } from "./VenueOffersForm";
import { VenueOverviewForm } from "./VenueOverviewForm";

type Props = {
  venue: Venue;
  categoryOptions: Array<{ label: string; value: string }>;
  onPatch: (patch: Partial<Venue>) => void;
};

export function VenueEditorTabs({ venue, categoryOptions, onPatch }: Props) {
  return (
    <Tabs
      defaultActiveKey="overview"
      items={[
        {
          key: "overview",
          label: "Overview",
          children: (
            <VenueOverviewForm
              venue={venue}
              categoryOptions={categoryOptions}
              onPatch={onPatch}
            />
          ),
        },
        {
          key: "content",
          label: "Content",
          children: <VenueContentForm venue={venue} onPatch={onPatch} />,
        },
        {
          key: "media",
          label: "Media",
          children: <VenueMediaForm venue={venue} onPatch={onPatch} />,
        },
        {
          key: "offers",
          label: "Offers",
          children: <VenueOffersForm venue={venue} onPatch={onPatch} />,
        },
        {
          key: "location",
          label: "Location & Social",
          children: <VenueLocationSocialForm venue={venue} onPatch={onPatch} />,
        },
      ]}
    />
  );
}
