---
id: TASK-10
title: 行李準備功能優化
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 04:33'
updated_date: '2026-07-30 05:09'
labels: []
dependencies: []
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
- 後台建立一套【行李管理】功能，涵蓋他的類別與名稱，並在建立初期天幫我資料庫建立齊全，但依然保留我可以從後台針對類型與物品新增/修改/刪除
- 行程列表可以選擇(UIUX要夠好，看看能不能圈選或是拖拉)這次要攜帶的行李(含編輯與刪除)，並儲存為json(如目前的前台流程)，如為空前台不顯示行李相關功能
- 不引響既有的前台還原功能/使用者自行添加功能，但如果該行程的行李有異動(添加或刪除)，要可以幫他們新增回去
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 後台行李管理首次載入會建立完整預設 catalog，之後可新增、編輯、刪除分類與物品。
- [x] #2 旅程列表可開啟行李 Drawer，從 catalog 選取並編輯/移除本次項目，結果保存於 trips/{tripId}.packingList JSON。
- [x] #3 trip.packingList 為空時前台不顯示行李功能；有資料時個人勾選、自訂與還原維持可用。
- [x] #4 旅程行李異動後，前台合併新增管理項目、移除已取消管理項目，並保留個人自訂項目。
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 合併工具斷言、Vue SFC、Prettier、production/PWA build、git diff 與 UTF-8 檢查通過。
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 建立 settings/packingCatalog API 與預設資料正規化，首次開啟後台行李管理自動 seed。2. 新增 /admin/packing 以 Drawer 維護分類與物品。3. 旅程列表新增行李 Drawer，可從範本選取並編輯本次 JSON 後寫入 trip.packingList。4. 前台依 trip.packingList 決定是否顯示，將個人狀態改為 trip+participant scoped JSON，合併後台新增/刪除並保留自訂與還原。5. 驗證 API/合併工具、SFC、Prettier、build、diff、UTF-8。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
完成 settings/packingCatalog 預設種子與 CRUD、旅程行李 Drawer、trip.packingList 儲存，以及 trip+participant scoped 前台狀態。合併策略會同步管理端新增/刪除並保留明確標記的個人自訂項目；舊版無 scope 資料只遷移一次，避免跨旅程重複帶入。驗證：資料合併與 scope assertions 通過、Prettier 通過、production/PWA build 通過、git diff --check 通過、29 個變更檔 UTF-8 strict decode 與 U+FFFD 掃描通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
完成 TASK-10 行李準備功能 JSON 化：後台可維護全域 catalog 並為各旅程選取清單，前台依旅程是否有清單決定顯示，個人勾選與自訂資料按旅程及成員隔離，且可安全合併後台異動。已以合併斷言與 production/PWA build 驗證。
<!-- SECTION:FINAL_SUMMARY:END -->
