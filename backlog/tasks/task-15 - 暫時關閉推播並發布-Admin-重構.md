---
id: TASK-15
title: 暫時關閉推播並發布 Admin 重構
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 08:20'
updated_date: '2026-07-30 08:34'
labels: []
dependencies: []
references:
  - src/api/notifications.js
  - src/pages/Settings.vue
priority: high
type: chore
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
在重新梳理推播觸發時機前，只於共用通知 API 暫停訊息發送。前台通知授權、FCM Token 綁定、解除綁定與 Service Worker 全部維持；人工推播、測試推播與 itinerary silent sync 暫時不呼叫 Render。完成後將 Admin 組件化分支合併到 main。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 共用通知 API 的 PUSH_DELIVERY_ENABLED 預設為 false。
- [x] #2 人工推播、測試推播與 itinerary silent sync 不取得管理員 Token、不呼叫 Render notification API，也不新增 notificationLogs。
- [x] #3 前台通知授權、FCM Token 綁定、解除綁定與 Service Worker 維持現況。
- [x] #4 不新增測試、不執行測試或 build；提交分支後合併並推送 main。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 在共用 notification API 加入 PUSH_DELIVERY_ENABLED=false。2. sendGuidebookNotification 關閉時回傳 skipped 結果並在取得 ID Token 前結束。3. 不修改任何呼叫端、前台綁定或後台介面。4. 提交重構分支、合併 main、更新 TASK-14/15 並推送。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PUSH_DELIVERY_ENABLED 已設為 false，sendGuidebookNotification 在 Firebase Auth 與 fetch 前直接回傳 skipped；未修改 Settings、FCM Token、Service Worker、Render 或任何呼叫端。依使用者要求未新增或執行測試/build；重構分支已成功合併 main。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
暫時停用所有推播發送，保留完整前台綁定與接收基礎；Admin 重構已合併 main。依要求未執行測試或 build。
<!-- SECTION:FINAL_SUMMARY:END -->
