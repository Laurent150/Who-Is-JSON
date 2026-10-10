<p align="center">
  <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <strong>日本語</strong> · <a href="README.ko.md">한국어</a>
</p>

<h1 align="center">FIMI</h1>

<h3 align="center">クリックするたび、コードがわかる</h3>

<p align="center">AI と一緒にものを作りながら、コードへの理解も深めたい人のためのワークスペース</p>

<p align="center">
  <a href="https://github.com/Laurent150/FIMI/releases/latest"><img src="https://img.shields.io/github/v/release/Laurent150/FIMI?style=flat-square&amp;color=496B4A" alt="最新リリース"></a>
  <a href="https://github.com/Laurent150/FIMI/releases/latest"><img src="https://img.shields.io/badge/desktop-Windows%20x64-496B4A?style=flat-square" alt="Windows x64"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-DCE7A4?style=flat-square" alt="MIT ライセンス"></a>
</p>

<p align="center">
  <a href="#使い始める">使い始める</a> · <a href="#できること">機能</a> · <a href="#ソースから起動する">ソースから起動</a> · <a href="https://github.com/Laurent150/FIMI/issues">フィードバック</a>
</p>

## FIMI の使い方を動画で見る

https://github.com/user-attachments/assets/6b5deab6-18f2-4a1f-a3b5-622c61fa94fb

買い物かごの決済処理を例に、見慣れない記号から「割引を使ったら、なぜ送料無料ではなくなったのか」という疑問までたどります。コードを読み、条件を確認し、変更方法を質問して、回答をソースと一緒に保存します。

## FIMI が目指すこと

AI にコードを書いてもらうことと、その動きを理解することは別の作業です。FIMI はソース、処理の流れ、解説を同じ画面にまとめ、エディターやチャット、メモを行き来せずに読み進められるようにします。

わからない箇所から始めてください。単語や記号をクリックすると、そのコードでの役割を確認できます。フローのステップから対応するソースへ移動し、追加の質問で構文と実際の動きを結び付けられます。vibe coding を実践している人も、初めてプログラミングを学ぶ人も、自分が使うコードへの理解を深められます。

## できること

| 機能 | 使い方 |
| --- | --- |
| **単語・記号・行を読む** | 名前や `=>`、行全体をクリックし、文脈に沿った解説を表示します。解説カードはドラッグで移動でき、読み終えたら閉じられます。 |
| **処理の流れをたどる** | 関数やモジュールを開き、ステップを選ぶと、対応するソースと解説を並べて確認できます。 |
| **まとまった処理を理解する** | フローのモジュールやステップを選択し、関連するコードをひとまとまりとして読みます。 |
| **具体例を見る** | 条件や計算を具体的な入力に当てはめ、変化を追いながら理解できます。 |
| **追加で質問する** | なぜその結果になるのか、変更するとどうなるのかを、現在のコードについて質問できます。 |
| **保存して振り返る** | 役立つ解説を **Saved** に保存して検索できます。保存時のソースを開くと、該当箇所がハイライトされます。 |

同じページで同じ箇所を読み直すと、生成済みの解説が再利用されます。画面と AI 解説は英語・簡体字中国語に対応しています。初期言語は英語で、選んだ言語は記憶されます。

## 使い始める

1. **FIMI をインストール。** [Windows 10/11 x64 版](https://github.com/Laurent150/FIMI/releases/download/v1.2.2/FIMI-1.2.2-Windows-x64-Setup.exe)をダウンロードします。Node.js と Python は同梱されており、開発環境の準備は不要です。
2. **AI の接続方法を選択。** メールでサインインして、提供中の利用枠がある場合は AI トライアルを使えます。または **AI settings** に OpenAI 互換 API のベース URL、モデル名、API キーを入力します。
3. **コードを読み込む。** 貼り付け、ファイルの読み込み、内蔵サンプルのいずれかで始めます。フローを開き、ソースをクリックして、気になる点を質問してください。

現在の Windows インストーラーは未署名です。[リリース](https://github.com/Laurent150/FIMI/releases/latest)にチェックサムを掲載しています。詳細は[インストールガイド](docs/WINDOWS_INSTALL.md)を参照してください。

### コードと言語の対応範囲

Python、JavaScript/TypeScript、Java、Bash はローカルでの構造ナビゲーションに対応しています。JSON、YAML、HTML、CSS、SQL、Dockerfile などは形式に応じた構造で表示します。C/C++、Go、Rust、C#、PHP、Ruby は読み込んで AI に解説を求められますが、完全なローカル関数マップにはまだ対応していません。

コードの画像を読み込み、文字を認識してから確認・閲覧することもできます。ローカル OCR は英語と簡体字中国語に対応し、AI 画像認識には画像対応モデルが必要です。README の翻訳言語と、画面の対応言語は異なります。

### AI・アカウント・ソースコード

- ローカル解析とローカル OCR は AI 接続なしで動作します。AI 解説にはトライアルまたは設定済みのサービスが必要です。トライアルには提供状況と利用枠の制限があります。
- AI 機能は関連するソースと文脈を選択したサービスへ送信します。AI 画像認識では画像も送信します。自分のサービスを使う場合、料金とデータの扱いは提供元の規定に従います。
- ゲストの保存データは現在のブラウザーに残ります。アカウントの保存データは、解説と**関連するソース**をクラウドに同期します。
- FIMI はコードを読むツールであり、実行はしません。依存関係や周辺コードが不足している場合は特に、解説や例をソースと照合してください。

## ソースから起動する

Node.js 20 以降、Python（3.12 推奨）、pnpm 10.15.1 を用意します。

```sh
git clone https://github.com/Laurent150/FIMI.git
cd FIMI
pnpm install --frozen-lockfile --ignore-scripts
pnpm start
```

<http://127.0.0.1:43127> を開きます。Python が PATH にない場合は、起動前に `CODELINGO_PYTHON` で実行ファイルを指定してください。Windows 用の開発スクリプトと検証方法は[貢献ガイド](CONTRIBUTING.md)に記載しています。

## 開発への参加

不具合報告、再現できるコード例、解説を改善する提案を歓迎します。[Issue](https://github.com/Laurent150/FIMI/issues) を作成するか、PR を送る前に[貢献ガイド](CONTRIBUTING.md)をお読みください。共有する内容から認証情報や非公開コードを取り除いてください。

## ライセンス

FIMI は [MIT ライセンス](LICENSE)で公開されています。第三者のコンポーネントとデータセットにはそれぞれのライセンスが適用されます。[出典・帰属表示](OPEN_SOURCE_REFERENCES.md)をご確認ください。
