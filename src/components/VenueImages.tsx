import {
  Button,
  Card,
  Carousel,
  Col,
  Modal,
  Row,
  Space,
  Spin,
  message,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";

const PRESIGN_ENDPOINT = "/.netlify/functions/api-s3-presign";
const UPDATE_ENDPOINT = "/.netlify/functions/api-venues-update";

type Kind = "logo" | "image" | "ogImage";

const maxBytesForKind: Record<Kind, number> = {
  logo: 50 * 1024,
  image: 100 * 1024,
  ogImage: 100 * 1024,
};

const requiredDimsForKind: Record<Kind, { w: number; h: number }> = {
  // logo: max 1000x1000
  logo: { w: 1000, h: 1000 },
  // image + ogImage: exact 1200x630
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

  const [imgState, setImgState] = useState<
    Record<Kind, "empty" | "loading" | "loaded" | "error">
  >({
    logo: "empty",
    image: "empty",
    ogImage: "empty",
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewNonce, setPreviewNonce] = useState(0);

  const fileInputLogo = useRef<HTMLInputElement | null>(null);
  const fileInputImage = useRef<HTMLInputElement | null>(null);
  const fileInputOg = useRef<HTMLInputElement | null>(null);

  const thumbLogoImg = useRef<HTMLImageElement | null>(null);
  const thumbImageImg = useRef<HTMLImageElement | null>(null);
  const thumbOgImg = useRef<HTMLImageElement | null>(null);

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

  useEffect(() => {
    setImgState({
      logo: busted.logo ? "loading" : "empty",
      image: busted.image ? "loading" : "empty",
      ogImage: busted.ogImage ? "loading" : "empty",
    });

    // If the browser serves the image from cache, onLoad can be missed.
    // Check `complete` and update state accordingly.
    const checkComplete = (kind: Kind, el: HTMLImageElement | null) => {
      if (!el) return;
      if (!el.complete) return;
      if (el.naturalWidth > 0) markLoaded(kind);
      else markError(kind);
    };

    // Next tick so refs are attached.
    const t = window.setTimeout(() => {
      checkComplete("logo", thumbLogoImg.current);
      checkComplete("image", thumbImageImg.current);
      checkComplete("ogImage", thumbOgImg.current);
    }, 0);
    return () => window.clearTimeout(t);
  }, [busted.logo, busted.image, busted.ogImage]);

  const markLoaded = (kind: Kind) =>
    setImgState((prev) => ({ ...prev, [kind]: "loaded" }));

  const markError = (kind: Kind) =>
    setImgState((prev) => ({ ...prev, [kind]: "error" }));

  const hasImageLoadError =
    imgState.logo === "error" ||
    imgState.image === "error" ||
    imgState.ogImage === "error";

  const refreshImages = () => {
    setCacheBust(Date.now());
  };

  const previewItems = useMemo(() => {
    const items: Array<{ kind: Kind; label: string; url: string }> = [];
    if (busted.logo)
      items.push({ kind: "logo", label: "Logo", url: busted.logo });
    if (busted.image)
      items.push({ kind: "image", label: "Image", url: busted.image });
    if (busted.ogImage)
      items.push({ kind: "ogImage", label: "OG Image", url: busted.ogImage });
    return items;
  }, [busted.logo, busted.image, busted.ogImage]);

  const openPreviewForKind = (kind: Kind) => {
    const idx = previewItems.findIndex((i) => i.kind === kind);
    if (idx < 0) return;
    setPreviewIndex(idx);
    setPreviewNonce((n) => n + 1);
    setPreviewOpen(true);
  };

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
      if (kind === "logo") {
        if (w > dims.w || h > dims.h) {
          message.error(
            `${labelForKind[kind]} must be at most ${dims.w}×${dims.h}px (got ${w}×${h}px).`,
          );
          return;
        }
      } else {
        if (w !== dims.w || h !== dims.h) {
          message.error(
            `${labelForKind[kind]} must be exactly ${dims.w}×${dims.h}px (got ${w}×${h}px).`,
          );
          return;
        }
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
        hasImageLoadError ? (
          <Button
            size="small"
            onClick={refreshImages}
            disabled={uploading !== null}
          >
            Refresh
          </Button>
        ) : null
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

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Space direction="vertical" size={8}>
            <div style={{ fontSize: 12, color: "#888" }}>Logo</div>
            {busted.logo ? (
              imgState.logo === "error" ? (
                <div style={{ fontSize: 12, color: "#888" }}>
                  Failed to load
                </div>
              ) : (
                <Spin spinning={imgState.logo === "loading"} size="small">
                  <img
                    ref={thumbLogoImg}
                    src={busted.logo}
                    alt="logo"
                    onClick={() => openPreviewForKind("logo")}
                    onLoad={() => markLoaded("logo")}
                    onError={() => markError("logo")}
                    style={{
                      width: 96,
                      height: 96,
                      objectFit: "contain",
                      borderRadius: 8,
                      background: "#fff",
                      border: "1px solid #eee",
                      cursor: "pointer",
                    }}
                  />
                </Spin>
              )
            ) : (
              <div style={{ fontSize: 12, color: "#888" }}>No image</div>
            )}
            <Button
              size="small"
              onClick={() => pickFile("logo")}
              disabled={!venue?.id || uploading !== null}
              loading={uploading === "logo"}
            >
              Upload
            </Button>
            <div style={{ fontSize: 12, color: "#888" }}>≤1000×1000, ≤50KB</div>
          </Space>
        </Col>

        <Col xs={24} md={9}>
          <Space direction="vertical" size={8}>
            <div style={{ fontSize: 12, color: "#888" }}>Image</div>
            {busted.image ? (
              imgState.image === "error" ? (
                <div style={{ fontSize: 12, color: "#888" }}>
                  Failed to load
                </div>
              ) : (
                <Spin spinning={imgState.image === "loading"} size="small">
                  <img
                    ref={thumbImageImg}
                    src={busted.image}
                    alt="image"
                    onClick={() => openPreviewForKind("image")}
                    onLoad={() => markLoaded("image")}
                    onError={() => markError("image")}
                    style={{
                      width: "100%",
                      maxWidth: 220,
                      height: 96,
                      objectFit: "cover",
                      borderRadius: 8,
                      background: "#fff",
                      border: "1px solid #eee",
                      cursor: "pointer",
                    }}
                  />
                </Spin>
              )
            ) : (
              <div style={{ fontSize: 12, color: "#888" }}>No image</div>
            )}
            <Button
              size="small"
              onClick={() => pickFile("image")}
              disabled={!venue?.id || uploading !== null}
              loading={uploading === "image"}
            >
              Upload
            </Button>
            <div style={{ fontSize: 12, color: "#888" }}>1200×630, ≤100KB</div>
          </Space>
        </Col>

        <Col xs={24} md={9}>
          <Space direction="vertical" size={8}>
            <div style={{ fontSize: 12, color: "#888" }}>OG Image</div>
            {busted.ogImage ? (
              imgState.ogImage === "error" ? (
                <div style={{ fontSize: 12, color: "#888" }}>
                  Failed to load
                </div>
              ) : (
                <Spin spinning={imgState.ogImage === "loading"} size="small">
                  <img
                    ref={thumbOgImg}
                    src={busted.ogImage}
                    alt="ogImage"
                    onClick={() => openPreviewForKind("ogImage")}
                    onLoad={() => markLoaded("ogImage")}
                    onError={() => markError("ogImage")}
                    style={{
                      width: "100%",
                      maxWidth: 220,
                      height: 96,
                      objectFit: "cover",
                      borderRadius: 8,
                      background: "#fff",
                      border: "1px solid #eee",
                      cursor: "pointer",
                    }}
                  />
                </Spin>
              )
            ) : (
              <div style={{ fontSize: 12, color: "#888" }}>No image</div>
            )}
            <Button
              size="small"
              onClick={() => pickFile("ogImage")}
              disabled={!venue?.id || uploading !== null}
              loading={uploading === "ogImage"}
            >
              Upload
            </Button>
            <div style={{ fontSize: 12, color: "#888" }}>1200×630, ≤100KB</div>
          </Space>
        </Col>
      </Row>

      <Modal
        title="Images"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width={900}
        destroyOnClose
      >
        {previewItems.length === 0 ? (
          <div style={{ color: "#888" }}>No images</div>
        ) : (
          <Carousel key={previewNonce} initialSlide={previewIndex} dots>
            {previewItems.map((item) => (
              <div key={item.kind}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
                  {item.label}
                </div>
                <div style={{ textAlign: "center" }}>
                  <Spin spinning={imgState[item.kind] === "loading"}>
                    <img
                      src={item.url}
                      alt={item.kind}
                      onLoad={() => markLoaded(item.kind)}
                      onError={() => markError(item.kind)}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "70vh",
                        objectFit: "contain",
                        borderRadius: 8,
                        background: "#fff",
                        border: "1px solid #eee",
                      }}
                    />
                  </Spin>
                </div>
              </div>
            ))}
          </Carousel>
        )}
      </Modal>
    </Card>
  );
}
