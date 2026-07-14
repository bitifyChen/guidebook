# 🚀 出遊即時位置追蹤系統 (PWA + Traccar + Firebase) 初步設計方案

本方案專為**好友出遊**設計，免去原生 App 開發與上架費用。利用 iOS/Android 免費開源 App (**Traccar Client**) 在背景抓取 GPS，透過自訂連結自動帶入設定，並經由 Firebase 即時同步，最終在自建的 PWA 網頁地圖上顯示所有成員的位置與電量。

---

## 🛠️ 系統架構圖

```
[成員手機: Traccar Client (背景定位)]
       │ (自動定時發送 HTTP POST)
       ▼
[Firebase Cloud Functions (後端 API)] ➔ 比對設備號與成員姓名
       │
       ▼
[Firebase Cloud Firestore (即時資料庫)]
       │ (onSnapshot 秒級自動推播)
       ▼
[前端 PWA 網頁地圖 (Vue 3 + Leaflet.js)] ➔ 顯示所有人位置、電量、狀態
```

---

## 🗄️ Firebase 資料庫設計 (Firestore)

主要規劃兩個集合 (Collection)：一個用來管理成員報到綁定，一個用來存放即時位置。

### 1. `devices` 集合 (成員報到對照表)

- **文件 ID (Doc ID)**：直接使用 Traccar App 隨機產生的「設備識別碼」
- **欄位結構**：

```json
{
  "deviceId": "456789", // 設備識別碼 (字串)
  "userName": "小明", // 成員在 PWA 填寫的暱稱
  "joinedAt": "2026-07-13T15:45:00Z" // 報到時間
}
```

### 2. `locations` 集合 (即時位置與狀態)

- **文件 ID (Doc ID)**：同樣使用 `deviceId`，方便覆蓋與快速查詢
- **欄位結構**：

```json
{
  "userId": "456789",
  "userName": "小明",
  "latitude": 25.0339,
  "longitude": 121.5644,
  "battery": 85, // 剩餘電量 % (Traccar 自動提供)
  "speed": 0, // 移動速度
  "lastUpdated": "2026-07-13T15:48:00Z" // 最後更新時間
}
```

---

## ⚙️ 後端 API 實作邏輯 (Firebase Functions 偽程式碼)

當成員的 Traccar App 在背景發送位置時，此 API 會被觸發：

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.trackLocation = functions.https.onRequest(async (req, res) => {
  // 1. 解析 Traccar 發送過來的標準格式
  const { id, lat, lon, timestamp, batt, speed } = req.body;

  if (!id || !lat || !lon) {
    return res.status(400).send('Missing parameters');
  }

  try {
    // 2. 根據設備 id 去 devices 集合查詢對應的成員姓名
    const deviceDoc = await admin
      .firestore()
      .collection('devices')
      .doc(id)
      .get();
    let userName = '未知隊友';

    if (deviceDoc.exists) {
      userName = deviceDoc.data().userName;
    }

    // 3. 寫入或更新 locations 集合
    await admin
      .firestore()
      .collection('locations')
      .doc(id)
      .set(
        {
          userId: id,
          userName: userName,
          latitude: lat,
          longitude: lon,
          battery: batt,
          speed: speed,
          lastUpdated: new Date(timestamp * 1000), // Traccar 時間戳為秒級
        },
        { merge: true }
      );

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).send('Internal Server Error');
  }
});
```

---

## 📱 前端 PWA 網頁設計 (Vue 3 + Leaflet.js)

### 1. 成員無腦設定流程 (Deep Link 應用)

在 LINE 群組或 PWA 首頁提供此特製連結：

```text
traccar://notification?url=https%3A%2F%2Fus-central1-yourproject.cloudfunctions.net%2Ftrack&accuracy=high
```

> **說明**：成員手機點擊後會自動喚醒 Traccar Client，並將 `Server URL` 自動填入你的 API 網址，並把精度調為 `High`。成員只需動手將**「服務狀態 (Service status)」**開關打開即可。

### 2. PWA 報到表單頁面

成員複製 App 上的設備號後，回到 PWA 輸入：

- 姓名輸入框 (`v-model="form.name"`)
- 設備號輸入框 (`v-model="form.deviceId"`)
- 送出後執行：`db.collection('devices').doc(form.deviceId).set({ ... })`

### 3. 即時地圖監聽與動態渲染

使用 Leaflet.js 配合 Firestore `onSnapshot`，達成無感秒級刷新：

```javascript
import { onMounted, ref } from 'vue';
import { collection, onSnapshot } from 'firebase/firestore';
// 假設已安裝並引入 Leaflet 或 Vue Leaflet

const users = ref([]);

onMounted(() => {
  // 即時監聽所有人的位置
  onSnapshot(collection(db, 'locations'), (snapshot) => {
    const updatedUsers = [];
    snapshot.forEach((doc) => {
      const data = doc.data();

      // 檢查最後更新時間是否超過 5 分鐘 (判斷是否斷線/關閉 App)
      const isOnline = new Date() - data.lastUpdated.toDate() < 5 * 60 * 1000;

      updatedUsers.push({
        ...data,
        isOnline, // 傳給地圖標記，若斷線可將 Marker 變為半透明或灰色
      });
    });
    users.value = updatedUsers;
  });
});
```

---

## 💡 專案開發與防呆優化建議

1. **免費額度評估**：
   - **Firestore 寫入額度**：每日 20,000 筆免費。
   - **試算**：假設 5 個朋友出遊，Traccar 設定每 60 秒發送一次位置，持續出遊 10 小時：
     `5人 × 60次/小時 × 10小時 = 3,000 次寫入`。
     **完全在免費額度內**，不需支付任何 Firebase 費用。
2. **斷線視覺提示**：在地圖畫面上，若 `isOnline` 為 `false`，可利用 CSS filter (`opacity: 0.5; filter: grayscale(1);`) 把該成員的大頭貼變灰，讓大家知道「此人的位置停留在 5 分鐘前，可能手機沒電或關閉了定位服務」。
3. **電量監控**：在地圖 Marker 的 Popup 上顯示 `電量: 85%`，朋友之間還能互相提醒誰的手機快沒電了，非常實用。
