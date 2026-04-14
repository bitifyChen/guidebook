/**
 * 匯率 API 服務
 * 使用 Open Exchange Rates (免費版) 或 Frankfurter (無須 API Key)
 */

const BASE_URL = 'https://open.er-api.com/v6/latest';

export const getExchangeRates = async (base = 'TWD') => {
  try {
    const response = await fetch(`${BASE_URL}/${base}`);
    if (!response.ok) throw new Error('匯率抓取失敗');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Currency API Error:', error);
    return null;
  }
};

/**
 * 取得常見貨幣清單
 */
export const COMMON_CURRENCIES = [
  { code: 'TWD', name: '新台幣', symbol: '$' },
  { code: 'KRW', name: '韓圓', symbol: '₩' },
  { code: 'JPY', name: '日圓', symbol: '¥' },
  { code: 'USD', name: '美金', symbol: '$' },
  { code: 'HKD', name: '港幣', symbol: '$' },
  { code: 'EUR', name: '歐元', symbol: '€' },
];
