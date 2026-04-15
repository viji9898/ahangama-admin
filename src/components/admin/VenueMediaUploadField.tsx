import { Button, Card, Space, Typography, message } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type VenueMediaKind,
  uploadVenueMediaToS3,
  venueMediaDimensions,
  venueMediaLabel,
  venueMediaMaxBytes,
} from "./venueMediaUpload";

type Props = {
  kind: VenueMediaKind;
  venueId?: string;
  value?: string;
  compact?: boolean;
  onUploaded: (url: string) => void;
};

export function VenueMediaUploadField({
  kind,
  venueId,
  value,
  compact = false,
  onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cacheBust, setCacheBust] = useState(Date.now());
  const [previewSource, setPreviewSource] = useState(value || "");

  useEffect(() => {
    setPreviewSource(value || "");
  }, [value]);

  const previewUrl = useMemo(() => {
    if (!previewSource) return "";
    const separator = previewSource.includes("?") ? "&" : "?";
    return `${previewSource}${separator}v=${cacheBust}`;
  }, [cacheBust, previewSource]);

  const rules = venueMediaDimensions[kind];
  const helperText = rules.exact
    ? `${rules.width}×${rules.height}px, ≤${Math.round(venueMediaMaxBytes[kind] / 1024)}KB, JPG`
    : `up to ${rules.width}×${rules.height}px, ≤${Math.round(venueMediaMaxBytes[kind] / 1024)}KB, JPG`;

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !venueId) return;

    setUploading(true);
    try {
      const upload = await uploadVenueMediaToS3({ venueId, kind, file });
      setPreviewSource(upload.publicUrl);
      onUploaded(upload.publicUrl);
      setCacheBust(Date.now());
      message.success(`${venueMediaLabel[kind]} uploaded.`);
    } catch (error) {
      message.error(String((error as Error)?.message || error));
    } finally {
      setUploading(false);
    }
  };

  const previewHeight = compact ? 88 : kind === "logo" ? 140 : 180;
  const previewAspectRatio = `${rules.width} / ${rules.height}`;

  return (
    <Card
      size="small"
      title={venueMediaLabel[kind]}
      styles={{ body: { padding: compact ? 12 : 14 } }}
      style={{ borderRadius: 16 }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <Space direction="vertical" size={10} style={{ width: "100%" }}>
        <div
          style={{
            height: previewHeight,
            width: "100%",
            aspectRatio: compact ? undefined : previewAspectRatio,
            borderRadius: 12,
            background: "rgba(226, 232, 240, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            border: "1px solid rgba(15, 23, 42, 0.06)",
            padding: compact ? 8 : 12,
            boxSizing: "border-box",
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={venueMediaLabel[kind]}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            <Typography.Text type="secondary">Missing media</Typography.Text>
          )}
        </div>

        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {helperText}
          </Typography.Text>
          <Button
            size="small"
            onClick={() => inputRef.current?.click()}
            loading={uploading}
            disabled={uploading || !venueId}
          >
            Upload
          </Button>
        </Space>
        {!venueId ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Set a venue ID first. Uploads are stored under that ID.
          </Typography.Text>
        ) : null}
      </Space>
    </Card>
  );
}
