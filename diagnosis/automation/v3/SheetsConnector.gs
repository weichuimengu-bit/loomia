/**
 * SheetsConnector.gs
 * Loomia AI診断システム V3.0 福祉業界特化版
 *
 * 役割: 診断結果を Google Sheets「Loomia診断ログ」に書き込む。
 *       初回起動時に 15列のスキーマを持つシートを自動生成する。
 *
 * 設計思想:
 *   - Apps Script 標準の SpreadsheetApp で完結(API トークン不要)
 *   - 既存スプレッドシートの ID を Config.SHEETS_LOG_ID で受け取る
 *   - Webhook や Integration Token のような外部依存ゼロ
 *   - シートが無ければ自動生成、ヘッダ行も自動投入
 *   - 偉吹さんの Excel スキルがそのまま運用に使える
 *
 * 公開関数:
 *   - sendToSheets(diagnosisData): メイン関数。診断結果を1行追加
 *   - ensureSheetSchema(): シート構造を初期化(初回または手動再構築用)
 *   - buildSheetsRow(diagnosisData): 行データの組み立て(テスト用に分離)
 *
 * 依存:
 *   - Config.SHEETS_LOG_ID(PropertiesService から動的取得)
 *
 * 守るべき原則:
 *   - 要配慮個人情報(医療歴・介護歴)は記録しない
 *   - 書き込み失敗時もメール送信は続行できるよう例外を握る
 *   - 失敗時は Logger に記録し、ユーザー側にはエラーを見せない
 */

// ========== シートスキーマ定義 ==========

/**
 * Loomia診断ログシートの列定義(15列+タイムスタンプで計16列)。
 * 列順を変える場合は buildSheetsRow_() の配列順も同期させること。
 */
const SHEETS_SCHEMA = {
  SHEET_NAME: 'Loomia診断ログ',
  HEADERS: [
    'タイムスタンプ',
    '事業所名',
    '担当者名',
    '連絡先メール',
    '都道府県',
    '業態',
    '職員数',
    '診断日',
    '月間削減時間(h)',
    '年間人件費削減見込(円)',
    '記録業務削減率(%)',
    '加算月次収益増(円)',
    '最優先プロダクト',
    '推奨プロダクト',
    '推奨補助金',
    '商談ステータス',
    '備考'
  ]
};


// ========== メイン関数 ==========

/**
 * 診断データを Sheets に1行追加する。
 * 失敗時も例外を投げず、Logger に記録して false を返す。
 *
 * @param {Object} diagnosisData - 診断データ(Code.gs から渡される)
 * @returns {boolean} 書き込み成功なら true、失敗なら false
 */
function sendToSheets(diagnosisData) {
  if (!diagnosisData || typeof diagnosisData !== 'object') {
    console.error('sendToSheets: diagnosisData is required');
    return false;
  }

  const sheetsId = Config.SHEETS_LOG_ID;
  if (!sheetsId) {
    console.warn('sendToSheets: SHEETS_LOG_ID is not set in PropertiesService. Skipping Sheets log.');
    return false;
  }

  try {
    const sheet = openOrCreateSheet_(sheetsId);
    const row = buildSheetsRow(diagnosisData);
    sheet.appendRow(row);

    console.log('sendToSheets: success for ' + (diagnosisData.companyName || 'unknown'));
    return true;
  } catch (e) {
    console.error('sendToSheets: failed - ' + e.message);
    return false;
  }
}


/**
 * シート構造を初期化する。手動再構築や初期セットアップで呼ぶ。
 * 既にヘッダ行がある場合は何もせず終了する(冪等)。
 *
 * @returns {Object} { created: boolean, sheetUrl: string }
 */
function ensureSheetSchema() {
  const sheetsId = Config.SHEETS_LOG_ID;
  if (!sheetsId) {
    throw new Error('ensureSheetSchema: SHEETS_LOG_ID is not set in PropertiesService.');
  }

  const ss = SpreadsheetApp.openById(sheetsId);
  let sheet = ss.getSheetByName(SHEETS_SCHEMA.SHEET_NAME);
  let created = false;

  if (!sheet) {
    sheet = ss.insertSheet(SHEETS_SCHEMA.SHEET_NAME);
    created = true;
  }

  initializeHeaders_(sheet);
  applyFormatting_(sheet);

  return {
    created: created,
    sheetUrl: ss.getUrl() + '#gid=' + sheet.getSheetId()
  };
}

