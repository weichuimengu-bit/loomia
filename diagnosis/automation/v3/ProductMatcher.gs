/**
 * Loomia AI診断システム V3.0 福祉業界特化版
 * ProductMatcher.gs - Loomia 5プロダクトへの適合度判定
 *
 * 役割: フォーム入力から、Loomia 5プロダクト(訪問記録AI、加算管理AI、
 *       ルート最適化AI、家族連絡AI、ケアプラン作成支援AI)それぞれの
 *       適合度をスコアリングし、Top3を抽出する。
 *
 * スコアリング(100点満点):
 *   - 業態適合性: 40点
 *   - 痛み点(Q7)の一致: 30点
 *   - 取り組みテーマ(Q11)の一致: 20点
 *   - ICT姿勢(Q9)のボーナス: 10点
 *
 * 適合度ランク:
 *   70点以上 → 高
 *   40〜69点 → 中
 *   40点未満 → 低
 */

const ProductMatcher = {

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
    const businessType = formData.q2_business_type;
    const painPoints = formData.q7_pain_points || [];
    const themes = formData.q11_themes || [];
    const aiAttitude = formData.q9_attitude;

    // 業態適合性(40点満点)
    const businessTypeMatch = (product.best_for_business_types || []).includes(businessType);
    if (businessTypeMatch) {
      score += 40;
      reasons.push('業態「' + this._getBusinessTypeLabel(businessType) + '」に高適合');
    } else {
      reasons.push('業態「' + this._getBusinessTypeLabel(businessType) + '」は対象外または対象拡大予定');
    }

    // 痛み点の一致(30点満点)
    const painMatchList = painPoints.filter(function(p) {
      return (product.target_pain_points || []).indexOf(p) >= 0;
    });
    if (painMatchList.length > 0) {
      const painPointBonus = Math.min(30, painMatchList.length * 15);
      score += painPointBonus;
      const painLabels = painMatchList.map(function(p) {
        return this._getPainPointLabel(p);
      }, this).join('、');
      reasons.push('お困りごと「' + painLabels + '」に対応');
    }

    // 取り組みテーマの一致(20点満点)
    const themeMatchList = themes.filter(function(t) {
      return (product.target_themes || []).indexOf(t) >= 0;
    });
    if (themeMatchList.length > 0) {
      const themeBonus = Math.min(20, themeMatchList.length * 10);
      score += themeBonus;
      const themeLabels = themeMatchList.map(function(t) {
        return this._getThemeLabel(t);
      }, this).join('、');
      reasons.push('取り組みテーマ「' + themeLabels + '」に対応');
    }

    // ICT姿勢ボーナス(10点)
    if (aiAttitude === 'active' || aiAttitude === 'considering') {
      score += 10;
      reasons.push('AI/ICT活用への前向きな姿勢');
    }

    // 適合度ランクの判定
    let matchLevel;
    if (score >= 70) {
      matchLevel = '高';
    } else if (score >= 40) {
      matchLevel = '中';
    } else {
      matchLevel = '低';
    }

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
      reasons: reasons,
      target_pain_points: product.target_pain_points,
      target_themes: product.target_themes,
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
      'day_care': '通所介護(デイサービス)',
      'care_manager': '居宅介護支援(ケアマネ事業所)',
      'group_home': 'グループホーム/特養/老健',
      'disability_welfare': '障害福祉サービス',
      'child_development': '児童発達支援/放デイ',
      'other': 'その他'
    };
    return labels[code] || code;
  },

  /**
   * 痛み点コードを日本語ラベルに変換
   */
  _getPainPointLabel(code) {
    const labels = {
      'visit_records': '訪問記録の手書き・再入力',
      'addition_management': 'LIFE加算など加算管理',
      'shift_creation': 'シフト作成',
      'route_optimization': '訪問ルートの調整',
      'family_communication': '家族・利用者への連絡',
      'billing': 'レセプト・国保連請求',
      'care_plan': 'ケアプラン作成',
      'assessment': 'アセスメント',
      'recruitment': '採用・教育',
      'other': 'その他'
    };
    return labels[code] || code;
  },

  /**
   * テーマコードを日本語ラベルに変換
   */
  _getThemeLabel(code) {
    const labels = {
      'admin_reduction': 'ヘルパー事務作業の削減',
      'addition_max': '加算取得の正確化・最大化',
      'user_satisfaction': '利用者・家族満足度の向上',
      'retention': '採用・離職対策',
      'revision_response': '介護報酬改定への対応',
      'subsidy_application': '補助金活用',
      'other_theme': 'その他'
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
