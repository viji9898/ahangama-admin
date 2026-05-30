import { Alert, Button, Form, Input, Select, Space, Typography } from "antd";
import { useState } from "react";
import type { Venue } from "../../types/venue";
import { normalizeStringArray } from "./venueAdminUtils";

type Props = {
  venue: Venue;
  onPatch: (patch: Partial<Venue>) => void;
  onGenerateContent: () => Promise<void>;
  generatingContent: boolean;
};

type TagFieldProps = {
  label: string;
  value: string[];
  placeholder: string;
  onChange: (nextValue: string[]) => void;
};

function TagField({ label, value, placeholder, onChange }: TagFieldProps) {
  const [searchValue, setSearchValue] = useState("");

  const commitPendingValue = () => {
    const pendingValues = normalizeStringArray(
      searchValue
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    );

    if (!pendingValues.length) return;

    onChange(normalizeStringArray([...value, ...pendingValues]));
    setSearchValue("");
  };

  return (
    <Form.Item label={label}>
      <Select
        mode="tags"
        open={false}
        value={value}
        searchValue={searchValue}
        onSearch={setSearchValue}
        onBlur={commitPendingValue}
        onChange={(nextValue) => onChange(normalizeStringArray(nextValue))}
        onInputKeyDown={(event) => {
          if (event.key === "Tab") {
            commitPendingValue();
          }
        }}
        tokenSeparators={[","]}
        placeholder={placeholder}
        style={{ width: "100%" }}
      />
    </Form.Item>
  );
}

export function VenueContentForm({
  venue,
  onPatch,
  onGenerateContent,
  generatingContent,
}: Props) {
  const bestForValues = normalizeStringArray(venue.bestFor);
  const tagValues = normalizeStringArray(venue.tags);

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

      <TagField
        label="Best for"
        value={bestForValues}
        placeholder="Add phrases like Post-surf lunch, Remote work, Golden hour"
        onChange={(value) => onPatch({ bestFor: value })}
      />

      <TagField
        label="Tags"
        value={tagValues}
        placeholder="Add tags like Cafe, Brunch, Ahangama"
        onChange={(value) => onPatch({ tags: value })}
      />
    </Form>
  );
}
