const OBJECT_URL_LIFETIME_MS = 30000;

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  let link: HTMLAnchorElement | undefined;
  try {
    link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
  } finally {
    try {
      link?.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS);
    }
  }
}
