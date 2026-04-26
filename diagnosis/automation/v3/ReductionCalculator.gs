/**
 * Loomia AI診断システム V3.0 福祉業界特化版
 * ReductionCalculator.gs - 削減効果計算ロジック
 *
 * 役割: フォーム入力から「削減見込み時間」「年間人件費換算」を事前計算し、
 *       Claude APIに渡す確定値として提供することで、ハルシネーションを防ぐ。
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
   * これは業界平均の参考値であり、最終的な数値は事業所ごとに変動する
   */
  REDUCTION_RATES: {
    'visit_records': 12,        // 訪問記録AI: 月12時間/人(Nuance DAX 60%削減ベース)
    'addition_management': 6,   // 加算管理AI: 月6時間/人(管理者・サ責)
    'shift_creation': 4,        // シフト作成: 月4時間/人(管理者)
    'route_optimization': 3,    // ルート最適化: 月3時間/人(ヘルパー1人あたり)
    'family_communication': 5,  // 家族連絡: 月5時間/人(ヘルパー)
    'billing': 8,               // レセプト・国保連請求: 月8時間/人(管理者)
    'care_plan': 15,            // ケアプラン: 月15時間/人(ケアマネ、CDI MAIA参考値)
    'assessment': 6,            // アセスメント: 月6時間/人(ケアマネ)
    'recruitment': 3,           // 採用・教育: 月3時間/人(管理者)
    'other': 2                  // その他: 月2時間/人(保守的見積)
  },

  /**
   * 時給換算用の係数(全国平均ベース、保守的)
   * 出典: 介護労働安定センター調査 + 福祉_AI自動化記載値
   */
  HOURLY_WAGE_AVERAGE: 1500,  // 円/時(ヘルパー・管理者の平均的な時給換算)

  /**
   * メイン関数: 削減効果を計算
   * @param {Object} formData - フォーム入力データ
   * @return {Object} 削減効果計算結果
   */
  calculate(formData) {
    const staffCount = this._parseStaffCount(formData.q5_staff_count);
    const painPoints = (formData.q9_pain_points || []).map(this._normalizePainPoint, this);

    const adminHours = staffCount * 25;

    const areaReductions = painPoints.map(function(pp) {
      const hoursPerPerson = this.REDUCTION_RATES[pp] || 0;
      return {
        area: pp,
        area_label: this._getAreaLabel(pp),
        hours_per_person: hoursPerPerson,
        total_hours_per_month: hoursPerPerson * staffCount,
        annual_yen: hoursPerPerson * staffCount * 12 * this.HOURLY_WAGE_AVERAGE
      };
    }, this).sort(function(a, b) {
      return b.total_hours_per_month - a.total_hours_per_month;
    });

    const top3 = areaReductions.slice(0, 3);
    const monthlyTotalHours = areaReductions.reduce(function(sum, a) {
      return sum + a.total_hours_per_month;
    }, 0);

    const annualYenSaved = monthlyTotalHours * 12 * this.HOURLY_WAGE_AVERAGE;
    const recordingReductionRate = painPoints.indexOf('visit_records') >= 0 ? 85 : 0;
    const additionalRevenuePerMonth = (formData.q7_user_count || 0) * 10 * 10;

    return {
      timeReductionPerMonth: monthlyTotalHours,
      costReductionPerYear: annualYenSaved,
      recordingReductionRate: recordingReductionRate,
      additionalRevenuePerMonth: additionalRevenuePerMonth,
      top3_areas: top3,
      all_areas: areaReductions,
      staff_count: staffCount,
      hourly_wage_assumed: this.HOURLY_WAGE_AVERAGE,
      assumption_note: '※削減見込みは業界平均からの参考値です。事業所ごとに変動します。'
    };
  },

  /**
   * 職員数: V3 では数値直接入力
   */
  _parseStaffCount: function(value) {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1) return 8;
    return Math.min(n, 500);
  },

  /**
   * V3 フォームの日本語ラベルを内部キーに正規化
   */
  _normalizePainPoint: function(label) {
    const map = {
      '訪問記録の入力': 'visit_records',
      'ケアプラン作成': 'care_plan',
      '申し送り・議事録': 'other',
      '加算の届出・管理': 'addition_management',
      '家族からの問い合わせ対応': 'family_communication',
      'シフト作成': 'shift_creation',
      '訪問ルート調整': 'route_optimization',
      'ヒヤリハット・事故報告': 'other',
      '国保連請求': 'billing',
      '採用・教育': 'recruitment'
    };
    return map[label] || 'other';
  },

  /**
   * 業務領域コードを日本語ラベルに変換
   */
  _getAreaLabel: function(code) {
    const labels = {
      'visit_records': '訪問記録の手書き・再入力',
      'addition_management': 'LIFE加算など加算管理',
      'shift_creation': 'シフト作成',
      'route_optimization': '訪問ルートの調整',
      'family_communication': '家族・利用者への連絡',
      'billing': 'レセプト・国保連請求',
      'care_plan': 'ケアプラン作成(ケアマネ向け)',
      'assessment': 'アセスメント',
      'recruitment': '採用・教育',
      'other': 'その他'
    };
    return labels[code] || code;
  }
};
