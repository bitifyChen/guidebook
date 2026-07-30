---
id: TASK-3
title: 【前台】景點詳情
status: Done
assignee:
  - '@codex'
created_date: '2026-07-29 08:00'
updated_date: '2026-07-29 08:55'
labels: []
dependencies: []
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

- 【開啟 Naver Map】 改為 【開啟地圖】
- 是不是將後台原本的景點 【抵達】【離開】按鈕，改放在這邊，不太可能出遊還使用後台控制，我們可以在旅程管理 添加一個 【成員】功能，他是側邊攔檢視彈出目前參加的成員，我們可以指定多人為管理員，成為管理員後。可以從前台看到【抵達】【離開】按鈕
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 後台可為單一旅程複選多位旅程管理員，不影響其他旅程。
- [x] #2 只有進行中旅程的全域管理員或旅程管理員能在非子景點詳情調整抵達／離開時間。
- [x] #3 一般成員、公開訪客及非進行中旅程看不到時間操作。
- [x] #4 開啟地圖優先使用 map，舊資料可回退 geo.mapUrl。
- [x] #5 時間更新立即刷新本機並向其他裝置發送 silent sync。
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->

- [x] #1 SFC、權限/時間工具測試、格式、build、diff 與 UTF-8 檢查通過。
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. 新增旅程層級 managerParticipantIds 與後台成員選擇 Drawer。 2. 將抵達／離開操作移到前台景點詳情並套用旅程狀態與角色權限。 3. 移除後台時間操作，保留 silent sync 與舊地圖資料相容。 4. 驗證角色、狀態、SFC/build/diff/UTF-8。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Added trip.managerParticipantIds with an admin member-selection Drawer, pure trip timing permission checks, frontend arrival/departure Drawer and save flow, canonical map fallback, immediate local refresh, and silent sync. Removed admin arrival/departure controls. Validation: role/status and timing assertions passed; five affected Vue templates compiled; production/PWA build, Prettier, diff check, and strict UTF-8/mojibake scan passed.

<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Moved trip timing controls to authorized frontend trip managers, preserved global admin access and legacy map links, and verified permissions, timing calculations, Vue compilation, and production build.

<!-- SECTION:FINAL_SUMMARY:END -->
