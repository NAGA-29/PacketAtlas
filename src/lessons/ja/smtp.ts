import type { Lesson } from '../types';

const smtp: Lesson = {
  id: 'smtp',
  part: 5,
  order: 1,
  title: 'SMTP',
  tagline: 'メールをサーバーからサーバーへ渡す',
  lead:
    '**メールを送る側から受け取る側のサーバーへ、テキストのコマンドで受け渡すプロトコル。**クライアントがコマンドを1行送り、サーバーが3桁の数字で答える、という往復を繰り返します。1982年からほとんど形を変えずに使われていて、暗号化や認証は後から拡張で足されました。',
  lanes: [
    { id: 'mua', name: 'メールソフト', sub: 'alice@example.net' },
    { id: 'msa', name: '送信サーバー', sub: 'mail.example.net' },
    { id: 'mx', name: '受信サーバー', sub: 'mx.example.com' },
  ],
  steps: [
    {
      id: 'submission',
      title: 'メールソフトから送信サーバーへ(認証つき)',
      hops: [
        { from: 'mua', to: 'msa', label: 'EHLO / AUTH PLAIN', kind: 'control' },
        { from: 'msa', to: 'mua', label: '235 認証成功', kind: 'control' },
        { from: 'mua', to: 'msa', label: 'MAIL / RCPT / DATA', kind: 'data' },
      ],
      body:
        'メールソフトは、自分のプロバイダーの送信サーバーの **587番**(サブミッション)に接続し、TLSで暗号化してからログインします。誰でも送れると迷惑メールの中継に使われるので、送信には認証が要ります。\n\n`AUTH PLAIN` の値はユーザー名とパスワードを Base64 にしただけです。暗号ではないので、TLSの内側でしか使ってはいけません。',
      packet: {
        name: 'SMTP AUTH(TLS の内側)',
        layers: ['IPv4', 'TCP', 'TLS', 'SMTP'],
        view: 'decrypted',
        fields: [
          { name: 'クライアント', text: 'AUTH PLAIN AGFsaWNlQGV4YW1wbGUubmV0AHNlY3JldA==␍␊', lineBreak: true, desc: '「\\0alice@example.net\\0secret」の Base64(パスワードは例)' },
          { name: 'サーバー', text: '235 2.7.0 Authentication successful␍␊', lineBreak: true, desc: '2xx は成功' },
        ],
      },
    },
    {
      id: 'mx-lookup',
      title: '宛先ドメインの受信サーバーを探す',
      hops: [{ from: 'msa', to: 'msa', label: 'MX を引く', kind: 'signal' }],
      body:
        '宛先が `bob@example.com` なので、送信サーバーは DNS で `example.com` の **MX レコード**を引きます。MX にはそのドメインのメールを受け取るサーバーの名前が、優先度付きで並んでいます。\n\n数字が小さいほど優先です。1台目が応答しなければ次を試し、それでもだめなら送信サーバーがしばらく持っておいて再送します。',
      packet: {
        name: 'DNS の答え(MX)',
        note: 'ネットワークのやり取りは DNS の章と同じ形なので、答えの中身だけを示します。',
        fields: [
          { name: 'MX', text: 'example.com.  3600  IN  MX  10 mx.example.com.', lineBreak: true, desc: '優先度10' },
          { name: 'MX', text: 'example.com.  3600  IN  MX  20 mx2.example.com.', lineBreak: true, desc: '予備' },
          { name: 'A', text: 'mx.example.com.  3600  IN  A  203.0.113.25', lineBreak: true },
        ],
      },
    },
    {
      id: 'ehlo',
      title: '挨拶して、できることを聞く',
      hops: [
        { from: 'mx', to: 'msa', label: '220 挨拶', kind: 'control' },
        { from: 'msa', to: 'mx', label: 'EHLO', kind: 'control' },
        { from: 'mx', to: 'msa', label: '250 機能の一覧', kind: 'control' },
      ],
      body:
        'サーバー間の受け渡しは **25番**ポートです。つなぐとサーバーが先に `220` で名乗り、クライアントは `EHLO` で自分の名前を伝えます。\n\n返事は複数行で、使える拡張(STARTTLS、サイズ上限など)が並びます。続きがある行は数字の後が `-`、最後の行は空白です。',
      packet: {
        name: 'EHLO とその応答',
        layers: ['IPv4', 'TCP', 'SMTP'],
        fields: [
          { name: 'サーバー', text: '220 mx.example.com ESMTP ready␍␊', lineBreak: true, desc: '接続直後の挨拶' },
          { name: 'クライアント', text: 'EHLO mail.example.net␍␊', lineBreak: true },
          { name: 'サーバー', text: '250-mx.example.com␍␊', lineBreak: true, desc: '「-」は続きがある印' },
          { name: 'サーバー', text: '250-SIZE 52428800␍␊', lineBreak: true, desc: '50MBまで受け付ける' },
          { name: 'サーバー', text: '250-8BITMIME␍␊', lineBreak: true },
          { name: 'サーバー', text: '250-STARTTLS␍␊', lineBreak: true, desc: '暗号化に切り替えられる' },
          { name: 'サーバー', text: '250 PIPELINING␍␊', lineBreak: true, desc: '空白なので最後の行' },
        ],
      },
    },
    {
      id: 'starttls',
      title: 'STARTTLS で途中から暗号化する',
      hops: [
        { from: 'msa', to: 'mx', label: 'STARTTLS', kind: 'control' },
        { from: 'mx', to: 'msa', label: '220 Ready', kind: 'control' },
        { from: 'msa', to: 'mx', label: 'TLS ハンドシェイク', kind: 'control' },
        { from: 'msa', to: 'mx', label: 'EHLO(もう一度)', kind: 'control' },
      ],
      body:
        '`STARTTLS` を送って了承されたら、同じTCP接続の上でTLSのハンドシェイクを始めます。以降は暗号化され、最初の EHLO からやり直します。\n\nサーバー間では「相手が対応していれば暗号化する」運用が多く、途中で `STARTTLS` の行を消されると平文のまま進んでしまいます。MTA-STS などで暗号化を必須にする仕組みが足されています。',
      packet: {
        name: 'STARTTLS',
        layers: ['IPv4', 'TCP', 'SMTP'],
        fields: [
          { name: 'クライアント', text: 'STARTTLS␍␊', lineBreak: true },
          { name: 'サーバー', text: '220 2.0.0 Ready to start TLS␍␊', lineBreak: true, desc: 'この直後から TLS の ClientHello が流れる' },
        ],
      },
    },
    {
      id: 'envelope',
      title: '封筒:差出人と宛先',
      hops: [
        { from: 'msa', to: 'mx', label: 'MAIL FROM', kind: 'data' },
        { from: 'mx', to: 'msa', label: '250 OK', kind: 'data' },
        { from: 'msa', to: 'mx', label: 'RCPT TO', kind: 'data' },
        { from: 'mx', to: 'msa', label: '250 OK', kind: 'data' },
      ],
      body:
        '`MAIL FROM` と `RCPT TO` は、郵便の**封筒**にあたる情報です。サーバーはこれを見て配達し、届かなかったときは `MAIL FROM` のアドレスにエラーを返します。\n\nメール本文の `From:` や `To:` ヘッダーとは別物で、一致している必要もありません。BCC は、封筒にだけ宛先が書かれた状態です。',
      packet: {
        name: 'エンベロープ(TLS の内側)',
        layers: ['IPv4', 'TCP', 'TLS', 'SMTP'],
        view: 'decrypted',
        fields: [
          { name: 'クライアント', text: 'MAIL FROM:<alice@example.net> SIZE=208␍␊', lineBreak: true, desc: '差出人とおおよその大きさ' },
          { name: 'サーバー', text: '250 2.1.0 OK␍␊', lineBreak: true },
          { name: 'クライアント', text: 'RCPT TO:<bob@example.com>␍␊', lineBreak: true, desc: '宛先が複数なら RCPT TO を繰り返す' },
          { name: 'サーバー', text: '250 2.1.5 OK␍␊', lineBreak: true },
        ],
      },
    },
    {
      id: 'data',
      title: '本文を送り、「.」だけの行で終える',
      hops: [
        { from: 'msa', to: 'mx', label: 'DATA', kind: 'data' },
        { from: 'mx', to: 'msa', label: '354 どうぞ', kind: 'data' },
        { from: 'msa', to: 'mx', label: 'ヘッダー + 本文 + .', kind: 'data' },
      ],
      body:
        '`DATA` の後は、ヘッダーと本文をそのまま流します。ヘッダーと本文の間は空行、終わりは `.` だけの行です。\n\n本文に `.` で始まる行があると終わりと間違えるので、送る側はその行の先頭に `.` をもう1つ足し、受ける側は取り除きます(**ドットスタッフィング**)。',
      packet: {
        name: 'DATA(TLS の内側)',
        layers: ['IPv4', 'TCP', 'TLS', 'SMTP'],
        view: 'decrypted',
        fields: [
          { name: 'クライアント', text: 'DATA␍␊', lineBreak: true },
          { name: 'サーバー', text: '354 End data with <CR><LF>.<CR><LF>␍␊', lineBreak: true, desc: '3xx は「続けて」' },
          { name: 'From', text: 'From: Alice <alice@example.net>␍␊', lineBreak: true, desc: '画面に表示される差出人' },
          { name: 'To', text: 'To: Bob <bob@example.com>␍␊', lineBreak: true },
          { name: 'Subject', text: 'Subject: Lunch?␍␊', lineBreak: true },
          { name: 'Date', text: 'Date: Fri, 06 Nov 2026 12:00:00 +0900␍␊', lineBreak: true },
          { name: 'Message-ID', text: 'Message-ID: <20261106120000.42@mail.example.net>␍␊', lineBreak: true, desc: 'メールごとに一意' },
          { name: '空行', text: '␍␊', lineBreak: true, desc: 'ここから本文' },
          { name: '本文', text: 'Lunch at noon?␍␊', lineBreak: true },
          { name: '本文', text: '..and bring the slides.␍␊', lineBreak: true, desc: '元は「.and …」。先頭に「.」を1つ足した' },
          { name: '終わり', text: '.␍␊', lineBreak: true, desc: '「.」だけの行で本文の終わり' },
        ],
      },
    },
    {
      id: 'quit',
      title: '受け取りの返事をもらって終わる',
      hops: [
        { from: 'mx', to: 'msa', label: '250 受け付けた', kind: 'data' },
        { from: 'msa', to: 'mx', label: 'QUIT', kind: 'control' },
        { from: 'mx', to: 'msa', label: '221 さようなら', kind: 'control' },
      ],
      body:
        '`250` が返った時点で、責任は受信サーバーに移ります。送信サーバーはキューから消して構いません。この後に配達できないと分かったら、受信サーバーがエラーメールを返す決まりです。\n\nBob は後で POP3 や IMAP を使って、受信サーバーからメールを読みます。',
      packet: {
        name: '受け付けと終了',
        layers: ['IPv4', 'TCP', 'TLS', 'SMTP'],
        view: 'decrypted',
        fields: [
          { name: 'サーバー', text: '250 2.0.0 OK queued as 7F3A2C␍␊', lineBreak: true, desc: '受け付け番号(例)' },
          { name: 'クライアント', text: 'QUIT␍␊', lineBreak: true },
          { name: 'サーバー', text: '221 2.0.0 Bye␍␊', lineBreak: true },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 5321 Simple Mail Transfer Protocol', url: 'https://www.rfc-editor.org/rfc/rfc5321' },
    { label: 'RFC 5322 Internet Message Format', url: 'https://www.rfc-editor.org/rfc/rfc5322' },
    { label: 'RFC 6409 Message Submission for Mail', url: 'https://www.rfc-editor.org/rfc/rfc6409' },
    { label: 'RFC 3207 SMTP Service Extension for Secure SMTP over TLS', url: 'https://www.rfc-editor.org/rfc/rfc3207' },
    { label: 'RFC 4954 SMTP Service Extension for Authentication', url: 'https://www.rfc-editor.org/rfc/rfc4954' },
    { label: 'RFC 4616 The PLAIN SASL Mechanism', url: 'https://www.rfc-editor.org/rfc/rfc4616' },
    { label: 'RFC 8461 SMTP MTA Strict Transport Security(MTA-STS)', url: 'https://www.rfc-editor.org/rfc/rfc8461' },
  ],
  lastVerified: '2026-11-06',
};

export default smtp;
