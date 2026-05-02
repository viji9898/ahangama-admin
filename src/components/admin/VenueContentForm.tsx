import { Alert, Button, Form, Input, Space, Typography } from "antd";
import type { Venue } from "../../types/venue";
import { listToText, textToList } from "./venueAdminUtils";

type Props = {
  venue: Venue;
  onPatch: (patch: Partial<Venue>) => void;
  onGenerateContent: () => Promise<void>;
  generatingContent: boolean;
};

export function VenueContentForm({
  venue,
  onPatch,
  onGenerateContent,
  generatingContent,
}: Props) {
  return (
    <Form layout="vertical" style={{ paddingTop: 8 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="AI Content Assistant"
        description={
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <Typography.Text type="secondary">
              Generate a stronger excerpt, description, best-for list, and tags
              from the venue details already in this record. Review the draft
              before saving.
            </Typography.Text>
            <div>
              <Button
                loading={generatingContent}
                onClick={() => void onGenerateContent()}
              >
                Generate Content
              </Button>
            </div>
          </Space>
        }
      />

      <Form.Item label="Excerpt">
        <Input.TextArea
          rows={3}
          value={venue.excerpt || ""}
          onChange={(event) => onPatch({ excerpt: event.target.value })}
          placeholder="A short summary that sets the tone for the venue."
        />
      </Form.Item>

      <Form.Item label="Description">
        <Input.TextArea
          rows={8}
          value={venue.description || ""}
          onChange={(event) => onPatch({ description: event.target.value })}
          placeholder="Long-form venue description"
        />
      </Form.Item>

      <Form.Item label="Best for (one per line)">
        <Input.TextArea
          rows={4}
          value={listToText(venue.bestFor)}
          onChange={(event) =>
            onPatch({ bestFor: textToList(event.target.value) })
          }
          placeholder={"Post-surf lunch\nRemote work\nGolden hour"}
        />
      </Form.Item>

      <Form.Item label="Tags (one per line)">
        <Input.TextArea
          rows={4}
          value={listToText(venue.tags)}
          onChange={(event) =>
            onPatch({ tags: textToList(event.target.value) })
          }
          placeholder={"Cafe\nBrunch\nAhangama"}
        />
      </Form.Item>
    </Form>
  );
}
