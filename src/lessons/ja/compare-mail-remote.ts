import type { CompareTable } from '../types';

const compareMailRemote: CompareTable = {
  part: 5,
  title: 'メールとリモートの5つのプロトコルの比較',
  lead: 'どれもインターネットの初期から使われ、**テキストのコマンドと応答**という形を共有しています。違いは、何を運ぶか、そして暗号化を後から足したか最初から組み込んだかです。',
  aspects: [
    { id: 'purpose', label: '用途' },
    { id: 'ports', label: 'ポート' },
    { id: 'format', label: '形式' },
    { id: 'reply', label: '応答の形' },
    { id: 'crypto', label: '暗号化' },
    { id: 'now', label: '今の立ち位置' },
  ],
  columns: [
    {
      name: 'SMTP',
      lessonId: 'smtp',
      cells: {
        purpose: 'メールを送る・サーバー間で受け渡す',
        ports: '25(サーバー間)、587(送信)、465(最初からTLS)',
        format: 'テキストの1行コマンド',
        reply: '3桁の数字 + 説明',
        crypto: 'STARTTLS で途中から',
        now: '今もメール配送の唯一の標準',
      },
    },
    {
      name: 'POP3',
      lessonId: 'pop3',
      cells: {
        purpose: 'メールを手元にダウンロードする',
        ports: '110、995(TLS)',
        format: 'テキストの1行コマンド',
        reply: '+OK / -ERR',
        crypto: '995 番で最初から TLS',
        now: '1台の端末だけで読む用途に残る',
      },
    },
    {
      name: 'IMAP',
      lessonId: 'imap',
      cells: {
        purpose: 'サーバー上のメールを操作する',
        ports: '143、993(TLS)',
        format: 'タグ付きのコマンド',
        reply: 'タグなし応答(*)+ タグ付きの OK / NO / BAD',
        crypto: '993 番で最初から TLS',
        now: '複数の端末で読むメールの主流',
      },
    },
    {
      name: 'SSH',
      lessonId: 'ssh',
      cells: {
        purpose: 'リモートログイン、ポート転送、ファイル転送(SFTP)',
        ports: '22',
        format: 'バージョン行のあとはバイナリのパケット',
        reply: 'メッセージ番号で種類を表す',
        crypto: '最初から組み込み(鍵交換 → 暗号化)',
        now: 'サーバー管理の標準',
      },
    },
    {
      name: 'FTP',
      lessonId: 'ftp',
      cells: {
        purpose: 'ファイルの送受信',
        ports: '21(制御)+ データ用にもう1本',
        format: 'テキストの1行コマンド',
        reply: '3桁の数字 + 説明',
        crypto: 'なし(FTPS で TLS を足せる)',
        now: 'SFTP や HTTPS に置き換わりつつある',
      },
    },
  ],
  notes: ['RFC 8314 は、メールの読み書きでも平文のポートをやめ、最初から TLS を使うことを勧めています。'],
  lastVerified: '2026-11-06',
};

export default compareMailRemote;
