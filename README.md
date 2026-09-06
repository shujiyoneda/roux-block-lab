# Roux Block Lab：GitHub Pages公開・PWA検証手順

この配布版は、既存のFB最短手順ツールにiOS / Android向けPWA基盤を組み込んだものです。ビルドやnpmのインストールは不要です。

## ファイルの配置

ZIPを解凍した直下に `index.html`、`manifest.json`、`sw.js` があります。`icons/` と、CSS・ソルバー・距離表も同じ階層構成のまま配置してください。PWAの基盤は3ファイルですが、既存ツールの実行資産と実際のPNGアイコンも動作に必要です。

| ファイル | 役割 |
| --- | --- |
| `index.html` | 既存ツール、iOS用メタ情報、インストール案内、Service Worker登録 |
| `manifest.json` | アプリ名、起動URL、対象範囲、standalone、Android用アイコン |
| `sw.js` | オフラインキャッシュ、更新待機、対象パスの限定 |
| `icons/` | iOS 180px、Android 192px / 512px、maskable 512pxのPNG |
| `style.css` | 既存画面、4辺のセーフエリア、モバイル表示 |
| `app.mjs` / `cube.mjs` / `solver.worker.mjs` | 既存ツールの表示・キューブ操作・最短探索 |
| `fb-distance.bin.gz` / `fb-distance.bin` | 完全距離表。非圧縮版は展開API非対応環境のフォールバック |
| `.nojekyll` | GitHub Pagesでそのまま静的配信するための指定 |

## GitHub Pagesへ公開する

1. GitHubで公開先リポジトリを作成するか、既存リポジトリを開きます。一般公開してよいリポジトリを選んでください。
2. ZIPを解凍し、**中のファイルと `icons/` フォルダをリポジトリのルートにアップロード**して `main` にコミットします。ZIPそのものを置くだけでは公開できません。
3. リポジトリの **Settings → Pages → Build and deployment** で、Sourceを **Deploy from a branch**、Branchを **main / (root)** にして保存します。
4. Pages画面に表示されたHTTPSの公開URLを開きます。配信先は通常 `https://ユーザー名.github.io/リポジトリ名/` です。独自ドメインやユーザーサイトのルートでも利用できます。
5. **Enforce HTTPS** が利用できる場合は有効にします。初回はオンラインで起動し、「オフラインで使えます」の表示を待ちます。

`id`、`start_url`、`scope`、アイコン、CSS、JavaScript、Service Workerを相対パスで指定しているため、リポジトリ名の書き換えは不要です。ソースリポジトリ全体を公開する場合は、`dist/` の中身が配信ルートになるように設定してください。このZIPは配信ルートへ直接置く形になっています。

GitHub公式：[公開元ブランチの設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)、[HTTPSで保護する](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)。

## ホーム画面に追加する

### iPhone / iPad（Safari）

1. HTTPSの公開URLをSafariで開きます。
2. 共有メニューを開きます。Safariのレイアウトにより「…」→「共有」の場合もあります。
3. 「ホーム画面に追加」を選びます。項目がない場合は「アクションを編集」から追加します。
4. **「Webアプリとして開く」が表示される場合はオン**にし、「追加」を押します。
5. ホーム画面の **Roux Lab** アイコンから起動します。Safariのアドレスバー・ツールバーがない状態で開きます。

アプリ内の「追加方法」も同じ手順を案内します。Safariは `beforeinstallprompt` を使用しないため、独自ボタンからOSの追加ダイアログを直接開く実装にはしていません。

Apple公式：[iPhoneのSafariでWebサイトをアプリにする](https://support.apple.com/ja-jp/guide/iphone/iphea86e5236/ios)、[ホーム画面Webアプリの仕組み](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)。

### Android（Chrome）

1. HTTPSの公開URLをChromeで開きます。
2. アプリ内に **「アプリを追加」** が表示されたらタップし、Chromeの確認画面でインストールします。
3. 表示されない場合は「追加方法」を開くか、Chromeの「︙」→「アプリをインストール」または「ホーム画面に追加」から進み、「インストール」を確定します。
4. ホーム画面の **Roux Lab** アイコンから起動します。

`beforeinstallprompt` が利用できるかは、ブラウザの判定や既存のインストール状態にも左右されます。イベントが届いた場合だけ保存し、ボタンを押したときに一度だけ `prompt()` を実行します。未発火時・キャンセル時にはメニューでの追加を案内します。`appinstalled` とstandalone起動時には追加案内を非表示にします。

Chrome公式：[独自インストール導線](https://web.dev/articles/customize-install)。

## セーフエリア

`viewport-fit=cover` と `env(safe-area-inset-top/right/bottom/left, 0px)` を組み合わせています。上部バー、本文の左右、ページ最下部に通常の余白と安全領域を加算します。縦向きだけでなく横向きのノッチにも対応し、固定のノッチ寸法は使いません。

本文は `100vh` → `100svh` → `100dvh` の段階的フォールバックで最小高さを確保し、スクロールを許可します。拡大操作は制限しません。iOSのステータスバースタイルは `default` とし、ブラウザUIとOSの時計・通信・電池表示を区別します。standaloneはOSのステータスバーやホームバーまで消す設定ではありません。

WebKit公式：[viewport-fitとsafe-areaの設計](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)、[iOS用メタ情報](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)。

## オフライン・更新

- 初回に画面と距離表をまとめて保存します。非圧縮フォールバックを含むため、初回の保存対象は約6.4 MBです。
- **ホーム画面に追加したアプリ側でも、一度オンラインで起動し、「オフラインで使えます」を確認**してください。Safariのタブと追加したアプリで、保存状態が同じとは限りません。
- 準備完了後は、機内モードでも起動・新しいスクランブル生成・最短探索ができます。OSによるデータ削除や容量不足の後はオンラインでの再準備が必要です。
- ソース変更時は **`sw.js` の `VERSION` を更新**し、関係する全ファイルを同じリリースで公開します。
- 新しい版はバックグラウンドで準備され、「更新して再起動」を押すまで自動的に画面を再読み込みしません。適用すると入力中の内容はリセットされます。
- キャッシュ名は公開パスごとに分離しています。別のGitHub Pagesリポジトリや、同一オリジンの無関係なURLのキャッシュは削除・横取りしません。

## 実機での確認項目

以下は公開後の確認手順です。作成環境ではiOS / Androidの実機による追加・起動の確認は行っていません。

| 確認 | iOS Safari | Android Chrome |
| --- | --- | --- |
| 通常のブラウザ表示 | 「追加方法」が開く | イベント受信後に「アプリを追加」、未受信時は追加方法 |
| ホーム画面からの起動 | アドレスバー・Safariのツールバーなし | アドレスバー・Chromeのツールバーなし |
| 起動状態 | 「アプリとして起動中」と表示 | 同左 |
| 縦向き | 上部と最下部がノッチ・ホームバーに重ならない | システム領域と操作要素が重ならない |
| 横向き | 左右のノッチ領域に文字・ボタンが重ならない | 横向きでも操作できる |
| オフライン | 準備完了後、機内モードで再起動・探索できる | 同左 |
| 更新 | VERSIONを変更して公開後、更新案内から再起動 | 同左 |

`file://` でHTMLを直接開く検証は対象外です。HTTPSの静的サーバー、または開発用のlocalhostで配信してください。自動検証では、ルート・サブディレクトリのURL解決、インストールイベント、キャッシュ対象・分離、オフライン応答を確認しています。
