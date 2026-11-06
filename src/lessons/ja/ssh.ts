import type { Lesson } from '../types';

const ssh: Lesson = {
  id: 'ssh',
  part: 5,
  order: 4,
  title: 'SSH',
  tagline: '鍵を交換し、暗号化された端末を開く',
  lead:
    '**離れたコンピューターに安全にログインし、コマンドを打つためのプロトコル。**TLS と同じように鍵を交換してから暗号化しますが、相手の確認には証明書ではなく、前回覚えたホスト鍵を使うのが一般的です。1本の接続の中に、端末やファイル転送などの「チャネル」を何本も開けます。',
  lanes: [
    { id: 'client', name: 'クライアント', sub: 'ssh bob@ssh.example.com' },
    { id: 'server', name: 'サーバー', sub: 'ssh.example.com:22' },
  ],
  steps: [
    {
      id: 'version',
      title: 'バージョンの文字列を交換する',
      hops: [
        { from: 'server', to: 'client', label: 'SSH-2.0-…', kind: 'control' },
        { from: 'client', to: 'server', label: 'SSH-2.0-…', kind: 'control' },
      ],
      body:
        'TCPの22番につなぐと、両側がまず `SSH-2.0-` で始まる1行を送ります。ここだけはテキストで、ソフトの名前と版が入ります。\n\nこの文字列は後で鍵交換のハッシュに混ぜられるので、途中で書き換えられると鍵が合わなくなり、気づけます。',
      packet: {
        name: 'バージョン文字列',
        layers: ['IPv4', 'TCP', 'SSH'],
        fields: [
          { name: 'プロトコル版', hex: '53 53 48 2D 32 2E 30 2D', desc: '「SSH-2.0-」' },
          { name: 'ソフトの名前', hex: '45 78 61 6D 70 6C 65 53 53 48 5F 31 2E 30', desc: '「ExampleSSH_1.0」(例)' },
          { name: '改行', hex: '0D 0A', desc: 'CR LF' },
        ],
      },
    },
    {
      id: 'kexinit',
      title: 'KEXINIT:使える方式を並べる',
      hops: [
        { from: 'client', to: 'server', label: 'KEXINIT', kind: 'control' },
        { from: 'server', to: 'client', label: 'KEXINIT', kind: 'control' },
      ],
      body:
        'ここからは**バイナリパケット**です。長さ、詰め物の長さ、中身、詰め物の順に並び、全体が8バイト(暗号化後はブロック長)の倍数になるよう詰め物で調整します。\n\nKEXINIT では鍵交換、ホスト鍵、暗号、MAC、圧縮の方式を、好きな順にカンマ区切りで並べます。両者の一覧から、クライアント側で先に書かれていて相手も使えるものが選ばれます。',
      packet: {
        name: 'SSH_MSG_KEXINIT',
        layers: ['IPv4', 'TCP', 'SSH'],
        fields: [
          { name: 'パケット長', hex: '00 00 00 9C', desc: '156バイト(この欄を除く)。4 + 156 = 160 は8の倍数' },
          { name: '詰め物の長さ', hex: '0B', desc: '11バイト(4以上)' },
          { name: 'メッセージ番号', hex: '14', desc: '20 = KEXINIT' },
          { name: 'cookie', hex: '5C 0E 91 3A 7F 22 B4 18 E6 4D 03 A9 71 C8 2F 6B', desc: '16バイトの乱数(例)' },
          { name: '鍵交換', hex: '00 00 00 11 63 75 72 76 65 32 35 35 31 39 2D 73 68 61 32 35 36', desc: '長さ17 +「curve25519-sha256」' },
          { name: 'ホスト鍵', hex: '00 00 00 0B 73 73 68 2D 65 64 32 35 35 31 39', desc: '「ssh-ed25519」' },
          { name: '暗号(往・復)', hex: '00 00 00 0A 61 65 73 31 32 38 2D 63 74 72 00 00 00 0A 61 65 73 31 32 38 2D 63 74 72', desc: '「aes128-ctr」を両方向に' },
          { name: 'MAC(往・復)', hex: '00 00 00 0D 68 6D 61 63 2D 73 68 61 32 2D 32 35 36 00 00 00 0D 68 6D 61 63 2D 73 68 61 32 2D 32 35 36', desc: '「hmac-sha2-256」を両方向に' },
          { name: '圧縮(往・復)', hex: '00 00 00 04 6E 6F 6E 65 00 00 00 04 6E 6F 6E 65', desc: '「none」' },
          { name: '言語(往・復)', hex: '00 00 00 00 00 00 00 00', desc: '空の一覧' },
          { name: '推測で先に送るか', hex: '00', desc: 'false' },
          { name: '予約', hex: '00 00 00 00' },
          { name: '詰め物', hex: '…', desc: '11バイトの乱数(例)' },
        ],
      },
    },
    {
      id: 'ecdh',
      title: '公開鍵を交換して、共有秘密を作る',
      hops: [
        { from: 'client', to: 'server', label: 'KEX_ECDH_INIT', kind: 'control' },
        { from: 'server', to: 'client', label: 'KEX_ECDH_REPLY', kind: 'control' },
      ],
      body:
        'クライアントは使い捨ての Curve25519 の公開鍵を送ります。サーバーは自分の使い捨て公開鍵と**ホスト鍵**、それに「ここまでの全部のハッシュ」へのホスト鍵での署名を返します。\n\n両側で同じ共有秘密ができ、そこから暗号の鍵を作ります。使い捨ての鍵なので、後でホスト鍵が漏れても過去の通信は読めません。',
      packet: {
        name: 'SSH_MSG_KEX_ECDH_INIT',
        layers: ['IPv4', 'TCP', 'SSH'],
        fields: [
          { name: 'パケット長', hex: '00 00 00 2C', desc: '44バイト。4 + 44 = 48' },
          { name: '詰め物の長さ', hex: '06' },
          { name: 'メッセージ番号', hex: '1E', desc: '30 = KEX_ECDH_INIT' },
          { name: '公開鍵 Q_C', hex: '00 00 00 20 B0 B8 5E 7E B3 1D 45 1C 13 95 F4 9C 44 36 65 A6 B5 1E 29 CB 94 33 A9 08 31 34 D4 AC 13 D8 A7 3B', desc: '長さ32 + X25519 の公開鍵(例)' },
          { name: '詰め物', hex: '…', desc: '6バイト(例)' },
        ],
      },
    },
    {
      id: 'host-key',
      title: 'ホスト鍵を確かめる',
      hops: [{ from: 'client', to: 'client', label: 'known_hosts を確認', kind: 'control' }],
      body:
        'クライアントは、受け取ったホスト鍵が `~/.ssh/known_hosts` に覚えてあるものと同じかを確かめます。初めての相手なら指紋を表示して「信用しますか」と聞きます(**TOFU**、最初の1回を信用する方式)。\n\n覚えている鍵と違えば、強い警告を出して止まります。サーバーの入れ替えか、なりすましのどちらかだからです。',
      packet: {
        name: '初めて接続したときの表示',
        note: 'ネットワークには流れない、クライアントの画面です。指紋は例です。',
        fields: [
          { name: '表示', text: "The authenticity of host 'ssh.example.com (203.0.113.22)' can't be established.", lineBreak: true },
          { name: '表示', text: 'ED25519 key fingerprint is SHA256:Xq3v…8kM.', lineBreak: true, desc: 'サーバー管理者から聞いた値と比べる' },
          { name: '答え', text: 'yes → known_hosts に記録', lineBreak: true },
        ],
      },
    },
    {
      id: 'newkeys',
      title: 'NEWKEYS で暗号化に切り替える',
      hops: [
        { from: 'client', to: 'server', label: 'NEWKEYS', kind: 'control' },
        { from: 'server', to: 'client', label: 'NEWKEYS', kind: 'control' },
      ],
      body:
        '両側が `NEWKEYS` を送り、ここから先のパケットは新しい鍵で暗号化され、MAC が付きます。中身は1バイト(番号21)だけです。\n\n長い接続では、途中でもう一度 KEXINIT からやり直して鍵を新しくします(再鍵交換)。',
      packet: {
        name: 'SSH_MSG_NEWKEYS',
        layers: ['IPv4', 'TCP', 'SSH'],
        fields: [
          { name: 'パケット長', hex: '00 00 00 0C', desc: '12バイト。4 + 12 = 16' },
          { name: '詰め物の長さ', hex: '0A', desc: '10バイト' },
          { name: 'メッセージ番号', hex: '15', desc: '21 = NEWKEYS' },
          { name: '詰め物', hex: '…', desc: '10バイト(例)' },
        ],
      },
    },
    {
      id: 'userauth',
      title: '公開鍵でユーザーを認証する',
      hops: [
        { from: 'client', to: 'server', label: 'SERVICE_REQUEST', kind: 'control' },
        { from: 'server', to: 'client', label: 'SERVICE_ACCEPT', kind: 'control' },
        { from: 'client', to: 'server', label: 'USERAUTH_REQUEST', kind: 'control' },
        { from: 'server', to: 'client', label: 'USERAUTH_SUCCESS', kind: 'control' },
      ],
      body:
        '暗号化された中で、ユーザー認証を始めます。公開鍵認証では、セッションごとに違う値(セッションID)を含むデータに、ユーザーの秘密鍵で署名して送ります。\n\nサーバーは `authorized_keys` の公開鍵で署名を確かめます。パスワードと違って、秘密鍵そのものはネットワークに流れません。',
      packet: {
        name: 'SSH_MSG_USERAUTH_REQUEST(復号後の中身、前半)',
        layers: ['IPv4', 'TCP', 'SSH'],
        view: 'decrypted',
        fields: [
          { name: 'メッセージ番号', hex: '32', desc: '50 = USERAUTH_REQUEST' },
          { name: 'ユーザー名', hex: '00 00 00 03 62 6F 62', desc: '「bob」' },
          { name: 'サービス', hex: '00 00 00 0E 73 73 68 2D 63 6F 6E 6E 65 63 74 69 6F 6E', desc: '「ssh-connection」:認証の後で使うもの' },
          { name: '方式', hex: '00 00 00 09 70 75 62 6C 69 63 6B 65 79', desc: '「publickey」' },
          { name: '署名あり', hex: '01', desc: 'true' },
          { name: '鍵の種類', hex: '00 00 00 0B 73 73 68 2D 65 64 32 35 35 31 39', desc: '「ssh-ed25519」' },
          { name: '公開鍵と署名', hex: '…', desc: '(省略)' },
        ],
      },
    },
    {
      id: 'channel',
      title: 'チャネルを開いて端末を使う',
      hops: [
        { from: 'client', to: 'server', label: 'CHANNEL_OPEN session', kind: 'data' },
        { from: 'server', to: 'client', label: 'OPEN_CONFIRMATION', kind: 'data' },
        { from: 'client', to: 'server', label: 'pty-req / shell', kind: 'data' },
        { from: 'server', to: 'client', label: 'CHANNEL_DATA', kind: 'data' },
      ],
      body:
        '1本のSSH接続の中に、番号付きの**チャネル**を開きます。端末用の `session` を開き、疑似端末(pty)とシェルを頼むと、打った文字とその結果が CHANNEL_DATA で行き来します。\n\nポート転送や `scp`・`sftp` も、同じ接続に別のチャネルを開いて行います。チャネルごとに受信枠があり、1本が他を詰まらせないようにしています。',
      packet: {
        name: 'SSH_MSG_CHANNEL_OPEN(復号後の中身)',
        layers: ['IPv4', 'TCP', 'SSH'],
        view: 'decrypted',
        fields: [
          { name: 'メッセージ番号', hex: '5A', desc: '90 = CHANNEL_OPEN' },
          { name: 'チャネルの種類', hex: '00 00 00 07 73 65 73 73 69 6F 6E', desc: '「session」' },
          { name: '送信側のチャネル番号', hex: '00 00 00 00', desc: 'クライアントが付けた番号 0' },
          { name: '受信枠', hex: '00 20 00 00', desc: '2097152バイト' },
          { name: '最大パケット', hex: '00 00 80 00', desc: '32768バイト' },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 4251 SSH Protocol Architecture', url: 'https://www.rfc-editor.org/rfc/rfc4251' },
    { label: 'RFC 4252 SSH Authentication Protocol', url: 'https://www.rfc-editor.org/rfc/rfc4252' },
    { label: 'RFC 4253 SSH Transport Layer Protocol', url: 'https://www.rfc-editor.org/rfc/rfc4253' },
    { label: 'RFC 4254 SSH Connection Protocol', url: 'https://www.rfc-editor.org/rfc/rfc4254' },
    { label: 'RFC 8731 Curve25519 / Curve448 による SSH の鍵交換', url: 'https://www.rfc-editor.org/rfc/rfc8731' },
    { label: 'RFC 8709 SSH の Ed25519 / Ed448 公開鍵', url: 'https://www.rfc-editor.org/rfc/rfc8709' },
  ],
  lastVerified: '2026-11-06',
};

export default ssh;
