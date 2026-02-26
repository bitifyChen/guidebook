import { defineStore } from 'pinia';
import {
  getParticipants,
  postParticipant,
  patchParticipant,
  deleteParticipant,
  getParticipantsVersion,
} from '@/api/participants';
import { getWallet, patchWalletItem, deleteWalletItem } from '@/api/wallet';

export const useParticipantsStore = defineStore('participants', {
  state: () => ({
    participants: [],
    isLoading: false,
  }),

  actions: {
    async init() {
      const CACHE_KEY = 'jeju_participants_cache';

      // 1. 先抓取本地快取並立即呈現 (Stale-while-revalidate)
      let localCache = null;
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          localCache = JSON.parse(raw);
          this.participants = localCache.participants;
        }
      } catch (e) {
        console.warn('Participants cache load failed', e);
      }

      try {
        // 2. 抓取遠端版本號 (極小請求)
        const remoteMeta = await getParticipantsVersion();

        // 3. 如果版本一致且已有資料，就不再抓取大宗資料
        if (localCache && localCache.timestamp === remoteMeta.lastUpdate) {
          console.log('Using participants cache (version match)');
          return;
        }

        // 4. 版本不一致或無快取，才抓取大宗資料
        this.isLoading = true;
        const res = await getParticipants();

        if (res.status === 200) {
          this.participants = res.data;
        }

        // 5. 更新快取
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            participants: this.participants,
            timestamp: remoteMeta.lastUpdate,
          })
        );
        console.log(
          'Participants data updated to version:',
          remoteMeta.lastUpdate
        );
      } catch (error) {
        console.error('Wallet 初始化失敗:', error);
      } finally {
        this.isLoading = false;
      }
    },

    async addParticipant(data) {
      try {
        const res = await postParticipant(data);
        if (res.status === 200) {
          await this.init();
          return res;
        }
      } catch (error) {
        console.error('新增成員失敗:', error);
        throw error;
      }
    },

    async updateParticipant(id, data) {
      try {
        const res = await patchParticipant(id, data);
        if (res.status === 200) {
          await this.init();
          return res;
        }
      } catch (error) {
        console.error('更新成員失敗:', error);
        throw error;
      }
    },

    async removeParticipant(id) {
      try {
        const res = await deleteParticipant(id);
        if (res.status === 200) {
          await this.init();
          return res;
        }
      } catch (error) {
        console.error('刪除成員失敗:', error);
        throw error;
      }
    },

    /**
     * 同步 Wallet 資料：
     * 1. 如果 payerId 不存在，刪除該筆支出
     * 2. 如果 splitWithIds 包含已刪除的 ID，將其移除
     */
    async syncWalletParticipants() {
      try {
        const res = await getWallet();
        if (res.status !== 200) return;

        const walletItems = res.data;
        const participantIds = new Set(this.participants.map((p) => p.id));
        let deleteCount = 0;
        let updateCount = 0;

        for (const item of walletItems) {
          // 1. 檢查付款人是否存在
          if (!participantIds.has(item.payerId)) {
            await deleteWalletItem(item.id);
            deleteCount++;
            continue; // 已刪除則跳過後續檢查
          }

          // 2. 檢查分帳名單
          const validSplitIds = item.splitWithIds.filter((id) =>
            participantIds.has(id)
          );

          if (validSplitIds.length !== item.splitWithIds.length) {
            await patchWalletItem(item.id, {
              splitWithIds: validSplitIds,
            });
            updateCount++;
          }
        }

        return { deleteCount, updateCount };
      } catch (error) {
        console.error('同步 Wallet 失敗:', error);
        throw error;
      }
    },

    getParticipant(id) {
      return this.participants.find((p) => p.id === id);
    },
  },
});
