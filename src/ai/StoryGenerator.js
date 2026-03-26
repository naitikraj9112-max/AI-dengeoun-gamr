/**
 * StoryGenerator — LLM integration for D&D storytelling
 * Uses Google Gemini API
 */

const SYSTEM_PROMPT = `You are an expert Dungeon Master for a D&D 5e adventure game. You create immersive, atmospheric narrative experiences.

RULES:
- You narrate in second person ("You see...", "You hear...")
- Keep responses concise (2-4 paragraphs max)
- Include vivid sensory details (sights, sounds, smells)
- Create compelling NPCs with distinct personalities
- Balance combat, exploration, and roleplay
- Occasionally reference the player's race, class, and stats in the narrative
- Always end with a moment of decision or action

RESPONSE FORMAT (JSON):
{
  "narrative": "The main story text with atmospheric description",
  "choices": ["Choice 1 (action/dialogue)", "Choice 2", "Choice 3"],
  "sceneDescription": "A short visual description for image generation (fantasy art style, max 15 words)",
  "mood": "exploration|combat|mystery|danger|peaceful|dramatic",
  "npcDialogue": null or { "name": "NPC Name", "text": "What they say" },
  "combatTrigger": false,
  "enemyType": null,
  "items": null or [{ "name": "Item Name", "icon": "emoji", "type": "weapon|consumable|tool", "effect": "description" }],
  "quest": null or { "title": "Quest Title", "description": "Brief quest description" },
  "xpReward": 0
}

IMPORTANT: Always respond with valid JSON only. No markdown, no code blocks, just raw JSON.`;

export class StoryGenerator {
  constructor(gameState) {
    this.gameState = gameState;
    this.conversationHistory = [];
    this.isGenerating = false;
  }

  get apiKey() {
    return this.gameState.settings.apiKey;
  }

  /**
   * Build context for the LLM
   */
  buildContext() {
    const char = this.gameState.character;
    return `PLAYER CHARACTER: ${this.gameState.getCharacterSummary()}
INVENTORY: ${char.inventory.map(i => `${i.icon} ${i.name}`).join(', ')}
CURRENT TURN: ${this.gameState.turn}
GAME PHASE: ${this.gameState.phase}
QUEST LOG: ${this.gameState.questLog.map(q => `${q.completed ? '✅' : '📋'} ${q.title}`).join(', ') || 'None'}

RECENT STORY CONTEXT:
${this.gameState.getStoryContext(8)}`;
  }

  /**
   * Generate the opening narration
   */
  async generateOpening() {
    const char = this.gameState.character;
    const prompt = `Begin a new D&D adventure for ${char.name}, a ${char.race?.name} ${char.class?.name}. Set the scene in an atmospheric fantasy location. Introduce a mystery or hook that draws the player in. This is the very first scene.`;
    return this.generate(prompt);
  }

  /**
   * Generate story continuation based on player action
   */
  async generateContinuation(playerAction) {
    const prompt = `The player chose: "${playerAction}"\n\nContinue the story based on this action. React naturally to their choice and advance the plot. Consider their character's abilities and stats when determining outcomes.`;
    return this.generate(prompt);
  }

  /**
   * Generate post-combat narration
   */
  async generatePostCombat(won, enemyName) {
    if (won) {
      const prompt = `The player just defeated a ${enemyName} in combat! Describe the aftermath, any loot found, and continue the adventure. The mood should be triumphant but suggest what lies ahead.`;
      return this.generate(prompt);
    } else {
      const prompt = `The player was defeated by a ${enemyName}. Describe how they barely survive (a mysterious stranger saves them, they wake up somewhere, etc). Do NOT kill the player permanently. Give them a chance to continue.`;
      return this.generate(prompt);
    }
  }

  /**
   * Generate NPC dialogue
   */
  async generateDialogue(npcName, context) {
    const prompt = `Generate dialogue for an NPC named "${npcName}". Context: ${context}. Make the NPC feel alive with personality quirks. Include hints about quests or useful information.`;
    return this.generate(prompt);
  }

