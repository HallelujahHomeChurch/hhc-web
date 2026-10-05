export function containedVideoRect(containerWidth: number, containerHeight: number, videoWidth: number, videoHeight: number) {
  if (![containerWidth, containerHeight, videoWidth, videoHeight].every(value => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.min(containerWidth / videoWidth, containerHeight / videoHeight);
  const width = Math.min(containerWidth, videoWidth * scale), height = Math.min(containerHeight, videoHeight * scale);
  return {left:(containerWidth - width) / 2, top:(containerHeight - height) / 2, width, height};
}

export function displayWatermarkCode(code: string) {
  return /^[0-9A-HJKMNP-TV-Z]{10}$/.test(code) ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}
