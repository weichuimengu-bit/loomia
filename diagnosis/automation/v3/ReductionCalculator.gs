/**
 * Loomia AI診断システム V3.0 福祉業界特化版
 * ReductionCalculator.gs - 削減効果計算ロジック
 *
 * 役割: フォーム入力から「削減見込み時間」「年間人件費換算」を事前計算し、
 *       Claude APIに渡す確定値として提供することで、ハルシネーションを防ぐ。
 *
 * V3.0 注記: HTML フォーム (index.html) は q9_pain_points を日本語ラベル配列で、
 *           q5_staff を整数で送信する。本モジュールはそれを直接扱う。
 *
 * 出典:
 *   - 福祉_AI自動化(訪問記録時間削減効果 月15〜30時間/人)
 *   - Nuance DAX(訪問記録60%削減)
 *   - Hippocratic AI(他業務領域の削減効果)
 *   - CDI MAIA(ケアプラン作成支援の削減効果)
 */

const ReductionCalculator = {

  /**
   * 各業務領域の削減ポテンシャル(時間/月/人)
   * キーは HTML フォームの q9_pain_points が送る日本語ラベルそのもの
   */
  REDUCTION_RATES: {
    '訪問記録の入力': 12,
    'ケアプラン作成': 15,
    '申し送り・議事録': 4,
    '加算の届出・管理': 6,
    '家族からの問い合わせ対応': 5,
    'シフト作成': 4,
    '訪問ルート調整': 3,
    'ヒヤリハット・事故報告': 3,
    '国保連請求': 8,
    '採用・教育': 3
  },

  /**
   * 時給換算用の係数(全国平均ベース、保守的)
   * 出典: 介護労働安定センター調査 + 福祉_AI自動化記載値
   */
  HOURLY_WAGE_AVERAGE: 1500,

  /**
   * メイン関数: 削減効果を計算
   * @param {Object} formData - フォーム入力データ
   * @return {Object} 削減効果計算結果
   */
  calculate(formData) {
    const staffCount = this._parseStaffCount(formData.q5_staff);
    const painPoints = formData.q9_pain_points || [];
    const userCount = Number(formData.q7_users) || 0;
    const kasanStatus = formData.q10_kasan || '';

    const self = this;
    const areaReductions = painPoints.map(function(label) {
      const hoursPerPerson = self.REDUCTION_RATES[label] || 2;
      return {
        area: label,
        area_label: label,
        hours_per_person: hoursPerPerson,
        total_hours_per_month: hoursPerPerson * staffCount,
        annual_yen: hoursPerPerson * staffCount * 12 * self.HOURLY_WAGE_AVERAGE
      };
    }).sort(function(a, b) {
      return b.total_hours_per_month - a.total_hours_per_month;
    });

    const top3 = areaReductions.slice(0, 3);
    const monthlyTotalHours = areaReductions.reduce(function(sum, a) {
      return sum + a.total_hours_per_month;
    }, 0);

    const annualYenSaved = monthlyTotalHours * 12 * this.HOURLY_WAGE_AVERAGE;

    // 訪問記録AI が対象に入っていれば 60〜85% 削減を想定値として返す
    const recordingReductionRate = painPoints.indexOf('訪問記録の入力') >= 0 ? 85 : 0;

    // 加算取得状況に基づく追加収益見込み(月額)
    // 「未取得」「これから取りたい」と答えた事業所には加算管理AIによる新規取得効果を加算
    let additionalRevenuePerMonth = 0;
    if (kasanStatus.indexOf('未取得') >= 0 || kasanStatus.indexOf('これから') >= 0 || kasanStatus.indexOf('検討') >= 0) {
      // 利用者1人あたり月10単位 × 10円 = 100円/月/人 を保守的に見積もり
      additionalRevenuePerMonth = userCount * 100;
    } else if (kasanStatus.indexOf('一部') >= 0) {
      additionalRevenuePerMonth = userCount * 50;
    }

    return {
      // 新キー(V3 命名)
      timeReductionPerMonth: monthlyTotalHours,
      costReductionPerYear: annualYenSaved,
      recordingReductionRate: recordingReductionRate,
      additionalRevenuePerMonth: additionalRevenuePerMonth,
      top3_areas: top3,
      all_areas: areaReductions,
      staff_count: staffCount,
      hourly_wage_assumed: this.HOURLY_WAGE_AVERAGE,
      assumption_note: '※削減見込みは業界平均からの参考値です。事業所ごとに変動します。',

      // 旧キー(後方互換: ReportFormatter / Claude プロンプト用)
      monthly_total_hours: monthlyTotalHours,
      annual_yen_saved: annualYenSaved
    };
  },

  /**
   * 職員数: V3 では数値直接入力(整数文字列または整数)
   */
  _parseStaffCount: function(value) {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1) return 8;
    return Math.min(n, 500);
  }
};
