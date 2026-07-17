/**
 * Trigger a browser download of a base64-encoded protoset file.
 */
export function downloadProtosetFile(protosetBase64: string, fileName: string): void {
  let binary: string;
  try {
    binary = atob(protosetBase64);
  } catch {
    throw new Error('Invalid protoset payload received from server');
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.pb') || fileName.endsWith('.protoset')
    ? fileName
    : `${fileName}.pb`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
