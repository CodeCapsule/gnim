/**
 * TextToImageAgent
 * A prompt engineering specialist.
 * Takes a raw user concept and expands it into a highly detailed,
 * model-optimized prompt for FLUX, DALL-E, or similar image models.
 */

/** Prompts that contain specific text/layout that must be rendered accurately */
const TEXT_HEAVY_KEYWORDS = [
  "business card", "certificate", "poster", "banner", "flyer", "invoice",
  "letterhead", "id card", "badge", "label", "ticket", "receipt", "menu",
  "logo", "sign", "text that says", "words", "written", "typed", "font",
  "email", "phone number", "address", "contact",
];

export class TextToImageAgent {
  /**
   * Detects whether the prompt is a text/design-heavy request that requires
   * accurate text rendering (e.g. business cards, certificates, posters).
   */
  static isTextHeavy(rawPrompt: string): boolean {
    const lower = rawPrompt.toLowerCase();
    return TEXT_HEAVY_KEYWORDS.some(kw => lower.includes(kw));
  }

  /**
   * Expands a simple user request into an optimized generation prompt.
   * For text-heavy prompts (e.g. business cards), skips style/lighting enrichment
   * to avoid distorting the layout, and instead focuses on clean rendering.
   */
  static expand(rawPrompt: string, context?: string): string {
    const lower = rawPrompt.toLowerCase();

    // TEXT-HEAVY PROMPTS: Don't add artistic enrichments — they confuse the model
    // and produce garbled text. Instead, guide it toward clean flat design.
    if (this.isTextHeavy(rawPrompt)) {
      let structured = rawPrompt.trim();

      // Inject storyboard context if available
      if (context) {
        structured = `${structured}, ${context}`;
      }

      // Add clean design tags instead of artistic ones
      structured += ", clean flat design, crisp typography, perfect legible text, professional layout, white background, high resolution, sharp edges, no artistic distortion";
      return structured;
    }

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
   * For text-heavy prompts, removes "text" from the negative list.
   */
  static buildNegativePrompt(isTextHeavy = false): string {
    const base = [
      "blurry",
      "low quality",
      "pixelated",
      "jpeg artifacts",
      "watermark",
      "signature",
      "extra limbs",
      "deformed hands",
      "bad anatomy",
      "ugly",
      "duplicate",
      "mutated",
      "disfigured",
      "out of frame",
    ];

    if (!isTextHeavy) {
      // For non-text images, suppress unwanted text/logos
      base.push("text", "logo");
    } else {
      // For text-heavy images, suppress garbling
      base.push("distorted text", "unreadable", "misspelled", "garbled", "artistic distortion", "painterly");
    }

    return base.join(", ");
  }
}
