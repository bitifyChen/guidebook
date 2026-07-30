---
id: TASK-2
title: 【後台】圖片貼上上傳
status: Done
assignee:
  - '@codex'
created_date: '2026-07-29 07:24'
updated_date: '2026-07-29 08:43'
labels: []
dependencies: []
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

- 後台的圖片功能，要支援ctrl+V的貼上
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Clipboard 圖片可直接上傳，單圖取代、圖集依序追加。
- [x] #2 一般文字與 URL 貼上不攔截、不觸發圖片上傳。
- [x] #3 上傳失敗保留原圖片並顯示既有錯誤提示。
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->

- [x] #1 SFC、工具測試、格式、build、diff 與 UTF-8 檢查通過。
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. 抽出 Clipboard 圖片檔解析與 ImgBB 批次上傳工具。 2. 接入景點封面、景點圖集、成員頭像與推播圖片欄位。 3. 驗證圖片與文字 paste 行為、錯誤保留、SFC/build/diff/UTF-8。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Added a shared Clipboard image parser/uploader and integrated cover replacement, ordered gallery append, participant avatar replacement, and notification image replacement. Simulated image/text paste behavior passed; affected Vue templates, production/PWA build, Prettier, diff check, and strict UTF-8 validation passed.

<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Implemented admin Clipboard image upload without intercepting text paste, verified failure-safe assignment and production compilation.

<!-- SECTION:FINAL_SUMMARY:END -->