// ===== Part 1/2 ここまで。Part 2 を続けて末尾に追記してください =====


// ========== 行データ組み立て ==========

/**
 * 診断データから Sheets 1行分の配列を生成する。
 * 配列の順序は SHEETS_SCHEMA.HEADERS と完全に一致させること。
 *
 * @param {Object} diagnosisData - 診断データ
 * @returns {Array} 16要素の配列
 */
function buildSheetsRow(diagnosisData) {
  const d = diagnosisData;
  const r = d.reduction || {};

  const productNames = (d.recommendedProducts || []).map(p => p.name || '').filter(Boolean);
  const subsidyNames = (d.recommendedSubsidies || []).map(s => s.name || '').filter(Boolean);

  const now = new Date();
  const today = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');

  return [
    now,                                      // タイムスタンプ
    d.companyName || '',                      // 事業所名
    d.contactName || '',                      // 担当者名
    d.contactEmail || '',                     // 連絡先メール
    d.prefecture || '',                       // 都道府県
    d.serviceType || '',                      // 業態
    Number(d.staffCount || 0),                // 職員数
    today,                                    // 診断日
    Number(r.timeReductionPerMonth || 0),     // 月間削減時間(h)
    Number(r.costReductionPerYear || 0),      // 年間人件費削減見込(円)
    Number(r.recordingReductionRate || 0),    // 記録業務削減率(%)
    Number(r.additionalRevenuePerMonth || 0), // 加算月次収益増(円)
    productNames[0] || '',                    // 最優先プロダクト
    productNames.join(', '),                  // 推奨プロダクト
    subsidyNames.join(', '),                  // 推奨補助金
    '診断完了',                                // 商談ステータス(初期値)
    d.notes || ''                             // 備考
  ];
}


// ========== シートヘルパー(内部関数)==========

/**
 * シートを開き、無ければ作成する。ヘッダ行も自動セットアップ。
 *
 * @param {string} sheetsId - スプレッドシートID
 * @returns {Sheet} 書き込み可能な Sheet オブジェクト
 */
function openOrCreateSheet_(sheetsId) {
  const ss = SpreadsheetApp.openById(sheetsId);
  let sheet = ss.getSheetByName(SHEETS_SCHEMA.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEETS_SCHEMA.SHEET_NAME);
    initializeHeaders_(sheet);
    applyFormatting_(sheet);
    return sheet;
  }

  if (sheet.getLastRow() === 0) {
    initializeHeaders_(sheet);
    applyFormatting_(sheet);
  }

  return sheet;
}


/**
 * ヘッダ行を投入する。既にヘッダがある場合は上書きしない。
 */
function initializeHeaders_(sheet) {
  if (sheet.getLastRow() > 0) return;

  const headers = SHEETS_SCHEMA.HEADERS;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}


/**
 * シートに装飾を適用。ヘッダ太字+背景色、列幅、固定行など。
 * 偉吹さんの Excel スキルでさらに整形可能。
 */
function applyFormatting_(sheet) {
  const headers = SHEETS_SCHEMA.HEADERS;
  const headerRange = sheet.getRange(1, 1, 1, headers.length);

  headerRange
    .setFontWeight('bold')
    .setBackground('#0a0a0b')
    .setFontColor('#7dd3fc')
    .setHorizontalAlignment('center');

  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(14, 250);
  sheet.setColumnWidth(15, 250);
  sheet.setColumnWidth(17, 200);
}


// ========== テスト用 ==========

/**
 * GASエディタから手動実行して動作確認する。
 * SHEETS_LOG_ID が設定されている前提で、サンプルデータを1行書き込む。
 */
function testSheetsConnector() {
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
    notes: 'テスト送信(testSheetsConnector)'
  };

  const row = buildSheetsRow(sampleData);
  Logger.log('Row preview: ' + JSON.stringify(row));

  const result = sendToSheets(sampleData);
  Logger.log('sendToSheets result: ' + result);
  return result;
}


/**
 * シート構造を手動で初期化する。
 * SHEETS_LOG_ID 設定後に1度だけ実行すれば、ヘッダ行と装飾が入る。
 */
function testEnsureSheetSchema() {
  const result = ensureSheetSchema();
  Logger.log('ensureSheetSchema result: ' + JSON.stringify(result));
  return result;
}
