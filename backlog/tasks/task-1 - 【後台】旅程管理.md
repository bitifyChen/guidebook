---
id: TASK-1
title: 【後台】旅程管理
status: Done
assignee:
  - '@codex'
created_date: '2026-07-29 07:15'
updated_date: '2026-07-29 08:38'
labels: []
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

- 新增行程的一筆景點後，應該要清空資料，目前完成一筆資料新增，在打開一次新增景點，上一筆的資料依然存在。
- 目前形程管理>新增景點，打開來的drawer title 是寫 【新增行程】，請改為【新增景點】
- 目前形程管理>既有景點，打開來的drawer title 是寫 【編輯行程】，請改為【編輯景點】
- 計算本日行車時間，如果有其中一個行程沒有填經緯度提示失敗
- 我們可以提供一個更將方便填寫經緯度的功能，目前我都是將行程json的資料複製，貼chatGPT請他幫我依據 map 去推估 經緯度，所以我是不是可以建議，你添加一個功能輸出簡易array涵蓋 id 、map、geo<object>，讓使用者完整貼到GPT並回貼給你，如需要加上嚴格遵守的prompt 你也可以添加，對使用者來說，他們只要按下複製按鈕並回貼，他們不需要詳細知道細節，對他們來說 點擊【計算本日行車時間】>【如果資料都齊全】>【完成】;【計算本日行車時間】>【如果資料有齊全】>彈出視窗【複製】【貼上】>【完成】
- 我們目前的安排是透過類似接龍式安排，但如果有一些特定景點要求特定時間，我們該如何設計，例如餐廳(1930)，我需要從早上每一項行程慢慢調整
- 建議在形程管理的day 【計算本日行車】旁邊添加【設定起始時間】，此功能等於目前我們在【每日】裡面的設定，放到這邊會更方便
- 在目前的【行程管理】>每一row上 有 【停留】【延遲】加上【車程】，我們經過自動計算，但可以人為從外層調整自己的開車步調
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 連續新增景點時不保留上一筆內容，文案統一為景點。
- [x] #2 map 為正式地圖連結欄位，舊 geo.mapUrl 可相容讀取但新資料不再寫入。
- [x] #3 缺少座標時可透過嚴格 JSON 補齊並自動繼續本日路線計算。
- [x] #4 固定時間可產生等待或遲到分鐘，父子景點依群組計算車程。
- [x] #5 每日起始時間、停留、延遲與車程可在行程管理直接調整。
- [x] #6 進行中旅程異動會發送 silent sync，其他狀態不發送。
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->

- [x] #1 SFC、JS、格式、build、diff 與 UTF-8 檢查通過。
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. 修正景點 Drawer session 與景點文案，統一 map/geo 正規化。
2. 建立座標補齊助手與群組路線計算，補齊後自動重試 OSRM。
3. 加入 fixedStartTime 排程、每日起始時間及 Row 車程編輯。
4. 統一行程異動 silent sync 並完成靜態與建置驗證。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Implemented canonical map normalization, form sessions, strict coordinate assistant with automatic OSRM retry, parent/child route grouping, fixed-time scheduling, Day start controls, inline drive editing, and active-trip silent sync. Validation: Vue SFC parse/template compile passed; itinerary schedule/route assertions passed; Vite production + messaging service worker build passed; Prettier, git diff --check, and strict UTF-8 scan passed.

<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Completed the itinerary management workflow. Verified map compatibility, schedule/route utilities, Vue templates, production build, diff hygiene, and UTF-8 integrity.

<!-- SECTION:FINAL_SUMMARY:END -->
