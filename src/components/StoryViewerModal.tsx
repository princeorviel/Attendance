import React, { useEffect, useRef, useState } from 'react';
import {
  Clapperboard,
  Eye,
  Pause,
  Play,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Account, StoryMediaType } from '../types';
import {
  STORY_REACTIONS,
  getLiveStories,
  getRelativeTime,
} from '../utils/hazri';
import { getMediaBlob } from '../utils/mediaStore';
import { Avatar } from './Avatar';

interface StoryViewerModalProps {
  accounts: Account[];
  initialAccountId: string | null;
  currentAccountId: string;
  onClose: () => void;
  onDeleteStory: (accountId: string, storyId: string) => void;
  onReactStory: (accountId: string, storyId: string, emoji: string) => void;
  onMarkViewed: (accountId: string, storyId: string) => void;
  onAddMore: (mode?: StoryMediaType) => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  accounts,
  initialAccountId,
  currentAccountId,
  onClose,
  onDeleteStory,
  onReactStory,
  onMarkViewed,
  onAddMore,
}) => {
  const storyAccounts = accounts.filter((a) => getLiveStories(a).length > 0);
  const [accountId, setAccountId] = useState<string | null>(initialAccountId);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0); // 0..100
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [floatingEmoji, setFloatingEmoji] = useState<{
    emoji: string;
    key: number;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setAccountId(initialAccountId);
    setIndex(0);
    setProgress(0);
    setPaused(false);
    setConfirmDelete(false);
  }, [initialAccountId]);

  const activeAccount =
    storyAccounts.find((a) => a.id === accountId) || null;
  const activeAccountIndex = activeAccount
    ? Math.max(
        0,
        accounts.findIndex((a) => a.id === activeAccount.id)
      )
    : 0;
  const stories = activeAccount ? getLiveStories(activeAccount) : [];
  const safeIndex = Math.min(index, Math.max(0, stories.length - 1));
  const currentStory = stories[safeIndex];

  const isVideoStory = Boolean(
    currentStory &&
      (currentStory.type === 'video' || currentStory.type === 'reel')
  );

  // Mark story viewed when displayed
  useEffect(() => {
    if (activeAccount && currentStory) {
      onMarkViewed(activeAccount.id, currentStory.id);
    }
  }, [activeAccount?.id, currentStory?.id]);

  // Load media blob from IndexedDB if mediaId exists
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setMediaUrl('');

    if (currentStory?.mediaId) {
      getMediaBlob(currentStory.mediaId)
        .then((blob) => {
          if (!active || !blob) return;
          objectUrl = URL.createObjectURL(blob);
          setMediaUrl(objectUrl);
        })
        .catch(() => {
          // fallback to thumbnail
        });
    }

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [currentStory?.id, currentStory?.mediaId]);

  // Sync play/pause on video element
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isVideoStory) return;
    if (paused || confirmDelete) {
      v.pause();
    } else {
      v.play().catch(() => {});
    }
  }, [paused, confirmDelete, isVideoStory, mediaUrl]);

  const goNext = () => {
    setConfirmDelete(false);
    setProgress(0);
    if (safeIndex < stories.length - 1) {
      setIndex(safeIndex + 1);
      return;
    }
    const curAcctPos = storyAccounts.findIndex(
      (a) => a.id === activeAccount?.id
    );
    if (curAcctPos >= 0 && curAcctPos < storyAccounts.length - 1) {
      setAccountId(storyAccounts[curAcctPos + 1].id);
      setIndex(0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    setConfirmDelete(false);
    setProgress(0);
    if (safeIndex > 0) {
      setIndex(safeIndex - 1);
      return;
    }
    const curAcctPos = storyAccounts.findIndex(
      (a) => a.id === activeAccount?.id
    );
    if (curAcctPos > 0) {
      const prevAcct = storyAccounts[curAcctPos - 1];
      const prevStories = getLiveStories(prevAcct);
      setAccountId(prevAcct.id);
      setIndex(Math.max(0, prevStories.length - 1));
    }
  };

  // Timer progress for Text and Photo stories (5s)
  useEffect(() => {
    if (!activeAccount || !currentStory || isVideoStory) return;
    if (paused || confirmDelete) return;

    const DURATION = 5000;
    let last = performance.now();
    let elapsed = (progress / 100) * DURATION;
    let rafId = 0;

    const tick = (now: number) => {
      elapsed += now - last;
      last = now;
      const pct = Math.min(100, (elapsed / DURATION) * 100);
      setProgress(pct);
      if (pct >= 100) {
        goNext();
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    activeAccount?.id,
    currentStory?.id,
    isVideoStory,
    paused,
    confirmDelete,
    safeIndex,
  ]);

  if (!initialAccountId || !activeAccount || !currentStory) return null;

  const canDelete = activeAccount.id === currentAccountId;
  const resolvedSrc = mediaUrl || currentStory.img;
  const isPhoto =
    currentStory.type === 'photo' ||
    (!currentStory.type && Boolean(currentStory.img));

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDeleteStory(activeAccount.id, currentStory.id);
    setConfirmDelete(false);
    setProgress(0);
    if (stories.length <= 1) {
      const curAcctPos = storyAccounts.findIndex(
        (a) => a.id === activeAccount.id
      );
      if (curAcctPos >= 0 && curAcctPos < storyAccounts.length - 1) {
        setAccountId(storyAccounts[curAcctPos + 1].id);
        setIndex(0);
      } else {
        onClose();
      }
    } else if (safeIndex >= stories.length - 1) {
      setIndex(Math.max(0, stories.length - 2));
    }
  };

  const fontClass =
    currentStory.fontStyle === 'serif'
      ? 'font-serif'
      : currentStory.fontStyle === 'mono'
        ? 'font-mono'
        : 'font-sans';

  const totalReactions = Object.values(currentStory.reactions || {}).reduce(
    (sum, n) => sum + n,
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white select-none">
      {/* Main Stage (9:16 centered on desktop, full screen on mobile) */}
      <div className="relative h-full w-full max-w-md overflow-hidden bg-black sm:h-[92vh] sm:rounded-2xl sm:border sm:border-white/10">
        {/* Media / Background Layer */}
        {isVideoStory ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            {resolvedSrc ? (
              mediaUrl ? (
                <video
                  ref={videoRef}
                  src={mediaUrl}
                  autoPlay
                  playsInline
                  muted={muted}
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    if (v.duration > 0) {
                      setProgress((v.currentTime / v.duration) * 100);
                    }
                  }}
                  onEnded={goNext}
                  className="h-full w-full object-contain"
                />
              ) : (
                <img
                  src={resolvedSrc}
                  alt={currentStory.txt || 'Reel'}
                  className="h-full w-full object-contain opacity-80"
                />
              )
            ) : null}
          </div>
        ) : isPhoto && resolvedSrc ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <img
              src={resolvedSrc}
              alt={currentStory.txt || 'Status photo'}
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <div
            className={`absolute inset-0 flex items-center justify-center p-8 text-center text-2xl font-bold whitespace-pre-wrap [text-shadow:0_2px_10px_rgba(0,0,0,0.6)] ${fontClass}`}
            style={{ background: currentStory.bg || '#4f46e5' }}
          >
            {currentStory.txt}
          </div>
        )}

        {/* Sticker Overlay */}
        {currentStory.sticker && (
          <div className="pointer-events-none absolute top-22 left-1/2 z-20 -translate-x-1/2 rounded-xl bg-black/55 px-3.5 py-1.5 text-xs font-semibold backdrop-blur-xs">
            {currentStory.sticker}
          </div>
        )}

        {/* Touch Navigation & Hold-to-Pause Layer */}
        <div
          className="absolute inset-x-0 top-20 bottom-28 z-10 flex"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerCancel={() => setPaused(false)}
        >
          <button
            type="button"
            aria-label="पिछला Status"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="w-1/3 bg-transparent focus:outline-none"
          />
          <div className="w-1/3" />
          <button
            type="button"
            aria-label="अगला Status"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="w-1/3 bg-transparent focus:outline-none"
          />
        </div>

        {/* Top Progress Bars */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex gap-1.5 pt-safe">
          {stories.map((s, idx) => {
            const width =
              idx < safeIndex ? 100 : idx === safeIndex ? progress : 0;
            return (
              <div
                key={s.id}
                className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"
              >
                <div
                  className="h-full bg-white"
                  style={{ width: `${width}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Top Header */}
        <div className="absolute inset-x-3 top-7 z-20 flex items-center gap-2.5 pt-safe">
          <Avatar
            account={activeAccount}
            index={activeAccountIndex}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-bold">
                {activeAccount.name}
              </span>
              {isVideoStory && (
                <Clapperboard className="h-3.5 w-3.5 shrink-0 text-pink-400" />
              )}
            </div>
            <div className="text-xs text-white/80">
              {getRelativeTime(currentStory.ts)}
            </div>
          </div>

          {isVideoStory && (
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'आवाज़ चालू करें' : 'आवाज़ बंद करें'}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 hover:bg-black/60"
            >
              {muted ? (
                <VolumeX className="h-4 w-4 text-red-400" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'चलाएं' : 'रोकें'}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 hover:bg-black/60"
          >
            {paused ? (
              <Play className="h-4 w-4" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
          </button>

          {canDelete && (
            <>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAddMore('reel');
                }}
                aria-label="और Status जोड़ें"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 hover:bg-black/60"
              >
                <Plus className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={handleDelete}
                className={`min-h-[36px] rounded-lg px-2 text-xs font-semibold ${
                  confirmDelete
                    ? 'bg-red-600 text-white'
                    : 'bg-black/40 hover:bg-black/60'
                }`}
              >
                {confirmDelete ? 'पक्का?' : <Trash2 className="h-4 w-4" />}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="बंद करें"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 hover:bg-black/60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Floating Reaction Pop */}
        {floatingEmoji && (
          <div
            key={floatingEmoji.key}
            className="pointer-events-none absolute right-6 bottom-28 z-30 animate-bounce text-4xl"
          >
            {floatingEmoji.emoji}
          </div>
        )}

        {/* Bottom Caption, Views & Quick Reactions */}
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pt-10 pb-4 pb-safe">
          {(isPhoto || isVideoStory) && currentStory.txt && (
            <p className="mb-3 text-center text-sm font-medium leading-relaxed text-white">
              {currentStory.txt}
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-xs text-white/80">
              <span className="inline-flex items-center gap-1 font-mono-num">
                <Eye className="h-3.5 w-3.5" />
                <span>{currentStory.views || 1}</span>
              </span>
              {totalReactions > 0 && (
                <span className="font-mono-num">
                  {Object.entries(currentStory.reactions || {})
                    .filter(([, count]) => count > 0)
                    .map(([emoji, count]) => `${emoji} ${count}`)
                    .join(' · ')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {STORY_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onReactStory(activeAccount.id, currentStory.id, emoji);
                    setFloatingEmoji({ emoji, key: Date.now() });
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-base transition-transform hover:bg-white/20 active:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
