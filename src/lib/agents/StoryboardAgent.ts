/**
 * StoryboardAgent
 * Maintains a sequential history of generated images within a conversation.
 * Injects context from previous frames to ensure visual continuity
 * (e.g. same background, same scene, evolving character state).
 */

export interface StoryboardFrame {
  prompt: string;
  imageUrl: string;
  timestamp: number;
}

// In-memory storyboard per conversation ID
const storyboardStore = new Map<string, StoryboardFrame[]>();

export class StoryboardAgent {
  /**
   * Records a generated image frame for a given conversation.
   */
  static addFrame(conversationId: string, prompt: string, imageUrl: string): void {
    if (!storyboardStore.has(conversationId)) {
      storyboardStore.set(conversationId, []);
    }
    storyboardStore.get(conversationId)!.push({
      prompt,
      imageUrl,
      timestamp: Date.now(),
    });
  }

  /**
   * Gets the last N frames from the storyboard.
   */
  static getRecentFrames(conversationId: string, n = 3): StoryboardFrame[] {
    const frames = storyboardStore.get(conversationId) || [];
    return frames.slice(-n);
  }

  /**
   * Builds a context string for the prompt based on recent frames.
   * For example: "Continuation of scene: [forest at dusk, mystical fog]"
   */
  static buildContext(conversationId: string): string {
    const frames = this.getRecentFrames(conversationId, 2);
    if (frames.length === 0) return "";

    const summaries = frames.map((f) => f.prompt.slice(0, 100)).join("; ");
    return `Continuing visual story from previous scene: ${summaries}`;
  }

  /**
   * Clears the storyboard for a conversation.
   */
  static clearBoard(conversationId: string): void {
    storyboardStore.delete(conversationId);
  }
}
