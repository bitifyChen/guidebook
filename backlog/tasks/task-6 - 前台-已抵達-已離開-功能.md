---
id: TASK-6
title: 前台 已抵達 / 已離開 功能
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 03:21'
updated_date: '2026-07-30 03:52'
labels: []
dependencies: []
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

- 已確認離開 會自推算後面的景點時間
- 已抵達似乎不會更新本景點時間
- 後台可以清楚看到 已抵達 與 已離開的標示(但只能顯示一個我覺得不太合理，我覺得可以改成實際時間 目前形成管理的景點上有 預計 0900-1130 / (已離開1130 或 已抵達 1114)我覺得可以改成，~~0900~~ 0850 -1130，這種標示，另外我們在前台按抵達，要讓他選擇否照原本的離開時間，或是照原本的停留時間(推估新的離開時間)，這樣UIUX更好。
- 相關異動前台的顯示也很重要，要清楚知道本次離開時間(或抵達時間有異動)，因此反到延遲時間的顯示在前台已經不需要
- 前台抵達/離開組件，違背相關的組件測計，我們應該是非滿版的drawer上方會是圓角
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 抵達必選 keepDuration 或 keepDeparture，逾時抵達不可選 keepDeparture。
- [x] #2 actualTiming 可同時保存抵達與離開；離開後修正抵達不改變離開及後續排程。
- [x] #3 前後台以刪除線原時間與有效時間清楚呈現異動，不再只顯示單一狀態。
- [x] #4 Drawer 非滿版且頂部圓角；有效更新立即刷新並只在進行中旅程發 silent sync。
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->

- [x] #1 時間/排程/權限工具測試、Vue SFC 編譯、格式、diff 與 UTF-8 檢查通過。
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. 擴充排程輸出 scheduled/effective 時間並加入 actualTiming 相容處理。 2. 重做前台抵達/離開 Drawer：抵達策略必選、逾時限制、離開權威。 3. 前後台時間改用原時間刪除線加有效時間，移除前台延遲分鐘文案。 4. 驗證策略、修正流程、權限、silent sync、SFC/diff/UTF-8。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

完成 actualTiming 抵達/離開並存、抵達策略必選、離開權威排程、前後台原訂/有效時間顯示與非滿版時間 Drawer。驗證：Node timing/schedule/permission assertions、四個 Vue SFC parse/template compile、Prettier、git diff --check、UTF-8 scan 全數通過。

<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

完成實際抵達/離開的雙紀錄與排程重算；以工具斷言驗證兩種抵達策略、逾時限制、離開後修正抵達及下游排程，並通過 SFC/格式/UTF-8 檢查。

<!-- SECTION:FINAL_SUMMARY:END -->
