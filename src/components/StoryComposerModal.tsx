import React, { useEffect, useState } from 'react';
import {
  Camera,
  Check,
  Clapperboard,
  ImagePlus,
  Loader2,
  Type,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Story, StoryMediaType } from '../types';
import {
  STORY_COLORS,
  STORY_STICKERS,
  formatDuration,
  resizeStoryImage,
  resizeStoryPhotoBlob,
} from '../utils/hazri';
import { extractVideoMeta, saveMediaBlob } from '../utils/mediaStore';

interface StoryComposerModalProps {
  isOpen: boolean;
  initialMode?: StoryMediaType;
  onClose: () => void;
  onPost: (story: Omit<Story, 'id' | 'ts'> & { id?: string }) => void;
}

type ComposerMode = 'text' | 'photo' | 'reel';

export const StoryComposerModal: React.FC<StoryComposerModalProps> = ({
  isOpen,
  initialMode = 'photo',
  onClose,
  onPost,
}) => {
  const [mode, setMode] = useState<ComposerMode>(
    initialMode === 'text'
      ? 'text'
      : initialMode === 'video' || initialMode === 'reel'
        ? 'reel'
        : 'photo'
  );
  const [text, setText] = useState('');
  const [bg, setBg] = useState(STORY_COLORS[0]);
  const [fontStyle, setFontStyle] = useState<'sans' | 'serif' | 'mono'>('sans');
  const [sticker, setSticker] = useState('');

  // Photo state
  const [photoThumb, setPhotoThumb] = useState('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  // Video / Reel state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoThumb, setVideoThumb] = useState('');
  const [muted, setMuted] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMode(
      initialMode === 'text'
        ? 'text'
        : initialMode === 'video' || initialMode === 'reel'
          ? 'reel'
          : 'photo'
    );
    setErrorMsg('');
  }, [isOpen, initialMode]);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  if (!isOpen) return null;

  const resetMedia = () => {
    setPhotoThumb('');
    setPhotoBlob(null);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoFile(null);
    setVideoPreviewUrl('');
    setVideoDuration(0);
    setVideoThumb('');
    setErrorMsg('');
  };

  const handleClose = () => {
    if (saving) return;
    resetMedia();
    setText('');
    setSticker('');
    onClose();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg('');
    try {
      const [thumb, blob] = await Promise.all([
        resizeStoryImage(file),
        resizeStoryPhotoBlob(file),
      ]);
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      setVideoFile(null);
      setVideoPreviewUrl('');
      setPhotoThumb(thumb);
      setPhotoBlob(blob);
      setMode('photo');
    } catch {
      setErrorMsg('यह फोटो पढ़ी नहीं जा सकी, कोई दूसरी फोटो चुनें');
    }
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg('');
    if (file.size > 60 * 1024 * 1024) {
      setErrorMsg('वीडियो फ़ाइल 60MB से छोटी चुनें');
      return;
    }
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    const preview = URL.createObjectURL(file);
    setPhotoThumb('');
    setPhotoBlob(null);
    setVideoFile(file);
    setVideoPreviewUrl(preview);
    setMode('reel');

    const meta = await extractVideoMeta(file);
    setVideoDuration(meta.duration);
    setVideoThumb(meta.thumbnail);
  };

  const canPost =
    (mode === 'text' && text.trim().length > 0) ||
    (mode === 'photo' && Boolean(photoThumb)) ||
    (mode === 'reel' && Boolean(videoFile));

  const handlePost = async () => {
    if (!canPost || saving) return;
    setSaving(true);
    setErrorMsg('');

    try {
      const id = `s${Date.now()}`;
      if (mode === 'photo' && photoBlob) {
        const mediaId = `media_${id}`;
        await saveMediaBlob(mediaId, photoBlob);
        onPost({
          id,
          type: 'photo',
          txt: text.trim(),
          bg,
          img: photoThumb,
          mediaId,
          sticker: sticker || undefined,
          views: 0,
          reactions: {},
        });
      } else if (mode === 'reel' && videoFile) {
        const mediaId = `media_${id}`;
        await saveMediaBlob(mediaId, videoFile);
        onPost({
          id,
          type: 'reel',
          txt: text.trim(),
          bg: '#000000',
          img: videoThumb,
          mediaId,
          duration: videoDuration || 15,
          muted,
          sticker: sticker || undefined,
          views: 0,
          reactions: {},
        });
      } else {
        onPost({
          id,
          type: 'text',
          txt: text.trim(),
          bg,
          img: '',
          fontStyle,
          sticker: sticker || undefined,
          views: 0,
          reactions: {},
        });
      }

      resetMedia();
      setText('');
      setSticker('');
      onClose();
    } catch {
      setErrorMsg('सेव करने में समस्या आई, दोबारा कोशिश करें');
    } finally {
      setSaving(false);
    }
  };

  const fontClass =
    fontStyle === 'serif'
      ? 'font-serif'
      : fontStyle === 'mono'
        ? 'font-mono'
        : 'font-sans';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2 bg-slate-950/90 px-4 py-3 pt-safe">
        <button
          type="button"
          onClick={handleClose}
          aria-label="बंद करें"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-1 rounded-xl bg-white/10 p-1">
          <button
            type="button"
            onClick={() => setMode('photo')}
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
              mode === 'photo'
                ? 'bg-white text-slate-950'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            <span>फोटो</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('reel')}
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
              mode === 'reel'
                ? 'bg-white text-slate-950'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <Clapperboard className="h-3.5 w-3.5" />
            <span>Video / Reel</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('text')}
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
              mode === 'text'
                ? 'bg-white text-slate-950'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <Type className="h-3.5 w-3.5" />
            <span>टेक्स्ट</span>
          </button>
        </div>

        {/* Font / Mute Contextual Button */}
        {mode === 'text' ? (
          <button
            type="button"
            onClick={() =>
              setFontStyle((f) =>
                f === 'sans' ? 'serif' : f === 'serif' ? 'mono' : 'sans'
              )
            }
            className="flex h-10 min-w-[40px] items-center justify-center rounded-full bg-white/10 px-3 text-xs font-bold hover:bg-white/20"
          >
            Aa
          </button>
        ) : mode === 'reel' && videoPreviewUrl ? (
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'आवाज़ चालू करें' : 'आवाज़ बंद करें'}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            {muted ? (
              <VolumeX className="h-5 w-5 text-red-400" />
            ) : (
              <Volume2 className="h-5 w-5 text-white" />
            )}
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Main Preview Canvas */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden p-4"
        style={{
          background: mode === 'text' ? bg : '#090d16',
        }}
      >
        {/* Text Story Canvas */}
        {mode === 'text' && (
          <div className="flex w-full max-w-md flex-col items-center gap-4">
            {sticker && (
              <div className="rounded-xl bg-black/30 px-3.5 py-1.5 text-sm font-semibold backdrop-blur-xs">
                {sticker}
              </div>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={180}
              placeholder="अपना status लिखें…"
              autoFocus
              className={`h-56 w-full resize-none bg-transparent text-center text-2xl font-bold text-white placeholder:text-white/65 focus:outline-none [text-shadow:0_2px_10px_rgba(0,0,0,0.5)] ${fontClass}`}
            />
          </div>
        )}

        {/* Photo Story Canvas */}
        {mode === 'photo' && (
          <div className="flex h-full w-full max-w-md flex-col items-center justify-center">
            {photoThumb ? (
              <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-black">
                <img
                  src={photoThumb}
                  alt="Preview"
                  className="max-h-full max-w-full object-contain"
                />
                {sticker && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-xl bg-black/60 px-3.5 py-1.5 text-sm font-semibold backdrop-blur-xs">
                    {sticker}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 p-8 text-center">
                <ImagePlus className="h-12 w-12 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    फोटो Status लगाएं
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    गैलरी से कोई भी फोटो चुनें या कैमरे से तुरंत खींचें
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700">
                    <ImagePlus className="h-4 w-4" />
                    <span>गैलरी से चुनें</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                  <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700">
                    <Camera className="h-4 w-4" />
                    <span>कैमरा खोलें</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Video / Reel Story Canvas */}
        {mode === 'reel' && (
          <div className="flex h-full w-full max-w-md flex-col items-center justify-center">
            {videoPreviewUrl ? (
              <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-black">
                <video
                  src={videoPreviewUrl}
                  autoPlay
                  loop
                  muted={muted}
                  playsInline
                  controls
                  className="max-h-full max-w-full object-contain"
                />
                {videoDuration > 0 && (
                  <div className="pointer-events-none absolute top-3 left-3 rounded-lg bg-black/65 px-2.5 py-1 font-mono text-xs font-semibold text-white">
                    {formatDuration(videoDuration)}
                  </div>
                )}
                {sticker && (
                  <div className="pointer-events-none absolute top-3 right-3 rounded-xl bg-black/60 px-3 py-1 text-xs font-semibold backdrop-blur-xs">
                    {sticker}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 p-8 text-center">
                <Clapperboard className="h-12 w-12 text-pink-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    वीडियो / Reel Status लगाएं
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Instagram / WhatsApp जैसा कोई भी वीडियो या Reel अपलोड करें
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-pink-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-pink-700">
                    <Clapperboard className="h-4 w-4" />
                    <span>वीडियो / Reel चुनें</span>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoChange}
                      className="hidden"
                    />
                  </label>
                  <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700">
                    <Camera className="h-4 w-4" />
                    <span>रिकॉर्ड करें</span>
                    <input
                      type="file"
                      accept="video/*"
                      capture="environment"
                      onChange={handleVideoChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="space-y-2.5 bg-slate-900 px-4 py-3 pb-safe">
        {errorMsg && (
          <p className="text-center text-xs font-medium text-red-400">
            {errorMsg}
          </p>
        )}

        {/* Color Swatches (Text Mode) */}
        {mode === 'text' && (
          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
            {STORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBg(c)}
                style={{ background: c }}
                aria-label="रंग चुनें"
                className={`h-8 w-8 shrink-0 rounded-full border-2 transition-transform active:scale-95 ${
                  bg === c ? 'border-white scale-110' : 'border-white/40'
                }`}
              />
            ))}
          </div>
        )}

        {/* Quick Sticker / Tag Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {STORY_STICKERS.filter(Boolean).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setSticker((prev) => (prev === st ? '' : st))}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                sticker === st
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Caption Input for Photo & Video/Reel */}
        {(mode === 'photo' || mode === 'reel') && (
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={140}
            placeholder={
              mode === 'reel'
                ? 'Reel / वीडियो का कैप्शन लिखें (optional)…'
                : 'फोटो का कैप्शन लिखें (optional)…'
            }
            className="min-h-[42px] w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
          />
        )}

        {/* Action Row */}
        <div className="flex items-center gap-2">
          {mode === 'photo' && photoThumb && (
            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700">
              <ImagePlus className="h-4 w-4" />
              <span>बदलें</span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>
          )}

          {mode === 'reel' && videoPreviewUrl && (
            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700">
              <Clapperboard className="h-4 w-4" />
              <span>बदलें</span>
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                className="hidden"
              />
            </label>
          )}

          <button
            type="button"
            disabled={!canPost || saving}
            onClick={handlePost}
            className="ml-auto inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>लग रहा है…</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Status लगाएं</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
