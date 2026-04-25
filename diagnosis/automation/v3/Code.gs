/**
 * Loomia AI診断システム V3.0 福祉業界特化版
 * Code.gs — メインエントリポイント
 *
 * @author Loomia (偉吹)
 * @lastModified 2026-04-25
 * @version 3.0.0
 *
 * 役割:
 *   doGet  — 14問フォーム (index.html) のサーブ
 *   doPost — 診断フォーム送信を受け、業態判定→計算→Claude→メール→Notion→ログ
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
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('訪問介護AI活用度診断 | Loomia')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ─────────────────────────────────────────
// doPost: 診断申込を受領 → 業態判定 → 処理分岐
// ─────────────────────────────────────────
function doPost(e) {
  const startTime = new Date();
  let formData = null;

  try {
    // 1. JSON parse + バリデーション
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ status: 'error', message: '送信データが空です。' }, 400);
    }
    formData = JSON.parse(e.postData.contents);

    // 2. 入力バリデーション + PII / 医療要求ガード (Validator.gs)
    const validation = Validator.validate(formData);
    if (!validation.valid) {
      Logger.logSubmission(formData, 'rejected', null, validation.errors.join(' | '));
      return jsonResponse({
        status: 'error',
        message: validation.errors.join(' / '),
        errorCode: validation.code || 'VALIDATION_FAILED'
      }, 400);
    }

    // 3. hCaptcha 検証 (formData.captchaToken が存在する場合)
    if (formData.captchaToken) {
      const captchaOk = Validator.verifyCaptcha(formData.captchaToken);
      if (!captchaOk) {
        Logger.logSubmission(formData, 'rejected', null, 'captcha_failed');
        return jsonResponse({
          status: 'error',
          message: 'セキュリティチェックに失敗しました。お手数ですが再度お試しください。'
        }, 400);
      }
    }

    // 4. 業態フィルタ: 訪問介護 = フル診断、それ以外 = 段階対応メール
    const businessType = formData.q2_business_type;
    if (!isCurrentlySupported(businessType)) {
      EmailSender.sendDeferredResponseEmail(formData);
      Logger.logSubmission(formData, 'deferred', new Date() - startTime,
        `business_type=${businessType}`);
      return jsonResponse({
        status: 'deferred',
        message: '受け付けました。訪問介護以外の業態は順次対応予定として、ロードマップをメールでお送りしました。'
      }, 200);
    }

    // 5. 数値根拠の事前計算 (ハルシネーション防止)
    const reduction = ReductionCalculator.calculate(formData);
    const productMatch = ProductMatcher.match(formData);
    const subsidies = SubsidyMatcher.match(formData);

    // 6. Claude API で診断レポート生成 (4フェーズ自己批判)
    const claudeInput = buildClaudeInput(formData, reduction, productMatch, subsidies);
    const reportMarkdown = ClaudeAPI.generateReportWithSelfCritique(claudeInput);

    // 7. Markdown → メール用 HTML 整形
    const formattedReport = ReportFormatter.formatForEmail(reportMarkdown, formData);

    // 8. メール送信
    EmailSender.sendDiagnosisReport(formData, reportMarkdown, formattedReport);

    // 9. Notion 連携 (webhook URL が設定されていれば)
    NotionConnector.createCandidate(formData, reportMarkdown, reduction, productMatch, subsidies);

    // 10. ログ記録
    Logger.logSubmission(formData, 'success', new Date() - startTime,
      `reduction=${reduction.monthly_total_hours}h/mo, top_product=${productMatch[0] && productMatch[0].id}`);

    return jsonResponse({
      status: 'success',
      message: '診断レポートをメールでお送りしました。'
    }, 200);

  } catch (err) {
    const ctx = formData || (e && e.postData && e.postData.contents) || '(no input)';
    Logger.logError(err, ctx);
    Logger.notifyAdminOfError(err, ctx);
    return jsonResponse({
      status: 'error',
      message: 'システムエラーが発生しました。お手数ですが ' + Config.ADMIN_EMAIL + ' までご連絡ください。'
    }, 500);
  }
}

// ─────────────────────────────────────────
// 業態フィルタ: V3.0 では訪問介護のみフル対応
// 他業態は2026年Q4以降に段階展開予定
// ─────────────────────────────────────────
function isCurrentlySupported(businessType) {
  return businessType === 'visiting_care';
}

// ─────────────────────────────────────────
// Claude に渡す統合入力を構築
// (PII を含まないことを再確認した上で)
// ─────────────────────────────────────────
function buildClaudeInput(formData, reduction, productMatch, subsidies) {
  return {
    // 事業所側の集計情報のみ (利用者個人情報は含まない)
    business_name: formData.q1_business_name || '',
    business_type: formData.q2_business_type,
    insurance_number_provided: !!formData.q3_insurance_number,
    staff_count: formData.q4_staff_count,
    user_count: formData.q5_user_count,
    software: formData.q6_software,
    pain_points: formData.q7_pain_points || [],
    admin_hours: formData.q8_admin_hours,
    ai_attitude: formData.q9_attitude,
    subsidy_experience: formData.q10_subsidy_experience,
    themes: formData.q11_themes || [],
    prefecture: formData.q12_prefecture,
    free_text: (formData.q14_free_text || '').slice(0, 2000),

    // 事前計算済み数値 (Claude にこれ以外の数値を発明させない)
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
// index.html から <?!= include('partial') ?> で参照可能
// ─────────────────────────────────────────
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
