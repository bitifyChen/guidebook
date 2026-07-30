---
id: TASK-9
title: 子景點固定時間
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 04:25'
updated_date: '2026-07-30 04:48'
labels: []
dependencies: []
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

有一個情境設計錯誤

- 當主景點原離開時間是 1245，子景點設定了固定時間1300，主景點離開時間變更為1300合理，但如果子景點設定了停留時間，主景點離開時間卻不會變動，這個情境是：【我們在這主景點中安排了一場電影，電影有確定的開始 與 持續時間】
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 子景點可設定 duration，且 fixedStartTime 加 duration 超過主景點原離開時間時會延長主景點並順延後續。
- [x] #2 子景點沒有 duration 時維持既有固定時間錨點行為；延遲與下一段車程仍由主景點控制。
- [x] #3 後台表單可編輯子景點停留時間並清楚說明群組時間規則。
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->

- [x] #1 排程工具斷言、Vue SFC、Prettier、production build、git diff 與 UTF-8 檢查通過。
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. 擴充群組排程，子景點以 fixedStartTime 加 duration 計算區段結束並延長主景點。2. 景點表單開放子景點停留時間，延遲與車程仍鎖定並更新說明。3. 驗證區段內、超出主景點、無固定時間與多子景點情境。4. 執行工具斷言、SFC、Prettier、build、diff 與 UTF-8。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

子景點 duration 已納入群組排程，固定開始加停留時間可延長主景點；無固定時間從主景點有效開始計算。表單開放子景點停留，延遲與車程維持鎖定。排程斷言、SFC、Prettier、build、diff、UTF-8 通過。

<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

修正子景點固定活動模型，電影等具有開始時間與片長的活動現在會正確延長主景點與後續行程。

<!-- SECTION:FINAL_SUMMARY:END -->
