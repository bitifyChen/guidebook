import { uploadImage } from '../api/storage.js';

export const getClipboardImageFiles = (event) => {
  const clipboard = event?.clipboardData;
  if (!clipboard) return [];

  const itemFiles = Array.from(clipboard.items || [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter(Boolean);
  if (itemFiles.length) return itemFiles;

  return Array.from(clipboard.files || []).filter((file) =>
    file.type.startsWith('image/')
  );
};

export const uploadClipboardImages = async (
  event,
  { multiple = true, uploader = uploadImage } = {}
) => {
  const files = getClipboardImageFiles(event);
  if (!files.length) return { handled: false, urls: [] };

  event.preventDefault();
  const selectedFiles = multiple ? files : files.slice(0, 1);
  const urls = [];
  for (const file of selectedFiles) {
    urls.push(await uploader(file));
  }
  return { handled: true, urls };
};
