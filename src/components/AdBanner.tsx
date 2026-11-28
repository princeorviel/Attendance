import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

const ADSENSE_CLIENT_ID = (
  import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined
)?.trim();

const ADSENSE_SCRIPT_ID = 'google-adsense-script';
const ADSENSE_META_NAME = 'google-adsense-account';

/**
 * Ensures the Google AdSense script and verification meta tag are injected once
 * when VITE_ADSENSE_CLIENT_ID is configured (e.g. ca-pub-1234567890123456).
 */
export function initAdSense(): void {
  if (typeof document === 'undefined' || !ADSENSE_CLIENT_ID) return;
  if (!ADSENSE_CLIENT_ID.startsWith('ca-pub-')) return;

  if (!document.querySelector(`meta[name="${ADSENSE_META_NAME}"]`)) {
    const meta = document.createElement('meta');
    meta.name = ADSENSE_META_NAME;
    meta.content = ADSENSE_CLIENT_ID;
    document.head.appendChild(meta);
  }

  if (!document.getElementById(ADSENSE_SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = ADSENSE_SCRIPT_ID;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
      ADSENSE_CLIENT_ID
    )}`;
    document.head.appendChild(script);
  }
}

interface AdBannerProps {
  slot?: string;
  format?: 'auto' | 'horizontal' | 'rectangle';
  className?: string;
}

/**
 * Policy-compliant responsive Google AdSense container.
 * Renders nothing unless both VITE_ADSENSE_CLIENT_ID and an ad slot ID are set,
 * keeping the workspace completely clean until AdSense is activated.
 */
export const AdBanner: React.FC<AdBannerProps> = ({
  slot,
  format = 'auto',
  className = '',
}) => {
  const adSlotId = (
    slot ?? (import.meta.env.VITE_ADSENSE_SLOT_MAIN as string | undefined)
  )?.trim();

  const pushedRef = useRef(false);

  useEffect(() => {
    if (!ADSENSE_CLIENT_ID || !ADSENSE_CLIENT_ID.startsWith('ca-pub-')) return;
    initAdSense();

    if (!adSlotId || pushedRef.current) return;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      pushedRef.current = true;
    } catch {
      // Ad blockers or pending script load should never interrupt the app
    }
  }, [adSlotId]);

  if (!ADSENSE_CLIENT_ID || !ADSENSE_CLIENT_ID.startsWith('ca-pub-') || !adSlotId) {
    return null;
  }

  return (
    <aside
      aria-label="विज्ञापन"
      className={`my-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2.5 text-center dark:border-slate-800 dark:bg-slate-900/70 ${className}`}
    >
      <div className="mb-1.5 text-[10px] font-medium tracking-wide text-slate-400 dark:text-slate-500">
        विज्ञापन · Advertisement
      </div>
      <ins
        className="adsbygoogle block min-h-[60px] w-full"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={adSlotId}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </aside>
  );
};
