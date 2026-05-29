// LogoUpload — picks a logo from disk, downsizes to a 256x256 PNG square,
// and emits the result as a base64 data: URL. The backend stores it in the
// vendor.logoUrl text column as-is, so we don't need a separate file
// upload service for MVP. Total payload after compression: typically 8–30 KB.

import { useRef, useState } from 'react';

const TARGET_SIZE = 256; // 256x256 square output
const MAX_INPUT_BYTES = 4 * 1024 * 1024; // reject > 4 MB inputs

interface LogoUploadProps {
  value: string; // current data URL or http(s) URL or ''
  onChange: (next: string) => void;
  disabled?: boolean;
}

export default function LogoUpload({ value, onChange, disabled }: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Please pick an image file (PNG, JPG, or WebP).');
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError('Image must be under 4 MB.');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await resizeToSquarePng(file, TARGET_SIZE);
      onChange(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read image.');
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    onChange('');
    if (inputRef.current) inputRef.current.value = '';
  }

  const hasLogo = value.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        {hasLogo ? (
          <img
            src={value}
            alt="Logo preview"
            className="h-20 w-20 rounded-2xl border border-mint-edge bg-white object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-dashed border-mint-edge bg-white/50 text-xs text-ink-soft">
            No logo
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-mint-edge bg-white px-4 py-2 text-sm font-medium text-primary-deep hover:bg-mint disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? 'Processing…' : hasLogo ? 'Replace' : 'Choose file'}
            </button>
            {hasLogo && !disabled && (
              <button
                type="button"
                className="text-sm text-coral hover:underline"
                onClick={clear}
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-xs text-ink-soft">
            PNG, JPG, or WebP. Auto-resized to a 256×256 square.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />

      {error && (
        <div className="rounded-lg bg-coral-soft px-3 py-2 text-xs text-coral">{error}</div>
      )}
    </div>
  );
}

/**
 * Reads the file, draws it into a square canvas (cover/center crop),
 * and returns the result as a PNG data URL. We force PNG so transparent
 * logos render correctly on light/dark cards.
 */
function resizeToSquarePng(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode image.'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas not supported in this browser.'));
            return;
          }
          // Cover/center crop: scale so the shorter side fills the square,
          // then center the longer side and clip the overflow.
          const scale = Math.max(size / img.width, size / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const dx = (size - drawW) / 2;
          const dy = (size - drawH) / 2;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, dx, dy, drawW, drawH);
          resolve(canvas.toDataURL('image/png'));
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Failed to process image.'));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
