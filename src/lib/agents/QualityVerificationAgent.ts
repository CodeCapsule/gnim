/**
 * QualityVerificationAgent
 * Validates the final prompt before it is sent to the Image Model.
 * Checks for:
 *  - Safety violations (blocked content)
 *  - Completeness (subject, style, quality tags present)
 *  - Length constraints
 */

export interface VerificationResult {
  passed: boolean;
  optimizedPrompt: string;
  warnings: string[];
  blockedReason?: string;
}

// Words that will result in a blocked generation
const BLOCKED_TERMS = [
  "nude", "naked", "explicit", "nsfw", "gore", "violence", "self-harm",
  "illegal", "weapon", "child",
];

// Minimum signal words we expect in a good prompt
const QUALITY_SIGNALS = [
  "detailed", "masterpiece", "sharp focus", "8k", "4k", "uhd",
  "cinematic", "photorealistic", "illustration", "art", "realistic",
];

const MAX_PROMPT_LENGTH = 1200;

export class QualityVerificationAgent {
  /**
   * Runs a full quality check on the final generation prompt.
   */
  static verify(prompt: string): VerificationResult {
    const warnings: string[] = [];
    let optimizedPrompt = prompt.trim();

    // 1. Safety check
    const lowerPrompt = optimizedPrompt.toLowerCase();
    for (const term of BLOCKED_TERMS) {
      if (lowerPrompt.includes(term)) {
        return {
          passed: false,
          optimizedPrompt: "",
          warnings,
          blockedReason: `Prompt contains restricted content: "${term}". Please rephrase your request.`,
        };
      }
    }

    // 2. Length check
    if (optimizedPrompt.length > MAX_PROMPT_LENGTH) {
      optimizedPrompt = optimizedPrompt.slice(0, MAX_PROMPT_LENGTH);
      warnings.push(`Prompt was truncated to ${MAX_PROMPT_LENGTH} characters to stay within model limits.`);
    }

    // 3. Completeness check
    const hasQualitySignal = QUALITY_SIGNALS.some((s) => lowerPrompt.includes(s));
    if (!hasQualitySignal) {
      // Auto-inject a minimal quality booster
      optimizedPrompt += ", highly detailed, masterpiece";
      warnings.push("Quality tags were missing — added automatically.");
    }

    // 4. Check prompt is not too short
    if (optimizedPrompt.split(" ").length < 4) {
      warnings.push("Prompt is very short. Consider adding more descriptive details for better results.");
    }

    return {
      passed: true,
      optimizedPrompt,
      warnings,
    };
  }
}
