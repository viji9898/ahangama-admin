import { VenueImages } from "../components/VenueImages";
import { VenueBasicInfo } from "../components/VenueBasicInfo";
import { VenueCategoriesTags } from "../components/VenueCategoriesTags";
import { VenueRatingsOffers } from "../components/VenueRatingsOffers";
import { VenueDescription } from "../components/VenueDescription";
import { VenueLocationSocial } from "../components/VenueLocationSocial";
import { VenueCuration } from "../components/VenueCuration";
import { Card, Space, Tabs, Tag, Typography } from "antd";
import { useEffect, useState } from "react";

import type { Venue } from "../types/venue";

type Props = {
  venue?: Venue;
  onVenueUpdated?: (venue: Partial<Venue>) => void;
};

export default function VenueDetail({ venue, onVenueUpdated }: Props) {
  const [localVenue, setLocalVenue] = useState<Venue | undefined>(venue);

  useEffect(() => {
    setLocalVenue(venue);
  }, [venue]);

  const handleVenueUpdated = (updated: Partial<Venue> | undefined) => {
    if (!updated) return;
    onVenueUpdated?.(updated);
    setLocalVenue((prev) => {
      const updatedId = updated?.id;
      if (prev?.id && updatedId && prev.id === updatedId) {
        return { ...prev, ...updated };
      }
      return { ...(prev || {}), ...updated };
    });
  };

  if (!localVenue) {
    return (
      <div style={{ color: "#888", padding: 24 }}>
        Select a venue to view details.
      </div>
    );
  }

  const tabs = [
    {
      key: "overview",
      label: "Overview",
      children: (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <VenueBasicInfo
            venue={localVenue}
            onVenueUpdated={handleVenueUpdated}
          />
          <VenueCuration
            venue={localVenue}
            onVenueUpdated={handleVenueUpdated}
          />
          <VenueCategoriesTags venue={localVenue} />
        </Space>
      ),
    },
    {
      key: "content",
      label: "Content",
      children: (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <VenueDescription
            venue={localVenue}
            onVenueUpdated={handleVenueUpdated}
          />
          <VenueRatingsOffers
            venue={localVenue}
            onVenueUpdated={handleVenueUpdated}
          />
        </Space>
      ),
    },
    {
      key: "media",
      label: "Media",
      children: (
        <VenueImages venue={localVenue} onVenueUpdated={handleVenueUpdated} />
      ),
    },
    {
      key: "location",
      label: "Location & Social",
      children: (
        <VenueLocationSocial
          venue={localVenue}
          onVenueUpdated={handleVenueUpdated}
        />
      ),
    },
  ];

  return (
    <div
      style={{
        border: "1px solid rgba(15, 23, 42, 0.06)",
        borderRadius: 20,
        padding: 24,
        background: "rgba(250, 250, 249, 0.92)",
        width: "100%",
        minWidth: 0,
        maxWidth: "none",
        maxHeight: "calc(100vh - 240px)",
        overflowY: "auto",
        boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
      }}
    >
      <Space direction="vertical" size={20} style={{ width: "100%" }}>
        <Card
          size="small"
          styles={{ body: { padding: 20 } }}
          style={{
            borderRadius: 16,
            border: "1px solid rgba(15, 23, 42, 0.06)",
            background: "rgba(255, 255, 255, 0.7)",
          }}
        >
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <Typography.Text type="secondary">
              Editing workspace
            </Typography.Text>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {localVenue?.name}
            </Typography.Title>
            <Space size={[8, 8]} wrap>
              {localVenue?.id ? (
                <Tag bordered={false}>{localVenue.id}</Tag>
              ) : null}
              {localVenue?.slug ? (
                <Tag bordered={false}>{localVenue.slug}</Tag>
              ) : null}
              <Tag color={(localVenue?.live ?? true) ? "green" : "default"}>
                {(localVenue?.live ?? true) ? "Live" : "Coming soon"}
              </Tag>
              {localVenue?.status ? <Tag>{localVenue.status}</Tag> : null}
              {localVenue?.area ? <Tag>{localVenue.area}</Tag> : null}
            </Space>
          </Space>
        </Card>

        <Tabs
          defaultActiveKey="overview"
          items={tabs}
          style={{ width: "100%" }}
          tabBarStyle={{ marginBottom: 16 }}
        />
      </Space>
    </div>
  );
}
