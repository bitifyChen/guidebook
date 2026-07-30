---
id: TASK-12
title: 行程詳情
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 06:24'
updated_date: '2026-07-30 07:13'
labels: []
dependencies: []
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
- 當抵達或離開時間有異動，我們的【本次時間停留 XX 分鐘】，應該要照我們下方實際的新起訖計算
- 抵達彈窗會讓他選擇 調整行程的方式，最下是一個黑色的新時間確認，我們拿它來取代目前【實際抵達時間】那個block，這樣其實也很清楚，我們下面兩個選擇切換，差異的跳動，此外這個彈出視窗可以再告高一點。
- 裡開也可以遵循同一個設計，就不用兩格都是時間相關
- 綜合以上【抵達/離開】都是採取目前深色起訖版本來看時間，本次異動項目可以閃爍(或顏色)知道我們選擇會變更的欄位，文字也可以放大
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 時間 Drawer 最上方顯示深色有效起訖卡，時間選擇位於其下且預設目前時間並可修改。
- [x] #2 抵達模式兩種策略會即時更新起訖與停留分鐘；離開模式依選定時間更新，異動欄位有短暫高亮。
- [x] #3 景點詳情的本次停留依有效起訖計算，支援跨午夜，非法負值會阻擋儲存。
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 時間工具與 Drawer 元件測試、Prettier、production/PWA build、git diff 與 UTF-8 檢查通過。
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 擴充 itineraryTiming 的有效停留計算與非法時間判斷。2. 重排 ItineraryTimingDrawer，深色預覽置頂並保留可調時間與抵達策略。3. 景點詳情改用有效停留分鐘。4. 補齊工具與元件測試後驗收。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
深色起訖卡已置頂，時間選擇保留於下方；抵達策略與離開時間即時更新有效起訖和停留分鐘，異動欄位有 reduced-motion 相容短動畫。Vitest 10/10、production/PWA build、Prettier、git diff 與 UTF-8 檢查通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
行程時間 Drawer 已統一為置頂深色起訖預覽加可選時間；景點詳情與預覽皆以有效起訖計算停留，並處理跨午夜與非法離開時間。
<!-- SECTION:FINAL_SUMMARY:END -->
