'use client';

import type { ChangeEvent } from 'react';
import { PRODUCT_PHOTO_ACCEPT, takeFilesFromInput } from '@/lib/admin-photo-upload';

type Props = {
  label: string;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  variant?: 'block' | 'inline';
  accent?: boolean;
  inputId?: string;
  /** Catalog multi-foto defaults on; Vitrine banner is a single image. */
  multiple?: boolean;
};

/**
 * Mobile-safe product photo control (Android Chrome / WebView):
 * 1) Large hit area — opacity-0 input covering a real button (NOT clip/1px).
 * 2) Visible native file input — Samsung/WebView often only deliver files here.
 */
export function AdminPhotoFilePicker({
  label,
  disabled,
  onFiles,
  variant = 'block',
  accent = false,
  inputId,
  multiple = true,
}: Props) {
  const rootClass = [
    'admin-file-picker',
    variant === 'inline' ? 'admin-file-picker--inline' : 'admin-file-picker--block',
    accent ? 'admin-file-picker--accent' : '',
    disabled ? 'is-disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const files = takeFilesFromInput(e.currentTarget);
    onFiles(files);
  }

  return (
    <div className={rootClass}>
      <label className="admin-file-picker__hit">
        <span className="admin-file-picker__face">{label}</span>
        <input
          type="file"
          accept={PRODUCT_PHOTO_ACCEPT}
          multiple={multiple}
          disabled={disabled}
          className="admin-file-picker__cover"
          aria-hidden
          tabIndex={-1}
          onChange={handleChange}
        />
      </label>
      <label className="admin-file-picker__native-wrap">
        <span className="admin-file-picker__native-caption">
          Seletor de arquivos (Android)
        </span>
        <input
          id={inputId}
          type="file"
          accept={PRODUCT_PHOTO_ACCEPT}
          multiple={multiple}
          disabled={disabled}
          className="admin-file-picker__visible"
          aria-label={label}
          onChange={handleChange}
        />
      </label>
    </div>
  );
}
