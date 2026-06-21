/**
 * ImageEditingAgent
 * Coordinates image editing by classifying edit intent and determining the
 * appropriate processing pipeline:
 *   - Simple edits: handled by Jimp (free, instant, local)
 *   - Advanced AI edits: dispatched to external inpainting APIs (Replicate, ClipDrop)
 */

export type EditType = "simple" | "ai_inpaint" | "ai_restyle" | "unknown";

export interface EditPlan {
  type: EditType;
  operation: string;
  params: Record<string, unknown>;
  aiPrompt?: string; // for AI edits
}

const SIMPLE_EDIT_KEYWORDS: Record<string, string> = {
  pixelate: "pixelate",
  blur: "blur",
  grayscale: "grayscale",
  "black and white": "grayscale",
  sepia: "sepia",
  invert: "invert",
  brighten: "brighten",
  brighter: "brighten",
  darken: "darken",
  darker: "darken",
  rotate: "rotate",
  flip: "flip",
  sharpen: "sharpen",
  crop: "crop",
  resize: "resize",
  shrink: "resize",
  smaller: "resize",
};

const AI_INPAINT_KEYWORDS = ["remove", "erase", "delete", "replace", "fill"];
const AI_RESTYLE_KEYWORDS = ["restyle", "style as", "make it look like", "turn into", "convert to", "enhance", "upscale"];

export class ImageEditingAgent {
  /**
   * Analyzes the user's edit request and returns a structured edit plan.
   */
  static plan(message: string): EditPlan {
    const lower = message.toLowerCase();

    // Check simple edits first
    for (const [keyword, operation] of Object.entries(SIMPLE_EDIT_KEYWORDS)) {
      if (lower.includes(keyword)) {
        return {
          type: "simple",
          operation,
          params: this.buildSimpleParams(operation, lower),
        };
      }
    }

    // Check AI inpainting
    for (const kw of AI_INPAINT_KEYWORDS) {
      if (lower.includes(kw)) {
        return {
          type: "ai_inpaint",
          operation: "inpaint",
          params: {},
          aiPrompt: message,
        };
      }
    }

    // Check AI restyling
    for (const kw of AI_RESTYLE_KEYWORDS) {
      if (lower.includes(kw)) {
        return {
          type: "ai_restyle",
          operation: "restyle",
          params: {},
          aiPrompt: message,
        };
      }
    }

    return { type: "unknown", operation: "none", params: {} };
  }

  private static buildSimpleParams(operation: string, lower: string): Record<string, unknown> {
    switch (operation) {
      case "pixelate":
        return { pixelSize: 15 };
      case "blur":
        return { radius: 10 };
      case "brighten":
        return { amount: 0.5 };
      case "darken":
        return { amount: -0.5 };
      case "rotate": {
        // Try to extract degrees from prompt like "rotate 45 degrees"
        const degreesMatch = lower.match(/rotate\s+(\d+)/);
        return { degrees: degreesMatch ? parseInt(degreesMatch[1]) : 90 };
      }
      case "resize":
        return { scale: 0.5 };
      default:
        return {};
    }
  }

  /**
   * Returns a user-facing description of the edit plan.
   */
  static describe(plan: EditPlan): string {
    switch (plan.type) {
      case "simple":
        return `⚡ Applying ${plan.operation} filter instantly using Jimp.`;
      case "ai_inpaint":
        return `🤖 AI inpainting required: "${plan.aiPrompt}". Dispatching to Replicate API...`;
      case "ai_restyle":
        return `🎨 AI restyling required: "${plan.aiPrompt}". Dispatching to Replicate API...`;
      default:
        return `⚠️ Could not determine edit type from request.`;
    }
  }
}
