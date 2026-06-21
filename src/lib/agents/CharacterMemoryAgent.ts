/**
 * CharacterMemoryAgent
 * Maintains a server-side in-memory store of known characters and injects
 * their visual traits into prompts for consistency across generations.
 * NOTE: For persistence across server restarts, this should be replaced with a DB.
 */

export interface CharacterProfile {
  name: string;
  traits: string; // e.g. "red hair, green eyes, wearing a blue trench coat"
  createdAt: number;
}

// In-memory store (session-scoped; resets on server restart)
const characterStore = new Map<string, CharacterProfile>();

export class CharacterMemoryAgent {
  /**
   * Saves or updates a character profile.
   */
  static save(name: string, traits: string): void {
    characterStore.set(name.toLowerCase(), {
      name,
      traits,
      createdAt: Date.now(),
    });
  }

  /**
   * Retrieves a character profile by name.
   */
  static get(name: string): CharacterProfile | undefined {
    return characterStore.get(name.toLowerCase());
  }

  /**
   * Lists all known characters.
   */
  static list(): CharacterProfile[] {
    return Array.from(characterStore.values());
  }

  /**
   * Given a user prompt, detects any known character names and injects
   * their visual traits into the prompt string.
   */
  static injectTraits(prompt: string): string {
    let enriched = prompt;
    for (const [key, profile] of characterStore.entries()) {
      // Simple whole-word match (case-insensitive)
      const regex = new RegExp(`\\b${key}\\b`, "gi");
      if (regex.test(prompt)) {
        enriched += `, ${profile.name}: ${profile.traits}`;
      }
    }
    return enriched;
  }

  /**
   * Extracts character definition from a prompt like:
   * "save character Aria: long silver hair, violet eyes, cyberpunk suit"
   * Returns {name, traits} or null if no definition found.
   */
  static extractDefinition(prompt: string): { name: string; traits: string } | null {
    const match = prompt.match(/(?:save|remember|define)\s+(?:character\s+)?([A-Za-z]+)\s*[:\-]\s*(.+)/i);
    if (match) {
      return { name: match[1].trim(), traits: match[2].trim() };
    }
    return null;
  }
}
