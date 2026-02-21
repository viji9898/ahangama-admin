import { Button, Card, Col, Row, Space, message } from "antd";
import { useMemo, useRef, useState } from "react";

const PRESIGN_ENDPOINT = "/.netlify/functions/api-s3-presign";
const UPDATE_ENDPOINT = "/.netlify/functions/api-venues-update";

type Kind = "logo" | "image" | "ogImage";

const maxBytesForKind: Record<Kind, number> = {
  logo: 50 * 1024,
  image: 100 * 1024,
  ogImage: 100 * 1024,
};

const requiredDimsForKind: Record<Kind, { w: number; h: number }> = {
  logo: { w: 100, h: 100 },
  image: { w: 1200, h: 630 },
  ogImage: { w: 1200, h: 630 },
};

const labelForKind: Record<Kind, string> = {
  logo: "Logo",
  image: "Image",
  ogImage: "OG Image",
};

const fieldForKind: Record<Kind, "logo" | "image" | "ogImage"> = {
  logo: "logo",
  image: "image",
  ogImage: "ogImage",
};

const loadImageDimensions = async (file: File) => {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
    });
    return { w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
};

type Props = {
  venue: any;
  onVenueUpdated?: (venue: any) => void;
};

export function VenueImages({ venue, onVenueUpdated }: Props) {
  const [uploading, setUploading] = useState<Kind | null>(null);
  const [cacheBust, setCacheBust] = useState<number>(Date.now());

  const fileInputLogo = useRef<HTMLInputElement | null>(null);
  const fileInputImage = useRef<HTMLInputElement | null>(null);
  const fileInputOg = useRef<HTMLInputElement | null>(null);

  const inputForKind = (kind: Kind) => {
    if (kind === "logo") return fileInputLogo;
    if (kind === "image") return fileInputImage;
    return fileInputOg;
  };

  const busted = useMemo(() => {
    const addBust = (url?: string) => {
      if (!url) return url;
      const sep = url.includes("?") ? "&" : "?";
      return `${url}${sep}v=${cacheBust}`;
    };
    return {
      logo: addBust(venue?.logo),
      image: addBust(venue?.image),
      ogImage: addBust(venue?.ogImage),
    };
  }, [venue?.logo, venue?.image, venue?.ogImage, cacheBust]);

  const patchVenue = async (payload: Record<string, unknown>) => {
    const r = await fetch(UPDATE_ENDPOINT, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data?.ok !== true) {
      throw new Error(data?.error || `Failed (${r.status})`);
    }
    return data?.venue;
  };

  const presign = async (id: string, kind: Kind) => {
    const r = await fetch(PRESIGN_ENDPOINT, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, kind }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data?.ok !== true) {
      throw new Error(data?.error || `Failed (${r.status})`);
    }
    return data.upload as {
      url: string;
      fields: Record<string, string>;
      key: string;
      publicUrl: string;
      maxBytes: number;
      contentType: string;
    };
  };

  const uploadFile = async (kind: Kind, file: File) => {
    const id = String(venue?.id || "")
      .trim()
      .toLowerCase();
    if (!id) {
      message.error("Missing venue id");
      return;
    }

    if (file.type !== "image/jpeg") {
      message.error("Only JPG images are allowed.");
      return;
    }

    const maxBytes = maxBytesForKind[kind];
    if (file.size > maxBytes) {
      message.error(
        `${labelForKind[kind]} must be ≤ ${Math.round(maxBytes / 1024)}KB (got ${Math.round(
          file.size / 1024,
        )}KB).`,
      );
      return;
    }

    const dims = requiredDimsForKind[kind];
    try {
      const { w, h } = await loadImageDimensions(file);
      if (w !== dims.w || h !== dims.h) {
        message.error(
          `${labelForKind[kind]} must be exactly ${dims.w}×${dims.h}px (got ${w}×${h}px).`,
        );
        return;
      }
    } catch (e) {
      message.error(String((e as Error)?.message || e));
      return;
    }

    setUploading(kind);
    try {
      const upload = await presign(id, kind);

      const form = new FormData();
      Object.entries(upload.fields).forEach(([k, v]) => form.append(k, v));
      form.append("file", file);

      const r = await fetch(upload.url, { method: "POST", body: form });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(text || `S3 upload failed (${r.status})`);
      }

      const field = fieldForKind[kind];
      const updated = await patchVenue({ id, [field]: upload.publicUrl });
      if (updated) onVenueUpdated?.(updated);
      setCacheBust(Date.now());
      message.success(`${labelForKind[kind]} uploaded.`);
    } catch (e) {
      message.error(String((e as Error)?.message || e));
    } finally {
      setUploading(null);
    }
  };

  const pickFile = (kind: Kind) => {
    const ref = inputForKind(kind);
    ref.current?.click();
  };

  return (
    <Card
      title="Images"
      style={{ marginBottom: 16 }}
      extra={
        <Space>
          <Button
            size="small"
            onClick={() => pickFile("logo")}
            disabled={!venue?.id || uploading !== null}
            loading={uploading === "logo"}
          >
            Upload Logo (100×100, ≤50KB)
          </Button>
          <Button
            size="small"
            onClick={() => pickFile("image")}
            disabled={!venue?.id || uploading !== null}
            loading={uploading === "image"}
          >
            Upload Image (1200×630, ≤100KB)
          </Button>
          <Button
            size="small"
            onClick={() => pickFile("ogImage")}
            disabled={!venue?.id || uploading !== null}
            loading={uploading === "ogImage"}
          >
            Upload OG (1200×630, ≤100KB)
          </Button>
        </Space>
      }
    >
      <input
        ref={fileInputLogo}
        type="file"
        accept="image/jpeg"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void uploadFile("logo", file);
        }}
      />
      <input
        ref={fileInputImage}
        type="file"
        accept="image/jpeg"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void uploadFile("image", file);
        }}
      />
      <input
        ref={fileInputOg}
        type="file"
        accept="image/jpeg"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void uploadFile("ogImage", file);
        }}
      />

      <Row gutter={16}>
        {busted.logo && (
          <Col>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
              Logo
            </div>
            <img
              src={busted.logo}
              alt="logo"
              style={{
                width: 64,
                height: 64,
                objectFit: "contain",
                borderRadius: 8,
                background: "#fff",
                border: "1px solid #eee",
              }}
            />
          </Col>
        )}
        {busted.image && (
          <Col>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
              Image
            </div>
            <img
              src={busted.image}
              alt="image"
              style={{
                width: 64,
                height: 64,
                objectFit: "cover",
                borderRadius: 8,
                background: "#fff",
                border: "1px solid #eee",
              }}
            />
          </Col>
        )}
        {busted.ogImage && (
          <Col>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
              OG Image
            </div>
            <img
              src={busted.ogImage}
              alt="ogImage"
              style={{
                width: 64,
                height: 64,
                objectFit: "cover",
                borderRadius: 8,
                background: "#fff",
                border: "1px solid #eee",
              }}
            />
          </Col>
        )}
      </Row>
    </Card>
  );
}
