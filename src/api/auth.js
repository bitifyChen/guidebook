import app from '@/firebase/index.js';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

/**
 * Google 登入函式
 */
export const loginWithGoogle = () => {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await signInWithPopup(auth, provider);
      // 登入成功後，你可以從這裡取得用戶資訊
      const user = result.user;
      console.log('✅ 登入成功:', user.displayName);
      resolve({ status: 200, user });
    } catch (error) {
      console.error('❌ 登入失敗:', error);
      reject(error);
    }
  });
};
