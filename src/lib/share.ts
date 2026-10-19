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

/** Copies `text`. Resolves true if it was copied. */
export const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older phones and some embedded views block the clipboard API, and popups too; copy from a hidden box.
    const box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
    document.body.append(box);
    box.select();
    box.setSelectionRange(0, text.length);
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    box.remove();
    return copied;
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
