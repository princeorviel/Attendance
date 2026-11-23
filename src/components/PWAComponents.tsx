import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  Share2,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const INSTALL_BANNER_DISMISSED_KEY = 'hazri_pwa_banner_dismissed_v1';

interface InstallShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InstallShareModal: React.FC<InstallShareModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInIframe, install } =
    usePWAInstall();
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  if (!isOpen) return null;

  const appUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : '';

  const shareText =
    'Attendance ऐप — स्टाफ़ हाज़िरी, सैलरी हिसाब, मल्टी-ब्रांच शॉप और PDF लेजर के लिए आसान ऐप:';

  const showTempStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const handleInstallClick = async () => {
    const accepted = await install();
    if (accepted) {
      showTempStatus('App आपके फ़ोन में इंस्टॉल हो रहा है ✓');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      showTempStatus('ऐप का लिंक कॉपी हो गया ✓');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showTempStatus('कृपया ऊपर दिया लिंक कॉपी करें');
    }
  };

  const handleShareApp = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Attendance — हाज़िरी व सैलरी हिसाब ऐप',
          text: shareText,
          url: appUrl,
        });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    await handleCopyLink();
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
    `${shareText}\n${appUrl}`
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="App इंस्टॉल व शेयर"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 pb-safe shadow-2xl sm:rounded-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-slate-700" />

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/pwa-192x192.png"
              alt="Attendance App"
              className="h-12 w-12 rounded-2xl border border-slate-200 object-cover shadow-xs dark:border-slate-700"
            />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Attendance App
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                फुल-स्क्रीन मोबाइल ऐप · ऑफ़लाइन व क्लाउड सपोर्ट
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="बंद करें"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section 1: Install App on Phone / Desktop */}
        <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900/70 dark:bg-indigo-950/30">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Smartphone className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>फ़ोन / कंप्यूटर में App इंस्टॉल करें</span>
          </div>

          {isInstalled ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>यह ऐप आपके डिवाइस में पहले से App मोड में इंस्टॉल है ✓</span>
            </div>
          ) : isInstallable ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                एक क्लिक में होम स्क्रीन पर आइकन जुड़ जाएगा — बिना ब्राउज़र बार के
                बिल्कुल मोबाइल App की तरह चलेगा और ऑफ़लाइन भी काम करेगा।
              </p>
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700"
              >
                <Download className="h-4 w-4" />
                <span>अभी App इंस्टॉल करें</span>
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {isInIframe && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-100">
                  <p className="font-semibold">
                    सीधे 1-क्लिक Install के लिए इस App को अलग टैब में खोलें:
                  </p>
                  <a
                    href={appUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Chrome / Safari में खोलकर Install करें</span>
                  </a>
                </div>
              )}

              {isIOS ? (
                <ol className="space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  <li>
                    1. iPhone / iPad में इस लिंक को <strong>Safari</strong> में
                    खोलें और नीचे <strong>Share</strong> बटन दबाएं।
                  </li>
                  <li>
                    2. स्क्रॉल करके <strong>Add to Home Screen</strong> चुनें —
                    होम स्क्रीन पर Attendance App का आइकन बन जाएगा।
                  </li>
                </ol>
              ) : isAndroid ? (
                <ol className="space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  <li>
                    1. Android <strong>Chrome</strong> में ऊपर दाईं ओर{' '}
                    <strong>⋮ (मेन्यू)</strong> दबाएं।
                  </li>
                  <li>
                    2. <strong>Install app</strong> या{' '}
                    <strong>Add to Home screen</strong> चुनें — तुरंत ऐप
                    इंस्टॉल हो जाएगा।
                  </li>
                </ol>
              ) : (
                <ol className="space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  <li>
                    1. <strong>Android / Chrome:</strong> ऊपर दाईं ओर{' '}
                    <strong>⋮ मेन्यू → Install app</strong> (या Address bar का
                    Install आइकन) दबाएं।
                  </li>
                  <li>
                    2. <strong>iPhone / Safari:</strong> नीचे{' '}
                    <strong>Share → Add to Home Screen</strong> चुनें।
                  </li>
                </ol>
              )}
            </div>
          )}
        </div>

        {/* Section 2: Share App Link */}
        <div className="mt-3.5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            Staff या दूसरों को App भेजें
          </div>

          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-mono-num text-slate-600 break-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {appUrl}
          </div>

          {statusMsg && (
            <p className="mt-2 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {statusMsg}
            </p>
          )}

          <button
            type="button"
            onClick={handleShareApp}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            <Share2 className="h-4 w-4" />
            <span>App लिंक शेयर करें</span>
          </button>

          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>WhatsApp पर भेजें</span>
            </a>

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>लिंक कॉपी हुआ</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>लिंक कॉपी करें</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AppShareDownloadButton: React.FC = () => {
  const { isInstallable, isInstalled } = usePWAInstall();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        aria-label={isInstalled ? 'App शेयर करें' : 'App इंस्टॉल या शेयर करें'}
        title={isInstalled ? 'App शेयर करें' : 'App इंस्टॉल / शेयर करें'}
        className={`inline-flex h-9 w-9 items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border transition-colors sm:h-10 sm:w-auto sm:px-3 ${
          isInstallable && !isInstalled
            ? 'border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700'
            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        {isInstalled ? (
          <Share2 className="h-4 w-4 shrink-0" />
        ) : (
          <Download className="h-4 w-4 shrink-0" />
        )}
        <span className="hidden md:inline text-xs font-semibold">
          {isInstalled
            ? 'App शेयर'
            : isInstallable
              ? 'App इंस्टॉल'
              : 'App इंस्टॉल / शेयर'}
        </span>
      </button>

      <InstallShareModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
};

export const PWAInstallButton = AppShareDownloadButton;

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(INSTALL_BANNER_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [guideOpen, setGuideOpen] = useState(false);

  if (isInstalled || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(INSTALL_BANNER_DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
  };

  const handlePrimaryAction = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        setDismissed(true);
      }
      return;
    }
    setGuideOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-white px-3.5 py-2.5 shadow-xs dark:border-indigo-900/70 dark:bg-slate-900">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/pwa-192x192.png"
            alt="Attendance App Icon"
            className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 object-cover dark:border-slate-700"
          />
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-slate-900 sm:text-sm dark:text-white">
              Attendance को मोबाइल App बनाएं
            </div>
            <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {isInstallable
                ? '1 क्लिक में होम स्क्रीन पर इंस्टॉल करें — ऑफ़लाइन भी चलेगा'
                : isIOS
                  ? 'iPhone Safari से होम स्क्रीन पर जोड़ें — फुल-स्क्रीन App मोड'
                  : 'फुल-स्क्रीन App की तरह फ़ोन में सेव करें व ऑफ़लाइन चलाएं'}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handlePrimaryAction()}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            <span>{isInstallable ? 'Install करें' : 'App इंस्टॉल'}</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="बैनर बंद करें"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <InstallShareModal
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
      />
    </>
  );
};

export const PWAUpdateToast: React.FC = () => {
  const [updateHandler, setUpdateHandler] = useState<
    ((reloadPage?: boolean) => Promise<void>) | null
  >(null);

  useEffect(() => {
    const onUpdateAvailable = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          updateSW?: (reloadPage?: boolean) => Promise<void>;
        }>
      ).detail;
      if (detail?.updateSW) {
        setUpdateHandler(() => detail.updateSW!);
      }
    };
    window.addEventListener('pwa-update-available', onUpdateAvailable);
    return () =>
      window.removeEventListener('pwa-update-available', onUpdateAvailable);
  }, []);

  if (!updateHandler) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 right-4 z-40 flex items-center gap-2.5 rounded-2xl border border-indigo-300 bg-indigo-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg md:bottom-4"
    >
      <span>App का नया अपडेट तैयार है</span>
      <button
        type="button"
        onClick={() => void updateHandler(true)}
        className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50"
      >
        <RefreshCw className="h-3 w-3" />
        <span>अपडेट करें</span>
      </button>
      <button
        type="button"
        onClick={() => setUpdateHandler(null)}
        aria-label="बंद करें"
        className="rounded p-0.5 text-indigo-200 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-md md:bottom-4 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Offline Mode — आपका डेटा सुरक्षित है</span>
    </div>
  );
};
