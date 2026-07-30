---
id: TASK-14
title: Admin 全站組件化
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-30 07:15'
updated_date: '2026-07-30 07:52'
labels: []
dependencies: []
references:
  - src/pages/admin
  - src/components/admin
priority: high
type: enhancement
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
將後台大型頁面拆成 shared 與 singular domain 元件，建立一致命名與依賴邊界，維持所有既有操作、資料流與視覺行為。重構在 codex/admin-component-refactor 分支執行，完成後與 main 基準執行相同 Vitest 測試並等待人工 QA，未確認前不得合併。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 跨頁共用元件位於 components/admin/shared，且不含特定頁面設計或領域 API 依賴。
- [x] #2 旅程、行程、成員、推播、行李與每日設定依 singular domain 拆分，元件名稱符合 Admin{Domain}{Feature}。
- [x] #3 Admin Page 不再 import 另一個 Admin Page，Page 僅負責路由、權限、資料載入與工作流程串接。
- [x] #4 main 與重構分支使用相同 Vitest 測試集且測試名稱、數量、結果一致；重構分支 production/PWA build 通過。
- [x] #5 重構分支推送後保持未合併狀態，等待使用者完成後台 QA。
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 AGENTS.md 與 check:admin-architecture 已建立，Prettier、git diff、UTF-8 與架構檢查通過。
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
基準 main commit：cfd965b。1. 建立 admin/shared 並搬移跨頁共用元件、更新引用。2. 依 config、itinerary、trip、participant、notification、packing 順序抽出 singular domain 元件與必要 useAdmin composable。3. 移除 Admin Page-to-Page import，讓 Page 僅負責路由、權限、載入與工作流程。4. 更新 AGENTS.md 並新增 check:admin-architecture。5. 執行與 main 相同 Vitest JSON 測試、production/PWA build、Prettier、git diff、UTF-8，提交推送後等待 QA，不合併。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
重構基準為 main cfd965b；基準 Vitest 6 files、22 tests 全數通過，production/PWA build 通過。

完成 shared 與六個 singular domain 拆分：Trip、Itinerary、Participant、Notification、Packing、Config；Admin Page 已改為薄路由容器。新增架構檢查與 AGENTS 規範。重構分支驗證：Vitest 6 files / 22 tests 通過、32 個 Admin SFC 編譯通過、production/PWA build 通過、Prettier、git diff、UTF-8 與架構檢查通過。待提交推送並與 main JSON reporter 結果比對後交付 QA。

雙分支驗證完成：main cfd965b 與 refactor db988d1 使用相同 JSON reporter，比對 12 suites、22 tests、22 passed，測試名稱與結果完全一致；兩個分支 production/PWA build 均通過。重構分支已推送且未合併，TASK-14 保持 In Progress 等待後台人工 QA。
<!-- SECTION:NOTES:END -->
