---
id: TASK-11
title: 旅程管理 > 旅程行李
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 06:18'
updated_date: '2026-07-30 07:09'
labels: []
dependencies: []
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
- 應添加全選，全移除功能
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 旅程行李 Drawer 提供全選，補入 catalog 全部項目且保留既有名稱修改與旅程自訂項目。
- [x] #2 全移除會清空 Drawer 內全部項目，只有按儲存才寫入 trip.packingList 空陣列；取消不寫入。
- [x] #3 元件移至 components/admin/trip 並更新所有引用，空清單仍使前台隱藏行李功能。
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 工具斷言、Vue 元件測試、Prettier、build、git diff 與 UTF-8 檢查通過。
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 抽出可測試的旅程行李全選合併工具。2. 將 AdminTripPackingDrawer 移至 admin/trip 並加入全選與全移除控制。3. 補齊元件與工具測試，完成驗證與 Backlog 驗收。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
完成全選／全移除暫存操作、catalog 合併工具與 admin/trip 領域搬移。Vitest 4/4 通過，production/PWA build、Prettier、git diff 與 UTF-8 檢查通過。測試另發現並修正 Drawer 初始化會覆蓋旅程自訂名稱的問題。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
旅程行李 Drawer 已支援安全全選與全移除；全選保留既有編輯和自訂項目，全移除僅在儲存時寫入空清單，元件已移至 admin/trip。
<!-- SECTION:FINAL_SUMMARY:END -->
