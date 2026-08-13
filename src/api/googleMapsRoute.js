import app from '@/firebase/index.js';
import { getAuth } from 'firebase/auth';

const getBackendBaseUrl = () =>
  (
    import.meta.env.VITE_GUIDEBOOK_BACKEND_URL ||
    'https://guidebook-ckce.onrender.com/'
  ).replace(/\/$/, '');

export const resolveGoogleMapsRouteUrl = async (url) => {
  const user = getAuth(app).currentUser;
  if (!user) throw new Error('請先登入後台。');

  const idToken = await user.getIdToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  let response;
  try {
    response = await fetch(`${getBackendBaseUrl()}/maps/resolve-route`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Google Maps 短網址解析逾時，請稍後再試。');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'Google Maps 連結解析失敗。');
  }
  return payload;
};
