import type { Lesson } from '../types';

const imap: Lesson = {
  id: 'imap',
  part: 5,
  order: 3,
  title: 'IMAP',
  tagline: 'サーバー上のメールを操作する',
  lead:
    '**メールをサーバーに置いたまま、フォルダーや既読の印を操作するプロトコル。**スマホとPCで同じ受信箱を見ても状態がそろうのは、正本がサーバーにあるからです。コマンドには「タグ」を付け、答えのどれがどのコマンドへのものかを区別します。',
  lanes: [
    { id: 'mua', name: 'メールソフト', sub: 'bob@example.com' },
    { id: 'server', name: 'IMAP サーバー', sub: 'imap.example.com:993' },
  ],
  steps: [
    {
      id: 'greeting',
      title: '挨拶と、できることの一覧',
      hops: [
        { from: 'mua', to: 'server', label: 'TLS ハンドシェイク', kind: 'control' },
        { from: 'server', to: 'mua', label: '* OK 挨拶', kind: 'control' },
      ],
      body:
        'TLSで包む **993番**につなぐと、サーバーは `*` で始まる行で挨拶します。`*` は**タグなし応答**で、特定のコマンドへの答えではなく、サーバーから知らせたいことを表します。\n\n角かっこの中には、このサーバーが対応する機能(CAPABILITY)が並んでいます。',
      packet: {
        name: '挨拶(TLS の内側)',
        layers: ['IPv4', 'TCP', 'TLS', 'IMAP'],
        view: 'decrypted',
        fields: [{ name: 'サーバー', text: '* OK [CAPABILITY IMAP4rev2 AUTH=PLAIN IDLE] ready␍␊', lineBreak: true }],
      },
    },
    {
      id: 'login',
      title: 'タグを付けてログイン',
      hops: [
        { from: 'mua', to: 'server', label: 'a001 LOGIN', kind: 'control' },
        { from: 'server', to: 'mua', label: 'a001 OK', kind: 'control' },
      ],
      body:
        'クライアントは各コマンドの先頭に `a001` のような**タグ**を付けます。サーバーは処理が終わると、同じタグで `OK` / `NO` / `BAD` を返します。\n\nタグがあるので、答えを待たずに次のコマンドを送っても、どの結果がどれへの答えかが分かります。',
      packet: {
        name: 'LOGIN(TLS の内側)',
        layers: ['IPv4', 'TCP', 'TLS', 'IMAP'],
        view: 'decrypted',
        fields: [
          { name: 'クライアント', text: 'a001 LOGIN bob secret␍␊', lineBreak: true, desc: 'パスワードは例' },
          { name: 'サーバー', text: 'a001 OK LOGIN completed␍␊', lineBreak: true, desc: '同じタグで完了を知らせる' },
        ],
      },
    },
    {
      id: 'select',
      title: 'フォルダーを開く',
      hops: [
        { from: 'mua', to: 'server', label: 'a002 SELECT INBOX', kind: 'data' },
        { from: 'server', to: 'mua', label: '* 3 EXISTS …', kind: 'data' },
        { from: 'server', to: 'mua', label: 'a002 OK', kind: 'data' },
      ],
      body:
        '`SELECT INBOX` で受信箱を開くと、サーバーはまずタグなし応答で状態を知らせ、最後にタグ付きの `OK` を返します。\n\n**UIDVALIDITY** と **UID** の組は、メールを長く一意に指すための番号です。手元にキャッシュしたメールが、次に接続したときも同じものかを確かめるのに使います。',
      packet: {
        name: 'SELECT(TLS の内側)',
        layers: ['IPv4', 'TCP', 'TLS', 'IMAP'],
        view: 'decrypted',
        fields: [
          { name: 'クライアント', text: 'a002 SELECT INBOX␍␊', lineBreak: true },
          { name: 'サーバー', text: '* 3 EXISTS␍␊', lineBreak: true, desc: '3通ある' },
          { name: 'サーバー', text: '* FLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)␍␊', lineBreak: true, desc: '付けられる印の一覧' },
          { name: 'サーバー', text: '* OK [UIDVALIDITY 1762387200] UIDs valid␍␊', lineBreak: true },
          { name: 'サーバー', text: '* OK [UIDNEXT 43] Predicted next UID␍␊', lineBreak: true, desc: '次に届くメールの UID' },
          { name: 'サーバー', text: 'a002 OK [READ-WRITE] SELECT completed␍␊', lineBreak: true },
        ],
      },
    },
    {
      id: 'fetch',
      title: '必要な部分だけ取り寄せる',
      hops: [
        { from: 'mua', to: 'server', label: 'a003 FETCH', kind: 'data' },
        { from: 'server', to: 'mua', label: '* 3 FETCH {52}', kind: 'data' },
        { from: 'server', to: 'mua', label: 'a003 OK', kind: 'data' },
      ],
      body:
        '一覧を出すだけなら、差出人と件名だけで十分です。IMAP はメールの一部だけを取り寄せられます。`BODY.PEEK` は、読んだことにせず(既読の印を付けずに)のぞく指定です。\n\n`{52}` は**リテラル**で、「この後の52バイトはそのまま中身」という意味です。改行を含むデータも、長さを先に言えば安全に送れます。',
      packet: {
        name: 'FETCH(TLS の内側)',
        layers: ['IPv4', 'TCP', 'TLS', 'IMAP'],
        view: 'decrypted',
        fields: [
          { name: 'クライアント', text: 'a003 FETCH 3 (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT)])␍␊', lineBreak: true },
          { name: 'サーバー', text: '* 3 FETCH (BODY[HEADER.FIELDS (FROM SUBJECT)] {52}␍␊', lineBreak: true, desc: 'この後に52バイト' },
          { name: 'リテラル', text: 'From: Alice <alice@example.net>␍␊', lineBreak: true },
          { name: 'リテラル', text: 'Subject: Lunch?␍␊', lineBreak: true },
          { name: 'リテラル', text: '␍␊', lineBreak: true, desc: 'ここまでで52バイト' },
          { name: 'サーバー', text: ')␍␊', lineBreak: true },
          { name: 'サーバー', text: 'a003 OK FETCH completed␍␊', lineBreak: true },
        ],
      },
    },
    {
      id: 'store',
      title: '既読の印をサーバーに付ける',
      hops: [
        { from: 'mua', to: 'server', label: 'a004 STORE +FLAGS', kind: 'data' },
        { from: 'server', to: 'mua', label: '* 3 FETCH (FLAGS)', kind: 'data' },
        { from: 'server', to: 'mua', label: 'a004 OK', kind: 'data' },
      ],
      body:
        'Bob がメールを開いたので、`\\Seen` の印を足します。印はサーバーに記録されるので、スマホで開いたメールはPCでも既読になります。\n\nサーバーは変わった後の印を `FETCH` 応答で知らせます。同じ受信箱を開いている他の端末にも、同じ知らせが届きます。',
      packet: {
        name: 'STORE(TLS の内側)',
        layers: ['IPv4', 'TCP', 'TLS', 'IMAP'],
        view: 'decrypted',
        fields: [
          { name: 'クライアント', text: 'a004 STORE 3 +FLAGS (\\Seen)␍␊', lineBreak: true, desc: '「+」は今の印に足す' },
          { name: 'サーバー', text: '* 3 FETCH (FLAGS (\\Seen))␍␊', lineBreak: true },
          { name: 'サーバー', text: 'a004 OK STORE completed␍␊', lineBreak: true },
        ],
      },
    },
    {
      id: 'idle',
      title: 'IDLE で新着を待つ',
      hops: [
        { from: 'mua', to: 'server', label: 'a005 IDLE', kind: 'control' },
        { from: 'server', to: 'mua', label: '+ idling', kind: 'control' },
        { from: 'server', to: 'mua', label: '* 4 EXISTS', kind: 'data' },
        { from: 'mua', to: 'server', label: 'DONE', kind: 'control' },
        { from: 'server', to: 'mua', label: 'a005 OK', kind: 'control' },
      ],
      body:
        '新着を知るために何度も聞きに行く代わりに、`IDLE` で接続を開いたまま待ちます。メールが届くと、サーバーからすぐ `* 4 EXISTS` が飛んできます。\n\n`+` は「続けて」の合図です。`DONE` を送ると待ち受けが終わり、普通のコマンドに戻ります。NATに切られないよう、30分以内に一度張り直すのが目安です。',
      packet: {
        name: 'IDLE(TLS の内側)',
        layers: ['IPv4', 'TCP', 'TLS', 'IMAP'],
        view: 'decrypted',
        fields: [
          { name: 'クライアント', text: 'a005 IDLE␍␊', lineBreak: true },
          { name: 'サーバー', text: '+ idling␍␊', lineBreak: true },
          { name: 'サーバー', text: '* 4 EXISTS␍␊', lineBreak: true, desc: '新しいメールが届いた' },
          { name: 'クライアント', text: 'DONE␍␊', lineBreak: true },
          { name: 'サーバー', text: 'a005 OK IDLE terminated␍␊', lineBreak: true },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 9051 IMAP Version 4rev2', url: 'https://www.rfc-editor.org/rfc/rfc9051' },
    { label: 'RFC 2177 IMAP4 IDLE command', url: 'https://www.rfc-editor.org/rfc/rfc2177' },
    { label: 'RFC 8314 Cleartext Considered Obsolete', url: 'https://www.rfc-editor.org/rfc/rfc8314' },
  ],
  lastVerified: '2026-11-06',
};

export default imap;
