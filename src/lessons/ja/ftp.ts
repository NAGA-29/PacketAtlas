import type { Lesson } from '../types';

const ftp: Lesson = {
  id: 'ftp',
  part: 5,
  order: 5,
  title: 'FTP',
  tagline: '制御とデータの2本の接続',
  lead:
    '**ファイルを送り受けするための、インターネットでもっとも古いプロトコルの1つ。**コマンドを送る「制御接続」と、ファイルの中身を流す「データ接続」を別々に張るのが特徴です。もともと暗号化がなく、パスワードもそのまま流れるので、今は SFTP や HTTPS に置き換わりつつあります。',
  lanes: [
    { id: 'client', name: 'クライアント', sub: '192.0.2.10' },
    { id: 'server', name: 'FTP サーバー', sub: '203.0.113.21' },
  ],
  steps: [
    {
      id: 'control',
      title: '21番で制御接続を張る',
      hops: [
        { from: 'client', to: 'server', label: 'TCP → :21', kind: 'control' },
        { from: 'server', to: 'client', label: '220 挨拶', kind: 'control' },
      ],
      body:
        'クライアントはサーバーの **21番**にTCPでつなぎます。これが**制御接続**で、コマンドと3桁の返事だけが流れます。返事の数字の読み方は SMTP とほぼ同じです(2xx 成功、3xx 続けて、4xx・5xx 失敗)。\n\nファイルの中身はこの接続には流れません。',
      packet: {
        name: '挨拶',
        layers: ['IPv4', 'TCP', 'FTP'],
        fields: [{ name: 'サーバー', text: '220 FTP server ready␍␊', lineBreak: true }],
      },
    },
    {
      id: 'login',
      title: 'ログイン(パスワードが丸見え)',
      hops: [
        { from: 'client', to: 'server', label: 'USER bob', kind: 'control' },
        { from: 'server', to: 'client', label: '331', kind: 'control' },
        { from: 'client', to: 'server', label: 'PASS secret', kind: 'control' },
        { from: 'server', to: 'client', label: '230 ログイン', kind: 'control' },
      ],
      body:
        'ユーザー名とパスワードを1行ずつ送ります。暗号化されていないので、経路の途中にいる誰でもこの行を読めます。\n\nこれが FTP をそのまま使ってはいけない一番の理由です。同じパスワードを他のサービスで使っていると、被害が広がります。',
      packet: {
        name: 'ログイン(平文)',
        layers: ['IPv4', 'TCP', 'FTP'],
        fields: [
          { name: 'クライアント', text: 'USER bob␍␊', lineBreak: true },
          { name: 'サーバー', text: '331 Password required␍␊', lineBreak: true, desc: '3xx:続けてパスワードを' },
          { name: 'クライアント', text: 'PASS secret␍␊', lineBreak: true, desc: '経路上で読める(パスワードは例)' },
          { name: 'サーバー', text: '230 User logged in␍␊', lineBreak: true },
        ],
      },
    },
    {
      id: 'pasv',
      title: 'PASV:データ用のポートを教えてもらう',
      hops: [
        { from: 'client', to: 'server', label: 'PASV', kind: 'control' },
        { from: 'server', to: 'client', label: '227 (…,195,149)', kind: 'control' },
      ],
      body:
        'ファイルを受け取る前に、データ接続の行き先を決めます。**パッシブモード**では、サーバーが待ち受けるポートを教えてくれます。\n\n6つの数字のうち前の4つがIPアドレス、後ろの2つがポート番号の上位と下位のバイトです。195 × 256 + 149 = 50069。',
      packet: {
        name: 'PASV',
        layers: ['IPv4', 'TCP', 'FTP'],
        fields: [
          { name: 'クライアント', text: 'PASV␍␊', lineBreak: true },
          { name: 'サーバー', text: '227 Entering Passive Mode (203,0,113,21,195,149)␍␊', lineBreak: true, desc: '203.0.113.21 の 50069番で待つ' },
        ],
      },
    },
    {
      id: 'retr',
      title: 'もう1本の接続でファイルを受け取る',
      hops: [
        { from: 'client', to: 'server', label: 'TCP → :50069', kind: 'data' },
        { from: 'client', to: 'server', label: 'RETR report.txt', kind: 'control' },
        { from: 'server', to: 'client', label: '150 送ります', kind: 'control' },
        { from: 'server', to: 'client', label: 'ファイルの中身', kind: 'data' },
        { from: 'server', to: 'client', label: '226 完了', kind: 'control' },
      ],
      body:
        'クライアントは50069番に**データ接続**を張り、制御接続で `RETR` を送ります。ファイルの中身はデータ接続に流れ、送り終わるとサーバーがデータ接続を閉じます。\n\nファイルの終わりは「接続が閉じたこと」で表されます。だからファイルごとにデータ接続を張り直します。',
      packet: {
        name: 'RETR(制御接続側)',
        layers: ['IPv4', 'TCP', 'FTP'],
        fields: [
          { name: 'クライアント', text: 'TYPE I␍␊', lineBreak: true, desc: 'バイナリのまま送ってもらう' },
          { name: 'サーバー', text: '200 Type set to I␍␊', lineBreak: true },
          { name: 'クライアント', text: 'RETR report.txt␍␊', lineBreak: true },
          { name: 'サーバー', text: '150 Opening BINARY mode data connection␍␊', lineBreak: true, desc: 'ここでデータ接続に中身が流れる' },
          { name: 'サーバー', text: '226 Transfer complete␍␊', lineBreak: true },
        ],
      },
    },
    {
      id: 'active',
      title: 'アクティブモードと NAT の相性',
      hops: [
        { from: 'client', to: 'server', label: 'PORT …,195,80', kind: 'control' },
        { from: 'server', to: 'client', label: 'TCP → :50000', kind: 'data', lost: true },
      ],
      body:
        '元々の**アクティブモード**では逆に、クライアントが「ここで待っている」と `PORT` で伝え、サーバーからつなぎに来ます。195 × 256 + 80 = 50000番です。\n\nところがクライアントがNATやファイアウォールの内側にいると、外からの接続は届きません。さらにIPアドレスがコマンドの中に書かれているので、NATは中身を書き換える特別な処理が必要になります。今パッシブモードが主流なのはこのためです。',
      packet: {
        name: 'PORT',
        layers: ['IPv4', 'TCP', 'FTP'],
        fields: [
          { name: 'クライアント', text: 'PORT 192,0,2,10,195,80␍␊', lineBreak: true, desc: '192.0.2.10 の 50000番で待つ' },
          { name: 'サーバー', text: '200 PORT command successful␍␊', lineBreak: true, desc: 'この後のサーバーからの接続が届かない' },
        ],
      },
    },
    {
      id: 'secure',
      title: '暗号化するなら FTPS か SFTP',
      hops: [
        { from: 'client', to: 'server', label: 'AUTH TLS', kind: 'control' },
        { from: 'server', to: 'client', label: '234', kind: 'control' },
        { from: 'client', to: 'server', label: 'TLS ハンドシェイク', kind: 'control' },
      ],
      body:
        '**FTPS** は `AUTH TLS` で制御接続を TLS に切り替え、データ接続も TLS で包みます。ただ、2本の接続という構造はそのままなので、ファイアウォールの設定は難しいままです。\n\n名前は似ていますが **SFTP** は別物で、SSH のチャネルの中で動くファイル転送です。接続は22番の1本で済むので、今はこちらが選ばれることが多いです。',
      packet: {
        name: 'AUTH TLS',
        layers: ['IPv4', 'TCP', 'FTP'],
        fields: [
          { name: 'クライアント', text: 'AUTH TLS␍␊', lineBreak: true },
          { name: 'サーバー', text: '234 AUTH TLS successful␍␊', lineBreak: true, desc: 'この直後から TLS の ClientHello が流れる' },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 959 File Transfer Protocol', url: 'https://www.rfc-editor.org/rfc/rfc959' },
    { label: 'RFC 4217 Securing FTP with TLS', url: 'https://www.rfc-editor.org/rfc/rfc4217' },
    { label: 'RFC 2428 FTP Extensions for IPv6 and NATs(EPSV)', url: 'https://www.rfc-editor.org/rfc/rfc2428' },
    { label: 'RFC 1579 Firewall-Friendly FTP', url: 'https://www.rfc-editor.org/rfc/rfc1579' },
  ],
  lastVerified: '2026-11-06',
};

export default ftp;