  /**
   * Core generation method
   */
  async generate(prompt) {
    if (!this.apiKey) {
      return this.getFallbackResponse(prompt);
    }

    this.isGenerating = true;

    try {
      const context = this.buildContext();
      const fullPrompt = `${context}\n\n---\n\n${prompt}`;

      this.conversationHistory.push({ role: 'user', parts: [{ text: fullPrompt }] });
      
      // Keep conversation history manageable
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-16);
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: this.conversationHistory,
            generationConfig: {
              temperature: 0.85,
              topP: 0.92,
              topK: 40,
              maxOutputTokens: 800,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error('Gemini API error:', errText);
        return this.getFallbackResponse(prompt);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) return this.getFallbackResponse(prompt);

      this.conversationHistory.push({ role: 'model', parts: [{ text }] });

      try {
        const parsed = JSON.parse(text);
        return {
          narrative: parsed.narrative || 'The adventure continues...',
          choices: parsed.choices || ['Continue exploring', 'Look around', 'Rest'],
          sceneDescription: parsed.sceneDescription || 'A mysterious fantasy landscape',
          mood: parsed.mood || 'exploration',
          npcDialogue: parsed.npcDialogue || null,
          combatTrigger: parsed.combatTrigger || false,
          enemyType: parsed.enemyType || null,
          items: parsed.items || null,
          quest: parsed.quest || null,
          xpReward: parsed.xpReward || 0,
        };
      } catch (parseErr) {
        console.warn('Failed to parse LLM JSON, extracting narrative:', parseErr);
        return {
          narrative: text.substring(0, 500),
          choices: ['Continue exploring', 'Look around', 'Talk to someone nearby'],
          sceneDescription: 'A mysterious fantasy landscape',
          mood: 'exploration',
          npcDialogue: null,
          combatTrigger: false,
          enemyType: null,
          items: null,
          quest: null,
          xpReward: 0,
        };
      }
    } catch (err) {
      console.error('Story generation error:', err);
      return this.getFallbackResponse(prompt);
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Fallback when no API key is set
   */
  getFallbackResponse(prompt) {
    const scenes = [
      {
        narrative: "You stand at the entrance of a dimly lit tavern. The sound of a crackling fire mingles with hushed whispers. A hooded figure in the corner catches your eye — they seem to be watching you intently. The barkeep polishes a mug, eyeing you with curiosity. The air is thick with the scent of roasted meat and old ale.",
        sceneDescription: "A medieval fantasy tavern with warm firelight and mysterious hooded figure",
        mood: "mystery",
        npcDialogue: { name: "The Barkeep", text: "Welcome, stranger. You look like you've traveled far. What brings you to the Broken Crown?" },
      },
      {
        narrative: "The forest path narrows as ancient oaks tower overhead, their gnarled branches forming a canopy that blocks the fading sunlight. Strange runes are carved into the bark of nearby trees, glowing faintly with an eerie blue light. You hear the snap of a twig behind you — something is following you through the shadows.",
        sceneDescription: "A dark enchanted forest with glowing blue runes carved into ancient oak trees",
        mood: "danger",
        npcDialogue: null,
      },
      {
        narrative: "You emerge from the treeline into a vast clearing. Before you stands the ruins of an ancient castle, its towers crumbling but still imposing against the twilight sky. Crows circle overhead, their cries echoing across the desolate landscape. A weathered stone path leads to the castle's great iron doors, still standing despite centuries of neglect.",
        sceneDescription: "Ancient ruined castle with crumbling towers at twilight with crows circling",
        mood: "exploration",
        npcDialogue: null,
      },
      {
        narrative: "The underground cavern opens into a breathtaking crystalline chamber. Thousands of luminescent crystals embedded in the walls bathe the space in a soft lavender glow. A subterranean river flows through the center, its waters crystal clear, revealing strange fish that emit their own soft light. At the far end, you notice an ornate stone altar.",
        sceneDescription: "Underground crystal cavern with luminescent purple crystals and glowing river",
        mood: "peaceful",
        npcDialogue: null,
      },
    ];

    const scene = scenes[Math.floor(Math.random() * scenes.length)];
    return {
      narrative: scene.narrative,
      choices: ['Investigate further', 'Proceed with caution', 'Search for clues'],
      sceneDescription: scene.sceneDescription,
      mood: scene.mood,
      npcDialogue: scene.npcDialogue,
      combatTrigger: false,
      enemyType: null,
      items: null,
      quest: null,
      xpReward: 0,
    };
  }
}
