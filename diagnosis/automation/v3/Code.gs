/**
 * Loomia AI診断システム V3.0 福祉業界特化版
 * Code.gs — メインエントリポイント
 *
 * @author Loomia (偉吹)
 * @lastModified 2026-04-26
 * @version 3.0.1
 *
 * 役割:
 *   doGet  — 14問フォーム (index.html) のサーブ
 *   doPost — 診断フォーム送信を受け、業態判定→計算→Sheets→Claude→メール→ログ
 *
 * 倫理 5 制約 (絶対遵守):
 *   1. 介護報酬不正請求への加担を促す表現を含めない
 *   2. 医療判断・診断の出力をしない
 *   3. 利用者個人情報を Claude API に送信しない (事業所匿名化IDのみ)
 *   4. 「人ゼロ運営」表現を使わない
 *   5. 専門職 (ヘルパー / サ責 / 看護師 / ケアマネ) の判断権を尊重
 */

// ─────────────────────────────────────────
// doGet: 診断フォームを表示
// ─────────────────────────────────────────
function doGet(e) {
  const tmpl = HtmlService.createTemplateFromFile('index');
  tmpl.scriptUrl = ScriptApp.getService().getUrl();
  return tmpl.evaluate()
    .setTitle('訪問介護AI活用度診断 | Loomia')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


// =============================================================
// processSubmission: フォーム送信処理の本体
// =============================================================

function processSubmission(formData) {
  console.log('=== processSubmission CALLED ===');

  // 文字列で渡された場合は JSON.parse する
  if (typeof formData === 'string') {
    try {
      formData = JSON.parse(formData);
    } catch (parseErr) {
      console.error('Failed to parse formData string:', parseErr);
      return {
        status: 'error',
        message: 'リクエストのフォーマットが不正です。'
      };
    }
  }

  if (!formData || typeof formData !== 'object') {
    console.error('formData is invalid after parsing');
    return {
      status: 'error',
      message: 'フォームデータを受け取れませんでした。再度お試しください。'
    };
  }

  // V3_TEST: 受信フォームのキー整合確認用デバッグログ
  console.log('V3_TEST: q5_staff=' + formData.q5_staff +
              ', q9_pain_points=' + JSON.stringify(formData.q9_pain_points) +
              ', q4_service=' + formData.q4_service +
              ', q6_prefecture=' + formData.q6_prefecture +
              ', q12_attitude=' + formData.q12_attitude);

  const startTime = new Date();

  try {
    // 1. 入力バリデーション(Validator が定義されていれば)
    if (typeof Validator !== 'undefined' && Validator.validate) {
      const validation = Validator.validate(formData);
      if (!validation.valid) {
        if (typeof Logger !== 'undefined' && Logger.logSubmission) {
          Logger.logSubmission(formData, 'rejected', null, validation.errors.join(' | '));
        }
        return {
          status: 'error',
          message: validation.errors.join(' / '),
          errorCode: validation.code || 'VALIDATION_FAILED'
        };
      }
    }

    // 2. hCaptcha 検証
    if (formData.captchaToken && typeof Validator !== 'undefined' && Validator.verifyCaptcha) {
      const captchaOk = Validator.verifyCaptcha(formData.captchaToken);
      if (!captchaOk) {
        return {
          status: 'error',
          message: 'セキュリティチェックに失敗しました。お手数ですが再度お試しください。'
        };
      }
    }

    // 3. 業態フィルタ: 訪問介護 = フル診断、それ以外 = 段階対応メール
    const businessType = formData.q4_service;
    if (!isCurrentlySupported(businessType)) {
      if (typeof EmailSender !== 'undefined' && EmailSender.sendDeferredResponseEmail) {
        EmailSender.sendDeferredResponseEmail(formData);
      }
      return {
        status: 'deferred',
        message: '受け付けました。訪問介護以外の業態は順次対応予定として、ロードマップをメールでお送りしました。'
      };
    }

    // 4. 計算層(訪問介護のみ)
    const reduction = ReductionCalculator.calculate(formData);
    const productMatch = ProductMatcher.match(formData);
    const subsidies = SubsidyMatcher.match(formData);

    // 5. 診断データ統合(Claude 結果は後で差し込む)
    const diagnosisData = {
      companyName: formData.q2_company,
      contactName: formData.q3_contact,
      contactEmail: formData.q1_email,
      prefecture: formData.q6_prefecture,
      serviceType: (Config.BUSINESS_TYPES[businessType] || {}).label || businessType,
      staffCount: formData.q5_staff,
      reduction: reduction,
      recommendedProducts: productMatch,
      recommendedSubsidies: subsidies,
      aiAssessment: null,
      notes: (formData.q13_issues || '') + ' / ' + (formData.q14_expectations || '')
    };

    // 6. Sheets に書き込み(Claude 失敗時もログを残すため先に実行)
    try {
      if (typeof sendToSheets === 'function') {
        sendToSheets(diagnosisData);
      } else if (typeof SheetsConnector !== 'undefined' && SheetsConnector.write) {
        SheetsConnector.write(diagnosisData);
      }
    } catch (sheetsErr) {
      console.error('sendToSheets failed (non-fatal): ' + sheetsErr.message);
    }

    // 7. Claude API で診断アセスメント生成(失敗してもメールは送る)
    try {
      const claudeInput = buildClaudeInput(formData, reduction, productMatch, subsidies);
      diagnosisData.aiAssessment = ClaudeAPI.generateReport(claudeInput);
    } catch (claudeErr) {
      console.error('Claude API failed: ' + claudeErr.message);
      diagnosisData.aiAssessment = '※AIアセスメントの生成に失敗しました。担当者(loomia.jp@gmail.com)より個別にご連絡いたします。';
    }

    // 8. メール送信
    try {
      const htmlBody = formatReportToHtml(diagnosisData);
      GmailApp.sendEmail(
        formData.q1_email,
        diagnosisData.companyName + ' 様 AI活用度診断レポート',
        'HTMLメール対応のメーラーでご覧ください',
        {
          htmlBody: htmlBody,
          name: 'Loomia',
          from: Session.getActiveUser().getEmail()
        }
      );
    } catch (mailErr) {
      console.error('GmailApp.sendEmail failed: ' + mailErr.message);
    }

    // 9. ログ記録
    if (typeof Logger !== 'undefined' && Logger.logSubmission) {
      Logger.logSubmission(formData, 'success', new Date() - startTime, null);
    }

    return {
      status: 'success',
      message: '診断レポートをメールでお送りしました。'
    };

  } catch (e) {
    console.error('processSubmission error: ' + e.message + ' / stack: ' + e.stack);
    if (typeof Logger !== 'undefined' && Logger.logSubmission) {
      Logger.logSubmission(formData, 'error', new Date() - startTime, e.message);
    }
    return {
      status: 'error',
      message: 'システムエラーが発生しました。loomia.jp@gmail.com まで直接ご連絡ください。'
    };
  }
}


// =============================================================
// doPost: form POST(隠し iframe 方式)+ 旧 fetch 方式の両対応
// =============================================================

function doPost(e) {
  let formData = null;

  try {
    // パターン1: form POST 方式(e.parameter.payload に JSON 文字列)
    if (e && e.parameter && e.parameter.payload) {
      console.log('doPost: form POST mode detected');
      try {
        formData = JSON.parse(e.parameter.payload);
      } catch (parseErr) {
        return HtmlService.createHtmlOutput('<html><body>JSON parse エラー</body></html>');
      }
    }
    // パターン2: 旧 fetch 方式(e.postData.contents に JSON 文字列)
    else if (e && e.postData && e.postData.contents) {
      console.log('doPost: postData.contents mode detected');
      try {
        formData = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        return HtmlService.createHtmlOutput('<html><body>JSON parse エラー</body></html>');
      }
    }
    else {
      console.error('doPost: no recognizable payload');
      return HtmlService.createHtmlOutput('<html><body>送信データが空です。</body></html>');
    }
  } catch (err) {
    console.error('doPost error: ' + err.message);
    return HtmlService.createHtmlOutput('<html><body>システムエラーが発生しました。</body></html>');
  }

  const result = processSubmission(formData);

  // form POST 方式の場合は HTML レスポンスを返す
  // 結果を postMessage で親ウィンドウに通知(成功/失敗どちらでも)
  return HtmlService.createHtmlOutput(
    '<html><body><script>' +
    'if (window.parent !== window) { window.parent.postMessage(' +
      JSON.stringify({ source: 'loomia_form_submission', result: result }) +
    ', "*"); }' +
    '</script>' +
    '<p>結果: ' + (result.message || '完了') + '</p>' +
    '</body></html>'
  );
}

// ─────────────────────────────────────────
// 業態フィルタ: V3.0 では訪問介護のみフル対応
// ─────────────────────────────────────────
function isCurrentlySupported(businessType) {
  return businessType === 'visiting_care';
}

// ─────────────────────────────────────────
// Claude に渡す統合入力を構築
// PII を含まないことを再確認した上で、HTML フォームの全 14 キーを反映
// ─────────────────────────────────────────
function buildClaudeInput(formData, reduction, productMatch, subsidies) {
  return {
    business_name: formData.q2_company || '',
    contact_name: formData.q3_contact || '',
    business_type: formData.q4_service,
    staff_count: formData.q5_staff,
    prefecture: formData.q6_prefecture,
    user_count: formData.q7_users,
    software: formData.q8_software || [],
    pain_points: formData.q9_pain_points || [],
    kasan_status: formData.q10_kasan || '',
    subsidy_experience: formData.q11_subsidy_exp || [],
    ai_attitude: formData.q12_attitude,
    issues: (formData.q13_issues || '').slice(0, 2000),
    free_text: (formData.q14_expectations || '').slice(0, 2000),

    calculated_reduction: reduction,
    matched_products: productMatch,
    matched_subsidies: subsidies
  };
}

// ─────────────────────────────────────────
// JSON レスポンスヘルパ
// ─────────────────────────────────────────
function jsonResponse(obj, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────
// HTML テンプレートのインクルード (Apps Script 慣例)
// ─────────────────────────────────────────
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
