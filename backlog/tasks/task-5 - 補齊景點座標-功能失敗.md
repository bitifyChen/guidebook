---
id: TASK-5
title: 補齊景點座標 功能失敗
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 03:10'
updated_date: '2026-07-30 03:42'
labels: []
dependencies: []
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

- 取得 prompt ： `請依據景點名稱與 Google Maps 連結補齊座標，並嚴格遵守以下規則：
  只回傳合法 JSON 陣列，不要使用 Markdown，不要加入說明文字。
  不得新增、刪除、重排項目，也不得修改 id、location、map。
  只可填寫 geo.lat 與 geo.lng，兩者必須是有效數字。

[
{
"id": "zsyQpbsy0XPWb0OrcoQr",
"location": "奇美博物館",
"map": "https://maps.app.goo.gl/GgDBkso7hiNnPHRm7",
"geo": {
"lat": null,
"lng": null
}
},
{
"id": "0kxt1AgFLRdqvVkntcoA",
"location": "文化中心",
"map": "https://maps.app.goo.gl/ho6MuSzEmyMTkAgEA",
"geo": {
"lat": null,
"lng": null
}
}
]`

- 回傳： `[
{
"id": "zsyQpbsy0XPWb0OrcoQr",
"location": "奇美博物館",
"map": "[https://maps.app.goo.gl/GgDBkso7hiNnPHRm7](https://maps.app.goo.gl/GgDBkso7hiNnPHRm7)",
"geo": {
"lat": 22.934752,
"lng": 120.22605
}
},
{
"id": "0kxt1AgFLRdqvVkntcoA",
"location": "文化中心",
"map": "[https://maps.app.goo.gl/ho6MuSzEmyMTkAgEA](https://maps.app.goo.gl/ho6MuSzEmyMTkAgEA)",
"geo": {
"lat": 22.975884,
"lng": 120.227636
}
}
]
`
  你的指令會讓chatGPT生成超連結

- 移除格式化功能(可以在套用時自動跑)，這邊盡量讓使用者簡單
- 建議一個按鈕直接貼上使用者剪貼簿的功能，要他們全選 json 在貼上有點不切實際
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 ChatGPT 回傳 Markdown 超連結或 JSON code fence 時仍可安全正規化並套用。
- [x] #2 Drawer 提供貼上回覆，且格式化改由套用流程自動完成。
- [x] #3 未知、重複、遺漏 ID 與非法座標仍會被阻擋。
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->

- [x] #1 座標解析工具測試、Vue SFC 編譯、格式、diff 與 UTF-8 檢查通過。
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. 強化 AI prompt 並新增 code fence、Markdown URL 回覆正規化。 2. 簡化 Drawer 操作，移除格式化並新增 Clipboard 文字貼上。 3. 驗證合法與非法回覆、Clipboard 失敗、SFC/diff/UTF-8。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Strengthened the AI prompt, added fenced-JSON and Markdown-link normalization, retained strict identity/coordinate validation, and replaced manual formatting with Clipboard paste plus automatic formatting during apply. Parser rejection assertions, SFC compile, Prettier, diff check, and UTF-8 scan passed.

<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Fixed coordinate assistant interoperability with ChatGPT output and simplified the copy/paste/apply workflow.

<!-- SECTION:FINAL_SUMMARY:END -->
