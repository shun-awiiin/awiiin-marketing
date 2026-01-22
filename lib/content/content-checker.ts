/**
 * Content Checker Service
 * Analyzes email content for spam triggers, link quality, and deliverability issues
 */

import type {
  ContentCheckResult,
  ContentCheckRequest,
  SpamWordMatch,
  LinkCheckResult,
  SubjectAnalysis,
  ContentRecommendation,
  AlertSeverity,
} from '@/lib/types/deliverability';
import { SPAM_WORD_CATEGORIES } from '@/lib/types/deliverability';

// ============================================
// SPAM WORD DETECTION
// ============================================

interface SpamWordDefinition {
  word: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
  weight: number;
}

// Extended spam word list with Japanese and English
const SPAM_WORDS: SpamWordDefinition[] = [
  // Urgency (High severity)
  { word: 'urgent', category: 'urgency', severity: 'high', weight: 10 },
  { word: '緊急', category: 'urgency', severity: 'high', weight: 10 },
  { word: 'act now', category: 'urgency', severity: 'high', weight: 10 },
  { word: '今すぐ', category: 'urgency', severity: 'high', weight: 8 },
  { word: 'limited time', category: 'urgency', severity: 'high', weight: 8 },
  { word: '期間限定', category: 'urgency', severity: 'medium', weight: 6 },
  { word: 'expires', category: 'urgency', severity: 'medium', weight: 6 },
  { word: '締め切り', category: 'urgency', severity: 'medium', weight: 5 },
  { word: 'hurry', category: 'urgency', severity: 'medium', weight: 6 },
  { word: 'お急ぎ', category: 'urgency', severity: 'medium', weight: 5 },

  // Money (High severity)
  { word: 'free', category: 'money', severity: 'medium', weight: 5 },
  { word: '無料', category: 'money', severity: 'low', weight: 3 },
  { word: 'cash', category: 'money', severity: 'high', weight: 10 },
  { word: '現金', category: 'money', severity: 'high', weight: 8 },
  { word: 'bonus', category: 'money', severity: 'medium', weight: 6 },
  { word: 'ボーナス', category: 'money', severity: 'medium', weight: 5 },
  { word: 'winner', category: 'money', severity: 'high', weight: 10 },
  { word: '当選', category: 'money', severity: 'high', weight: 10 },
  { word: 'prize', category: 'money', severity: 'high', weight: 10 },
  { word: '賞金', category: 'money', severity: 'high', weight: 10 },
  { word: 'lottery', category: 'money', severity: 'high', weight: 10 },
  { word: 'earn money', category: 'money', severity: 'high', weight: 10 },
  { word: '稼ぐ', category: 'money', severity: 'medium', weight: 6 },

  // Pressure (Medium severity)
  { word: 'guaranteed', category: 'pressure', severity: 'medium', weight: 6 },
  { word: '保証', category: 'pressure', severity: 'medium', weight: 5 },
  { word: 'no obligation', category: 'pressure', severity: 'medium', weight: 6 },
  { word: 'risk free', category: 'pressure', severity: 'medium', weight: 6 },
  { word: 'リスクなし', category: 'pressure', severity: 'medium', weight: 5 },
  { word: 'satisfaction guaranteed', category: 'pressure', severity: 'medium', weight: 6 },
  { word: '100%', category: 'pressure', severity: 'low', weight: 3 },

  // Suspicious (Medium severity)
  { word: 'click here', category: 'suspicious', severity: 'medium', weight: 6 },
  { word: 'click below', category: 'suspicious', severity: 'medium', weight: 6 },
  { word: 'こちらをクリック', category: 'suspicious', severity: 'medium', weight: 5 },
  { word: 'unsubscribe', category: 'suspicious', severity: 'low', weight: 2 },
  { word: 'remove', category: 'suspicious', severity: 'low', weight: 2 },
  { word: 'opt out', category: 'suspicious', severity: 'low', weight: 2 },

  // Marketing (Low severity)
  { word: 'special offer', category: 'marketing', severity: 'low', weight: 3 },
  { word: '特別オファー', category: 'marketing', severity: 'low', weight: 3 },
  { word: 'exclusive', category: 'marketing', severity: 'low', weight: 2 },
  { word: '限定', category: 'marketing', severity: 'low', weight: 2 },
  { word: 'deal', category: 'marketing', severity: 'low', weight: 2 },
  { word: 'discount', category: 'marketing', severity: 'low', weight: 3 },
  { word: '割引', category: 'marketing', severity: 'low', weight: 2 },
];

/**
 * Find spam words in text
 */
