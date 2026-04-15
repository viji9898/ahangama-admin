import { Form, Input } from "antd";
import type { Venue } from "../../types/venue";
import { listToText, textToList } from "./venueAdminUtils";

type Props = {
  venue: Venue;
  onPatch: (patch: Partial<Venue>) => void;
};

export function VenueContentForm({ venue, onPatch }: Props) {
  return (
    <Form layout="vertical" style={{ paddingTop: 8 }}>
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
