/**
 * TextToImageAgent
 * A prompt engineering specialist.
 * Takes a raw user concept and expands it into a highly detailed,
 * model-optimized prompt for FLUX, DALL-E, or similar image models.
 */

export class TextToImageAgent {
  /**
   * Expands a simple user request into an optimized generation prompt.
   * Uses a structured enrichment pipeline:
   *   1. Subject description
   *   2. Style/medium
   *   3. Lighting/mood
   *   4. Compositional details
   *   5. Technical quality tags
   */
  static expand(rawPrompt: string, context?: string): string {
    const lower = rawPrompt.toLowerCase();

    // Detect style hints already in the prompt
    const hasStyle = /oil paint|watercolor|anime|pixel art|photo|realistic|3d render|sketch|illustration|cinematic|neon|retro|vintage|surreal/i.test(rawPrompt);
    const hasLighting = /golden hour|sunset|sunrise|night|moonlight|soft light|dramatic light|backlit|studio light/i.test(rawPrompt);
    const hasQualityTags = /4k|8k|uhd|masterpiece|high detail|sharp focus/i.test(rawPrompt);

    let enriched = rawPrompt.trim();

    // Inject storyboard context if available
    if (context) {
      enriched = `${enriched}, ${context}`;
    }

    // Auto-add missing style if none detected
    if (!hasStyle) {
      if (lower.includes("character") || lower.includes("person") || lower.includes("portrait")) {
        enriched += ", cinematic portrait, photorealistic";
      } else if (lower.includes("landscape") || lower.includes("scene") || lower.includes("world")) {
        enriched += ", epic landscape, cinematic wide shot";
      } else if (lower.includes("creature") || lower.includes("monster") || lower.includes("dragon")) {
        enriched += ", concept art, detailed illustration";
      } else {
        enriched += ", digital art, highly detailed";
      }
    }

    // Auto-add lighting
    if (!hasLighting) {
      enriched += ", dramatic lighting, volumetric light";
    }

    // Auto-add quality
    if (!hasQualityTags) {
      enriched += ", sharp focus, 8k, masterpiece, award-winning";
    }

    // Append universal quality boosters
    enriched += ", intricate details, professional photography, trending on ArtStation";

    return enriched;
  }

  /**
   * Builds the negative prompt to suppress common issues.
   */
  static buildNegativePrompt(): string {
    return [
      "blurry",
      "low quality",
      "pixelated",
      "jpeg artifacts",
      "watermark",
      "signature",
      "text",
      "logo",
      "extra limbs",
      "deformed hands",
      "bad anatomy",
      "ugly",
      "duplicate",
      "mutated",
      "disfigured",
      "out of frame",
    ].join(", ");
  }
}