function findSpamWords(text: string): SpamWordMatch[] {
  const matches: SpamWordMatch[] = [];
  const lowerText = text.toLowerCase();

  for (const spamWord of SPAM_WORDS) {
    const regex = new RegExp(`\\b${escapeRegex(spamWord.word)}\\b`, 'gi');
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Get context (surrounding text)
      const start = Math.max(0, match.index - 20);
      const end = Math.min(text.length, match.index + spamWord.word.length + 20);
      const context = text.substring(start, end);

      matches.push({
        word: spamWord.word,
        category: spamWord.category,
        severity: spamWord.severity,
        context: `...${context}...`,
      });
    }
  }

  return matches;
}

/**
 * Calculate spam score from matches
 */
function calculateSpamScore(matches: SpamWordMatch[]): number {
  if (matches.length === 0) return 0;

  let totalWeight = 0;
  for (const match of matches) {
    const spamWord = SPAM_WORDS.find((sw) => sw.word === match.word);
    if (spamWord) {
      totalWeight += spamWord.weight;
    }
  }

  // Normalize to 0-100 scale (higher = more spam-like)
  return Math.min(100, totalWeight * 2);
}

// ============================================
// LINK VALIDATION
// ============================================

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
const SHORTENED_DOMAINS = [
  'bit.ly', 'goo.gl', 't.co', 'tinyurl.com', 'ow.ly', 'is.gd',
  'buff.ly', 'j.mp', 'lnkd.in', 'db.tt', 'qr.ae',
];

/**
 * Extract and validate links from content
 */
async function validateLinks(text: string): Promise<LinkCheckResult[]> {
  const urls = text.match(URL_REGEX) || [];
  const uniqueUrls = [...new Set(urls)];

  const results: LinkCheckResult[] = [];

  for (const url of uniqueUrls) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();

      results.push({
        url,
        is_valid: true,
        is_shortened: SHORTENED_DOMAINS.some((d) => domain.includes(d)),
        is_tracking: domain.includes('click') || domain.includes('track') || url.includes('utm_'),
        domain,
      });
    } catch {
      results.push({
        url,
        is_valid: false,
        is_shortened: false,
        is_tracking: false,
        domain: '',
        error: 'Invalid URL format',
      });
    }
  }

  return results;
}

// ============================================
// SUBJECT LINE ANALYSIS
// ============================================

/**
 * Analyze email subject line
 */
