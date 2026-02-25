/**
 * 上傳圖片到 ImgBB (免費圖床)
 * @param {File} file 檔案物件
 * @returns {Promise<string>} 圖片的下載 URL
 */
export const uploadImage = async (file) => {
  const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const result = await response.json();

    if (result.success) {
      return result.data.url; // 這是圖片的永久 URL
    } else {
      throw new Error(result.error.message || '上傳失敗');
    }
  } catch (error) {
    console.error('ImgBB Upload Error:', error);
    throw error;
  }
};
