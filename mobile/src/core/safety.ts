const BLOCKED_PATTERNS: RegExp[] = [
  /色情|赌博|暴力|自杀|毒品|成人/i,
  /\bsuicide\b|\bkill\b|\bdrugs?\b|\bporn\b/i,
];

export interface SafetyResult {
  passed: boolean;
  reason: string;
}

export function checkInput(text: string): SafetyResult {
  for (const pat of BLOCKED_PATTERNS) {
    if (pat.test(text)) {
      return {
        passed: false,
        reason: '输入包含不适合的内容，请重新表述你的问题。',
      };
    }
  }
  return { passed: true, reason: '' };
}

export function checkOutput(text: string): SafetyResult {
  for (const pat of BLOCKED_PATTERNS) {
    if (pat.test(text)) {
      return { passed: false, reason: '输出包含不适合内容' };
    }
  }
  return { passed: true, reason: '' };
}
