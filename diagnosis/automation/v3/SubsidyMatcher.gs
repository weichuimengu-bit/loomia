/**
 * Loomia AI診断システム V3.0 福祉業界特化版
 * SubsidyMatcher.gs - 補助金マッチングロジック
 *
 * 役割: フォーム入力(業態・都道府県・補助金経験等)から、Config.SUBSIDIES に
 *       登録された補助金マスター7種に対して適用可否・補助率・実質負担額を
 *       マッチングする。
 *
 * V3.0 注記: HTML フォームは q4_service(業態英語キー)、q6_prefecture
 *           (都道府県の日本語ラベル「大阪府」等)、q11_subsidy_exp
 *           (経験補助金の日本語配列)を送信する。Config.SUBSIDIES の
 *           eligible_prefectures も日本語キーで揃えてある。
 *
 * 重要な前提:
 *   - 業務改善助成金等の厚労省管轄助成金は社労士独占業務
 *   - 書類作成代行は行政書士独占業務(2021年総務省通知)
 *   - そのため、Loomia単独受任ではなく「社労士・行政書士・
 *     中小企業診断士と連携して支援」を前提とする
 *   - 申請代行成功報酬は15〜20%(中央値17.5%)
 */

const SubsidyMatcher = {

  /**
   * 申請代行成功報酬率(中央値)
   * 範囲: 15〜20%
   */
  LOOMIA_FEE_RATE: 0.175,

  /**
   * メイン関数: 該当する補助金をマッチング
   * @param {Object} formData - フォーム入力データ
   * @return {Array} 補助金見込み額順にソートされた配列
   */
  match(formData) {
    const businessType = formData.q4_service;
    const prefecture = formData.q6_prefecture || '';

    // プロダクトマッチングから投資額を見積もる
    const matchedProducts = ProductMatcher.matchTop3(formData);
    const totalEstimatedInvestment = this._estimateInvestment(matchedProducts);

    const self = this;
    return Config.SUBSIDIES.map(function(subsidy) {
      return self._evaluateSubsidy(subsidy, formData, businessType, prefecture, totalEstimatedInvestment);
    }).filter(function(s) {
      return s !== null;
    }).sort(function(a, b) {
      return (b.estimated_subsidy || 0) - (a.estimated_subsidy || 0);
    });
  },

  /**
   * Top3 のみを抽出
   */
  matchTop3(formData) {
    return this.match(formData).slice(0, 3);
  },

  /**
   * 個別補助金の評価
   */
  _evaluateSubsidy(subsidy, formData, businessType, prefecture, totalEstimatedInvestment) {
    // 業態適合性チェック
    const eligibleTypes = subsidy.eligible_types || [];
    const eligible = eligibleTypes.indexOf('all') >= 0 ||
                     eligibleTypes.indexOf(businessType) >= 0;

    if (!eligible) {
      return null;
    }

    // 都道府県制限チェック(大阪府限定の補助金など)
    // formData.q6_prefecture は「大阪府」のような日本語ラベル、
    // Config 側も日本語ラベルで揃えてある。
    if (subsidy.eligible_prefectures &&
        subsidy.eligible_prefectures.indexOf(prefecture) < 0) {
      return null;
    }

    // 補助率の決定(プレミアム条件達成時は高補助率を適用)
    let applicable_rate = subsidy.rate_standard || 0.5;
    let rate_reason = '標準補助率';

    if (subsidy.rate_premium && this._meetsPremiumConditions(formData, subsidy)) {
      applicable_rate = subsidy.rate_premium;
      rate_reason = 'プレミアム条件達成';
    }

    // IT導入補助金の小規模事業者向け特例
    if (subsidy.id === 'it_introduction_2026' && totalEstimatedInvestment <= 500000) {
      if (subsidy.rate_invoice_micro) {
        applicable_rate = subsidy.rate_invoice_micro;
        rate_reason = '50万円以下小規模事業者特例(4/5補助)';
      }
    }

    // 加算系(生産性向上推進体制加算等)は補助金とは別物として扱う
    if (subsidy.type === 'kasan') {
      return this._formatKasanResult(subsidy, formData);
    }

    // 補助額の見積もり(上限と補助率の min を取る)
    const max_amount = subsidy.max_amount || subsidy.single_max || 0;
    const max_subsidy = Math.min(
      max_amount,
      totalEstimatedInvestment * applicable_rate
    );

    // 実質負担額
    const net_cost = Math.max(0, totalEstimatedInvestment - max_subsidy);

    // Loomia申請代行成功報酬(15〜20%、中央値17.5%)
    const loomia_fee = max_subsidy * this.LOOMIA_FEE_RATE;

    // 負担軽減率
    const burden_reduction_percent = totalEstimatedInvestment > 0 ?
      Math.round((1 - net_cost / totalEstimatedInvestment) * 100) : 0;

    return {
      id: subsidy.id,
      name: subsidy.name,
      year: subsidy.year,
      type: subsidy.type || 'subsidy',
      applicable: true,
      applicable_rate: applicable_rate,
      rate_reason: rate_reason,
      max_amount: max_amount,
      estimated_investment: totalEstimatedInvestment,
      estimated_subsidy: max_subsidy,
      net_cost: net_cost,
      loomia_fee_estimate: loomia_fee,
      burden_reduction_percent: burden_reduction_percent,
      requirements: subsidy.requirements || [],
      independence_requirement: subsidy.independence_requirement || null,
      requires_external_partner: this._requiresExternalPartner(subsidy),
      external_partner_note: this._getExternalPartnerNote(subsidy),
      reference_url: subsidy.reference_url || null
    };
  },

  /**
   * 加算系(補助金ではなく介護報酬の加算)の整形
   */
  _formatKasanResult(subsidy, formData) {
    return {
      id: subsidy.id,
      name: subsidy.name,
      year: subsidy.year,
      type: 'kasan',
      applicable: true,
      monthly_addition_unit_1: subsidy.monthly_addition_unit_1,
      monthly_addition_unit_2: subsidy.monthly_addition_unit_2,
      mandatory_from: subsidy.mandatory_from,
      note: '生産性向上推進体制加算は2026年6月から処遇改善加算上位区分の必須要件です。' +
            'AI/ICTを活用した生産性向上計画の提出と、データ提出が必要です。',
      requires_external_partner: false,
      reference_url: subsidy.reference_url || null
    };
  },

  /**
   * プロダクトTop3から投資額を見積もる
   */
  _estimateInvestment(products) {
    return products.slice(0, 2).reduce(function(sum, p) {
      return sum + (p.initial_price || 500000);
    }, 0);
  },

  /**
   * プレミアム補助率の条件判定
   * V3 フォーム: q11_subsidy_exp は日本語ラベル配列。
   * 例: ['介護テクノロジー導入支援事業', 'IT導入補助金']
   *     ['使ったことがない']
   */
  _meetsPremiumConditions: function(formData, subsidy) {
    const exp = formData.q11_subsidy_exp || [];

    if (subsidy.id === 'care_tech') {
      // 介護テクノロジー導入支援事業の経験があればプレミアム
      return exp.indexOf('介護テクノロジー導入支援事業') >= 0;
    }
    if (subsidy.id === 'osaka_ict') {
      // 何らかの補助金経験があればプレミアム(「使ったことがない」のみは不可)
      return exp.length > 0 && exp.indexOf('使ったことがない') < 0;
    }
    return false;
  },

  /**
   * 外部士業との連携が必要かどうかの判定
   */
  _requiresExternalPartner(subsidy) {
    if (subsidy.independence_requirement === 'shaorshi') {
      return true;
    }
    if (subsidy.id === 'business_improvement') {
      return true;
    }
    return false;
  },

  /**
   * 外部パートナー連携時の注記文を生成
   */
  _getExternalPartnerNote(subsidy) {
    if (subsidy.independence_requirement === 'shaorshi') {
      return '本補助金の申請代行は社労士の独占業務のため、Loomiaは社労士と連携して支援します。';
    }
    if (subsidy.id === 'business_improvement') {
      return '業務改善助成金の申請は社労士独占業務のため、提携社労士と連携して支援します。';
    }
    if (subsidy.id === 'monozukuri' || subsidy.id === 'shoryokuka') {
      return '事業計画書の作成支援は中小企業診断士との連携により対応します。書類作成代行は行政書士独占業務(2021年総務省通知)のため、提携行政書士と連携します。';
    }
    return null;
  }
};
