---
id: TASK-7
title: 前台形程列表
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 03:27'
updated_date: '2026-07-30 04:00'
labels: []
dependencies: []
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

- 如果只有少天，日期全部都會靠左，day tab 是否將日期維持在正中間去動態分攤width
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 1～5 天的日期頁籤平均填滿可用寬度並保持文字置中。
- [x] #2 超過 5 天時維持約五格可見、可水平滑動，切換後仍自動捲動至作用中日期。
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->

- [x] #1 Vue SFC 編譯、格式、git diff 與 UTF-8 檢查通過。
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. 依總天數切換 compact tabs 樣式。2. 1～5 天平均分配完整寬度，超過 5 天保留每次約五格與水平捲動。3. 驗證 1/3/5/6/9 天樣式規則、自動捲動、SFC、格式與 UTF-8。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

加入 compact tabs 狀態：1～5 天 nav 佔滿寬度、item 等分；6 天以上保留既有 20% 寬度與水平捲動、自動 scrollIntoView。驗證：SFC/template compile、responsive style assertions、Prettier、production/PWA build、git diff --check、UTF-8 scan 通過。

<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

完成日期頁籤依天數自動分配；以 SFC 與樣式斷言驗證 compact/scroll 規則，並通過 production/PWA build。

<!-- SECTION:FINAL_SUMMARY:END -->
