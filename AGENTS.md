# AGENTS.md

## 專案協作規則

- 前端小修改不需要主動執行 build；除非修改範圍較大、涉及路由、資料流、打包設定，或使用者明確要求驗證。
- 編輯含有繁體中文的檔案後，必須以 UTF-8 驗證檔案內容，並檢查是否有亂碼或替換字元。

## 前台 Liquid Glass

- 目前只保留 `src/layouts/default.vue` 的 navbar 與 `src/pages/Itinerary.vue` 的日期選擇 Liquid Glass 效果。這是網頁近似實作，不是 Apple 原生元件。
- 不要再把 Liquid Glass 共用材質擴散到前台其他卡片、Drawer、表單、列表或內容區塊。
- 玻璃效果只作用於 navbar 與日期選擇容器背景。文字、圖示與內容不可使用 SVG displacement 或混色模式，閱讀優先。
- 前台主色維持橘色；藍、綠、紅只用於功能語意狀態。不要將前台 Liquid Glass 套用到 admin layout。

## Admin 組件架構

- 跨頁共用元件放在 `src/components/admin/shared/`，命名為 `Admin{Feature}`；不得包含特定頁面流程，不得直接依賴領域 API 或 domain 元件。
- 頁面專屬元件依 singular domain 放置：`trip`、`itinerary`、`participant`、`notification`、`packing`、`config`。
- Domain 元件命名為 `Admin{Domain}{Feature}`；複雜子功能繼續延伸名稱，例如 `AdminParticipantFormTracking`，並留在相同 domain 目錄。
- `src/pages/admin` 只負責 route metadata、權限、載入與流程串接；Admin Page 不得 import 另一個 Admin Page。
- 不得把頁面專屬元件放回 `src/components/admin/` 根目錄。修改後台架構後執行 `npm run check:admin-architecture`。

<!-- BACKLOG.MD GUIDELINES START -->
<!-- backlog.md-instructions-version: 1.48.0 -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**For every user request in this project, run `backlog instructions overview` before answering or taking action.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Before task lifecycle actions, read the matching detailed guide:
- `backlog instructions task-creation` before creating or splitting tasks
- `backlog instructions task-execution` before planning, changing status or assignee, adding a plan or implementation notes, or implementing task work
- `backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks to terminal statuses

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->
