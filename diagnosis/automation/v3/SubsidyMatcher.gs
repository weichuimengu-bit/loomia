/**
 * Loomia AI診断システム V3.0 福祉業界特化版
 * SubsidyMatcher.gs - 補助金マッチングロジック
 *
 * 役割: フォーム入力(業態・都道府県・補助金経験等)から、
 *       Config.SUBSIDIESに登録された補助金マスター7種に対して
 *       適用可否・補助率・実質負担額をマッチングする。
 *
 * 重要な前提:
 *   - 業務改善助成金等の厚労省管轄助成金は社労士独占業務
 *   - 書類作成代行は行政書士独占業務(2021年総務省通知)
 *   - そのため、Loomia単独受任ではなく「社労士・行政書士・
 *     中小企業診断士と連携して支援」を前提とする
 *   - 申請代行成功報酬は15〜20%(中央値17.5%)
 *
 * 出典:
 *   - 福祉_AI自動化(補助金7種・士業独占業務)
 *   - ＡＩＳＮＳ運用(申請代行相場感)
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
    const businessType = formData.q4_business_type;
    const prefectureLabel = formData.q6_prefecture || '';
    const prefecture = this._normalizePrefecture(prefectureLabel);

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
   * V3 フォームの都道府県日本語ラベルを内部キーに正規化
   */
  _normalizePrefecture: function(label) {
    if (!label) return '';
    if (label.indexOf('北海道') >= 0) return 'hokkaido';
    if (label.indexOf('青森') >= 0) return 'aomori';
    if (label.indexOf('岩手') >= 0) return 'iwate';
    if (label.indexOf('宮城') >= 0) return 'miyagi';
    if (label.indexOf('秋田') >= 0) return 'akita';
    if (label.indexOf('山形') >= 0) return 'yamagata';
    if (label.indexOf('福島') >= 0) return 'fukushima';
    if (label.indexOf('茨城') >= 0) return 'ibaraki';
    if (label.indexOf('栃木') >= 0) return 'tochigi';
    if (label.indexOf('群馬') >= 0) return 'gunma';
    if (label.indexOf('埼玉') >= 0) return 'saitama';
    if (label.indexOf('千葉') >= 0) return 'chiba';
    if (label.indexOf('東京') >= 0) return 'tokyo';
    if (label.indexOf('神奈川') >= 0) return 'kanagawa';
    if (label.indexOf('新潟') >= 0) return 'niigata';
    if (label.indexOf('富山') >= 0) return 'toyama';
    if (label.indexOf('石川') >= 0) return 'ishikawa';
    if (label.indexOf('福井') >= 0) return 'fukui';
    if (label.indexOf('山梨') >= 0) return 'yamanashi';
    if (label.indexOf('長野') >= 0) return 'nagano';
    if (label.indexOf('岐阜') >= 0) return 'gifu';
    if (label.indexOf('静岡') >= 0) return 'shizuoka';
    if (label.indexOf('愛知') >= 0) return 'aichi';
    if (label.indexOf('三重') >= 0) return 'mie';
    if (label.indexOf('滋賀') >= 0) return 'shiga';
    if (label.indexOf('京都') >= 0) return 'kyoto';
    if (label.indexOf('大阪') >= 0) return 'osaka';
    if (label.indexOf('兵庫') >= 0) return 'hyogo';
    if (label.indexOf('奈良') >= 0) return 'nara';
    if (label.indexOf('和歌山') >= 0) return 'wakayama';
    if (label.indexOf('鳥取') >= 0) return 'tottori';
    if (label.indexOf('島根') >= 0) return 'shimane';
    if (label.indexOf('岡山') >= 0) return 'okayama';
    if (label.indexOf('広島') >= 0) return 'hiroshima';
    if (label.indexOf('山口') >= 0) return 'yamaguchi';
    if (label.indexOf('徳島') >= 0) return 'tokushima';
    if (label.indexOf('香川') >= 0) return 'kagawa';
    if (label.indexOf('愛媛') >= 0) return 'ehime';
    if (label.indexOf('高知') >= 0) return 'kochi';
    if (label.indexOf('福岡') >= 0) return 'fukuoka';
    if (label.indexOf('佐賀') >= 0) return 'saga';
    if (label.indexOf('長崎') >= 0) return 'nagasaki';
    if (label.indexOf('熊本') >= 0) return 'kumamoto';
    if (label.indexOf('大分') >= 0) return 'oita';
    if (label.indexOf('宮崎') >= 0) return 'miyazaki';
    if (label.indexOf('鹿児島') >= 0) return 'kagoshima';
    if (label.indexOf('沖縄') >= 0) return 'okinawa';
    return label;
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
      // 50万円以下案件は最大4/5補助
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
   * プレミアム補助率の条件判定 (V3: q11 は配列、日本語ラベル)
   */
  _meetsPremiumConditions: function(formData, subsidy) {
    const exp = formData.q11_subsidy_experience || [];
    const hasExperience = exp.some(function(e) {
      return e !== '使ったことがない';
    });

    if (subsidy.id === 'care_tech') return hasExperience;
    if (subsidy.id === 'osaka_ict') return hasExperience;
    return false;
  },

  /**
   * 外部士業との連携が必要かどうかの判定
   */
  _requiresExternalPartner(subsidy) {
    // 厚労省管轄助成金は社労士独占
    if (subsidy.independence_requirement === 'shaorshi') {
      return true;
    }
    // 業務改善助成金、人材確保等支援助成金等
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
