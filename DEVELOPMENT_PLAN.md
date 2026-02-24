# 濟州島 Vue 之旅 - 開發計畫

本文件概述了專案的重構工作，並提出了未來開發的後續步驟。

## 專案重構 (已完成)

專案已進行了重大重構，以符合現代 Vue 3 和 Vite 的開發實踐。目標是建立一個穩定、可維護且可建構的基礎。

以下是已完成任務的摘要：

1.  **依賴項管理：**
    - 更新 `package.json`，包含正確且現代的依賴項 (`Vue 3.4`、`Vite 5`、`Pinia 2`、`Vue Router 4`)。
    - 添加了必要的開發工具，例如 `@vitejs/plugin-vue`、`tailwindcss`、`postcss` 和 `autoprefixer`。
    - 安裝了程式碼中使用的缺失依賴項 (`lucide-vue-next`、`element-plus`)。

2.  **建構系統與配置：**
    - 配置 `vite.config.ts` 以使用 Vue 插件並設定正確的別名 (`@` 指向 `/src`)。
    - 設定 `tailwind.config.js` 和 `postcss.config.js`。
    - 從 `index.html` 中移除了 CSS 和函式庫的 CDN 連結，轉而使用 NPM 套件和捆綁。

3.  **應用程式架構：**
    - **路由：** 用 `vue-router` 替換了手動組件切換。所有頁面現在都通過集中的 `src/router.ts` 文件進行管理。
    - **儲存 (Pinia)：** 重構了 Pinia 儲存 (`store/travelStore.ts`)，包含狀態、Getter 和 Action 的正確 TypeScript 介面。
    - **文件結構：** 重新組織了文件結構，以遵循常見的 Vue 慣例 (例如，將 `App.vue` 和 `store` 移至 `src` 目錄)。

4.  **組件重構：**
    - 重構了所有 Vue 組件以使用 TypeScript (`<script setup lang="ts">`)。
    - 修復了 Vue API (`ref`、`computed` 等)、組件和儲存動作的所有缺失導入。
    - 在主要佈局中用基於路由的邏輯替換了硬編碼導航。
    - 創建了缺失 UI 元素的佔位符組件 (`WeatherCard.vue`、`ItineraryCard.vue`)，以確保專案可建構。

5.  **程式碼品質與維護：**
    - **Linter 和格式化：** 設定了 ESLint 和 Prettier 以強制執行一致的程式碼風格。您現在可以執行 `npm run lint` 和 `npm run format`。
6.  **清理：**
    - 移除了過時的文件 (`src/ItineraryView.vue`)。
    - 清理了 `index.html`，使其成為 Vite 應用程式的簡單入口點。
7.  **即時行程提示功能：**
    - **動態時間計算**：在 `travelStore.js` 中新增了 `allItineraries` getter，統一計算所有日期的行程起訖時間。
    - **目前/下一個行程提示**：在首頁 (`index.vue`) 實作了基於 `currentTime` 的自動過濾邏輯，動態顯示「目前進行中」與「下一個即將開始」的行程。
    - **自動更新機制**：使用 `setInterval` 每分鐘自動更新 `currentTime`，確保提示訊息的即時性。

現在，專案可以使用 `npm run build` 進行可靠建構，並使用 `npm run dev` 進行開發服務。

## 後續步驟與未來開發

以下是一些建議的後續步驟，以繼續構建應用程式：

1.  **實作佔位符組件：**
    - **`WeatherCard.vue`**：連接到天氣 API (例如 OpenWeatherMap) 以顯示濟州島的即時天氣資訊。
    - **`ItineraryCard.vue`**：充實設計以正確顯示行程項目詳細資訊。

2.  **增強使用者介面/使用者體驗 (UI/UX)：**
    - **表單：** 為「新增費用」和「新增參與者」表單添加驗證。
    - **過渡效果：** 在主要佈局中使用 Vue 的 `<transition>` 組件添加頁面過渡效果，以提供更流暢的使用者體驗。
    - **空狀態：** 改善「空狀態」訊息的設計 (例如，當沒有費用或行程項目時)。

3.  **功能開發：**
    - **行程詳細檢視：** 為行程項目創建詳細檢視。點擊「行程」頁面中的卡片可以導航到一個新頁面，顯示更多詳細資訊、地圖和使用者筆記。
    - **費用分攤邏輯：** 資料結構已存在，但尚未實作計算「誰欠誰」的邏輯。這可能是「錢包」部分的新功能。
    - **使用者認證：** 如果這是一個真實世界的應用程式，請添加使用者帳戶和認證以保存旅行計畫。

4.  **開發工作流程增強 (新增項目)：**
    - **路由和佈局自動化：** 整合 `vite-plugin-pages` 和 `vite-plugin-vue-layouts` 以自動生成路由和管理佈局，減少手動配置並提高開發效率。
    - **自動導入：** 利用 `vite-auto-import-resolvers` 自動導入 Vue API、組件和實用函式，進一步減少手動導入語句。
    - **樣式規範：** 配置 `stylelint` 以確保整個專案的 CSS/SCSS 樣式一致性，提高程式碼品質並減少潛在錯誤。

5.  **程式碼品質與維護：**
    - **環境變數：** 目前，`GEMINI_API_KEY` 是通過 `vite.config.ts` 傳遞的。建議在專案根目錄創建一個 `.env` 文件，供開發人員添加其金鑰。
    ```
    # .env
    VITE_GEMINI_API_KEY=your_api_key_here
    ```
    程式碼可以通過 `import.meta.env.VITE_GEMINI_API_KEY` 訪問此變數。
    - **單元測試：** 使用 Vitest 等測試框架為 Pinia 儲存邏輯和關鍵組件編寫單元測試。

本計畫為開發「濟州島 Vue 之旅」應用程式提供了明確的前進路徑。
