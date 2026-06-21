/**
 * ImageRouter
 * The central orchestrator for all image-related requests.
 *
 * Flow:
 *  User Request
 *    └─ ImageRouter
 *         ├─ CharacterMemoryAgent (injects character visual traits)
 *         ├─ StoryboardAgent (injects scene continuation context)
 *         ├─ TextToImageAgent (expands & enriches the prompt)
 *         ├─ QualityVerificationAgent (validates & sanitizes the final prompt)
 *         └─ Returns { finalPrompt, negativePrompt, meta, warnings }
 */

import { CharacterMemoryAgent } from "./CharacterMemoryAgent";
import { StoryboardAgent } from "./StoryboardAgent";
import { TextToImageAgent } from "./TextToImageAgent";
import { ImageEditingAgent, EditPlan } from "./ImageEditingAgent";
import { QualityVerificationAgent } from "./QualityVerificationAgent";

export type RouterIntent = "generate" | "edit" | "character_define" | "unknown";

export interface RouterResult {
  intent: RouterIntent;
  // For generation
  finalPrompt?: string;
  negativePrompt?: string;
  // For editing
  editPlan?: EditPlan;
  // Shared
  warnings: string[];
  blockedReason?: string;
}

export class ImageRouter {
  /**
   * Analyzes the user request and routes it through the appropriate
   * agent pipeline.
   *
   * @param rawRequest - The user's raw text message
   * @param conversationId - Used for storyboard context
   * @param hasImage - Whether the user has attached an image
   */
  static async route(
    rawRequest: string,
    conversationId = "default",
    hasImage = false
  ): Promise<RouterResult> {
    const warnings: string[] = [];

    // --- 0. Check for Character Definition command ---
    const charDef = CharacterMemoryAgent.extractDefinition(rawRequest);
    if (charDef) {
      CharacterMemoryAgent.save(charDef.name, charDef.traits);
      return {
        intent: "character_define",
        warnings: [],
        finalPrompt: undefined,
      };
    }

    // --- 1. Route: Image Editing (user has an attached image) ---
    if (hasImage) {
      const editPlan = ImageEditingAgent.plan(rawRequest);
      return {
        intent: "edit",
        editPlan,
        warnings,
      };
    }

    // --- 2. Route: Text-to-Image Generation ---

    // Step A: Character Memory — inject known character visual traits
    let prompt = CharacterMemoryAgent.injectTraits(rawRequest);

    // Step B: Storyboard — inject scene continuation context if applicable
    const storyContext = StoryboardAgent.buildContext(conversationId);
    
    // Step C: Text-to-Image — expand and enrich the prompt
    const enrichedPrompt = TextToImageAgent.expand(prompt, storyContext || undefined);
    const negativePrompt = TextToImageAgent.buildNegativePrompt();

    // Step D: Quality Verification — validate and sanitize
    const verification = QualityVerificationAgent.verify(enrichedPrompt);
    if (verification.warnings.length > 0) {
      warnings.push(...verification.warnings);
    }

    if (!verification.passed) {
      return {
        intent: "generate",
        warnings,
        blockedReason: verification.blockedReason,
      };
    }

    return {
      intent: "generate",
      finalPrompt: verification.optimizedPrompt,
      negativePrompt,
      warnings,
    };
  }

  /**
   * Called AFTER a successful generation to record the frame in the storyboard.
   */
  static recordGeneration(conversationId: string, prompt: string, imageUrl: string): void {
    StoryboardAgent.addFrame(conversationId, prompt, imageUrl);
  }
}
