/**
 * DNS検証チェッカー
 * SPF, DKIM, DMARCの検証を行う
 */

import dns from 'dns';
import { promisify } from 'util';

const resolveTxt = promisify(dns.resolveTxt);

export interface DnsCheckResult {
  domain: string;
  spf: {
    valid: boolean;
    record: string | null;
    error?: string;
  };
  dkim: {
    valid: boolean;
    selector: string;
    record: string | null;
    error?: string;
  };
  dmarc: {
    valid: boolean;
    policy: 'none' | 'quarantine' | 'reject' | null;
    record: string | null;
    error?: string;
  };
  overallValid: boolean;
  canSend: boolean; // 最低限の要件を満たしているか
  recommendations: string[];
}

/**
 * SPFレコードをチェック
 */
async function checkSpf(domain: string): Promise<DnsCheckResult['spf']> {
  try {
    const records = await resolveTxt(domain);
    const spfRecords = records
      .map(r => r.join(''))
      .filter(r => r.startsWith('v=spf1'));

    if (spfRecords.length === 0) {
      return {
        valid: false,
        record: null,
        error: 'SPFレコードが見つかりません',
      };
    }

    if (spfRecords.length > 1) {
      return {
        valid: false,
        record: spfRecords[0],
        error: '複数のSPFレコードが存在します（1つにまとめてください）',
      };
    }

    const spf = spfRecords[0];

    // Amazon SESのSPFが含まれているかチェック
    const hasSes = spf.includes('amazonses.com') || spf.includes('amazon');

    return {
      valid: true,
      record: spf,
      error: hasSes ? undefined : 'Amazon SESのSPFが含まれていません（推奨）',
    };
  } catch (error) {
    return {
      valid: false,
      record: null,
      error: `DNS検索エラー: ${(error as Error).message}`,
    };
  }
}

/**
 * DKIMレコードをチェック
 * Amazon SESの場合、3つのCNAMEレコードが必要
 */
async function checkDkim(
  domain: string,
  selector: string = 'ses' // デフォルトはSESセレクタ
): Promise<DnsCheckResult['dkim']> {
  const dkimDomain = `${selector}._domainkey.${domain}`;

  try {
    // まずCNAMEを試す（SESの場合）
    try {
      const cname = await promisify(dns.resolveCname)(dkimDomain);
      if (cname && cname.length > 0) {
        return {
          valid: true,
          selector,
          record: cname[0],
        };
      }
    } catch {
      // CNAMEがない場合はTXTレコードを試す
    }

    // TXTレコードを試す
    const records = await resolveTxt(dkimDomain);
    const dkimRecords = records
      .map(r => r.join(''))
      .filter(r => r.includes('v=DKIM1') || r.includes('p='));

    if (dkimRecords.length > 0) {
      return {
        valid: true,
        selector,
        record: dkimRecords[0].substring(0, 100) + '...',
      };
    }

    return {
      valid: false,
      selector,
      record: null,
      error: `DKIMレコードが見つかりません（${dkimDomain}）`,
    };
  } catch (error) {
    // SESの他のセレクタも試す
    for (const altSelector of ['default', 'google', 'mail']) {
      if (altSelector === selector) continue;
      try {
        const altDomain = `${altSelector}._domainkey.${domain}`;
        const records = await resolveTxt(altDomain);
        const dkimRecords = records.map(r => r.join('')).filter(r => r.includes('v=DKIM1') || r.includes('p='));
        if (dkimRecords.length > 0) {
          return {
            valid: true,
            selector: altSelector,
            record: dkimRecords[0].substring(0, 100) + '...',
          };
        }
      } catch {
        continue;
      }
    }

    return {
      valid: false,
      selector,
      record: null,
      error: 'DKIMレコードが見つかりません',
    };
  }
}

/**
 * DMARCレコードをチェック
 */
async function checkDmarc(domain: string): Promise<DnsCheckResult['dmarc']> {
  const dmarcDomain = `_dmarc.${domain}`;

  try {
    const records = await resolveTxt(dmarcDomain);
    const dmarcRecords = records
      .map(r => r.join(''))
      .filter(r => r.startsWith('v=DMARC1'));

    if (dmarcRecords.length === 0) {
      return {
        valid: false,
        policy: null,
        record: null,
        error: 'DMARCレコードが見つかりません',
      };
    }

    const dmarc = dmarcRecords[0];

    // ポリシーを抽出
    const policyMatch = dmarc.match(/p=(none|quarantine|reject)/i);
    const policy = policyMatch
      ? (policyMatch[1].toLowerCase() as 'none' | 'quarantine' | 'reject')
      : null;

    return {
      valid: true,
      policy,
      record: dmarc,
    };
  } catch (error) {
    return {
      valid: false,
      policy: null,
      record: null,
      error: `DNS検索エラー: ${(error as Error).message}`,
    };
  }
}

/**
 * ドメインのDNS設定を包括的にチェック
 */
export async function checkDns(domain: string, dkimSelector?: string): Promise<DnsCheckResult> {
  const [spf, dkim, dmarc] = await Promise.all([
    checkSpf(domain),
    dkimSelector ? checkDkim(domain, dkimSelector) : checkDkim(domain),
    checkDmarc(domain),
  ]);

  const overallValid = spf.valid && dkim.valid && dmarc.valid;

  // 最低限の送信要件: SPFまたはDKIMが有効 + DMARCが存在（ポリシーは問わない）
  const canSend = (spf.valid || dkim.valid) && dmarc.valid;

  const recommendations: string[] = [];

  if (!spf.valid) {
    recommendations.push('SPFレコードを設定してください。Amazon SESを使用する場合は「include:amazonses.com」を追加してください。');
  }

  if (!dkim.valid) {
    recommendations.push('DKIMを設定してください。Amazon SESの場合はSESコンソールで「Easy DKIM」を有効にし、CNAMEレコードを追加してください。');
  }

  if (!dmarc.valid) {
    recommendations.push('DMARCレコードを設定してください。最低限「v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com」を設定してください。');
  } else if (dmarc.policy === 'none') {
    recommendations.push('DMARCポリシーを「quarantine」または「reject」に強化することを推奨します（到達率向上のため）。');
  }

  return {
    domain,
    spf,
    dkim,
    dmarc,
    overallValid,
    canSend,
    recommendations,
  };
}

/**
 * 送信可能かどうかをチェック（シンプル版）
 */
export async function canSendFromDomain(domain: string): Promise<{
  canSend: boolean;
  reason?: string;
}> {
  const result = await checkDns(domain);

  if (result.canSend) {
    return { canSend: true };
  }

  const issues: string[] = [];
  if (!result.spf.valid && !result.dkim.valid) {
    issues.push('SPFまたはDKIMの設定が必要です');
  }
  if (!result.dmarc.valid) {
    issues.push('DMARCの設定が必要です');
  }

  return {
    canSend: false,
    reason: issues.join('。') + '。',
  };
}
