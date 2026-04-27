# Loomia CLAUDE.md
# 福祉×AI Vertical SaaS / 訪問介護特化プロダクト開発

## リポジトリ構造
- index.html: メインサイト(GitHub Pages: weichuimengu-bit.github.io/loomia/)
- legal/: 法務ページ4種(privacy/terms/scope/tokutei)
- tools/voice-recorder/: 訪問記録音声入力AI MVP v0.1
- tools/kazan-shindan/: 加算取得診断AI
- diagnosis/automation/v3/: 無料診断システム(GAS連携)
- assets/: 画像・SVG

## Git運用
- mainブランチが本番(GitHub Pages自動デプロイ)
- featureブランチで作業 → mainにマージ
- コミットメッセージ: feat:/fix:/docs: のprefixを使う
- IMPORTANT: pushは必ずorigin mainまたはfeatureブランチへ

## デザインシステム(厳守)
- 背景: #0a0a0b / アクセント: #7dd3fc
- フォント: Fraunces(見出し) / Inter / Noto Sans JP
- 単一HTMLファイル原則(CSS/JSを分離しない)
- スマホファースト

## コンプライアンス絶対線(YOU MUST 遵守)
- 医療判断・診断・投薬指示の出力を実装しない
- 「自動配信」「自動判定」「申請代行」の表現を使わない
- 専門職判断権: AIは下書き、専門職が確認・最終判断する設計のみ
- 要配慮個人情報をサーバーに送信する設計を実装しない
- ケアマネ・社労士・行政書士の独占業務をAI単独で代替しない
- SaMD(医療機器プログラム)該当機能を実装しない

## ブランドボイス(YOU MUST 遵守)
- 誇張禁止: 「革新的」「画期的」「魔法のように」を使わない
- 営業色を排除し、現場改善視点で書く
- 利用者・専門職への敬意を文章で示す
- ハルシネーションリスクを正直に開示する

## 禁止事項
- 本名「偉吹」をコード・コメント・JSON-LDに含めない
- AIツール固有名詞(Claude/ChatGPT等)を顧客向け文書に出さない
- founder.nameに個人名を入れない(OrganizationのLoomiaのみ)

## 自己改善ループ
- 間違いが起きたらtasks/lessons.mdに再発防止ルールを追記
- CLAUDE.mdは80行以内を維持(肥大したら剪定する)
