import { useCallback, useState, type ChangeEvent } from 'react';

export type UploadedFileEntry = { id: string; name: string; size: number; file: File };

export function useGrpcUploadedFiles(body: Record<string, unknown>) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileEntry[]>([]);

  const handleFilesPicked = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setUploadedFiles((prior) => ([
      ...prior,
      ...files.map((file, index) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${index}`,
        name: file.name,
        size: file.size,
        file,
      })),
    ]));
  }, []);

  const handleRemoveUploadedFile = useCallback((fileId: string) => {
    setUploadedFiles((prior) => prior.filter((file) => file.id !== fileId));
  }, []);

  const handleClearUploadedFiles = useCallback(() => {
    setUploadedFiles([]);
  }, []);

  const applyFileDataToBody = useCallback(async (): Promise<Record<string, unknown> | null> => {
    if (uploadedFiles.length === 0) return null;
    const bodyWithFiles = { ...body };
    const bytesFields = uploadedFiles.filter((f) => f.file.type.includes('octet-stream') || /\.(bin|pb|proto)$/.test(f.name));
    if (bytesFields.length === 0) return null;
    for (let i = 0; i < bytesFields.length && i < 1; i++) {
      const fileData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) ?? '');
        reader.readAsDataURL(bytesFields[i]!.file);
      });
      const base64 = fileData.split(',')[1] ?? '';
      const firstBytesFieldKey = Object.keys(bodyWithFiles).find((key) => typeof bodyWithFiles[key] === 'string' && bodyWithFiles[key] === '');
      if (firstBytesFieldKey) {
        bodyWithFiles[firstBytesFieldKey] = base64;
      }
    }
    return bodyWithFiles;
  }, [body, uploadedFiles]);

  return {
    uploadedFiles,
    handleFilesPicked,
    handleRemoveUploadedFile,
    handleClearUploadedFiles,
    applyFileDataToBody,
  };
}
