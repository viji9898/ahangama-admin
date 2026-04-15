export type VenueMediaKind = "logo" | "image" | "ogImage";

const PRESIGN_ENDPOINT = "/.netlify/functions/api-s3-presign";

export const venueMediaLabel: Record<VenueMediaKind, string> = {
  logo: "Logo",
  image: "Hero image",
  ogImage: "OG image",
};

export const venueMediaMaxBytes: Record<VenueMediaKind, number> = {
  logo: 50 * 1024,
  image: 100 * 1024,
  ogImage: 100 * 1024,
};

export const venueMediaDimensions: Record<
  VenueMediaKind,
  { width: number; height: number; exact: boolean }
> = {
  logo: { width: 1080, height: 1080, exact: false },
  image: { width: 1200, height: 630, exact: true },
  ogImage: { width: 1200, height: 630, exact: true },
};

type PresignedUpload = {
  url: string;
  fields: Record<string, string>;
  key: string;
  publicUrl: string;
  maxBytes: number;
  contentType: string;
};

const loadImageDimensions = async (file: File) => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to load image"));
    });

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const presignVenueMediaUpload = async (
  venueId: string,
  kind: VenueMediaKind,
): Promise<PresignedUpload> => {
  const response = await fetch(PRESIGN_ENDPOINT, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: venueId, kind }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok !== true) {
    throw new Error(data?.error || `Failed (${response.status})`);
  }

  return data.upload as PresignedUpload;
};

export async function uploadVenueMediaToS3({
  venueId,
  kind,
  file,
}: {
  venueId: string;
  kind: VenueMediaKind;
  file: File;
}) {
  const normalizedVenueId = String(venueId || "")
    .trim()
    .toLowerCase();
  if (!normalizedVenueId) {
    throw new Error("Venue ID is required before uploading media.");
  }

  if (file.type !== "image/jpeg") {
    throw new Error("Only JPG images are allowed.");
  }

  const maxBytes = venueMediaMaxBytes[kind];
  if (file.size > maxBytes) {
    throw new Error(
      `${venueMediaLabel[kind]} must be ≤ ${Math.round(maxBytes / 1024)}KB.`,
    );
  }

  const required = venueMediaDimensions[kind];
  const dimensions = await loadImageDimensions(file);
  if (required.exact) {
    if (
      dimensions.width !== required.width ||
      dimensions.height !== required.height
    ) {
      throw new Error(
        `${venueMediaLabel[kind]} must be exactly ${required.width}×${required.height}px (got ${dimensions.width}×${dimensions.height}px).`,
      );
    }
  } else if (
    dimensions.width > required.width ||
    dimensions.height > required.height
  ) {
    throw new Error(
      `${venueMediaLabel[kind]} must be at most ${required.width}×${required.height}px (got ${dimensions.width}×${dimensions.height}px).`,
    );
  }

  const upload = await presignVenueMediaUpload(normalizedVenueId, kind);
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
    const text = await uploadResponse.text().catch(() => "");
    throw new Error(text || `S3 upload failed (${uploadResponse.status})`);
  }

  return {
    publicUrl: upload.publicUrl,
    key: upload.key,
  };
}
