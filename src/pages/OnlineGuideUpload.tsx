import {
  CopyOutlined,
  FileImageOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnsType } from "antd/es/table";
import type { Venue } from "../types/venue";
import "./OnlineGuideUpload.css";

const VENUES_ENDPOINT = "/.netlify/functions/api-venues-list";
const MEDIA_ENDPOINT = "/.netlify/functions/api-online-guide-media";
const PRESIGN_ENDPOINT =
  "/.netlify/functions/api-online-guide-media-presign";
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type MediaRow = {
  id: string;
  venueId?: string | null;
  venueName?: string | null;
  description: string;
  originalFilename: string;
  key: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  uploadedBy?: string | null;
  createdAt: string;
};

type PresignedUpload = {
  id: string;
  url: string;
  fields: Record<string, string>;
  key: string;
  publicUrl: string;
  contentType: string;
  maxBytes: number;
};

const slug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const extensionFor = (file?: File | null) => {
  if (file?.type === "image/png") return "png";
  if (file?.type === "image/webp") return "webp";
  return "jpg";
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const loadDimensions = async (file: File) => {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to read image dimensions"));
    });
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
};

const copyUrl = async (url: string) => {
  await navigator.clipboard.writeText(url);
  message.success("Image URL copied");
};

export default function OnlineGuideUpload() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [venueId, setVenueId] = useState<string>();
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpload, setLastUpload] = useState<MediaRow | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [venueResponse, mediaResponse] = await Promise.all([
          fetch(VENUES_ENDPOINT, {
            credentials: "include",
            signal: controller.signal,
          }),
          fetch(MEDIA_ENDPOINT, {
            credentials: "include",
            signal: controller.signal,
          }),
        ]);
        const venuePayload = await venueResponse.json().catch(() => ({}));
        const mediaPayload = await mediaResponse.json().catch(() => ({}));
        if (!venueResponse.ok) {
          throw new Error(venuePayload.error || "Unable to load venues");
        }
        if (!mediaResponse.ok) {
          throw new Error(mediaPayload.error || "Unable to load media");
        }
        setVenues(Array.isArray(venuePayload.venues) ? venuePayload.venues : []);
        setMedia(Array.isArray(mediaPayload.media) ? mediaPayload.media : []);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError(String((loadError as Error).message || loadError));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const suggestedFilename = `${venueId || "general"}-${slug(description) || "description"}-unique-id.${extensionFor(file)}`;
  const filteredMedia = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return media;
    return media.filter((item) =>
      [item.description, item.venueName, item.venueId, item.originalFilename]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [media, search]);

  const selectFile = (nextFile?: File) => {
    if (!nextFile) return;
    if (!ACCEPTED_TYPES.has(nextFile.type)) {
      message.error("Only JPG, PNG, and WebP images are allowed");
      return;
    }
    if (nextFile.size > MAX_BYTES) {
      message.error("Images must be 10 MB or smaller");
      return;
    }
    setFile(nextFile);
  };

  const handleUpload = async () => {
    if (!description.trim()) {
      message.error("Add a short image description");
      return;
    }
    if (!file) {
      message.error("Choose an image to upload");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const dimensions = await loadDimensions(file);
      const presignResponse = await fetch(PRESIGN_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: venueId || "",
          description,
          contentType: file.type,
        }),
      });
      const presignPayload = await presignResponse.json().catch(() => ({}));
      if (!presignResponse.ok || presignPayload.ok !== true) {
        throw new Error(presignPayload.error || "Unable to prepare upload");
      }
      const upload = presignPayload.upload as PresignedUpload;
      const formData = new FormData();
      Object.entries(upload.fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.append("file", file);

      const uploadResponse = await fetch(upload.url, {
        method: "POST",
        body: formData,
      });
      if (!uploadResponse.ok) {
        throw new Error(`S3 upload failed (${uploadResponse.status})`);
      }

      const finalizeResponse = await fetch(MEDIA_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: upload.id,
          venueId: venueId || "",
          description,
          originalFilename: file.name,
          key: upload.key,
          contentType: file.type,
          sizeBytes: file.size,
          ...dimensions,
        }),
      });
      const finalizePayload = await finalizeResponse.json().catch(() => ({}));
      if (!finalizeResponse.ok || finalizePayload.ok !== true) {
        throw new Error(finalizePayload.error || "Unable to save media record");
      }

      const saved = finalizePayload.media as MediaRow;
      const selectedVenue = venues.find((venue) => venue.id === venueId);
      const next = { ...saved, venueName: selectedVenue?.name || null };
      setMedia((current) => [next, ...current]);
      setLastUpload(next);
      setDescription("");
      setFile(null);
      message.success("Online Guide image uploaded");
    } catch (uploadError) {
      setError(String((uploadError as Error).message || uploadError));
    } finally {
      setUploading(false);
    }
  };

  const columns: ColumnsType<MediaRow> = [
    {
      title: "Image",
      width: 88,
      render: (_, item) => (
        <img className="online-guide-media__thumb" src={item.url} alt="" />
      ),
    },
    {
      title: "Media",
      render: (_, item) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{item.description}</Typography.Text>
          <Typography.Text type="secondary" className="online-guide-media__key">
            {item.key.replace("ahangama-online-guide/", "")}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Venue",
      width: 190,
      render: (_, item) =>
        item.venueId ? <Tag>{item.venueName || item.venueId}</Tag> : <Tag>General</Tag>,
    },
    {
      title: "File",
      width: 150,
      render: (_, item) => (
        <Typography.Text type="secondary">
          {formatBytes(item.sizeBytes)}
          {item.width && item.height ? ` · ${item.width}×${item.height}` : ""}
        </Typography.Text>
      ),
    },
    {
      title: "Uploaded",
      width: 180,
      render: (_, item) => new Date(item.createdAt).toLocaleString(),
    },
    {
      title: "",
      width: 56,
      fixed: "right",
      render: (_, item) => (
        <Button
          type="text"
          icon={<CopyOutlined />}
          aria-label={`Copy URL for ${item.description}`}
          title="Copy image URL"
          onClick={() => void copyUrl(item.url)}
        />
      ),
    },
  ];

  return (
    <div className="online-guide-media">
      <header className="online-guide-media__header">
        <div>
          <Typography.Text type="secondary">Upload · Online Guide</Typography.Text>
          <Typography.Title level={2}>Online Guide media</Typography.Title>
          <Typography.Paragraph type="secondary">
            Upload reusable guide imagery and copy its permanent S3 URL.
          </Typography.Paragraph>
        </div>
        <Tag color="blue">customer-apps-techhq / ahangama-online-guide</Tag>
      </header>

      {error ? <Alert type="error" showIcon message={error} closable onClose={() => setError("")} /> : null}

      <Spin spinning={loading}>
        <section className="online-guide-media__workspace">
          <div className="online-guide-media__form">
            <Typography.Title level={4}>Upload image</Typography.Title>
            <label>
              <span>Venue <Typography.Text type="secondary">(optional)</Typography.Text></span>
              <Select
                allowClear
                showSearch
                value={venueId}
                placeholder="General guide image"
                optionFilterProp="label"
                onChange={setVenueId}
                options={venues.map((venue) => ({
                  value: venue.id,
                  label: `${venue.name || venue.id} · ${venue.id}`,
                }))}
              />
            </label>
            <label>
              <span>Description</span>
              <Input
                value={description}
                maxLength={120}
                placeholder="e.g. rooftop sunset dining"
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <div>
              <span className="online-guide-media__label">Generated filename</span>
              <code>{suggestedFilename}</code>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => {
                selectFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className="online-guide-media__dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileImageOutlined />
              <strong>{file ? file.name : "Choose an image"}</strong>
              <span>{file ? formatBytes(file.size) : "JPG, PNG or WebP · up to 10 MB"}</span>
            </button>
            <Button
              type="primary"
              size="large"
              icon={<UploadOutlined />}
              loading={uploading}
              disabled={!file || !description.trim()}
              onClick={() => void handleUpload()}
            >
              Upload image
            </Button>
          </div>

          <div className="online-guide-media__preview">
            {previewUrl ? (
              <img src={previewUrl} alt="Selected upload preview" />
            ) : (
              <div>
                <FileImageOutlined />
                <span>Image preview</span>
              </div>
            )}
          </div>
        </section>

        {lastUpload ? (
          <section className="online-guide-media__result">
            <div>
              <Typography.Text type="secondary">Upload complete</Typography.Text>
              <Typography.Title level={4}>{lastUpload.description}</Typography.Title>
              <Typography.Text copyable={{ text: lastUpload.url }}>
                {lastUpload.url}
              </Typography.Text>
            </div>
            <Button icon={<CopyOutlined />} onClick={() => void copyUrl(lastUpload.url)}>
              Copy URL
            </Button>
          </section>
        ) : null}

        <section className="online-guide-media__library">
          <div className="online-guide-media__library-header">
            <div>
              <Typography.Title level={3}>Media library</Typography.Title>
              <Typography.Text type="secondary">{media.length} stored images</Typography.Text>
            </div>
            <Input.Search
              allowClear
              value={search}
              placeholder="Search media or venue"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Table<MediaRow>
            rowKey="id"
            columns={columns}
            dataSource={filteredMedia}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            scroll={{ x: 980 }}
          />
        </section>
      </Spin>
    </div>
  );
}