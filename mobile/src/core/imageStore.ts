let _latestImage: string | null = null;

export function setLatestImage(base64: string | null) {
  _latestImage = base64;
}

export function getLatestImage(): string | null {
  return _latestImage;
}
