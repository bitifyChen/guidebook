---
id: TASK-14
title: Admin 全站組件化
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 07:15'
updated_date: '2026-07-30 08:34'
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
- [x] #3 Admin Page 擁有路由的第一層畫面與編排，不使用只包裹整頁的 Admin{Domain}Manager，且不 import 另一個 Admin Page。
- [x] #4 Config、Itinerary 僅將 Trip Drawer 與獨立頁面都會使用的編輯區抽為 Workspace，其餘 Table、Drawer、Form、Row 維持明確職責。
- [x] #5 main 與重構分支使用相同 Vitest 測試集且測試名稱、數量、結果一致；重構分支 build 通過並保持未合併等待 QA。
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 AGENTS.md 與 check:admin-architecture 已建立，Prettier、git diff、UTF-8 與架構檢查通過。
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
基準 main commit：cfd965b。1. shared 與 singular domain 元件維持既有拆分。2. 移除只包住整頁的 Admin*Manager：Trip、Participant、Notification、Packing 邏輯與第一層 template 回到對應 page。3. Config、Itinerary 因需同時支援獨立 route 與 Trip Drawer，拆成 page chrome + 可重用 Admin*Workspace，不保留整頁 Manager。4. 架構規則新增禁止 top-level Manager wrapper，AGENTS 記錄 page 第一層原則。5. 重跑相同 Vitest、Admin SFC、build、Prettier、UTF-8 與架構檢查，推送分支後繼續等待 QA。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
重構基準為 main cfd965b；基準 Vitest 6 files、22 tests 全數通過，production/PWA build 通過。

完成 shared 與六個 singular domain 拆分：Trip、Itinerary、Participant、Notification、Packing、Config；Admin Page 已改為薄路由容器。新增架構檢查與 AGENTS 規範。重構分支驗證：Vitest 6 files / 22 tests 通過、32 個 Admin SFC 編譯通過、production/PWA build 通過、Prettier、git diff、UTF-8 與架構檢查通過。待提交推送並與 main JSON reporter 結果比對後交付 QA。

雙分支驗證完成：main cfd965b 與 refactor db988d1 使用相同 JSON reporter，比對 12 suites、22 tests、22 passed，測試名稱與結果完全一致；兩個分支 production/PWA build 均通過。重構分支已推送且未合併，TASK-14 保持 In Progress 等待後台人工 QA。

依使用者維護習慣修正：page 不應只渲染一個與整頁等價的 Manager component。將第一層責任移回 page，僅保留有明確 UI 職責或實際跨入口重用的元件。

依 QA 回饋完成 page ownership 修正：Trip、Participant、Notification、Packing 第一層畫面與流程已回到 page；Config、Itinerary page 自己持有頁面 chrome，只將跨 Trip Drawer 重用的編輯區保留為 Workspace。移除六個 Admin{Domain}Manager，架構檢查新增禁止無意義整頁 wrapper。驗證：40 個 Admin SFC 編譯、production/PWA build、架構檢查、Prettier、UTF-8、git diff 均通過；與 main JSON reporter 仍為 12 suites / 22 tests / 22 passed 且名稱結果一致。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
完成 Admin shared/domain 組件化並依維護規範保留 page 第一層所有權；重構分支已由使用者確認並合併至 main。先前已完成 unit、SFC、architecture 與 production/PWA build 驗證。
<!-- SECTION:FINAL_SUMMARY:END -->