function analyzeSubject(subject: string): SubjectAnalysis {
  const recommendations: string[] = [];
  let score = 100;

  // Length check
  const length = subject.length;
  if (length < 10) {
    score -= 20;
    recommendations.push('件名が短すぎます（10文字以上推奨）');
  } else if (length > 50) {
    score -= 10;
    recommendations.push('件名が長すぎます（50文字以下推奨）');
  }

  // Personalization check
  const hasPersonalization = /\{\{.*?\}\}/.test(subject) || subject.includes('さん');

  if (!hasPersonalization) {
    score -= 10;
    recommendations.push('パーソナライゼーション（名前など）を追加すると開封率が向上します');
  }

  // Spam trigger check
  const spamMatches = findSpamWords(subject);
  const hasSpamTriggers = spamMatches.length > 0;

  if (hasSpamTriggers) {
    score -= spamMatches.length * 10;
    recommendations.push(`件名にスパムトリガーワードが含まれています: ${spamMatches.map(m => m.word).join(', ')}`);
  }

  // Capitalization check
  const upperCount = (subject.match(/[A-Z]/g) || []).length;
  const lowerCount = (subject.match(/[a-z]/g) || []).length;
  const capitalizationRatio = lowerCount > 0 ? upperCount / (upperCount + lowerCount) : 0;

  if (capitalizationRatio > 0.5) {
    score -= 15;
    recommendations.push('大文字の使用が多すぎます（スパムと判定される可能性があります）');
  }

  // Special character check
  const specialChars = (subject.match(/[!?$%&*#@]/g) || []).length;
  const specialCharRatio = subject.length > 0 ? specialChars / subject.length : 0;

  if (specialCharRatio > 0.1) {
    score -= 10;
    recommendations.push('特殊文字の使用が多すぎます');
  }

  if (subject.includes('!!!') || subject.includes('???')) {
    score -= 10;
    recommendations.push('連続した記号（!!!、???）は避けてください');
  }

  // Good practices
  if (score === 100 && recommendations.length === 0) {
    recommendations.push('件名は問題ありません');
  }

  return {
    length,
    has_personalization: hasPersonalization,
    has_spam_triggers: hasSpamTriggers,
    capitalization_ratio: Math.round(capitalizationRatio * 100) / 100,
    special_char_ratio: Math.round(specialCharRatio * 100) / 100,
    recommendations,
  };
}

// ============================================
// HTML/TEXT RATIO
// ============================================

/**
 * Calculate HTML to text ratio
 */
function calculateHtmlTextRatio(bodyHtml?: string, bodyText?: string): number | null {
  if (!bodyHtml) return null;

  // Remove HTML tags to get text content
  const textFromHtml = bodyHtml.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const htmlLength = bodyHtml.length;
  const textLength = textFromHtml.length;

  if (htmlLength === 0) return null;

  return Math.round((textLength / htmlLength) * 100) / 100;
}

// ============================================
// MAIN CONTENT CHECK FUNCTION
// ============================================

/**
 * Perform comprehensive content check
 */
export async function checkContent(
  request: ContentCheckRequest
): Promise<ContentCheckResult> {
  const { subject, body_text, body_html } = request;

  // Find spam words
  const subjectSpamWords = findSpamWords(subject);
  const bodySpamWords = findSpamWords(body_text);
  const allSpamWords = [...subjectSpamWords, ...bodySpamWords];

  // Calculate spam score
  const spamScore = calculateSpamScore(allSpamWords);

  // Validate links
  const linksFound = await validateLinks(body_text);
  const linksValid = linksFound.every((l) => l.is_valid);

  // Analyze subject
  const subjectAnalysis = analyzeSubject(subject);

  // Calculate HTML/text ratio
  const htmlTextRatio = calculateHtmlTextRatio(body_html, body_text);

  // Generate recommendations
  const recommendations: ContentRecommendation[] = [];

  // Spam-related recommendations
  if (spamScore > 50) {
    recommendations.push({
      category: 'spam_words',
      severity: 'critical',
      message: 'スパムスコアが高すぎます。スパムトリガーワードを削除してください。',
      suggestion: `削除推奨: ${allSpamWords.map((w) => w.word).join(', ')}`,
    });
  } else if (spamScore > 20) {
    recommendations.push({
      category: 'spam_words',
      severity: 'warning',
      message: 'いくつかのスパムトリガーワードが検出されました。',
      suggestion: `確認推奨: ${allSpamWords.map((w) => w.word).join(', ')}`,
    });
  }

  // Link-related recommendations
  const shortenedLinks = linksFound.filter((l) => l.is_shortened);
  if (shortenedLinks.length > 0) {
    recommendations.push({
      category: 'links',
      severity: 'warning',
      message: '短縮URLが検出されました。フルURLの使用を推奨します。',
      suggestion: 'bit.ly, goo.gl などの短縮URLは避けてください',
    });
  }

  if (!linksValid) {
    recommendations.push({
      category: 'links',
      severity: 'critical',
      message: '無効なURLが含まれています。',
      suggestion: 'すべてのリンクが正しく機能することを確認してください',
    });
  }

  // Subject recommendations
  if (subjectAnalysis.length < 10 || subjectAnalysis.length > 60) {
    recommendations.push({
      category: 'subject',
      severity: 'warning',
      message: `件名の長さが最適ではありません（現在: ${subjectAnalysis.length}文字）`,
      suggestion: '件名は10〜50文字が最適です',
    });
  }

  // HTML ratio recommendations
  if (htmlTextRatio !== null && htmlTextRatio < 0.2) {
    recommendations.push({
      category: 'html_ratio',
      severity: 'warning',
      message: 'HTMLに対するテキストの比率が低すぎます。',
      suggestion: '画像だけでなく、十分なテキストコンテンツを含めてください',
    });
  }

  // Calculate overall score
  let overallScore = 100;
  overallScore -= spamScore * 0.4;
  overallScore -= (100 - Math.max(0, subjectAnalysis.length >= 10 && subjectAnalysis.length <= 50 ? 100 : 70)) * 0.2;
  overallScore -= linksValid ? 0 : 20;
  overallScore -= shortenedLinks.length * 5;

  overallScore = Math.max(0, Math.min(100, Math.round(overallScore)));

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (overallScore >= 90) grade = 'A';
  else if (overallScore >= 80) grade = 'B';
  else if (overallScore >= 70) grade = 'C';
  else if (overallScore >= 60) grade = 'D';
  else grade = 'F';

  return {
    overall_score: overallScore,
    grade,
    spam_score: spamScore,
    spam_words_found: allSpamWords,
    links_found: linksFound,
    links_valid: linksValid,
    html_text_ratio: htmlTextRatio,
    subject_score: Math.max(0, 100 - (100 - overallScore)),
    subject_analysis: subjectAnalysis,
    recommendations,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Quick spam check (lightweight)
 */
export function quickSpamCheck(text: string): { score: number; matches: string[] } {
  const matches = findSpamWords(text);
  return {
    score: calculateSpamScore(matches),
    matches: matches.map((m) => m.word),
  };
}

/**
 * Check if content passes basic deliverability checks
 */
export function passesDeliverabilityCheck(result: ContentCheckResult): boolean {
  return (
    result.overall_score >= 60 &&
    result.spam_score < 50 &&
    result.links_valid
  );
}
