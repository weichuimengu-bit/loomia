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
