import React, { useState } from 'react';
import { Download, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '@/src/hooks/usePWAInstall';

interface InstallGuideModalProps {
  isIOS: boolean;
  onClose: () => void;
}

function InstallGuideModal({ isIOS, onClose }: InstallGuideModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-[#E2DED5] bg-[#FAF9F6] p-6 shadow-xl text-[#18181B]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/icon.svg"
              alt="Folio Games icon"
              className="w-10 h-10 rounded-lg border border-[#E2DED5] shrink-0"
            />
            <div>
              <h3
                id="pwa-install-title"
                className="font-display text-lg font-bold tracking-tight"
              >
                Install Folio Games
              </h3>
              <p className="text-xs text-[#57534E]">
                Launch directly from your home screen
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close install instructions"
            className="p-1 text-[#57534E] hover:text-[#18181B] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isIOS ? (
          <ol className="mt-5 space-y-3 text-sm text-[#18181B]">
            <li className="flex items-start gap-3">
              <span className="font-mono text-xs font-semibold text-[#57534E] mt-0.5">
                01
              </span>
              <span className="leading-relaxed">
                Tap the{' '}
                <strong className="inline-flex items-center gap-1 font-semibold">
                  Share <Share className="w-3.5 h-3.5 inline" />
                </strong>{' '}
                button in your Safari toolbar.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="font-mono text-xs font-semibold text-[#57534E] mt-0.5">
                02
              </span>
              <span className="leading-relaxed">
                Scroll down and tap{' '}
                <strong className="inline-flex items-center gap-1 font-semibold">
                  Add to Home Screen <PlusSquare className="w-3.5 h-3.5 inline" />
                </strong>
                .
              </span>
            </li>
          </ol>
        ) : (
          <div className="mt-5 space-y-3 text-sm text-[#18181B]">
            <p className="text-xs text-[#57534E] leading-relaxed">
              Add Folio Games to your phone or desktop for full-screen puzzles and offline access:
            </p>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2.5">
                <span className="font-mono text-xs font-semibold text-[#57534E] mt-0.5">
                  Android
                </span>
                <span className="text-[#18181B]">
                  Open browser menu (<strong>⋮</strong>) and tap{' '}
                  <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-mono text-xs font-semibold text-[#57534E] mt-0.5">
                  iPhone
                </span>
                <span className="text-[#18181B]">
                  In Safari, tap <strong>Share</strong> then{' '}
                  <strong>Add to Home Screen</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-mono text-xs font-semibold text-[#57534E] mt-0.5">
                  Desktop
                </span>
                <span className="text-[#18181B]">
                  Click the <strong>Install</strong> icon in your browser&apos;s address bar.
                </span>
              </li>
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full h-10 rounded-lg bg-[#18181B] hover:bg-zinc-800 text-xs font-semibold text-[#FAF9F6] transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled || dismissed || (!isInstallable && !isIOS)) {
    return showGuide ? (
      <InstallGuideModal isIOS={isIOS} onClose={() => setShowGuide(false)} />
    ) : null;
  }

  const handleInstallClick = () => {
    if (isInstallable) {
      void install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <div className="mb-6 rounded-xl border border-[#E2DED5] bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/icon.svg"
            alt="Folio Games"
            className="w-9 h-9 rounded-lg border border-[#E2DED5] shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#18181B] truncate">
              Install Folio Games
            </p>
            <p className="text-xs text-[#57534E]">
              Add to your home screen for full-screen daily puzzles, even offline.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="h-9 px-3.5 rounded-lg bg-[#18181B] hover:bg-zinc-800 text-xs font-semibold text-[#FAF9F6] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            {isIOS && !isInstallable ? 'Add to Home Screen' : 'Install App'}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss install prompt"
            className="h-9 w-9 rounded-lg border border-[#E2DED5] hover:bg-[#F2EFE9] text-[#57534E] hover:text-[#18181B] inline-flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showGuide && (
        <InstallGuideModal isIOS={isIOS} onClose={() => setShowGuide(false)} />
      )}
    </>
  );
};

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = () => {
    if (isInstallable) {
      void install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="h-9 px-3 rounded-lg border border-[#E2DED5] bg-white hover:bg-[#F2EFE9] text-xs font-medium text-[#18181B] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
      >
        <Smartphone className="w-3.5 h-3.5 text-[#57534E] shrink-0" />
        Install App
      </button>

      {showGuide && (
        <InstallGuideModal isIOS={isIOS} onClose={() => setShowGuide(false)} />
      )}
    </>
  );
};
