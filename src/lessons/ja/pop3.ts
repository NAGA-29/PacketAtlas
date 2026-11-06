import type { Lesson } from '../types';

const pop3: Lesson = {
  id: 'pop3',
  part: 5,
  order: 2,
  title: 'POP3',
  tagline: 'メールを受け取って消す',
  lead:
    '**サーバーに届いたメールを手元にダウンロードするための、とても小さなプロトコル。**コマンドは数個で、答えは `+OK` か `-ERR` のどちらかで始まります。読んだら消すのが基本なので、複数の端末で同じメールボックスを見る使い方には向きません。',
  overview: {
    layer: 'アプリケーション層',
    transport: 'TCP(+ TLS)',
    ports: '110、995(TLS)',
    format: 'テキスト(1行のコマンド + +OK / -ERR)',
    key: { label: '主なコマンド', value: 'USER、PASS、STAT、LIST、RETR、DELE、QUIT' },
    specs: ['RFC 1939'],
  },
  lanes: [
    { id: 'mua', name: 'メールソフト', sub: 'bob@example.com' },
    { id: 'server', name: 'POP3 サーバー', sub: 'pop.example.com:995' },
  ],
  steps: [
    {
      id: 'greeting',
      title: 'つなぐとサーバーが挨拶する',
      hops: [
        { from: 'mua', to: 'server', label: 'TLS ハンドシェイク', kind: 'control' },
        { from: 'server', to: 'mua', label: '+OK 挨拶', kind: 'control' },
      ],
      body:
        '今は最初からTLSで包む **995番**を使うのが普通です。暗号化が済むと、サーバーが `+OK` で始まる1行の挨拶を送ってきます。\n\nここから **AUTHORIZATION**(ログイン待ち)の状態が始まります。',
      packet: {
        name: '挨拶(TLS の内側)',
        layers: ['IPv4', 'TCP', 'TLS', 'POP3'],
        view: 'decrypted',
        fields: [{ name: 'サーバー', text: '+OK POP3 server ready␍␊', lineBreak: true }],
      },
    },
    {
      id: 'login',
      title: 'USER と PASS でログイン',
      hops: [
        { from: 'mua', to: 'server', label: 'USER', kind: 'control' },
        { from: 'server', to: 'mua', label: '+OK', kind: 'control' },
        { from: 'mua', to: 'server', label: 'PASS', kind: 'control' },
        { from: 'server', to: 'mua', label: '+OK ログイン', kind: 'control' },
      ],
      body:
        'ユーザー名とパスワードを1行ずつ送ります。パスワードはそのままの文字なので、TLSの外で使うと盗み見られます。\n\nログインするとサーバーはメールボックスをロックし、**TRANSACTION** の状態に移ります。同じ箱を同時に別の端末から開くことはできません。',
      packet: {
        name: 'ログイン(TLS の内側)',
        layers: ['IPv4', 'TCP', 'TLS', 'POP3'],
        view: 'decrypted',
        fields: [
          { name: 'クライアント', text: 'USER bob␍␊', lineBreak: true },
          { name: 'サーバー', text: '+OK␍␊', lineBreak: true },
          { name: 'クライアント', text: 'PASS secret␍␊', lineBreak: true, desc: 'パスワードは例' },
          { name: 'サーバー', text: '+OK maildrop locked and ready␍␊', lineBreak: true },
        ],
      },
    },
    {
      id: 'stat-list',
      title: '何通あるか数える',
      hops: [
        { from: 'mua', to: 'server', label: 'STAT', kind: 'data' },
        { from: 'server', to: 'mua', label: '+OK 2 3410', kind: 'data' },
        { from: 'mua', to: 'server', label: 'LIST', kind: 'data' },
        { from: 'server', to: 'mua', label: '一覧 + .', kind: 'data' },
      ],
      body:
        '`STAT` は通数と合計のバイト数を1行で返します。`LIST` はメールごとの番号と大きさを返し、`.` だけの行で終わります。\n\n番号はこの接続の中だけで使う通し番号です。別の日に同じメールを指したいときは、`UIDL` で一意な識別子をもらいます。',
      packet: {
        name: 'STAT と LIST(TLS の内側)',
        layers: ['IPv4', 'TCP', 'TLS', 'POP3'],
        view: 'decrypted',
        fields: [
          { name: 'クライアント', text: 'STAT␍␊', lineBreak: true },
          { name: 'サーバー', text: '+OK 2 3410␍␊', lineBreak: true, desc: '2通、合計3410バイト' },
          { name: 'クライアント', text: 'LIST␍␊', lineBreak: true },
          { name: 'サーバー', text: '+OK 2 messages␍␊', lineBreak: true },
          { name: '1通目', text: '1 1205␍␊', lineBreak: true },
          { name: '2通目', text: '2 2205␍␊', lineBreak: true, desc: '1205 + 2205 = 3410' },
          { name: '終わり', text: '.␍␊', lineBreak: true },
        ],
      },
    },
    {
      id: 'retr',
      title: 'RETR で1通まるごと受け取る',
      hops: [
        { from: 'mua', to: 'server', label: 'RETR 1', kind: 'data' },
        { from: 'server', to: 'mua', label: 'メール全体 + .', kind: 'data' },
      ],
      body:
        '`RETR 1` で1通目を、ヘッダーから本文まで丸ごと受け取ります。終わりは SMTP と同じく `.` だけの行で、本文中の `.` で始まる行には `.` が足されています。\n\nヘッダーだけ見たいときは `TOP 1 0` も使えますが、POP3 では基本的に全部ダウンロードしてから手元で読みます。',
      packet: {
        name: 'RETR(TLS の内側、抜粋)',
        layers: ['IPv4', 'TCP', 'TLS', 'POP3'],
        view: 'decrypted',
        fields: [
          { name: 'クライアント', text: 'RETR 1␍␊', lineBreak: true },
          { name: 'サーバー', text: '+OK 1205 octets␍␊', lineBreak: true },
          { name: 'メール', text: 'Return-Path: <alice@example.net>␍␊', lineBreak: true, desc: '受信サーバーが封筒の差出人を書き足したもの' },
          { name: 'メール', text: 'From: Alice <alice@example.net>␍␊', lineBreak: true },
          { name: 'メール', text: 'Subject: Lunch?␍␊', lineBreak: true },
          { name: '(中略)', text: '…', lineBreak: true },
          { name: '終わり', text: '.␍␊', lineBreak: true },
        ],
      },
    },
    {
      id: 'dele',
      title: 'DELE で印を付ける',
      hops: [
        { from: 'mua', to: 'server', label: 'DELE 1', kind: 'data' },
        { from: 'server', to: 'mua', label: '+OK 削除予定', kind: 'data' },
      ],
      body:
        '`DELE 1` は、すぐには消さず「削除予定」の印を付けるだけです。同じ接続の中なら `RSET` で取り消せます。\n\n多くのメールソフトには「サーバーにコピーを残す」設定があり、そのときは `DELE` を送りません。',
      packet: {
        name: 'DELE(TLS の内側)',
        layers: ['IPv4', 'TCP', 'TLS', 'POP3'],
        view: 'decrypted',
        fields: [
          { name: 'クライアント', text: 'DELE 1␍␊', lineBreak: true },
          { name: 'サーバー', text: '+OK message 1 deleted␍␊', lineBreak: true, desc: 'まだ印を付けただけ' },
        ],
      },
    },
    {
      id: 'quit',
      title: 'QUIT で本当に消える',
      hops: [
        { from: 'mua', to: 'server', label: 'QUIT', kind: 'control' },
        { from: 'server', to: 'mua', label: '+OK', kind: 'control' },
      ],
      body:
        '`QUIT` を受け取ると、サーバーは **UPDATE** の状態に移り、印の付いたメールを実際に消してからロックを外します。\n\n途中で接続が切れた場合は UPDATE に入らないので、何も消えません。中途半端な状態でメールを失わないための設計です。',
      packet: {
        name: 'QUIT(TLS の内側)',
        layers: ['IPv4', 'TCP', 'TLS', 'POP3'],
        view: 'decrypted',
        fields: [
          { name: 'クライアント', text: 'QUIT␍␊', lineBreak: true },
          { name: 'サーバー', text: '+OK 1 message deleted, 1 left␍␊', lineBreak: true },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 1939 Post Office Protocol - Version 3', url: 'https://www.rfc-editor.org/rfc/rfc1939' },
    { label: 'RFC 8314 Cleartext Considered Obsolete(995番などの推奨)', url: 'https://www.rfc-editor.org/rfc/rfc8314' },
  ],
  lastVerified: '2026-11-06',
};

export default pop3;
