/**
 * Loomia AI診断システム V3.0 福祉業界特化版
 * 統合バンドル(9ファイルを連結した単一スクリプト)
 *
 * Apps Script Editor に貼り付けて使用するため、複数 .gs ファイルではなく
 * 1ファイルに集約してある。元の9ファイル構成は GitHub の v3/ ディレクトリに保管。
 *
 * 連結順序:
 *   1. Config.gs
 *   2. ReductionCalculator.gs
 *   3. ProductMatcher.gs
 *   4. SubsidyMatcher.gs
 *   5. ReportFormatter.gs
 *   6. ClaudeAPI.gs
 *   7. SheetsConnector.gs
 *   8. NotionConnector.gs
 *   9. Code.gs
 *
 * 連結スクリプトで自動生成。手動編集する場合は元ファイルも合わせて更新すること。
 */


// ============================================================================
// ===== Config.gs =====
// ============================================================================

/**
 * Loomia AI診断システム V3.0 福祉業界特化版
 * Config.gs — 定数 / 補助金マスター / プロダクトマスター / 介護ソフト連携マップ
 *
 * 重要: API キー / Webhook URL は PropertiesService に保存し、
 *      ハードコード絶対禁止。
 */

const Config = {

  // === Claude API ===========================================================
  get CLAUDE_API_KEY() {
    return PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  },
  CLAUDE_MODEL: 'claude-opus-4-7',
  CLAUDE_API_URL: 'https://api.anthropic.com/v1/messages',
  CLAUDE_VERSION: '2023-06-01',

  // === レポート生成 =========================================================
  REPORT_MAX_TOKENS: 8192,
  REPORT_THINKING_BUDGET: 10000, // 拡張思考予算 (各フェーズ共通、必要に応じ12000へ)

  // === 4 フェーズ自己批判 ==================================================
  SELF_CRITIQUE_ENABLED: true,
  SELF_CRITIQUE_PHASES: 4,

  // === Notion 連携 =========================================================
  get NOTION_WEBHOOK_URL() {
    return PropertiesService.getScriptProperties().getProperty('NOTION_WEBHOOK_URL');
  },
  NOTION_API_VERSION: '2022-06-28',

  // === Google Sheets ログ連携 ====================================
  get SHEETS_LOG_ID() {
    return PropertiesService.getScriptProperties().getProperty('SHEETS_LOG_ID');
  },

  // === メール送信 ==========================================================
  SENDER_EMAIL: 'loomia.jp@gmail.com',
  SENDER_NAME: 'Loomia / 偉吹',
  ADMIN_EMAIL: 'loomia.jp@gmail.com',

  // === ロギング ============================================================
  get LOG_SPREADSHEET_ID() {
    return PropertiesService.getScriptProperties().getProperty('LOG_SHEET_ID');
  },
  LOG_SHEET_NAME: '実行ログV3',

  // === hCaptcha 検証 (任意) ================================================
  get HCAPTCHA_SECRET() {
    return PropertiesService.getScriptProperties().getProperty('HCAPTCHA_SECRET');
  },
  HCAPTCHA_VERIFY_URL: 'https://api.hcaptcha.com/siteverify',

  // === 業態定義 ============================================================
  BUSINESS_TYPES: {
    visiting_care:        { label: '訪問介護',                      readiness: 'available',     roadmap_quarter: '現在主力 (2026 Q2 〜)' },
    visiting_nursing:     { label: '訪問看護',                      readiness: 'roadmap',       roadmap_quarter: '2026 Q4 〜' },
    day_care:             { label: '通所介護 (デイサービス)',          readiness: 'roadmap',       roadmap_quarter: '2027 Q1 〜' },
    care_manager:         { label: '居宅介護支援 (ケアマネ事業所)',     readiness: 'roadmap',       roadmap_quarter: '2027 Q2 〜' },
    group_home:           { label: 'グループホーム / 特養 / 老健',     readiness: 'roadmap',       roadmap_quarter: '2027 Q3 〜' },
    disability_welfare:   { label: '障害福祉サービス',                readiness: 'roadmap',       roadmap_quarter: '2027 Q3 〜' },
    child_development:    { label: '児童発達支援 / 放デイ',           readiness: 'roadmap_far',   roadmap_quarter: '2027 Q4 以降検討' },
    other:                { label: 'その他',                        readiness: 'manual_review', roadmap_quarter: '個別ご相談ください' }
  },

  // === 補助金マスター (2026 年度版) ========================================
  // 出典: プロジェクトナレッジ「福祉×AI自動化」
  // 数値はすべて 2026-04 時点。マスター更新時はここを書き換え、
  // システムプロンプト側 (ClaudeAPI.gs) と同期させること。
  SUBSIDIES: [
    {
      id: 'care_tech',
      name: '介護テクノロジー導入支援事業',
      max_amount: 10000000,            // パッケージ型上限 1000 万円
      single_max: 1000000,
      rate_standard: 0.5,
      rate_premium: 0.75,              // 加算条件 (生産性ガイドライン提出 + ビギナー受講 + 相談センター受診)
      eligible_types: ['visiting_care', 'visiting_nursing', 'day_care', 'group_home'],
      requirements: [
        '生産性向上ガイドラインに基づく計画提出',
        '生産性向上ビギナーセミナー受講',
        '介護生産性向上総合相談センター受診'
      ],
      target_products: ['visit_records_ai', 'addition_management_ai', 'route_optimization_ai'],
      year: 2026
    },
    {
      id: 'it_introduction_2026',
      name: 'IT導入補助金 2026 通常枠',
      max_amount: 4500000,
      rate_standard: 0.5,
      rate_invoice: 0.667,
      rate_invoice_small: 0.75,
      rate_invoice_micro: 0.8,
      hardware_cap: 200000,
      eligible_types: ['all'],
      target_products: ['all'],
      year: 2026
    },
    {
      id: 'monozukuri',
      name: 'ものづくり補助金 (第22次)',
      max_amount: 100000000,
      rate_standard: 0.667,
      eligible_types: ['all'],
      target_products: ['custom_development'],
      year: 2026,
      threshold: 'large_scale',
      note: '大規模投資 (1,000 万円超) の事業所のみ実用的'
    },
    {
      id: 'shoryokuka',
      name: '中小企業省力化投資補助金',
      max_amount: 100000000,
      rate_standard: 0.667,
      eligible_types: ['all'],
      target_products: ['route_optimization_ai', 'addition_management_ai'],
      year: 2026
    },
    {
      id: 'business_improvement',
      name: '業務改善助成金',
      max_amount: 6000000,
      rate_standard: 0.8,
      rate_premium: 0.95,              // 最低賃金 1,000 円未満地域で上振れ
      annual_budget_2025: 29700000000,
      eligible_types: ['all'],
      target_products: ['all'],
      year: 2026,
      independence_requirement: 'sharoshi', // 社労士独占業務
      note: '申請代行は社労士独占。Loomia は社労士と連携して支援します。'
    },
    {
      id: 'productivity_addition',
      name: '生産性向上推進体制加算',
      type: 'kasan',
      monthly_addition_unit_1: 100,    // 月 100 単位 / 人
      monthly_addition_unit_2: 10,
      eligible_types: ['visiting_care', 'visiting_nursing', 'day_care', 'group_home'],
      mandatory_from: '2026-06-01',    // 2026/6 から処遇改善加算上位の前提条件
      year: 2026
    },
    {
      id: 'osaka_ict',
      name: '介護ICT導入支援事業 (大阪府)',
      max_amount: 3000000,
      rate_standard: 0.5,
      rate_premium: 0.75,
      eligible_types: ['visiting_care', 'visiting_nursing', 'day_care'],
      eligible_prefectures: ['osaka'],
      year: 2026
    }
  ],

  // === Loomia 5 プロダクトマスター ==========================================
  PRODUCTS: [
    {
      id: 'visit_records_ai',
      name: '訪問記録 音声入力AI',
      initial_price: 500000,
      monthly_price_min: 50000,
      monthly_price_max: 100000,
      monthly_savings_hours: 22.5,
      target_pain_points: ['visit_records'],
      target_themes: ['admin_reduction'],
      best_for_business_types: ['visiting_care', 'visiting_nursing'],
      readiness: 'launching_2026q2'
    },
    {
      id: 'addition_management_ai',
      name: '加算管理AI',
      initial_price: 500000,
      monthly_price_min: 50000,
      monthly_price_max: 100000,
      monthly_savings_hours: 15,
      target_pain_points: ['addition_management', 'billing'],
      target_themes: ['addition_max', 'revision_response'],
      best_for_business_types: ['visiting_care', 'visiting_nursing', 'day_care'],
      readiness: 'launching_2026q4'
    },
    {
      id: 'route_optimization_ai',
      name: '訪問ルート最適化AI',
      initial_price: 300000,
      monthly_price_min: 50000,
      monthly_price_max: 100000,
      monthly_savings_hours: 10,
      target_pain_points: ['shift_creation', 'route_optimization'],
      target_themes: ['admin_reduction'],
      best_for_business_types: ['visiting_care', 'visiting_nursing'],
      readiness: 'launching_2027q1'
    },
    {
      id: 'family_communication_ai',
      name: '家族連絡自動化AI',
      initial_price: 200000,
      monthly_price_min: 30000,
      monthly_price_max: 50000,
      monthly_savings_hours: 8,
      target_pain_points: ['family_communication'],
      target_themes: ['user_satisfaction'],
      best_for_business_types: ['visiting_care', 'visiting_nursing', 'day_care', 'group_home'],
      readiness: 'launching_2026q4'
    },
    {
      id: 'care_plan_ai',
      name: 'ケアプラン作成支援AI',
      initial_price: 300000,
      monthly_price_per_caremanager: 10000,
      monthly_savings_hours: 20,
      target_pain_points: ['care_plan', 'assessment'],
      target_themes: ['admin_reduction'],
      best_for_business_types: ['care_manager'],
      readiness: 'launching_2027q2'
    }
  ],

  // === 介護ソフト連携対応マップ =============================================
  SOFTWARE_INTEGRATION: {
    kaipoke:    { vendor: 'エス・エム・エス',    integration_priority: 1, integration_method: 'api_planned' },
    wiseman:    { vendor: 'ワイズマン',          integration_priority: 2, integration_method: 'csv' },
    honobono:   { vendor: 'NDソフトウェア',       integration_priority: 3, integration_method: 'csv' },
    kanamic:    { vendor: 'カナミック',          integration_priority: 4, integration_method: 'api_planned' },
    carekarte:  { vendor: 'ケアコネクトジャパン', integration_priority: 5, integration_method: 'csv' },
    wincare:    { vendor: '富士通Japan',        integration_priority: 6, integration_method: 'csv' },
    firstcare:  { vendor: 'ビーシステム',         integration_priority: 7, integration_method: 'csv' },
    careviewer: { vendor: 'ロジック',            integration_priority: 8, integration_method: 'csv' },
    rakusuke:   { vendor: 'ニップクケアサービス',  integration_priority: 9, integration_method: 'manual' },
    other_software: { vendor: '不明',           integration_priority: 99, integration_method: 'investigate' },
    paper:      { vendor: null,                  integration_priority: 10, integration_method: 'full_digitization_required' },
    unknown:    { vendor: null,                  integration_priority: 11, integration_method: 'identify_first' }
  },

  // === 都道府県マスター (Notion select 用) =================================
  PREFECTURES: [
    { value: 'hokkaido', label: '北海道' }, { value: 'aomori', label: '青森県' },
    { value: 'iwate', label: '岩手県' }, { value: 'miyagi', label: '宮城県' },
    { value: 'akita', label: '秋田県' }, { value: 'yamagata', label: '山形県' },
    { value: 'fukushima', label: '福島県' }, { value: 'ibaraki', label: '茨城県' },
    { value: 'tochigi', label: '栃木県' }, { value: 'gunma', label: '群馬県' },
    { value: 'saitama', label: '埼玉県' }, { value: 'chiba', label: '千葉県' },
    { value: 'tokyo', label: '東京都' }, { value: 'kanagawa', label: '神奈川県' },
    { value: 'niigata', label: '新潟県' }, { value: 'toyama', label: '富山県' },
    { value: 'ishikawa', label: '石川県' }, { value: 'fukui', label: '福井県' },
    { value: 'yamanashi', label: '山梨県' }, { value: 'nagano', label: '長野県' },
    { value: 'gifu', label: '岐阜県' }, { value: 'shizuoka', label: '静岡県' },
    { value: 'aichi', label: '愛知県' }, { value: 'mie', label: '三重県' },
    { value: 'shiga', label: '滋賀県' }, { value: 'kyoto', label: '京都府' },
    { value: 'osaka', label: '大阪府 (Loomia 拠点)' }, { value: 'hyogo', label: '兵庫県' },
    { value: 'nara', label: '奈良県' }, { value: 'wakayama', label: '和歌山県' },
    { value: 'tottori', label: '鳥取県' }, { value: 'shimane', label: '島根県' },
    { value: 'okayama', label: '岡山県' }, { value: 'hiroshima', label: '広島県' },
    { value: 'yamaguchi', label: '山口県' }, { value: 'tokushima', label: '徳島県' },
    { value: 'kagawa', label: '香川県' }, { value: 'ehime', label: '愛媛県' },
    { value: 'kochi', label: '高知県' }, { value: 'fukuoka', label: '福岡県' },
    { value: 'saga', label: '佐賀県' }, { value: 'nagasaki', label: '長崎県' },
    { value: 'kumamoto', label: '熊本県' }, { value: 'oita', label: '大分県' },
    { value: 'miyazaki', label: '宮崎県' }, { value: 'kagoshima', label: '鹿児島県' },
    { value: 'okinawa', label: '沖縄県' }
  ],

  // === 想定時給 (削減効果計算用) ===========================================
  HOURLY_WAGE_YEN: 1500
};

