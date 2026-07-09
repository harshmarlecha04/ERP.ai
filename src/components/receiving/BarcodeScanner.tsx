import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from "@zxing/library";
import { Loader2, CameraOff, Zap, ZapOff, Power } from "lucide-react";
import { Button } from "@/components/ui/button";

type NativeBarcodeDetector = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

type NativeBarcodeDetectorConstructor = new (options?: { formats?: string[] }) => NativeBarcodeDetector;

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  paused?: boolean;
  /** Require N identical reads in a row before firing (default 1) to keep 1D receiving labels fast. */
  confirmCount?: number;
}

const FORMATS = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.ITF,
];

const NATIVE_FORMATS = ["qr_code", "data_matrix", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf"];

export function BarcodeScanner({ onDetected, paused, confirmCount = 1 }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const readerRef = useRef<MultiFormatReader | null>(null);
  const nativeDetectorRef = useRef<NativeBarcodeDetector | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [status, setStatus] = useState("Starting camera…");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const lastFiredRef = useRef<{ code: string; t: number }>({ code: "", t: 0 });
  const buffer = useRef<{ code: string; n: number }>({ code: "", n: 0 });

  const fireDetection = useCallback((code: string) => {
    if (!code) return;
    if (buffer.current.code === code) {
      buffer.current.n += 1;
    } else {
      buffer.current = { code, n: 1 };
    }
    if (buffer.current.n < confirmCount) return;

    const now = Date.now();
    if (code === lastFiredRef.current.code && now - lastFiredRef.current.t < 2500) return;
    lastFiredRef.current = { code, t: now };
    buffer.current = { code: "", n: 0 };
    setStatus("Barcode detected");
    onDetected(code);
  }, [confirmCount, onDetected]);

  useEffect(() => {
    if (paused || !cameraOn) return;
    let cancelled = false;
    let missCount = 0;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new MultiFormatReader();
    reader.setHints(hints);
    readerRef.current = reader;
    setStarting(true);
    setStatus("Starting camera…");
    setError(null);
    setTorchSupported(false);
    setTorchOn(false);

    const waitForVideo = (video: HTMLVideoElement) =>
      new Promise<void>((resolve) => {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          resolve();
          return;
        }
        const done = () => resolve();
        video.addEventListener("loadedmetadata", done, { once: true });
        window.setTimeout(done, 1200);
      });

    const stopStream = () => {
      if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const decodeCanvas = async (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
      const nativeDetector = nativeDetectorRef.current;
      if (nativeDetector) {
        try {
          const nativeResults = await nativeDetector.detect(canvas);
          const nativeCode = nativeResults[0]?.rawValue?.trim();
          if (nativeCode) return nativeCode;
        } catch {
          nativeDetectorRef.current = null;
        }
      }

      const decodeCurrentCanvas = (target: HTMLCanvasElement, targetCtx: CanvasRenderingContext2D) => {
        const imageData = targetCtx.getImageData(0, 0, target.width, target.height).data;
        const luminances = new Uint8ClampedArray(target.width * target.height);
        for (let src = 0, dest = 0; src < imageData.length; src += 4, dest += 1) {
          luminances[dest] = (imageData[src] + imageData[src + 1] * 2 + imageData[src + 2]) / 4;
        }

        const source = new RGBLuminanceSource(luminances, target.width, target.height);
        const bitmap = new BinaryBitmap(new HybridBinarizer(source));
        return reader.decodeWithState(bitmap).getText().trim();
      };

      try {
        return decodeCurrentCanvas(canvas, ctx);
      } catch {
        const rotated = document.createElement("canvas");
        rotated.width = canvas.height;
        rotated.height = canvas.width;
        const rotatedCtx = rotated.getContext("2d", { willReadFrequently: true }) ?? rotated.getContext("2d");
        if (!rotatedCtx) throw new Error("Unable to prepare rotated scan");
        rotatedCtx.translate(rotated.width / 2, rotated.height / 2);
        rotatedCtx.rotate(Math.PI / 2);
        rotatedCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
        return decodeCurrentCanvas(rotated, rotatedCtx);
      }
    };

    const scanFrame = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        scanTimerRef.current = window.setTimeout(scanFrame, 160);
        return;
      }

      let canvas = canvasRef.current;
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvasRef.current = canvas;
      }
      const ctx = canvas.getContext("2d", { willReadFrequently: true }) ?? canvas.getContext("2d");
      if (!ctx) {
        setError("Unable to prepare scanner");
        return;
      }

      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      const cropWidth = Math.round(sourceWidth * 0.94);
      const cropHeight = Math.round(sourceHeight * 0.76);
      const cropX = Math.round((sourceWidth - cropWidth) / 2);
      const cropY = Math.round((sourceHeight - cropHeight) / 2);
      const targetWidth = Math.min(1280, cropWidth);
      const targetHeight = Math.max(1, Math.round(targetWidth * (cropHeight / cropWidth)));

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);

      try {
        const code = await decodeCanvas(canvas, ctx);
        if (code) fireDetection(code);
      } catch {
        missCount += 1;
        if (missCount === 12) setStatus("Move closer and hold steady");
        if (missCount === 28) setStatus("Center the barcode in the box");
      } finally {
        if (!cancelled) scanTimerRef.current = window.setTimeout(scanFrame, 120);
      }
    };

    (async () => {
      try {
        const videoEl = videoRef.current;
        if (!videoEl) return;

        const Detector = (window as unknown as { BarcodeDetector?: NativeBarcodeDetectorConstructor }).BarcodeDetector;
        if (Detector) {
          try {
            nativeDetectorRef.current = new Detector({ formats: NATIVE_FORMATS });
          } catch {
            try { nativeDetectorRef.current = new Detector(); } catch { nativeDetectorRef.current = null; }
          }
        }

        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        };

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        }

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        videoEl.srcObject = stream;
        videoEl.muted = true;
        videoEl.setAttribute("autoplay", "");
        videoEl.setAttribute("playsinline", "");
        await waitForVideo(videoEl);
        try { await videoEl.play(); } catch { /* user tap overlay will retry */ }

        const track = stream?.getVideoTracks()[0] ?? null;
        trackRef.current = track;
        await track?.applyConstraints?.({ advanced: [{ focusMode: "continuous" }, { exposureMode: "continuous" }] as any }).catch(() => {});
        const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
        if (caps.torch) setTorchSupported(true);

        if (!cancelled) {
          setStarting(false);
          setStatus("Scanning…");
          scanFrame();
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Unable to access camera");
          setStarting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
      trackRef.current = null;
      readerRef.current?.reset();
      buffer.current = { code: "", n: 0 };
    };
  }, [paused, cameraOn, fireDetection]);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] });
      setTorchOn(!torchOn);
    } catch {
      /* ignore */
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
        <CameraOff className="h-10 w-10 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <p className="text-xs text-muted-foreground">
          Make sure you opened this page over HTTPS and allowed camera access.
        </p>
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-muted">
      {cameraOn ? (
        <>
          <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" autoPlay playsInline muted />
          <div
            className="absolute inset-0 cursor-pointer"
            onClick={() => videoRef.current?.play().catch(() => {})}
            aria-hidden
          />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[58%] w-[90%] rounded-md border-2 border-background/90 shadow-[0_0_0_9999px_hsl(var(--foreground)_/_0.28)]" />
          </div>

          <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-md bg-background/85 px-3 py-2 text-center text-sm font-medium text-foreground shadow-sm">
            {status}
          </div>

          {torchSupported && (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute right-14 top-3 h-9 w-9 rounded-full"
              onClick={toggleTorch}
              aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
            >
              {torchOn ? <ZapOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
            </Button>
          )}

          {starting && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {status}
            </div>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={() => setCameraOn(true)}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted text-muted-foreground transition hover:bg-muted/80"
        >
          <CameraOff className="h-10 w-10" />
          <span className="text-sm font-medium">Camera off</span>
          <span className="text-xs">Tap to enable</span>
        </button>
      )}

      <Button
        type="button"
        size="icon"
        variant={cameraOn ? "secondary" : "default"}
        className="absolute right-3 top-3 h-9 w-9 rounded-full"
        onClick={() => setCameraOn((v) => !v)}
        aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
      >
        <Power className="h-4 w-4" />
      </Button>
    </div>
  );
}
