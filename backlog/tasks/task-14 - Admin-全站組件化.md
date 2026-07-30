---
id: TASK-14
title: Admin 全站組件化
status: To Do
assignee: []
created_date: '2026-07-30 07:15'
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
- [ ] #1 跨頁共用元件位於 components/admin/shared，且不含特定頁面設計或領域 API 依賴。
- [ ] #2 旅程、行程、成員、推播、行李與每日設定依 singular domain 拆分，元件名稱符合 Admin{Domain}{Feature}。
- [ ] #3 Admin Page 不再 import 另一個 Admin Page，Page 僅負責路由、權限、資料載入與工作流程串接。
- [ ] #4 main 與重構分支使用相同 Vitest 測試集且測試名稱、數量、結果一致；重構分支 production/PWA build 通過。
- [ ] #5 重構分支推送後保持未合併狀態，等待使用者完成後台 QA。
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 AGENTS.md 與 check:admin-architecture 已建立，Prettier、git diff、UTF-8 與架構檢查通過。
<!-- DOD:END -->
