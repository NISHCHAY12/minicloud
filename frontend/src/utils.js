export const fileSize = (bytes) =>
  `${(bytes / 1024 / 1024).toFixed(bytes > 1024 * 1024 ? 1 : 2)} MB`;
export const kind = (type) =>
  type.startsWith("image")
    ? "image"
    : type.startsWith("audio")
      ? "audio"
      : "video";
