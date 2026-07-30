---
id: TASK-4
title: 行程
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 03:05'
updated_date: '2026-07-30 03:40'
labels: []
dependencies: []
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

- 景點的固定時間功能不錯，但有一個問題，子景點不能使用，但大多數場景是：【我們抵達一個X商圈，在這邊共有 A B C 三個景點，其中B是我們預定的用餐時間】，我們再編輯時會寫X回主景點，ABC歸屬他，但其中只有B會有一個準時間。
- 編輯景點中 > 【歸屬主行程】改為【歸屬主景點】
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 子景點可儲存 fixedStartTime，既有主景點 duration 模型不變。
- [x] #2 子景點固定時間位於區段外時能顯示遲到或延長主景點區段並順延後續。
- [x] #3 表單文案使用主景點，且子景點固定時間不被遮蔽或停用。
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->

- [x] #1 排程工具測試、Vue SFC 編譯、格式、diff 與 UTF-8 檢查通過。
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. 將排程改為主景點群組運算，子景點固定時間作區段內錨點。 2. 調整景點表單，子景點只鎖定停留、延遲與車程，固定時間維持可編輯。 3. 更新主景點文案並驗證區段內、遲到與超時延長情境。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Implemented group-based scheduling where child fixedStartTime acts as an anchor inside the parent duration window. Anchors beyond the parent end extend the group; anchors before arrival report lateness. Child duration/delay/drive remain parent-controlled while fixed time stays editable. Group schedule assertions, form SFC compile, Prettier, diff check, and UTF-8 scan passed.

<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Enabled child fixed-time anchors without migrating the parent-duration data model and updated all main-point wording.

<!-- SECTION:FINAL_SUMMARY:END -->
