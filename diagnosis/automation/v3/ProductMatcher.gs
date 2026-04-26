/**
 * Loomia AI診断システム V3.0 福祉業界特化版
 * ProductMatcher.gs - Loomia 5プロダクトへの適合度判定
 *
 * 役割: フォーム入力から、Loomia 5プロダクト(訪問記録AI、加算管理AI、
 *       ルート最適化AI、家族連絡AI、ケアプラン作成支援AI)それぞれの
 *       適合度をスコアリングし、Top3を抽出する。
 *
 * V3.0 注記: HTML フォームは q4_service(業態英語キー)、q9_pain_points
 *           (日本語ラベル配列)、q12_attitude(日本語ラベル)を送信する。
 *
 * スコアリング(80点満点):
 *   - 業態適合性: 40点
 *   - 痛み点(Q9)の一致: 30点
 *   - AI姿勢(Q12)のボーナス: 10点
 *
 * 適合度ランク:
 *   70点以上 → 高
 *   40〜69点 → 中
 *   40点未満 → 低
 */

const ProductMatcher = {

  /**
   * 痛み点ラベル(日本語) → 内部キー(英語)変換マップ
   * Config.PRODUCTS.target_pain_points は内部英語キーで定義されている。
   */
  PAIN_POINT_JP_TO_EN: {
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
  },

  /**
   * メイン関数: 全プロダクトの適合度を計算してソート済みで返す
   * @param {Object} formData - フォーム入力データ
   * @return {Array} 適合度スコア順にソートされたプロダクト配列
   */
  match(formData) {
    const self = this;
    return Config.PRODUCTS.map(function(product) {
      return self._scoreProduct(product, formData);
    }).sort(function(a, b) {
      return b.match_score - a.match_score;
    });
  },

  /**
   * Top3 のみを抽出
   */
  matchTop3(formData) {
    return this.match(formData).slice(0, 3);
  },

  /**
   * 個別プロダクトのスコアリング
   */
  _scoreProduct(product, formData) {
    let score = 0;
    const reasons = [];
    const businessType = formData.q4_service;
    const painPointLabels = formData.q9_pain_points || [];
    const aiAttitude = formData.q12_attitude || '';

    const self = this;
    const painPointKeys = painPointLabels.map(function(label) {
      return self.PAIN_POINT_JP_TO_EN[label] || 'other';
    });

    // 業態適合性(40点満点)
    const businessTypeMatch = (product.best_for_business_types || []).indexOf(businessType) >= 0;
    if (businessTypeMatch) {
      score += 40;
      reasons.push('業態「' + this._getBusinessTypeLabel(businessType) + '」に高適合');
    }

    // 痛み点の一致(30点満点)
    const painMatchList = painPointKeys.filter(function(p) {
      return (product.target_pain_points || []).indexOf(p) >= 0;
    });
    if (painMatchList.length > 0) {
      const painPointBonus = Math.min(30, painMatchList.length * 15);
      score += painPointBonus;
      // 表示は元の日本語ラベルのまま
      const matchedLabels = painPointLabels.filter(function(label) {
        const key = self.PAIN_POINT_JP_TO_EN[label] || 'other';
        return (product.target_pain_points || []).indexOf(key) >= 0;
      });
      reasons.push('お困りごと「' + matchedLabels.join('、') + '」に対応');
    }

    // AI姿勢ボーナス(10点)
    if (aiAttitude.indexOf('積極的') >= 0 || aiAttitude.indexOf('効果があれば') >= 0) {
      score += 10;
      reasons.push('AI/ICT活用への前向きな姿勢');
    }

    let matchLevel;
    if (score >= 70) matchLevel = '高';
    else if (score >= 40) matchLevel = '中';
    else matchLevel = '低';

    return {
      id: product.id,
      name: product.name,
      initial_price: product.initial_price,
      monthly_price_min: product.monthly_price_min,
      monthly_price_max: product.monthly_price_max,
      monthly_price_per_caremanager: product.monthly_price_per_caremanager,
      monthly_savings_hours: product.monthly_savings_hours,
      readiness: product.readiness,
      readiness_label: this._getReadinessLabel(product.readiness),
      match_score: score,
      match_level: matchLevel,
      reason: reasons.join(' / '),
      reasons: reasons,
      target_pain_points: product.target_pain_points,
      best_for_business_types: product.best_for_business_types
    };
  },

  /**
   * 業態コードを日本語ラベルに変換
   */
  _getBusinessTypeLabel(code) {
    const labels = {
      'visiting_care': '訪問介護',
      'visiting_nursing': '訪問看護',
      'day_service': '通所介護(デイサービス)',
      'care_manager': '居宅介護支援(ケアマネ事業所)',
      'group_home': 'グループホーム/特養/老健',
      'disability_welfare': '障害福祉サービス',
      'child_development': '児童発達支援/放デイ',
      'other': 'その他'
    };
    return labels[code] || code;
  },

  /**
   * リリース時期コードを日本語ラベルに変換
   */
  _getReadinessLabel(code) {
    const labels = {
      'launching_2026q2': '2026年Q2(現在開発中)',
      'launching_2026q4': '2026年Q4',
      'launching_2027q1': '2027年Q1',
      'launching_2027q2': '2027年Q2'
    };
    return labels[code] || code;
  }
};
