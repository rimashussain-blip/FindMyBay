import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { checkinByCode, checkinByQr, type CheckinResult } from '../api/admin';

export default function ScanCheckinPage() {
  const qc = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [recent, setRecent] = useState<CheckinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const containerId = 'qr-scanner-container';

  const submit = useMutation({
    mutationFn: checkinByQr,
    onSuccess: (data) => {
      setRecent(data);
      setError(null);
      qc.invalidateQueries({ queryKey: ['bookings-today'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
          ?.message ?? 'Scan failed';
      setError(msg);
    },
  });

  // Lazy-load the html5-qrcode library only when scanning starts.
  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('html5-qrcode');
        if (cancelled) return;
        const Html5Qrcode = mod.Html5Qrcode;
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = { stop: () => scanner.stop() };

        await scanner.start(
          { facingMode: 'environment' }, // prefer rear camera
          { fps: 10, qrbox: { width: 280, height: 280 } },
          (decoded) => {
            // Decoded once. Stop and submit.
            scanner.stop().catch(() => {});
            setScanning(false);
            submit.mutate(decoded);
          },
          () => {
            // ignore per-frame "no QR found" callbacks
          },
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Camera unavailable';
        setError(`Couldn't start camera: ${msg}`);
        setScanning(false);
      }
    })();

    return () => {
      cancelled = true;
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, [scanning, submit]);

  // Decide between QR string and short code based on what the user typed.
  const codeSubmit = useMutation({
    mutationFn: checkinByCode,
    onSuccess: (data) => {
      setRecent(data);
      setError(null);
      qc.invalidateQueries({ queryKey: ['bookings-today'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
          ?.message ?? 'Code not found';
      setError(msg);
    },
  });

  function manualSubmit() {
    const v = manualInput.trim();
    if (!v) return;
    // Clear stale state so an error or a different booking doesn't bleed
    // through from the previous submit. If the new call succeeds, the
    // mutation's onSuccess populates fresh `recent`; if it errors, only
    // the error shows.
    setRecent(null);
    setError(null);
    if (v.startsWith('fmb://') || v.startsWith('FMB://')) {
      submit.mutate(v);
    } else {
      codeSubmit.mutate(v);
    }
    setManualInput('');
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="label-eyebrow mb-1">Check-in</div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Scan customer QR</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Point the camera at the customer's QR. The booking will move to in-progress and the bay
          will flip to busy automatically.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* Camera area */}
        <div className="card overflow-hidden p-0">
          <div
            id={containerId}
            className="aspect-square w-full bg-ink/5"
            style={{ minHeight: 320 }}
          >
            {!scanning && (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-mint">
                  <CameraIcon />
                </div>
                <div>
                  <div className="text-base font-medium text-ink">Ready to scan</div>
                  <div className="mt-1 text-sm text-ink-soft">
                    Click below to start the camera. Allow access if prompted.
                  </div>
                </div>
                <button
                  className="btn-primary"
                  onClick={() => {
                    setError(null);
                    setRecent(null);
                    setScanning(true);
                  }}
                >
                  Start scanning
                </button>
              </div>
            )}
          </div>

          {scanning && (
            <div className="flex items-center justify-between border-t border-mint-edge p-4">
              <div className="text-xs text-ink-soft">Scanning… hold the QR steady</div>
              <button
                className="btn-outlined px-4 py-1.5 text-xs"
                onClick={() => {
                  scannerRef.current?.stop().catch(() => {});
                  setScanning(false);
                }}
              >
                Stop
              </button>
            </div>
          )}
        </div>

        {/* Result panel */}
        <div className="flex flex-col gap-3">
          {/* Manual entry */}
          <div className="card">
            <div className="label-eyebrow mb-2">Manual entry</div>
            <div className="mb-2 text-xs text-ink-soft">
              Type the customer's <strong>FMB-XXXX</strong> code, or paste the full QR text if they
              read it out.
            </div>
            <input
              className="input mb-2 font-mono text-sm uppercase"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="FMB-04A2"
            />
            <button
              className="btn-outlined w-full"
              onClick={manualSubmit}
              disabled={submit.isPending || codeSubmit.isPending || !manualInput.trim()}
            >
              {submit.isPending || codeSubmit.isPending ? 'Verifying…' : 'Submit'}
            </button>
          </div>

          {/* Result card */}
          {recent && <SuccessCard result={recent} />}
          {error && (
            <div className="rounded-xl border border-coral bg-coral-soft p-4">
              <div className="font-medium text-coral">Couldn't check in</div>
              <div className="mt-1 text-xs text-coral">{error}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SuccessCard({ result }: { result: CheckinResult }) {
  const b = result.booking;
  return (
    <div className="card border-2 border-primary bg-mint">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
          ✓
        </div>
        <div>
          <div className="text-sm font-bold text-primary-deep">
            {result.alreadyCheckedIn ? 'Already checked in' : 'Checked in!'}
          </div>
          <div className="text-xs text-ink-soft">
            {b.bay.name} · {b.service.name}
          </div>
        </div>
      </div>
      <div className="mt-3 border-t border-mint-edge pt-3 text-sm">
        <div className="font-medium text-ink">
          {b.customer.fullName ?? b.customer.phone}
        </div>
        <div className="text-xs text-ink-soft">{b.customer.phone}</div>
      </div>

      {/* Plate strip — always shown so the attendant knows whether the
          customer added their car details. Falls back to a neutral notice
          when null, prompting the customer to complete onboarding. */}
      {b.customer.carPlate ? (
        <div className="mt-3 rounded-xl bg-primary-deep px-4 py-3 text-white">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
            Look for this car
          </div>
          <div className="mt-0.5 text-lg font-extrabold tracking-wider">
            {b.customer.carPlate}
          </div>
          <div className="text-[11px] opacity-90">
            {[b.customer.carColor, b.customer.carMake, b.customer.carType ? capitalize(b.customer.carType) : null]
              .filter(Boolean)
              .join(' · ') || '—'}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-mint-edge bg-white px-4 py-3 text-xs text-ink-soft">
          <div className="font-bold uppercase tracking-wider text-primary-deep">
            No car details on file
          </div>
          <div className="mt-0.5">
            Customer hasn't completed their car profile yet.
          </div>
        </div>
      )}
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function CameraIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="6"
        width="18"
        height="13"
        rx="2"
        stroke="#0F766E"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="13" r="4" stroke="#0F766E" strokeWidth="1.6" />
      <path d="M8 6l1.5-2h5L16 6" stroke="#0F766E" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
