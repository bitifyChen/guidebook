---
id: TASK-8
title: 實際抵達時間
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 04:16'
updated_date: '2026-07-30 04:45'
labels: []
dependencies: []
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

前台

- 因為已經有原時間(刪除線)與實際的時間，我認為tag【實際抵達 12:08
  實際離開 12:09】是多餘的資訊，此灰色區快就是強調一件事情，最新起訖時間，所以我覺得可以在放大時間部分(你可以參考一些 台灣鐵路 / 台灣高鐵，等等APP 的UIUX。
- 此drawer 應內容稱大，我認為目前的內容不需要內scroll，如真的需要scroll，樣式請調整不採用原生(可以是element plus(但要確認手機端可以使用)，我們其他頁面應該有相關經驗

後台

- ~~09:00 - 09:30~~ 12:08- 12:09，實際抵達 12:08 實際離開 12:09 是不是跟前台一樣移除後面兩者，如果切分 預計與實際，我建議將時間 block做成上下 ， 預計 /實際，這樣顯示更清楚，如果沒有異動的預計就是實際，有異動過個預計的(起或訖)會有刪除線，並且在異動的(起或訖)顏色會變更
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 前台灰色時間區塊以大型抵達/離開時間為主，異動時顯示原時間刪除線且不再顯示重複 tags。
- [x] #2 後台時間以預計/實際上下排列，異動端點有清楚顏色，且不再重複顯示實際抵達/離開 tags。
- [x] #3 時間 Drawer 不使用原生捲軸，主要內容在一般手機高度無須捲動，短螢幕可用 Element Plus scrollbar。
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->

- [x] #1 Vue SFC 編譯、Prettier、production build、git diff 與 UTF-8 檢查通過。
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. 前台時間卡改為抵達/離開雙欄大字，僅異動欄位保留原時間刪除線，移除重複實際時間 tags。2. 後台行程列改為預計/實際上下兩列，異動端點套語意色。3. 時間 Drawer 放大內容並以 Element Plus scrollbar 作短螢幕備援。4. 驗證 SFC、格式、build、diff 與 UTF-8。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

前台時間區塊改為抵達/離開大字雙欄，僅異動端點顯示原時間刪除線；後台改為預計/實際上下兩列並移除重複 tags；Drawer 改用 el-scrollbar。SFC、Prettier、production/PWA build、diff 與 UTF-8 通過。

<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

完成前後台時間資訊重整，最新起訖時間成為主要視覺，移除重複實際時間標籤並改善 Drawer 捲動。

<!-- SECTION:FINAL_SUMMARY:END -->
