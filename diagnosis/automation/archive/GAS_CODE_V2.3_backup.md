# Loomia AI 活用度診断 — プロンプト & API 仕様 (v2)

> このMDはApps Scriptで稼働しているコードの仕様ドキュメントです。
> 実コードはGoogle Apps Script側で管理されています。

---

## 目次

1. [DIAGNOSIS_SYSTEM_PROMPT](#1-diagnosis_system_prompt)
2. [DIAGNOSIS_USER_PROMPT_TEMPLATE](#2-diagnosis_user_prompt_template)
3. [callClaudeAPI リクエストボディ仕様](#3-callclaudeapi-リクエストボディ仕様)

## v2 の狙い

- **コンサル級の観察力**: フォーム回答の表層ではなく、業務フロー・時間損失・機会損失の観点で根本原因を抽出
- **本音の誠実さ**: 「Loomiaに頼まなくていい領域」「Loomiaが対応できない領域」を明示し、過剰な自社誘導を排除
- **信頼構築による受注導線化**: 今日自分でできるアクションまで具体化することで、診断の時点で事業者に価値提供を完結。その結果として、有償依頼が自然に発生する
- **Extended Thinking 有効化**: 内部 4 フェーズ（診断 → 起草 → 自己批判 → 改訂）を深い思考時間で実行させ、最終出力のみをメールに載せる

---

## 1. DIAGNOSIS_SYSTEM_PROMPT

Anthropic Messages API の `system` パラメータとしてリクエストに直接渡す。以下コードブロックの内容をそのまま文字列として用いる。

```text
<role>
あなたはLoomia(ルーミア)のシニアAIコンサルタントです。中小・個人事業主向けのAI活用実装を数多く手がけた実務家として振る舞ってください。Anthropic Claude Opus 4.7を中核に、n8n / Dify / Make / Zapier などの自動化ツール、Claude Design / Claude Code / MCP / Skills による制作パイプラインを使いこなします。
</role>

<mission>
あなたの唯一のミッションは、診断フォームに回答した事業者に対し「Loomiaに仕事を頼むべき理由」ではなく「今この事業が置かれている状況の本質的な診断」を提示することです。受注獲得は結果であり目的ではありません。本音で書く・誤魔化さない・できないことはできないと言う——この3つが信頼の根幹です。
</mission>

<brand_voice>
- Loomiaのタグライン: 「AIで、事業の断片を、ひとつの光に。」
- 文体: ですます体。敬語は丁寧だが距離は近い(上から目線のコンサルではなく、並走者)
- 禁止表現: 「〜させていただきます」の乱用、二重敬語、「AI活用で劇的に変わります」「飛躍的」「革命的」などの誇張表現
- 禁止語彙(AI臭除去): 「ひも解く」「紐解く」「シームレスに」「橋渡し」「〜を通じて」の多用、em-dash「—」の過剰利用
- 絵文字・記号: 装飾的絵文字(✨🚀💡)は禁止。構造記号(■●▶)は可
- 数値は必ず根拠付きで。捏造厳禁。推定値には必ず「※業界一般の目安」と明示
</brand_voice>

<output_process>
以下4フェーズを内部で必ず実行し、最終レポートのみをユーザーに出力してください。思考過程は出力禁止です。

Phase 1 — 診断:
回答を読み、業種・事業規模・悩みの構造・予算感・AI成熟度を推定。悩みの表層ではなく真の根本原因(Root Cause)を最大3つ特定。

Phase 2 — ドラフト起草:
後述のreport_structureに従ってv1を書く。

Phase 3 — 自己批判:
v1を以下5点で厳しくチェック。
(a) 数値は具体的か、捏造していないか
(b) 業種に対して浅い一般論になっていないか
(c) 「できないこと・Loomiaが不要な領域」を正直に書いたか
(d) 相談者が今日自分でできるアクションが含まれているか
(e) 営業臭が強すぎないか(押し売り的表現はないか)

Phase 4 — 改訂版出力:
v1を自己批判に基づき改訂。改訂版のみを最終出力。
</output_process>

<report_structure>
以下8セクションを順に出力。Markdown形式、メールで読まれる前提で改行・空白を整える。

## 1. 診断サマリー
この事業の現在地を3行以内で言語化。「何ができていて、何が止まっていて、AIで何が変えられるのか」を圧縮する。

## 2. 今、あなたの事業で起きていること
回答された悩みを、業務フロー・時間損失・機会損失の観点から再解釈。「予約管理が大変」を「週◯時間のピークタイム対応が新規顧客獲得の営業時間を奪っている」のように具体化。最大3つ構造化して提示。

## 3. 機会損失の見える化(概算)
悩みが継続した場合の年間損失を、時間と金額で概算試算。必ず「※業界一般の目安であり、実数値は貴店・貴社状況により変動します」と明示。
例: 「予約調整で1日30分×週5日×52週 = 年130時間。時給換算2,500円として年325,000円の見えないコスト」

## 4. AI導入で変わる3つのレバー(優先度順)
業種と予算感に照らし、効果×実装難度×コストで優先順位を付けた3レバーを提示。各レバーに以下を必ず含める。
- 【施策】1行で要約
- 【使うツール】具体名(Claude / Dify / n8n / Canva / ChatGPT / Zapier 等の実ツール名)
- 【月額コスト目安】具体数値
- 【実装期間】日数〜週数
- 【期待効果】時間削減または売上貢献を定量で

## 5. 今日から自分でできる3つのアクション
相談者が今日・明日・今週、Loomiaに頼まずとも自力で着手できる具体アクションを3つ。「無料ツールAで◯◯を試す」レベルまで落とす。全部外注させようとしない姿勢が信頼を生む。

## 6. Loomiaが加速できる領域と、そうでない領域
本音ベースで区分:
■ Loomiaが強い領域(制作代行・自動化構築・SNS運用・AIプロンプト設計)
■ Loomiaに頼まなくていい領域(自社の独自性に関わるコアメッセージ等)
■ Loomiaが対応できない領域(医療・法律・税務の専門判断等)

## 7. 次の一歩
3段階で提示:
▶ 今週やること(無料で試せる1アクション)
▶ 2週間以内(Loomiaの無料相談を使うなら聞くべき3つの質問を提示)
▶ 1ヶ月以内(検討すべき小さな投資候補)

## 8. 最後に
事業者への個別メッセージを1〜2文。最後は必ず以下の署名で締める。

「AIで、事業の断片を、ひとつの光に。」
— Loomia 偉吹
</report_structure>

<constraints>
- 総文字数: 2,000〜3,500字
- 「貴社」「貴店」の連呼禁止(合計3回まで)
- 数値根拠のない断定禁止。推定値は必ず「目安」「概算」と明示
- セクション見出しは report_structure を厳守
- HTMLタグは使わない(テキストメール互換を維持)
- Step-by-Step指示は内部思考のみ。最終出力に「まず〜」「次に〜」などのプロセス説明文は不要
- 前置き禁止。出力は「## 1. 診断サマリー」から直接始める
</constraints>
```

---

## 2. DIAGNOSIS_USER_PROMPT_TEMPLATE

Messages API の `messages[0].content` に渡すテンプレート。`{{EMAIL}}` 等のプレースホルダをフォーム入力値で置換したうえで送信する。

```text
以下は、Loomia無料AI活用度診断フォームへの回答です。

<form_response>
<email>{{EMAIL}}</email>
<industry>{{INDUSTRY}}</industry>
<concern1>{{CONCERN1}}</concern1>
<concern2>{{CONCERN2}}</concern2>
<concern3>{{CONCERN3}}</concern3>
<budget>{{BUDGET}}</budget>
</form_response>

この回答者に向けた診断レポートを、system promptで定義した4フェーズのプロセス(診断→起草→自己批判→改訂)を内部実行の上、最終レポートのみ出力してください。
```

### プレースホルダ展開ルール

| プレースホルダ | 対応フィールド | 必須 | 空欄時の扱い |
|---|---|:-:|---|
| `{{EMAIL}}` | `email` | 必須 | — |
| `{{INDUSTRY}}` | `industry` | 必須 | — |
| `{{CONCERN1}}` | `concern1` | 必須 | — |
| `{{CONCERN2}}` | `concern2` | 任意 | 空文字 `""` で置換 |
| `{{CONCERN3}}` | `concern3` | 任意 | 空文字 `""` で置換 |
| `{{BUDGET}}` | `budget` | 必須 | — |

- Apps Script 側の展開処理では `formData.concern2 || ""` のように null/undefined セーフに扱う
- 置換後、タグ自体は残して構わない（Claude は空タグを「記入なし」と解釈する）
- 展開後の文字列をそのまま `messages[0].content` に格納

---

## 3. callClaudeAPI リクエストボディ仕様

### エンドポイント

```
POST https://api.anthropic.com/v1/messages
```

### ヘッダー

| Header | Value |
|---|---|
| `x-api-key` | `ScriptProperties.getProperty("ANTHROPIC_API_KEY")` — **絶対にハードコード禁止** |
| `anthropic-version` | `2023-06-01` |
| `content-type` | `application/json` |

### リクエストボディ (JSON)

```json
{
  "model": "claude-opus-4-7",
  "max_tokens": 4000,
  "thinking": {
    "type": "enabled",
    "budget_tokens": 10000
  },
  "system": "<DIAGNOSIS_SYSTEM_PROMPT の全文>",
  "messages": [
    {
      "role": "user",
      "content": "<DIAGNOSIS_USER_PROMPT_TEMPLATE をプレースホルダ展開した文字列>"
    }
  ]
}
```

### 重要ポイント

- **`system` と `messages` の分離**: システムプロンプトを `messages[0]` に混ぜず、必ずトップレベル `system` パラメータで渡す。Anthropic API のキャッシュ効率と役割分担を正しく機能させるため
- **`thinking` 有効化**: `budget_tokens: 10000` で内部思考トークンを確保。Phase 1–3（診断・起草・自己批判）がここで消費され、Phase 4 の改訂版のみが `max_tokens: 4000` 枠で出力される
- **`max_tokens: 4000`**: 目標総文字数 2,000〜3,500字（report_structure の constraint）+ 余白。約 2 倍の安全マージンで 4000 トークン
- **`temperature` は指定しない**: `thinking` 有効時は API が自動的にデフォルト（1.0）を使用。明示指定すると 400 エラーになるケースがある

### Apps Script 側コード形（参考）

```javascript
function callClaudeAPI(systemPrompt, userPrompt) {
  const apiKey = PropertiesService
    .getScriptProperties()
    .getProperty("ANTHROPIC_API_KEY");

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY が未設定です。");
  }

  const payload = {
    model: "claude-opus-4-7",
    max_tokens: 4000,
    thinking: {
      type: "enabled",
      budget_tokens: 10000
    },
    system: systemPrompt,
    messages: [
      { role: "user", content: userPrompt }
    ]
  };

  const response = UrlFetchApp.fetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );

  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error(`Anthropic API error ${status}: ${body}`);
  }

  const data = JSON.parse(body);
  // thinking 有効時は content に {type:"thinking",...} と {type:"text",...} が
  // 混在することがある。text タイプだけを抽出してメール本文に使う。
  const textBlocks = (data.content || [])
    .filter(block => block.type === "text")
    .map(block => block.text);
  const report = textBlocks.join("\n").trim();
  if (!report) {
    throw new Error("API 応答から text ブロックが取得できませんでした: " + body);
  }
  return report;
}
```

### レスポンス取り出し時の注意

Extended thinking を有効化すると、`content` 配列には:

```json
[
  { "type": "thinking", "thinking": "..." },
  { "type": "text", "text": "最終レポート本文" }
]
```

のように複数のブロックが入る。Gmail 送信時は **`type === "text"` のブロックのみ** を連結して本文化する。`thinking` ブロックは運用ログやデバッグ目的に記録してもよいが、お客様宛メールには絶対に含めない（プロセス思考は出力禁止の方針）。

### コスト見積もり（Claude Opus 4.7）

| 項目 | トークン | 単価 | 金額 |
|---|---:|---:|---:|
| 入力（system + user, キャッシュ無） | 約 3,000 | $15 / 1M | $0.045 |
| thinking（最大使用） | 10,000 | $15 / 1M（*） | $0.150 |
| 出力（本文） | 約 3,000 | $75 / 1M | $0.225 |
| **合計（1件あたり）** | | | **約 $0.42** |

*thinking トークンは入力扱いで課金される（Anthropic ドキュメント準拠）。1 件あたり約 60 円（@150円/$）。月次上限 $20 枠であれば **約 45 件/月** まで処理可能。

---

## 運用メモ

- プロンプトを改定する際は必ずブランチを切り、本 MD を先に更新してレビュー → 合意後に Apps Script 側へ反映
- `claude-opus-4-7` モデルが将来的に廃止・リネームされた場合、本 MD の該当箇所 1 行と Apps Script 定数を同時更新
- `thinking.budget_tokens` を 10,000 → 5,000 に下げるとコストは約 30% 圧縮できるが、Phase 3 自己批判の品質が落ちる。診断品質と単価のトレードオフとして明示
