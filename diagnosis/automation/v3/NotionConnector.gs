/**
 * NotionConnector.gs
 * Loomia AI診断システム V3.0 福祉業界特化版
 *
 * 役割: 診断結果を Notion DB に登録する Webhook 連携モジュール。
 *       Notion API を直接叩かず、Notion Automation または Zapier/Make 等の
 *       外部 Webhook URL に POST する設計。
 *
 * 設計思想:
 *   - Notion API トークンを Apps Script 側に持たない(セキュリティリスク回避)
 *   - プロパティ名のマッピングは Notion 側 Automation で吸収
 *   - Apps Script 側のコードは「正規化された JSON を投げる」だけに専念
 *
 * 公開関数:
 *   - sendToNotion(diagnosisData): メイン関数。診断結果を Notion DB に登録
 *   - buildNotionPayload(diagnosisData): JSON ペイロード生成(テスト用に分離)
 *
 * 依存:
 *   - Config.NOTION_WEBHOOK_URL(PropertiesService から動的取得)
 *
 * 守るべき原則:
 *   - 要配慮個人情報(医療歴・介護歴)は payload に含めない
 *   - Webhook 失敗時もメール送信(EmailSender.gs)は続行できるよう例外を握る
 *   - リトライは最大2回まで(指数バックオフ)
 *   - エラーは Logger.gs 側に記録し、ユーザー側にはエラーを見せない
 */

// ========== メイン関数 ==========

/**
 * 診断データを Notion DB に登録する。
 * Webhook 失敗時も例外を投げず、Logger に記録して false を返す。
 *
 * @param {Object} diagnosisData - 診断データ(Code.gs から渡される)
 * @returns {boolean} 登録成功なら true、失敗なら false
 */
function sendToNotion(diagnosisData) {
  if (!diagnosisData || typeof diagnosisData !== 'object') {
    console.error('sendToNotion: diagnosisData is required');
    return false;
  }

  const webhookUrl = Config.NOTION_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('sendToNotion: NOTION_WEBHOOK_URL is not set in PropertiesService. Skipping Notion sync.');
    return false;
  }

  const payload = buildNotionPayload(diagnosisData);

  try {
    const success = postWithRetry_(webhookUrl, payload, 2);
    if (success) {
      console.log('sendToNotion: success for ' + (diagnosisData.companyName || 'unknown'));
    } else {
      console.error('sendToNotion: failed after retries for ' + (diagnosisData.companyName || 'unknown'));
    }
    return success;
  } catch (e) {
    console.error('sendToNotion: unexpected error - ' + e.message);
    return false;
  }
}


// ========== ペイロード生成 ==========

/**
 * 診断データから Notion 登録用 JSON ペイロードを生成する。
 *
 * Notion 側の Automation で各フィールドを以下のプロパティにマッピングすること:
 *   companyName       → 事業所名(title)
 *   contactName       → 担当者名(rich_text)
 *   contactEmail      → 連絡先メール(email)
 *   prefecture        → 都道府県(select)
 *   serviceType       → 業態(select)5業態のいずれか
 *   staffCount        → 職員数(number)
 *   diagnosisDate     → 診断日(date)ISO8601
 *   monthlyHoursSaved → 月間削減時間(number)
 *   annualCostSaved   → 年間人件費削減見込(number)
 *   topProductName    → 最優先プロダクト名(select or rich_text)
 *   recommendedProducts → 推奨プロダクト一覧(multi_select or rich_text)
 *   recommendedSubsidies → 推奨補助金一覧(multi_select or rich_text)
 *   leadStage         → 商談ステータス(select)初期値「診断完了」
 *   notes             → 備考・自由記述(rich_text)
 *
 * @param {Object} diagnosisData - 診断データ
 * @returns {Object} Notion Automation に投げる JSON
 */
function buildNotionPayload(diagnosisData) {
  const d = diagnosisData;
  const r = d.reduction || {};

  const productNames = (d.recommendedProducts || []).map(p => p.name || '').filter(Boolean);
  const subsidyNames = (d.recommendedSubsidies || []).map(s => s.name || '').filter(Boolean);

  return {
    source: 'loomia_diagnosis_v3',
    timestamp: new Date().toISOString(),
    companyName: d.companyName || '',
    contactName: d.contactName || '',
    contactEmail: d.contactEmail || '',
    prefecture: d.prefecture || '',
    serviceType: d.serviceType || '',
    staffCount: Number(d.staffCount || 0),
    diagnosisDate: new Date().toISOString().split('T')[0],
    monthlyHoursSaved: Number(r.timeReductionPerMonth || 0),
    annualCostSaved: Number(r.costReductionPerYear || 0),
    recordingReductionRate: Number(r.recordingReductionRate || 0),
    additionalRevenuePerMonth: Number(r.additionalRevenuePerMonth || 0),
    topProductName: productNames[0] || '',
    recommendedProducts: productNames,
    recommendedSubsidies: subsidyNames,
    leadStage: '診断完了',
    notes: d.notes || ''
  };
}


// ========== HTTP POST(リトライ付き)==========

/**
 * 指定 URL に JSON を POST する。失敗時は指数バックオフでリトライ。
 *
 * @param {string} url - Webhook URL
 * @param {Object} payload - 送信する JSON
 * @param {number} maxRetries - 最大リトライ回数
 * @returns {boolean} 成功なら true
 */
function postWithRetry_(url, payload, maxRetries) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    followRedirects: true
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      const code = response.getResponseCode();

      if (code >= 200 && code < 300) {
        return true;
      }

      console.warn('postWithRetry_: HTTP ' + code + ' on attempt ' + (attempt + 1) + ' - ' + response.getContentText().substring(0, 200));
    } catch (e) {
      console.warn('postWithRetry_: exception on attempt ' + (attempt + 1) + ' - ' + e.message);
    }

    if (attempt < maxRetries) {
      Utilities.sleep(1000 * Math.pow(2, attempt));
    }
  }

  return false;
}


// ========== テスト用 ==========

function testNotionConnector() {
  const sampleData = {
    companyName: '株式会社サンプル介護',
    contactName: '山田太郎',
    contactEmail: 'sample@example.com',
    prefecture: '大阪府',
    serviceType: '訪問介護',
    staffCount: 12,
    reduction: {
      timeReductionPerMonth: 108,
      costReductionPerYear: 2592000,
      recordingReductionRate: 85,
      additionalRevenuePerMonth: 120000
    },
    recommendedProducts: [
      { name: '訪問記録音声入力AI' },
      { name: '加算管理AI' }
    ],
    recommendedSubsidies: [
      { name: '介護テクノロジー導入支援事業' },
      { name: 'IT導入補助金2026' }
    ],
    notes: 'テスト送信'
  };

  const payload = buildNotionPayload(sampleData);
  Logger.log('Payload preview: ' + JSON.stringify(payload, null, 2));

  const result = sendToNotion(sampleData);
  Logger.log('sendToNotion result: ' + result);
  return result;
}
