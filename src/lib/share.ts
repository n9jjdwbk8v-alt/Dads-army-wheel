/** Opens the phone's share sheet with `file`, or downloads it where sharing files isn't supported. */
export const shareOrDownload = async (file: File) => {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  download(file);
};

export const download = (file: Blob & { name: string }) => {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Copies `text`, falling back to a prompt the user can copy from. Resolves true if it was copied. */
export const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    prompt('Copy this:', text);
    return false;
  }
};

/** Opens the share sheet with `text` (so it can go straight to WhatsApp), or copies it where that isn't supported. */
export const shareText = async (text: string): Promise<'shared' | 'copied' | 'failed'> => {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'shared';
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed';
};
