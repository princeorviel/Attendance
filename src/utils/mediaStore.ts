const DB_NAME = 'meri_hazri_media_v1';
const STORE_NAME = 'media';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB error'));
  });
}

export async function saveMediaBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to save media'));
  });
}

export async function getMediaBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve((req.result as Blob) || null);
    req.onerror = () => reject(req.error || new Error('Failed to read media'));
  });
}

export async function deleteMediaBlob(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore cleanup failures
  }
}

export async function extractVideoMeta(
  file: File
): Promise<{ duration: number; thumbnail: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    let done = false;
    const finish = (duration: number, thumbnail: string) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve({ duration, thumbnail });
    };

    const timeout = setTimeout(() => finish(15, ''), 4000);

    video.onloadeddata = () => {
      const dur =
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.round(video.duration)
          : 15;
      try {
        video.currentTime = Math.min(0.5, dur / 2);
      } catch {
        clearTimeout(timeout);
        finish(dur, '');
      }
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      const dur =
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.round(video.duration)
          : 15;
      try {
        const w = Math.min(360, video.videoWidth || 360);
        const h = Math.round(
          ((video.videoHeight || 640) * w) / (video.videoWidth || 360)
        );
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          finish(dur, canvas.toDataURL('image/jpeg', 0.65));
          return;
        }
      } catch {
        // ignore canvas error
      }
      finish(dur, '');
    };

    video.onerror = () => {
      clearTimeout(timeout);
      finish(15, '');
    };

    video.src = url;
  });
}
