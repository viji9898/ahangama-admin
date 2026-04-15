import { Card, Space, Tag, Typography } from "antd";
import type { Venue } from "../../types/venue";
import { EmptyVenueState } from "./EmptyVenueState";
import { StickySaveBar } from "./StickySaveBar";
import { VenueEditorTabs } from "./VenueEditorTabs";

type Props = {
  venue?: Venue;
  categoryOptions: Array<{ label: string; value: string }>;
  dirty: boolean;
  saving: boolean;
  saveState: "idle" | "saving" | "saved";
  onPatch: (patch: Partial<Venue>) => void;
  onCancel: () => void;
  onSave: () => void;
  onCreate: () => void;
};

export function VenueEditorPanel({
  venue,
  categoryOptions,
  dirty,
  saving,
  saveState,
  onPatch,
  onCancel,
  onSave,
  onCreate,
}: Props) {
  return (
    <Card
      styles={{ body: { padding: 20 } }}
      style={{
        borderRadius: 24,
        border: "1px solid rgba(15, 23, 42, 0.06)",
        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
        background: "rgba(250, 250, 249, 0.96)",
      }}
    >
      {venue ? (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <div>
            <Space size={8} wrap style={{ marginBottom: 8 }}>
              <Typography.Text type="secondary">Editor</Typography.Text>
              {dirty ? <Tag color="gold">Unsaved</Tag> : null}
              {saveState === "saved" ? <Tag color="green">Saved</Tag> : null}
            </Space>
            <Typography.Title level={4} style={{ margin: 0 }}>
              Edit Venue
            </Typography.Title>
            <Typography.Text type="secondary">
              Make changes directly here. The selected venue updates only when
              you save.
            </Typography.Text>
          </div>

          <div
            style={{
              maxHeight: "calc(100vh - 10px)",
              overflowY: "auto",
              paddingRight: 4,
              paddingBottom: 4,
            }}
          >
            <VenueEditorTabs
              venue={venue}
              categoryOptions={categoryOptions}
              onPatch={onPatch}
            />
            <StickySaveBar
              dirty={dirty}
              saving={saving}
              saveState={saveState}
              onCancel={onCancel}
              onSave={onSave}
            />
          </div>
        </Space>
      ) : (
        <EmptyVenueState
          title="No venue selected"
          description="Choose a venue from the browser to start editing, or create a new venue to build out the collection."
          actionLabel="Create New Venue"
          onAction={onCreate}
        />
      )}
    </Card>
  );
}
