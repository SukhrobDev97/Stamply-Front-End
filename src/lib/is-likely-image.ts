const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif)$/i;

/** Telegram/iOS may leave File.type empty; accept common image extensions too. */
export function isLikelyImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXT.test(file.name);
}
