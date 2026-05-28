import { forwardRef, useEffect, useState } from "react";
import type React from "react";
import { fetchApiBlob } from "@/lib/api-config";

type ApiImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
};

const objectUrlCache = new Map<string, string>();
const pendingBlobRequests = new Map<string, Promise<string>>();

async function getObjectUrl(src: string): Promise<string> {
  const cached = objectUrlCache.get(src);
  if (cached) return cached;

  const pending = pendingBlobRequests.get(src);
  if (pending) return pending;

  const request = fetchApiBlob(src)
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      objectUrlCache.set(src, objectUrl);
      pendingBlobRequests.delete(src);
      return objectUrl;
    })
    .catch((error) => {
      pendingBlobRequests.delete(src);
      throw error;
    });

  pendingBlobRequests.set(src, request);
  return request;
}

export const ApiImage = forwardRef<HTMLImageElement, ApiImageProps>(function ApiImage(
  { src, alt, className, ...props },
  ref,
) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setFailed(false);
    setObjectUrl((current) => objectUrlCache.get(src) ?? current);

    getObjectUrl(src)
      .then((nextObjectUrl) => {
        if (cancelled) return;
        setObjectUrl(nextObjectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (failed) {
    return (
      <div className={className} aria-label={alt} role="img">
        <div className="flex h-full w-full items-center justify-center bg-secondary text-xs text-muted-foreground">
          image unavailable
        </div>
      </div>
    );
  }

  if (!objectUrl) {
    return <div className={`${className ?? ""} animate-pulse bg-secondary`} aria-label={alt} role="img" />;
  }

  return <img ref={ref} src={objectUrl} alt={alt} className={className} {...props} />;
});
