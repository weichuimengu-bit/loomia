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
