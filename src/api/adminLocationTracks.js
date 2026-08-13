import { getAuth } from 'firebase/auth';
import app from '@/firebase/index.js';

const getBackendBaseUrl = () =>
  (
    import.meta.env.VITE_GUIDEBOOK_BACKEND_URL ||
    'https://guidebook-ckce.onrender.com/'
  ).replace(/\/$/, '');

const getAdminIdToken = async () => {
  const user = getAuth(app).currentUser;
  if (!user) throw new Error('請先登入後台。');
  return user.getIdToken();
};

const requestAdminLocationTracks = async (path, options = {}) => {
  const token = await getAdminIdToken();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(`${getBackendBaseUrl()}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || '歷史軌跡操作失敗。');
    }
    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('歷史軌跡服務回應逾時，請稍後再試。');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export const getAdminParticipantLocationTracks = ({
  tripId,
  participantId,
  date,
}) => {
  const params = new URLSearchParams({ tripId, participantId, date });
  return requestAdminLocationTracks(`/admin/location-tracks?${params}`);
};

export const previewAdminLocationTrackDeletion = (payload) =>
  requestAdminLocationTracks('/admin/location-tracks/delete-preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const deleteAdminLocationTracks = (payload) =>
  requestAdminLocationTracks('/admin/location-tracks/delete', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
