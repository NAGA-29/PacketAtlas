import type { Lesson } from '../types';

const tls13: Lesson = {
  id: 'tls13',
  part: 3,
  order: 2,
  title: 'TLS 1.3',
  tagline: '1往復で鍵を共有し、相手を確かめる',
  lead:
    '**TCPの上に暗号化された通り道を作るプロトコル。**最初の1往復で鍵の材料を交換し、そこから先は証明書のやり取りも含めて全部暗号化されます。TLS 1.2 より1往復少なく、古い暗号方式は仕様から外されました。',
  overview: {
    layer: 'トランスポート層とアプリケーション層の間',
    transport: 'TCP',
    ports: 'アプリによる(HTTPS は 443)',
    format: 'バイナリ(レコード + ハンドシェイクメッセージ)',
    key: { label: '主なメッセージ', value: 'ClientHello、ServerHello、Certificate、CertificateVerify、Finished' },
    specs: ['RFC 8446'],
  },
  lanes: [
    { id: 'client', name: 'クライアント', sub: 'ブラウザ' },
    { id: 'server', name: 'サーバー', sub: 'example.com:443' },
  ],
  steps: [
    {
      id: 'client-hello',
      title: 'ClientHello:使える方式と鍵の半分を送る',
      hops: [{ from: 'client', to: 'server', label: 'ClientHello', kind: 'control' }],
      body:
        'クライアントは使える暗号方式の一覧と一緒に、**鍵共有**(key_share)の公開鍵をいきなり入れて送ります。サーバーがこれを選んでくれると見越して先に出すので、往復が1回で済みます。\n\n古い機器を通るために、レコードやバージョンの欄は TLS 1.2 以前の値のままです。本当のバージョンは `supported_versions` 拡張で伝えます。',
      packet: {
        name: 'ClientHello',
        layers: ['IPv4', 'TCP', 'TLS'],
        fields: [
          { name: 'レコード:タイプ', hex: '16', desc: '22 = handshake' },
          { name: 'レコード:バージョン', hex: '03 01', desc: '互換のための古い値(TLS 1.0)' },
          { name: 'レコード:長さ', hex: '00 94', desc: '148バイト' },
          { name: 'ハンドシェイク型', hex: '01', desc: 'ClientHello' },
          { name: 'ハンドシェイク長', hex: '00 00 90', desc: '144バイト(3バイトで表す)' },
          { name: 'legacy_version', hex: '03 03', desc: 'TLS 1.2 の値に固定' },
          { name: 'random', hex: 'B9 6A 0C 28 BB 54 FA 8C 46 76 C7 20 21 EB 57 53 CD 61 F7 E6 39 CD C4 8B DC 4C 25 F0 02 B7 95 93', desc: '32バイトの乱数(例)' },
          { name: 'セッションID', hex: '00', desc: '長さ0。TLS 1.3 では使わない' },
          { name: '暗号スイート', hex: '00 06 13 01 13 02 13 03', desc: '長さ6:AES-128-GCM、AES-256-GCM、ChaCha20-Poly1305' },
          { name: '圧縮', hex: '01 00', desc: '「圧縮なし」の1つだけ' },
          { name: '拡張の長さ', hex: '00 61', desc: '97バイト' },
          { name: 'server_name', hex: '00 00 00 10 00 0E 00 00 0B 65 78 61 6D 70 6C 65 2E 63 6F 6D', desc: '「example.com」。1つのIPに複数のサイトがあっても選べる(SNI)' },
          { name: 'supported_groups', hex: '00 0A 00 06 00 04 00 1D 00 17', desc: '鍵共有の曲線:x25519、secp256r1' },
          { name: 'signature_algorithms', hex: '00 0D 00 08 00 06 04 03 08 04 08 07', desc: '受け入れる署名:ECDSA P-256、RSA-PSS、Ed25519' },
          { name: 'supported_versions', hex: '00 2B 00 03 02 03 04', desc: '0x0304 = TLS 1.3' },
          { name: 'key_share', hex: '00 33 00 26 00 24 00 1D 00 20 B0 B8 5E 7E B3 1D 45 1C 13 95 F4 9C 44 36 65 A6 B5 1E 29 CB 94 33 A9 08 31 34 D4 AC 13 D8 A7 3B', desc: 'x25519 の公開鍵 32バイト(例)' },
          { name: 'psk_key_exchange_modes', hex: '00 2D 00 02 01 01', desc: '再開するときも鍵共有をする(psk_dhe_ke)' },
        ],
      },
    },
    {
      id: 'server-hello',
      title: 'ServerHello:方式を選び、鍵の残り半分を返す',
      hops: [{ from: 'server', to: 'client', label: 'ServerHello', kind: 'control' }],
      body:
        'サーバーは暗号スイートを1つ選び、自分の公開鍵を返します。両者の公開鍵がそろったので、どちらも同じ共有秘密を計算できます。盗聴者は公開鍵しか見ていないので、計算できません。\n\nこの ServerHello が、最後の平文のパケットです。',
      packet: {
        name: 'ServerHello',
        layers: ['IPv4', 'TCP', 'TLS'],
        fields: [
          { name: 'レコード:タイプ', hex: '16', desc: 'handshake' },
          { name: 'レコード:バージョン', hex: '03 03' },
          { name: 'レコード:長さ', hex: '00 5A', desc: '90バイト' },
          { name: 'ハンドシェイク型', hex: '02', desc: 'ServerHello' },
          { name: 'ハンドシェイク長', hex: '00 00 56', desc: '86バイト' },
          { name: 'legacy_version', hex: '03 03' },
          { name: 'random', hex: 'B2 D9 6C D6 F0 1D C0 9F 03 BB C2 0D 91 29 A2 AB 8D B0 36 4B F9 86 BD C4 54 22 96 8A BF D5 F1 45', desc: '32バイトの乱数(例)' },
          { name: 'セッションID', hex: '00', desc: 'クライアントが送った値をそのまま返す' },
          { name: '暗号スイート', hex: '13 01', desc: 'TLS_AES_128_GCM_SHA256 を選んだ' },
          { name: '圧縮', hex: '00' },
          { name: '拡張の長さ', hex: '00 2E', desc: '46バイト' },
          { name: 'supported_versions', hex: '00 2B 00 02 03 04', desc: 'TLS 1.3 で話す' },
          { name: 'key_share', hex: '00 33 00 24 00 1D 00 20 C2 7B 93 00 A8 50 E1 EC B7 27 19 95 A5 54 D0 58 56 E0 74 E0 1F 55 6F 54 00 2E 4F 28 E4 E5 E1 4C', desc: 'x25519 の公開鍵(例)' },
        ],
      },
    },
    {
      id: 'key-schedule',
      title: '両側で同じ鍵を作る',
      hops: [
        { from: 'client', to: 'client', label: '鍵を導出', kind: 'control' },
        { from: 'server', to: 'server', label: '鍵を導出', kind: 'control' },
      ],
      body:
        '共有秘密をそのまま鍵にはせず、HKDF で何段階にも混ぜて用途ごとの鍵を作ります(**鍵スケジュール**)。ここまでのメッセージのハッシュも混ぜるので、途中で ClientHello を書き換えられると鍵が合わなくなります。\n\nまずハンドシェイク用の鍵を作り、残りのハンドシェイクを暗号化します。アプリのデータ用の鍵は、ハンドシェイクが終わってから作ります。',
      packet: {
        name: '鍵スケジュール(要約)',
        note: 'ネットワークには流れない、両側の手元の計算です。',
        fields: [
          { name: '共有秘密', text: 'X25519(自分の秘密鍵, 相手の公開鍵)', lineBreak: true, desc: '両側で同じ値になる' },
          { name: 'Early Secret', text: 'HKDF-Extract(0, PSK または 0)', lineBreak: true },
          { name: 'Handshake Secret', text: 'HKDF-Extract(Derive(Early Secret), 共有秘密)', lineBreak: true },
          { name: 'ハンドシェイク鍵', text: 'Derive(Handshake Secret, "c hs traffic" / "s hs traffic", Hash(CH..SH))', lineBreak: true, desc: '向きごとに別の鍵' },
          { name: 'Master Secret', text: 'HKDF-Extract(Derive(Handshake Secret), 0)', lineBreak: true },
          { name: 'アプリ鍵', text: 'Derive(Master Secret, "c ap traffic" / "s ap traffic", Hash(CH..サーバーFinished))', lineBreak: true },
        ],
      },
    },
    {
      id: 'server-flight',
      title: '証明書から先は暗号化されて届く',
      hops: [
        { from: 'server', to: 'client', label: 'EncryptedExtensions', kind: 'control' },
        { from: 'server', to: 'client', label: 'Certificate', kind: 'control' },
        { from: 'server', to: 'client', label: 'CertificateVerify', kind: 'control' },
        { from: 'server', to: 'client', label: 'Finished', kind: 'control' },
      ],
      body:
        'サーバーは続けて、残りの拡張、証明書、**CertificateVerify**(ここまでのやり取りへの署名)、**Finished**(全体のMAC)を送ります。署名は証明書の秘密鍵でしか作れないので、本物のサーバーだと確かめられます。\n\nTLS 1.3 では証明書も暗号化されるので、どのサイトに接続しているかが外から見えにくくなりました。外側のレコードは中身に関係なく「アプリのデータ」を名乗ります。',
      packet: {
        name: '暗号化されたレコード(外側)',
        layers: ['IPv4', 'TCP', 'TLS'],
        note: '本当のコンテンツタイプ(22 = handshake)は、暗号文の中の末尾に入っています。',
        fields: [
          { name: 'タイプ', hex: '17', desc: '23 = application_data を名乗る' },
          { name: 'バージョン', hex: '03 03', desc: '互換のための固定値' },
          { name: '長さ', hex: '04 3E', desc: '(例)証明書の大きさで変わる' },
          { name: '暗号文', hex: '…', desc: 'EncryptedExtensions、Certificate、CertificateVerify、Finished と本当のタイプ' },
          { name: '認証タグ', hex: '…', desc: '16バイト。改ざんされていれば復号に失敗する' },
        ],
      },
    },
    {
      id: 'client-finished',
      title: 'クライアントの Finished で完了',
      hops: [
        { from: 'client', to: 'client', label: '証明書を検証', kind: 'control' },
        { from: 'client', to: 'server', label: 'Finished', kind: 'control' },
      ],
      body:
        'クライアントは証明書チェーンと有効期限、名前が `example.com` に合うかを確かめ、署名とサーバーの Finished を検証します。問題なければ自分の Finished を返し、ハンドシェイクが終わります。\n\nFinished はここまでの全メッセージのハッシュに対するMACです。両者が同じ会話を見ていたことの最終確認になります。',
      packet: {
        name: 'Finished(復号後)',
        layers: ['IPv4', 'TCP', 'TLS'],
        view: 'decrypted',
        fields: [
          { name: 'レコード:タイプ', hex: '17', desc: '外側は application_data' },
          { name: 'レコード:バージョン', hex: '03 03' },
          { name: 'レコード:長さ', hex: '00 35', desc: '4 + 32 + 1 + タグ16 = 53バイト' },
          { name: 'ハンドシェイク型', hex: '14', desc: '20 = Finished' },
          { name: 'ハンドシェイク長', hex: '00 00 20', desc: '32バイト(SHA-256 の長さ)' },
          { name: 'verify_data', hex: '…', desc: 'HMAC(finished_key, Hash(全メッセージ))' },
          { name: '本当のタイプ', hex: '16', desc: '22 = handshake' },
          { name: '認証タグ', hex: '…', desc: '16バイト' },
        ],
      },
    },
    {
      id: 'application-data',
      title: 'アプリのデータを送る',
      hops: [
        { from: 'client', to: 'server', label: 'HTTPリクエスト', kind: 'data' },
        { from: 'server', to: 'client', label: 'HTTPレスポンス', kind: 'data' },
      ],
      body:
        'ここからはアプリ用の鍵で暗号化して送ります。TCP接続の1往復と合わせて、最初のリクエストまで2往復です。\n\n暗号化された中身の末尾には本当のタイプと、任意の長さのゼロ埋めを付けられます。長さから中身を推測されにくくするためです。',
      packet: {
        name: 'application_data レコード',
        layers: ['IPv4', 'TCP', 'TLS', 'HTTP/1.1'],
        fields: [
          { name: 'タイプ', hex: '17', desc: 'application_data' },
          { name: 'バージョン', hex: '03 03' },
          { name: '長さ', hex: '00 36', desc: 'リクエスト37 + タイプ1 + タグ16 = 54バイト' },
          { name: '暗号文', hex: '…', desc: '「GET / HTTP/1.1␍␊Host: example.com␍␊␍␊」と本当のタイプ 23' },
          { name: '認証タグ', hex: '…', desc: '16バイト' },
        ],
      },
    },
    {
      id: 'resumption',
      title: 'チケットで次回を速くする(0-RTT)',
      hops: [
        { from: 'server', to: 'client', label: 'NewSessionTicket', kind: 'control' },
        { from: 'client', to: 'server', label: 'ClientHello + PSK', kind: 'control' },
        { from: 'client', to: 'server', label: '0-RTT データ', kind: 'data' },
      ],
      body:
        'ハンドシェイクの後、サーバーは再開用のチケットを渡します。次回クライアントはチケット(PSK)を ClientHello に付け、`early_data` が許されていれば、返事を待たずにリクエストを送れます(**0-RTT**)。\n\nただし 0-RTT のデータは、盗聴者が録画して送り直す**リプレイ**を防げません。サーバーは、何度実行されても困らないリクエスト(GET など)にだけ使います。',
      packet: {
        name: 'NewSessionTicket(復号後)',
        layers: ['IPv4', 'TCP', 'TLS'],
        view: 'decrypted',
        fields: [
          { name: 'ハンドシェイク型', hex: '04', desc: 'NewSessionTicket' },
          { name: 'ハンドシェイク長', hex: '00 00 D6', desc: '214バイト' },
          { name: 'ticket_lifetime', hex: '00 00 1C 20', desc: '7200秒。最長7日まで' },
          { name: 'ticket_age_add', hex: '5A 3B 91 C4', desc: 'チケットの経過時間を隠すための乱数(例)' },
          { name: 'ticket_nonce', hex: '01 00', desc: '長さ1、値0。チケットごとに変える' },
          { name: 'ticket の長さ', hex: '00 C0', desc: '192バイト' },
          { name: 'ticket', hex: '…', desc: 'サーバーだけが読める再開用の情報(省略)' },
          { name: '拡張の長さ', hex: '00 08' },
          { name: 'early_data', hex: '00 2A 00 04 00 00 40 00', desc: '0-RTT で 16384 バイトまで送ってよい' },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 8446 TLS 1.3', url: 'https://www.rfc-editor.org/rfc/rfc8446' },
    { label: 'RFC 8448 Example Handshake Traces for TLS 1.3', url: 'https://www.rfc-editor.org/rfc/rfc8448' },
    { label: 'RFC 5869 HKDF', url: 'https://www.rfc-editor.org/rfc/rfc5869' },
    { label: 'RFC 7748 Elliptic Curves for Security(X25519)', url: 'https://www.rfc-editor.org/rfc/rfc7748' },
    { label: 'RFC 6066 TLS Extensions(server_name)', url: 'https://www.rfc-editor.org/rfc/rfc6066' },
  ],
  lastVerified: '2026-11-06',
};

export default tls13;
