export function getDisplayHostname(value?: string | null): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.hostname : null;
  } catch {
    return null;
  }
}
