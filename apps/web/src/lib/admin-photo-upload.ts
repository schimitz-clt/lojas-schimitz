/**
 * Admin product photo picker — mobile-safe file capture + loud status copy.
 * Android Chrome/WebView: FileList is live; clearing input.value empties it.
 */

/** Samsung gallery hides JPEG if accept is a tight MIME list. */
export const PRODUCT_PHOTO_ACCEPT = 'image/*,.jpg,.jpeg,.png,.webp';

export const EMPTY_PHOTO_SELECTION_MESSAGE =
  'Nenhuma foto foi recebida. Se você selecionou imagens, o celular não entregou os arquivos — use o seletor visível, confirme, e envie de novo.';

export function snapshotSelectedFiles(files: FileList | File[] | null | undefined): File[] {
  if (!files || files.length === 0) return [];
  return Array.from(files);
}

/**
 * Copy files BEFORE clearing the input.
 * `input.files` is a live FileList — `value = ''` wipes it on Android Chrome.
 */
export function takeFilesFromInput(input: { files: FileList | null; value: string }): File[] {
  const copied = snapshotSelectedFiles(input.files);
  input.value = '';
  return copied;
}

export function photoUploadProgressLabel(current: number, total: number): string {
  const t = Math.max(1, Math.floor(Number(total) || 0));
  const n = Math.min(t, Math.max(1, Math.floor(Number(current) || 0)));
  return `Enviando… ${n}/${t}`;
}

export function emptyPhotoSelectionError(): string {
  return EMPTY_PHOTO_SELECTION_MESSAGE;
}