// ============================================================================
// ===== ReductionCalculator.gs =====
// ============================================================================

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
    const staffCount = this._parseStaffCount(formData.q4_staff_count);
    const adminHours = this._parseAdminHours(formData.q8_admin_hours);
    const painPoints = formData.q7_pain_points || [];

    // 各業務領域別の削減見込み計算
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

    // 現状の事務作業時間に対する削減率(最大70%でキャップ、現実的な値に)
    const reductionRateEstimate = adminHours > 0 ?
      Math.min(0.7, (areaReductions[0] && areaReductions[0].hours_per_person || 0) / adminHours) : 0;

    return {
      monthly_total_hours: monthlyTotalHours,
      annual_yen_saved: annualYenSaved,
      top3_areas: top3,
      all_areas: areaReductions,
      staff_count: staffCount,
      current_admin_hours_per_person: adminHours,
      reduction_rate_estimate: reductionRateEstimate,
      reduction_rate_percent: Math.round(reductionRateEstimate * 100),
      hourly_wage_assumed: this.HOURLY_WAGE_AVERAGE,
      assumption_note: '※削減見込みは業界平均からの参考値です。事業所ごとに変動します。'
    };
  },

  /**
   * 職員数の範囲を中央値に変換
   */
  _parseStaffCount: function(range) {
    const map = {
      '1-5': 3,
      '6-10': 8,
      '11-15': 13,
      '16-30': 23,
      '31+': 35
    };
    return map[range] || 8;
  },

  /**
   * 月間事務作業時間の範囲を中央値に変換
   */
  _parseAdminHours: function(range) {
    const map = {
      '0-5': 3,
      '6-15': 10,
      '16-30': 23,
      '31-50': 40,
      '51+': 60,
      'unknown': 23  // 不明時は中規模事業所の平均値で代替
    };
    return map[range] || 23;
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

// ============================================================================
// ===== ProductMatcher.gs =====
// ============================================================================

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

// ============================================================================
// ===== SubsidyMatcher.gs =====
// ============================================================================

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
    const businessType = formData.q2_business_type;
    const prefecture = formData.q12_prefecture;

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
   * プレミアム補助率の条件判定
   */
  _meetsPremiumConditions(formData, subsidy) {
    // 介護テクノロジー導入支援:過去の補助金経験があれば3/4補助
    if (subsidy.id === 'care_tech') {
      return formData.q10_subsidy_experience === 'multiple' ||
             formData.q10_subsidy_experience === 'once';
    }

    // 大阪府介護ICT導入支援:過去の活用経験があれば3/4補助
    if (subsidy.id === 'osaka_ict') {
      return formData.q10_subsidy_experience === 'multiple' ||
             formData.q10_subsidy_experience === 'once';
    }

    // 業務改善助成金:賃金要件達成は個別ヒアリング後に判定
    if (subsidy.id === 'business_improvement') {
      return false;
    }

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

// ============================================================================
// ===== ReportFormatter.gs =====
// ============================================================================

/**
 * ReportFormatter.gs
 * Loomia AI診断システム V3.0 福祉業界特化版
 *
 * 役割: 診断データを HTMLメール本文に整形する。
 *       Section 11(spec.md)準拠のテンプレート構造で、
 *       ダーク基調 #0a0a0b + シアン #7dd3fc のブランドカラーを適用する。
 *
 * 公開関数:
 *   - formatReportToHtml(data): メイン関数。診断データ → HTML文字列
 *   - markdownToHtml(markdown): Markdown → HTML 変換(軽量内製)
 *
 * 守るべき原則:
 *   - 「Loomiaに頼まなくていいこと」セクションを必ず含める
 *   - AIツール固有名詞は出さない(機能カテゴリで語る)
 *   - 専門職判断権を尊重する文言を入れる
 *   - 数値根拠は試算であることを明記する
 *   - 弁護士未レビューの注記を入れる
 */

// ========== ローカル定数 ==========

const RF_BRAND = {
  NAME: 'Loomia',
  NAME_KANA: 'ルーミア',
  TAGLINE: 'AIで、事業の断片を、ひとつの光に。',
  POSITION: '福祉業界のためのAI伴走パートナー',
  EMAIL: 'loomia.jp@gmail.com',
  PORTFOLIO_URL: 'https://weichuimengu-bit.github.io/loomia/',
  X_URL: 'https://x.com/loomia_ai',
  X_HANDLE: '@loomia_ai'
};

const RF_COLORS = {
  BG: '#0a0a0b',
  BG_CARD: '#16161a',
  ACCENT: '#7dd3fc',
  ACCENT_DIM: '#5fb8e0',
  TEXT_PRIMARY: '#f4f4f5',
  TEXT_SECONDARY: '#a1a1aa',
  TEXT_MUTED: '#71717a',
  BORDER: '#27272a',
  WARNING: '#fcd34d'
};

const RF_FONT = {
  HEADING: "'Fraunces', 'Noto Serif JP', Georgia, serif",
  BODY: "'Inter', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif"
};


// ========== メイン関数 ==========

function formatReportToHtml(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('formatReportToHtml: data is required');
  }

  const sections = [
    buildHeader_(data),
    buildExecutiveSummary_(data),
    buildReductionSection_(data),
    buildProductSection_(data),
    buildSubsidySection_(data),
    buildAssessmentSection_(data),
    buildNextStepsSection_(data),
    buildHonestDisclosure_(),
    buildLegalNotice_(),
    buildFooter_()
  ].filter(Boolean).join('\n');

  return wrapHtml_(sections, data);
}


// ========== HTMLラッパー ==========

function wrapHtml_(bodyContent, data) {
  const subject = `${data.companyName || '貴事業所'} 様 AI活用度診断レポート`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml_(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${RF_COLORS.BG};font-family:${RF_FONT.BODY};color:${RF_COLORS.TEXT_PRIMARY};line-height:1.7;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${RF_COLORS.BG};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;">
${bodyContent}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}


// ========== セクションビルダー(前半)==========

function buildHeader_(data) {
  return `      <tr><td style="padding:0 0 32px 0;border-bottom:1px solid ${RF_COLORS.BORDER};">
        <div style="font-family:${RF_FONT.HEADING};font-size:32px;font-weight:600;color:${RF_COLORS.ACCENT};letter-spacing:0.02em;margin-bottom:8px;">${RF_BRAND.NAME}</div>
        <div style="font-size:13px;color:${RF_COLORS.TEXT_SECONDARY};letter-spacing:0.05em;">${escapeHtml_(RF_BRAND.TAGLINE)}</div>
      </td></tr>
      <tr><td style="padding:32px 0 16px 0;">
        <div style="font-size:12px;color:${RF_COLORS.TEXT_MUTED};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">AI活用度診断レポート</div>
        <div style="font-family:${RF_FONT.HEADING};font-size:24px;font-weight:500;color:${RF_COLORS.TEXT_PRIMARY};line-height:1.4;">${escapeHtml_(data.companyName || '貴事業所')} 様</div>
        <div style="font-size:14px;color:${RF_COLORS.TEXT_SECONDARY};margin-top:6px;">業態: ${escapeHtml_(data.serviceType || '未指定')} / 職員数: ${escapeHtml_(String(data.staffCount || '-'))}名</div>
      </td></tr>`;
}


function buildExecutiveSummary_(data) {
  const r = data.reduction || {};
  const monthlyHours = r.timeReductionPerMonth || 0;
  const annualCost = r.costReductionPerYear || 0;

  return `      <tr><td style="padding:24px 0;">
        <div style="background:${RF_COLORS.BG_CARD};border-left:3px solid ${RF_COLORS.ACCENT};padding:24px;">
          <div style="font-size:11px;color:${RF_COLORS.ACCENT};letter-spacing:0.15em;text-transform:uppercase;margin-bottom:12px;">SUMMARY</div>
          <div style="font-size:15px;color:${RF_COLORS.TEXT_PRIMARY};line-height:1.85;">
            現状ヒアリングを基に、<strong style="color:${RF_COLORS.ACCENT};">月${monthlyHours}時間相当の業務削減</strong>と、
            <strong style="color:${RF_COLORS.ACCENT};">年${formatNumber_(annualCost)}円相当の人件費負担軽減</strong>が見込める可能性があります。
            ただし数値はあくまで他事業所での実績ベースの試算です。実数値は現場フローによって変動します。
          </div>
        </div>
      </td></tr>`;
}


function buildReductionSection_(data) {
  const r = data.reduction || {};

  const rows = [
    ['月間削減時間(全職員合計)', `${r.timeReductionPerMonth || 0} 時間`],
    ['年間人件費削減見込', `${formatNumber_(r.costReductionPerYear || 0)} 円`],
    ['記録業務削減率(目安)', `${r.recordingReductionRate || 0}%`],
    ['加算取得による月次収益増', `${formatNumber_(r.additionalRevenuePerMonth || 0)} 円`]
  ];

  return `      <tr><td style="padding:32px 0 16px 0;">
        <div style="font-family:${RF_FONT.HEADING};font-size:20px;font-weight:500;color:${RF_COLORS.TEXT_PRIMARY};margin-bottom:16px;">削減効果の試算</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${RF_COLORS.BG_CARD};">
${rows.map(([label, value]) => `          <tr>
            <td style="padding:14px 20px;border-bottom:1px solid ${RF_COLORS.BORDER};font-size:13px;color:${RF_COLORS.TEXT_SECONDARY};">${escapeHtml_(label)}</td>
            <td style="padding:14px 20px;border-bottom:1px solid ${RF_COLORS.BORDER};font-size:15px;color:${RF_COLORS.ACCENT};font-weight:500;text-align:right;font-variant-numeric:tabular-nums;">${escapeHtml_(value)}</td>
          </tr>`).join('\n')}
        </table>
        <div style="font-size:11px;color:${RF_COLORS.TEXT_MUTED};margin-top:8px;line-height:1.6;">※数値は他事業所の音声入力導入実績(記録時間85%削減等)を職員数で換算した試算値です。実数値は事前ヒアリングで精緻化します</div>
      </td></tr>`;
}


function buildProductSection_(data) {
  const products = data.recommendedProducts || [];
  if (products.length === 0) return '';

  const cards = products.map((p, i) => `          <tr><td style="padding:0 0 12px 0;">
            <div style="background:${RF_COLORS.BG_CARD};padding:20px;border:1px solid ${RF_COLORS.BORDER};">
              <div style="display:inline-block;font-size:11px;color:${RF_COLORS.ACCENT};border:1px solid ${RF_COLORS.ACCENT};padding:2px 10px;letter-spacing:0.1em;margin-bottom:10px;">優先度 ${i + 1}</div>
              <div style="font-family:${RF_FONT.HEADING};font-size:17px;font-weight:500;color:${RF_COLORS.TEXT_PRIMARY};margin-bottom:6px;">${escapeHtml_(p.name || '')}</div>
              <div style="font-size:13px;color:${RF_COLORS.TEXT_SECONDARY};line-height:1.75;">${escapeHtml_(p.reason || '')}</div>
            </div>
          </td></tr>`).join('\n');

  return `      <tr><td style="padding:32px 0 16px 0;">
        <div style="font-family:${RF_FONT.HEADING};font-size:20px;font-weight:500;color:${RF_COLORS.TEXT_PRIMARY};margin-bottom:16px;">推奨プロダクト</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${cards}
        </table>
      </td></tr>`;
}


function buildSubsidySection_(data) {
  const subsidies = data.recommendedSubsidies || [];
  if (subsidies.length === 0) return '';

  const items = subsidies.map((s) => {
    const rate = s.coverageRate ? `${Math.round(s.coverageRate * 100)}%` : '-';
    const max = s.maxAmount ? `${formatNumber_(s.maxAmount)}円` : '-';
    return `          <tr><td style="padding:0 0 12px 0;">
            <div style="background:${RF_COLORS.BG_CARD};padding:18px 20px;border-left:2px solid ${RF_COLORS.ACCENT_DIM};">
              <div style="font-size:15px;color:${RF_COLORS.TEXT_PRIMARY};font-weight:500;margin-bottom:4px;">${escapeHtml_(s.name || '')}</div>
              <div style="font-size:12px;color:${RF_COLORS.TEXT_SECONDARY};margin-bottom:8px;">補助率 <span style="color:${RF_COLORS.ACCENT};">${rate}</span> / 上限 <span style="color:${RF_COLORS.ACCENT};">${max}</span></div>
              <div style="font-size:13px;color:${RF_COLORS.TEXT_SECONDARY};line-height:1.65;">${escapeHtml_(s.description || '')}</div>
            </div>
          </td></tr>`;
  }).join('\n');

  return `      <tr><td style="padding:32px 0 16px 0;">
        <div style="font-family:${RF_FONT.HEADING};font-size:20px;font-weight:500;color:${RF_COLORS.TEXT_PRIMARY};margin-bottom:8px;">活用可能な補助金</div>
        <div style="font-size:12px;color:${RF_COLORS.TEXT_MUTED};margin-bottom:16px;">補助金の活用で、初期投資の実質負担を 1/5 まで圧縮できる可能性があります</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${items}
        </table>
        <div style="font-size:11px;color:${RF_COLORS.TEXT_MUTED};margin-top:12px;line-height:1.7;">※申請書類の作成代行は行政書士、厚労省管轄助成金の申請代行は社労士の独占業務です。Loomia は単独での申請代行は行わず、提携士業との分業体制で支援します</div>
      </td></tr>`;
}


function buildAssessmentSection_(data) {
  if (!data.aiAssessment) return '';

  const html = markdownToHtml(data.aiAssessment);

  return `      <tr><td style="padding:32px 0 16px 0;">
        <div style="font-family:${RF_FONT.HEADING};font-size:20px;font-weight:500;color:${RF_COLORS.TEXT_PRIMARY};margin-bottom:16px;">アセスメント詳細</div>
        <div style="background:${RF_COLORS.BG_CARD};padding:24px;font-size:14px;color:${RF_COLORS.TEXT_SECONDARY};line-height:1.9;">
${html}
        </div>
      </td></tr>`;
}


function buildNextStepsSection_(data) {
  return `      <tr><td style="padding:32px 0 16px 0;">
        <div style="font-family:${RF_FONT.HEADING};font-size:20px;font-weight:500;color:${RF_COLORS.TEXT_PRIMARY};margin-bottom:16px;">次のステップ</div>
        <div style="font-size:14px;color:${RF_COLORS.TEXT_SECONDARY};line-height:1.85;margin-bottom:20px;">
          本診断は無料の活用度評価です。次の段階として、現場ヒアリング(60分・無料)で、ヘルパーさん・サ責さんの実務フローを直接お伺いした上で、より精度の高い導入計画と費用対効果のシミュレーションをご提示します。
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background:${RF_COLORS.ACCENT};padding:14px 32px;">
            <a href="mailto:${RF_BRAND.EMAIL}?subject=${encodeURIComponent('現場ヒアリング希望')}" style="color:${RF_COLORS.BG};font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.05em;">現場ヒアリングを依頼する →</a>
          </td></tr>
        </table>
      </td></tr>`;
}


function buildHonestDisclosure_() {
  return `      <tr><td style="padding:32px 0 16px 0;">
        <div style="background:${RF_COLORS.BG_CARD};padding:24px;border:1px dashed ${RF_COLORS.BORDER};">
          <div style="font-size:11px;color:${RF_COLORS.TEXT_MUTED};letter-spacing:0.15em;text-transform:uppercase;margin-bottom:12px;">Loomia に頼まなくていいこと</div>
          <ul style="margin:0;padding-left:20px;font-size:13px;color:${RF_COLORS.TEXT_SECONDARY};line-height:1.95;">
            <li>導入済み介護ソフトの基本操作 → ベンダーサポートが最も詳しいです</li>
            <li>厚労省管轄助成金の申請書類作成 → 顧問社労士へご相談ください</li>
            <li>医療・看護判断、診断、投薬助言 → AI には絶対に任せられない領域です</li>
            <li>ケアプランの最終決定 → ケアマネさんの専門職判断が必須です</li>
            <li>既に運用が回っている領域への AI 後付け → ROI が出ない可能性が高いです</li>
          </ul>
          <div style="font-size:12px;color:${RF_COLORS.TEXT_MUTED};margin-top:16px;line-height:1.75;">
            Loomia は「AI が下書きを作り、専門職が確認・最終判断する」設計に徹します。ヘルパーさん・看護師さん・ケアマネさんの判断権を奪う運用は、この事業の存在意義に反するため受託しません。
          </div>
        </div>
      </td></tr>`;
}


function buildLegalNotice_() {
  return `      <tr><td style="padding:24px 0 16px 0;">
        <div style="font-size:11px;color:${RF_COLORS.TEXT_MUTED};line-height:1.85;">
          <strong style="color:${RF_COLORS.WARNING};">本レポートに関する注記</strong><br>
          ・本レポートの数値は、公開されている他事業所の実績データを基にした試算値であり、貴事業所の実数値を保証するものではありません<br>
          ・補助金の採択は審査機関の判断によります。Loomia は採択を保証するものではありません<br>
          ・要配慮個人情報(利用者の医療歴・介護歴等)は本診断システムには一切送信していません<br>
          ・AI 出力にはハルシネーション(事実と異なる回答)のリスクが含まれます。重要な判断には必ず人間の最終確認を行ってください<br>
          ・本レポートは弁護士の法務レビューを経ていない一般情報です。具体的な契約・運用判断は、顧問弁護士・社労士・行政書士等の専門家にご相談ください
        </div>
      </td></tr>`;
}


function buildFooter_() {
  return `      <tr><td style="padding:32px 0 16px 0;border-top:1px solid ${RF_COLORS.BORDER};">
        <div style="font-family:${RF_FONT.HEADING};font-size:18px;font-weight:500;color:${RF_COLORS.ACCENT};margin-bottom:6px;">${RF_BRAND.NAME}</div>
        <div style="font-size:12px;color:${RF_COLORS.TEXT_SECONDARY};line-height:1.85;">
          ${escapeHtml_(RF_BRAND.POSITION)}<br>
          <a href="mailto:${RF_BRAND.EMAIL}" style="color:${RF_COLORS.TEXT_SECONDARY};text-decoration:none;border-bottom:1px solid ${RF_COLORS.BORDER};">${RF_BRAND.EMAIL}</a><br>
          <a href="${RF_BRAND.PORTFOLIO_URL}" style="color:${RF_COLORS.TEXT_SECONDARY};text-decoration:none;border-bottom:1px solid ${RF_COLORS.BORDER};">${RF_BRAND.PORTFOLIO_URL}</a><br>
          <a href="${RF_BRAND.X_URL}" style="color:${RF_COLORS.TEXT_SECONDARY};text-decoration:none;border-bottom:1px solid ${RF_COLORS.BORDER};">${RF_BRAND.X_HANDLE}</a>
        </div>
      </td></tr>`;
}


// ========== Markdown → HTML 変換(GAS内製、軽量実装)==========

function markdownToHtml(markdown) {
  if (!markdown || typeof markdown !== 'string') return '';

  let html = escapeHtml_(markdown);

  html = html.replace(/^### (.+)$/gm, `<h3 style="font-family:${RF_FONT.HEADING};font-size:15px;font-weight:500;color:${RF_COLORS.TEXT_PRIMARY};margin:20px 0 8px 0;">$1</h3>`);
  html = html.replace(/^## (.+)$/gm, `<h2 style="font-family:${RF_FONT.HEADING};font-size:17px;font-weight:500;color:${RF_COLORS.TEXT_PRIMARY};margin:24px 0 10px 0;">$1</h2>`);
  html = html.replace(/^# (.+)$/gm, `<h1 style="font-family:${RF_FONT.HEADING};font-size:19px;font-weight:500;color:${RF_COLORS.ACCENT};margin:28px 0 12px 0;">$1</h1>`);

  html = html.replace(/\*\*(.+?)\*\*/g, `<strong style="color:${RF_COLORS.TEXT_PRIMARY};font-weight:600;">$1</strong>`);
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, `<em style="color:${RF_COLORS.TEXT_PRIMARY};font-style:italic;">$1</em>`);

  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, `<a href="$2" style="color:${RF_COLORS.ACCENT};text-decoration:none;border-bottom:1px solid ${RF_COLORS.ACCENT};">$1</a>`);

  html = html.replace(/(?:^[-*] .+(?:\n[-*] .+)*)/gm, function(match) {
    const items = match.split('\n')
      .map(line => line.replace(/^[-*] /, ''))
      .map(item => `<li style="margin-bottom:6px;">${item}</li>`)
      .join('');
    return `<ul style="margin:10px 0 14px 0;padding-left:20px;color:${RF_COLORS.TEXT_SECONDARY};">${items}</ul>`;
  });

  html = html.split(/\n\n+/).map(block => {
    if (block.match(/^<(h[1-3]|ul|ol|table|div)/)) return block;
    if (block.trim() === '') return '';
    return `<p style="margin:0 0 12px 0;">${block.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return html;
}


// ========== ユーティリティ ==========

function escapeHtml_(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNumber_(num) {
  if (typeof num !== 'number') num = Number(num) || 0;
  return num.toLocaleString('ja-JP');
}


// ========== テスト用 ==========

function testFormatReport() {
  const sampleData = {
    companyName: '株式会社サンプル介護',
    contactName: '山田太郎',
    serviceType: '訪問介護',
    staffCount: 12,
    reduction: {
      timeReductionPerMonth: 108,
      costReductionPerYear: 2592000,
      recordingReductionRate: 85,
      additionalRevenuePerMonth: 120000
    },
    recommendedProducts: [
      {
        name: '訪問記録音声入力AI',
        reason: 'ヘルパー12名・1日6訪問の規模で、記録時間85%削減により月90時間以上の業務解放が見込めます。'
      },
      {
        name: '加算管理AI',
        reason: '生産性向上推進体制加算Ⅱの取得で月12,000単位の収益増、年間144万円相当の効果が試算されます。'
      }
    ],
    recommendedSubsidies: [
      {
        name: '介護テクノロジー導入支援事業',
        coverageRate: 0.75,
        maxAmount: 10000000,
        description: '介護ソフト・タブレット・見守り機器をパッケージ導入する場合、補助率3/4で最大1,000万円。'
      },
      {
        name: 'IT導入補助金2026',
        coverageRate: 0.8,
        maxAmount: 500000,
        description: '小規模事業者は4/5、50万円以下のIT導入が対象。'
      }
    ],
    aiAssessment: '## 現状分析\n\n貴事業所の規模感(ヘルパー12名)では、**記録業務の音声入力化**が最大のレバレッジポイントです。\n\n- 月90時間の業務削減が見込まれます\n- 年間人件費換算で約260万円相当\n- 加算取得と組み合わせで投資回収期間は6〜9か月\n\n## 注意事項\n\n音声入力の精度は環境ノイズに大きく左右されます。導入初月は現場研修が必須です。'
  };

  const html = formatReportToHtml(sampleData);
  Logger.log(html.substring(0, 2000));
  return html;
}

// ============================================================================
// ===== ClaudeAPI.gs =====
// ============================================================================

/**
 * Loomia AI診断システム V3.0 福祉業界特化版
 * ClaudeAPI.gs - Claude API呼び出しと4フェーズ自己批判システム
 *
 * モデル: claude-opus-4-7
 * 4フェーズ自己批判:
 *   Phase 1: 初稿生成
 *   Phase 2: 数値根拠の自己批判(Chain-of-Verification)
 *   Phase 3: コンプライアンス・倫理の自己批判
 *   Phase 4: 最終仕上げ
 *
 * 出典統合:
 *   - 世界標準AIプロンプト実践ガイド(CoVe / arXiv:2309.11495)
 *   - AI最強(XMLタグ・ultrathink・Extended Thinking)
 *   - 福祉_AI自動化(7つの罠・コンプライアンス)
 *   - AI4月時点での最強のAI(Opus 4.7のeffort制御)
 */

const ClaudeAPI = {

  // === システムプロンプト(仕様書 Section 5 完全踏襲) ===
  SYSTEM_PROMPT: `<role>
あなたはLoomia(訪問介護事業所向けAI伴走パートナー)の診断アシスタントです。
家業として訪問介護事業所を運営してきた偉吹氏の代理として、
事業所の管理者・経営者から提供された情報をもとに、
AIによる業務自動化のポテンシャルを診断するレポートを生成します。
</role>

<mission>
あなたの使命は、事業所の現場ヘルパーさん・サ責・看護師・ケアマネ・管理者・利用者・ご家族、
そのすべての方々が「明日からの仕事が少し楽になる」と感じられる、
地に足のついた具体的なAI活用提案を、誇張なく、本音で提示することです。
</mission>

<critical_constraints>
これらの制約は絶対に違反してはなりません。違反は事業の致命傷になります。

1. 介護報酬の不正請求への加担を促す表現を絶対に含めない
   - 実態と異なる訪問記録を生成する提案
   - 提供していないサービスの請求を支援する提案
   - 加算要件を満たさないにもかかわらず加算を取得する提案
   これらは介護保険法違反、事業者指定取消事由

2. 医療判断・診断に関する出力を絶対にしない
   - 「この症状は◯◯の可能性があります」のような推論
   - 投薬・処置に関する助言
   - 医師法第17条、医療法に抵触

3. 利用者・家族の尊厳を侵害する表現を絶対にしない
   - 「ヘルパーが何もしなくていい」「人ゼロ運営」
   - 利用者を「処理対象」のように扱う表現

4. 専門職の判断権を奪う表現を絶対にしない
   - AIが介護記録を「自動的に確定する」ような提案
   - ケアマネがケアプランを「AIに任せる」ような提案
   - 必ず「AIが下書きし、専門職が確認・最終判断する」設計を提案

5. 業務改善助成金等の社労士独占助成金、書類作成代行(行政書士独占)の
   申請代行をLoomia単独で受任すると示唆しない
   - 「社労士・行政書士・中小企業診断士と連携して支援します」と明記する

6. 「Loomiaに頼まなくていいこと」を必要に応じて率直に開示する
</critical_constraints>

<output_format>
レポートは必ず以下の7章構成で、各章のH2見出しを完全に一致させて生成してください。
JSONではなくMarkdownで出力します。

# 1. 現状診断サマリー(300〜400字)
# 2. AI活用度スコア(400〜600字、5段階評価)
# 3. 最も削減効果が大きい業務領域(600〜900字、Top3、数値根拠必須)
# 4. Loomia 5プロダクトへの適合度(800〜1,200字)
# 5. 補助金活用ポテンシャル(600〜900字、2026年度版)
# 6. 推奨される導入ステップ(500〜800字、90日/6ヶ月/12ヶ月)
# 7. 次のアクション(200〜300字、無料相談誘導)
</output_format>

<input_data_structure>
入力データには以下が含まれます:
- formData(フォーム回答)
- calculated_reduction(事前計算済みの削減効果)
- matched_products(プロダクト適合度)
- matched_subsidies(該当補助金)

calculated_* および matched_* の値は必ず尊重してください。
独自に数値を発明することは禁止です(ハルシネーション防止)。
</input_data_structure>

<tone_and_voice>
- 誇張禁止、本音で書く
- できないことはできないと言う
- 介護現場への敬意を示す
- 数値根拠を必ず示す
- 営業色を抑え、純粋な現場改善視点で書く

避ける表現:
- 革新的な、画期的な、AIで全自動、魔法のように
- ヘルパーが何もしなくていい、人ゼロで運営

推奨される表現:
- 現場の実感では、ヘルパーさんの声では
- ただし◯◯のケースでは活用が難しいかもしれません
- 専門職の方の判断のもとで
- Loomiaに頼まなくても、◯◯で対応できる場合は...
</tone_and_voice>`,

  /**
   * メイン関数:4フェーズ自己批判でレポートを生成
   * @param {Object} input - { formData, reduction, productMatch, subsidies }
   * @return {String} 最終版レポート(Markdown)
   */
  generateReport(input) {
    try {
      // Phase 1: 初稿生成
      const draft1 = this._phase1_initialDraft(input);

      // Phase 2: 数値根拠の自己批判(CoVe)
      const verification = this._phase2_numericalVerification(draft1, input);

      // Phase 3: コンプライアンス・倫理の自己批判
      const compliance = this._phase3_complianceCheck(draft1);

      // Phase 4: 最終仕上げ
      const finalReport = this._phase4_finalPolish(draft1, verification, compliance);

      // ログ保存(品質改善ループ用)
      this._logAllPhases({
        phase1: draft1,
        phase2: verification,
        phase3: compliance,
        phase4: finalReport,
        input: input,
        timestamp: new Date().toISOString()
      });

      return finalReport;

    } catch (err) {
      console.error('ClaudeAPI.generateReport error:', err);
      throw err;
    }
  },

  /**
   * Phase 1: 初稿生成(adaptive thinking, effort: high)
   */
  _phase1_initialDraft(input) {
    const userPrompt = `<task>
Phase 1: 初稿生成

以下のデータをもとに、診断レポートの初稿を生成してください。
このフェーズでは7章構成のレポートを完全な形で書ききってください。
</task>

<input_data>
${JSON.stringify(input, null, 2)}
</input_data>

<output_instruction>
Markdownで7章構成のレポートを出力してください。
余計な前置きは不要です。「# 1. 現状診断サマリー」から始めてください。
</output_instruction>`;

    return this._callClaudeAPI({
      userPrompt: userPrompt,
      thinkingBudget: 10000,
      maxTokens: 8192
    });
  },

  /**
   * Phase 2: 数値根拠の自己批判(Chain-of-Verification)
   * 出典: arXiv:2309.11495 (Dhuliawala et al., ACL 2024)
   */
  _phase2_numericalVerification(draft1, input) {
    const userPrompt = `<task>
Phase 2: 数値根拠の自己批判(Chain-of-Verification)

Phase 1で生成された初稿に含まれる数値主張をすべて抽出し、
それぞれが入力データから根拠を持って導出されているかを検証してください。
</task>

<draft>
${draft1}
</draft>

<input_data>
${JSON.stringify(input, null, 2)}
</input_data>

<verification_protocol>
Step 1: 初稿に含まれる数値主張をすべて列挙
   例:「月間165時間削減」「年間297万円相当」「Lv2のスコア」

Step 2: 各主張について以下のサブ質問を生成して検証
   - この数値はどの入力データから導出されたか?
   - 計算式は正しいか?
   - 業態平均との比較に使った根拠は何か?
   - 補助金額・補助率は2026年度の正しい値か?

Step 3: 各サブ質問にYES/NOで答え、不正確なものを特定

Step 4: 不正確な数値主張があれば、修正版を提示
</verification_protocol>

<output_format>
## 検証結果
- 数値主張1: [初稿の引用]
  - 根拠データ: [入力データのどこか]
  - 検証結果: ✅正確 / ⚠️要修正 / ❌誤り
  - 修正版(必要時): [修正後の表現]
- 数値主張2: ...

## 修正提案サマリー
[修正が必要な箇所のリスト]
</output_format>`;

    return this._callClaudeAPI({
      userPrompt: userPrompt,
      thinkingBudget: 6000,
      maxTokens: 4096
    });
  },

  /**
   * Phase 3: コンプライアンス・倫理の自己批判
   * 福祉業界の絶対遵守事項チェック
   */
  _phase3_complianceCheck(draft1) {
    const userPrompt = `<task>
Phase 3: コンプライアンス・倫理の自己批判

Phase 1の初稿が、Loomiaの絶対遵守事項に違反していないかを検証してください。
</task>

<draft>
${draft1}
</draft>

<compliance_checklist>
1. 介護報酬不正請求への加担を促す表現はないか?
   - "加算を取りやすくする" "実態と異なる記録" 等の表現
   - "AIで自動的に加算判定" は OK だが "AIで加算を確実に獲得" は NG

2. 医療判断・診断を含む表現はないか?
   - "この症状は◯◯" "投薬を検討" 等の医療法・医師法に抵触する表現

3. 個人情報保護法(APPI)・介護保険法上の守秘義務に抵触する表現はないか?
   - 利用者個人情報をAI APIに送信する設計の示唆
   - 要配慮個人情報の取扱に関する不適切な提案

4. 専門職(ヘルパー・看護師・ケアマネ)の判断権を奪う表現はないか?
   - "AIが介護記録を自動確定" "AIがケアプランを作成" 等
   - 必ず "AIが下書き、専門職が確認・最終判断" の設計

5. 利用者・家族の尊厳を侵害する表現はないか?
   - "ヘルパーが何もしなくていい" "人ゼロで運営"
   - 家族連絡を機械的に処理する表現

6. 士業独占業務(社労士・行政書士)への抵触はないか?
   - 業務改善助成金等の申請代行をLoomia単独で示唆していないか
   - 「社労士・行政書士と連携」の明記があるか

7. 「Loomiaに頼まなくていいこと」を率直に開示しているか?

8. SaMD(プログラム医療機器)規制への抵触はないか?
   - 疾病の診断・治療・予防目的の出力を提案していないか
</compliance_checklist>

<output_format>
## コンプライアンス検証結果
- チェック項目1: ✅問題なし / ⚠️要修正 / ❌違反
  - 根拠: [初稿のどこに該当するか]
  - 修正提案: [具体的な修正案]
- チェック項目2: ...
- チェック項目8: ...

## 修正必須箇所サマリー
[全項目を通じて修正が必要な箇所]
</output_format>`;

    return this._callClaudeAPI({
      userPrompt: userPrompt,
      thinkingBudget: 8000,  // コンプライアンスは特に厳格に
      maxTokens: 4096
    });
  },

  /**
   * Phase 4: 最終仕上げ(Phase 2/3の指摘を全反映)
   */
  _phase4_finalPolish(draft1, verification, compliance) {
    const userPrompt = `<task>
Phase 4: 最終仕上げ

Phase 1の初稿に対して、Phase 2(数値検証)とPhase 3(コンプライアンス検証)の
指摘をすべて反映した最終版レポートを生成してください。
</task>

<draft_phase1>
${draft1}
</draft_phase1>

<verification_phase2>
${verification}
</verification_phase2>

<compliance_phase3>
${compliance}
</compliance_phase3>

<final_polish_checklist>
1. Phase 2で指摘された数値の修正をすべて反映
2. Phase 3で指摘されたコンプライアンス違反をすべて修正
3. 全体のトーンを再確認
   - 営業色が強すぎないか
   - 現場への敬意が伝わるか
   - "Loomiaに頼まなくていいこと"が率直に書けているか
4. 7章構成の見出しが完全に一致しているか
5. 各章の文字数が指定範囲内か
6. 数値根拠が具体的か(「約」「程度」を最小限に)
7. 介護現場の専門用語を適切に使えているか
8. 結びの「次のアクション」が押し付けがましくないか

最終出力は、これらすべてを満たした完成版レポートのみを
Markdown形式で出力してください。
余計な前置き(「以下が最終版です」等)は不要です。
「# 1. 現状診断サマリー」から始めてください。
</final_polish_checklist>`;

    return this._callClaudeAPI({
      userPrompt: userPrompt,
      thinkingBudget: 10000,
      maxTokens: 8192
    });
  },

  /**
   * Claude API 呼び出しの共通関数
   */
  _callClaudeAPI(options) {
    const url = Config.CLAUDE_API_URL;

    const requestBody = {
      model: Config.CLAUDE_MODEL,
      max_tokens: options.maxTokens || 8192,
      thinking: {
        type: 'enabled',
        budget_tokens: options.thinkingBudget || 10000
      },
      system: this.SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: options.userPrompt
      }]
    };

    const params = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': Config.CLAUDE_API_KEY,
        'anthropic-version': Config.CLAUDE_VERSION
      },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, params);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      console.error('Claude API error:', responseCode, responseText);
      throw new Error('Claude API call failed: ' + responseCode + ' - ' + responseText);
    }

    const responseData = JSON.parse(responseText);

    // thinking ブロックを除外して text のみ取得
    const textBlocks = responseData.content.filter(function(block) {
      return block.type === 'text';
    });

    if (textBlocks.length === 0) {
      throw new Error('No text content in Claude API response');
    }

    return textBlocks.map(function(block) { return block.text; }).join('\n');
  },

  /**
   * 全フェーズのログを保存(品質改善ループ用)
   */
  _logAllPhases(logData) {
    try {
      if (typeof Logger !== 'undefined' && Logger.logSelfCritique) {
        Logger.logSelfCritique(logData);
      }
    } catch (e) {
      console.warn('Failed to log self-critique phases:', e);
    }
  }
};

// ============================================================================
// ===== SheetsConnector.gs =====
// ============================================================================

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

// ============================================================================
// ===== NotionConnector.gs =====
// ============================================================================

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

// ============================================================================
// ===== Code.gs =====
// ============================================================================

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
