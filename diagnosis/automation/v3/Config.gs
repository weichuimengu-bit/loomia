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
    const props = PropertiesService.getScriptProperties();
    return props.getProperty('CLAUDE_API_KEY') || props.getProperty('ANTHROPIC_API_KEY');
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
    day_service:             { label: '通所介護 (デイサービス)',          readiness: 'roadmap',       roadmap_quarter: '2027 Q1 〜' },
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
      eligible_types: ['visiting_care', 'visiting_nursing', 'day_service', 'group_home'],
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
      eligible_types: ['visiting_care', 'visiting_nursing', 'day_service', 'group_home'],
      mandatory_from: '2026-06-01',    // 2026/6 から処遇改善加算上位の前提条件
      year: 2026
    },
    {
      id: 'osaka_ict',
      name: '介護ICT導入支援事業 (大阪府)',
      max_amount: 3000000,
      rate_standard: 0.5,
      rate_premium: 0.75,
      eligible_types: ['visiting_care', 'visiting_nursing', 'day_service'],
      eligible_prefectures: ['大阪府'],
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
      best_for_business_types: ['visiting_care', 'visiting_nursing', 'day_service'],
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
      best_for_business_types: ['visiting_care', 'visiting_nursing', 'day_service', 'group_home'],
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
