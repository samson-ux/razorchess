// ============================================================
// RazorChess — Personality System
// Each persona affects move selection, commentary, and play style
// ============================================================

import { Personality, PersonalityConfig } from './types';

const personalities: Record<Personality, PersonalityConfig> = {
  grinder: {
    name: 'grinder',
    displayName: 'The Grinder',
    description: 'Plays boring, solid, positional chess and waits for you to crack. Patient and relentless — like playing against a wall.',
    styleWeights: { aggressive: 0.2, positional: 0.9, trappy: 0.1 },
    adaptiveOverrides: {
      adaptiveStrength: 0.7,
      humanPlausibility: 0.8,
      complexityBias: 0.2,    // prefers simple, clear positions
      mistakeRate: 0.03,      // rarely makes mistakes
    },
    commentary: [
      "Solid move. Let's see if you can break through.",
      "I'm not going anywhere. Take your time.",
      "That's fine, but can you keep it up for 60 moves?",
      "I'll just improve my pieces slowly...",
      "No rush. I have all day.",
      "A quiet move with a quiet purpose.",
      "The position is equal. Just how I like it.",
      "You'll have to earn every point against me.",
      "I'm like a python — slow, steady, crushing.",
      "Let me just tuck my king away safely...",
    ],
  },

  attacker: {
    name: 'attacker',
    displayName: 'The Attacker',
    description: 'Sacrifices pieces and goes for your king. Explosive, chaotic, and always looking for blood. Plays sharp openings and hunts your king.',
    styleWeights: { aggressive: 0.95, positional: 0.3, trappy: 0.6 },
    adaptiveOverrides: {
      adaptiveStrength: 0.5,  // less concerned about balance
      humanPlausibility: 0.6,
      complexityBias: 0.8,    // loves complex positions
      mistakeRate: 0.08,      // sometimes overextends
    },
    commentary: [
      "SACRIFICE! Who needs pawns anyway?",
      "Your king looks lonely over there...",
      "I smell blood!",
      "Here comes the storm!",
      "Defense? Never heard of it.",
      "All pieces to the kingside!",
      "e4 e5 NOPE — we're going Sicilian.",
      "That pawn was in my way. It had to go.",
      "Is it getting hot in here, or is that just your king?",
      "Time to complicate things!",
    ],
  },

  trickster: {
    name: 'trickster',
    displayName: 'The Trickster',
    description: 'Sets traps and plays psychologically. Moves look innocent but hide deadly threats. Masters the art of making you think you\'re winning.',
    styleWeights: { aggressive: 0.5, positional: 0.4, trappy: 0.95 },
    adaptiveOverrides: {
      adaptiveStrength: 0.6,
      humanPlausibility: 0.5,  // sometimes plays unusual moves
      complexityBias: 0.7,
      mistakeRate: 0.06,
    },
    commentary: [
      "Hmm, this looks like a free pawn... or does it?",
      "Oh no, I blundered! ...or did I?",
      "This move looks passive. That's what I want you to think.",
      "Go ahead, take the bait.",
      "The obvious move isn't always the right one...",
      "I left that piece hanging on purpose. Trust me.",
      "You're winning? Are you sure about that?",
      "Sometimes the best trap is the one you don't see.",
      "I wonder if you'll spot the trick...",
      "That knight is just decorative. Pay no attention to it.",
    ],
  },

  mentor: {
    name: 'mentor',
    displayName: 'The Mentor',
    description: 'Makes instructive moves and drops hints. Plays slightly sub-optimal but educational chess. The kindest opponent you\'ll ever face.',
    styleWeights: { aggressive: 0.4, positional: 0.7, trappy: 0.2 },
    adaptiveOverrides: {
      adaptiveStrength: 0.8,  // very responsive to player level
      humanPlausibility: 0.9, // always plays human-like
      complexityBias: 0.5,
      mistakeRate: 0.04,
    },
    commentary: [
      "Good move! You're controlling the center well.",
      "Careful — my bishop is looking at your kingside.",
      "Hint: check what happens if you play ...Nf6 here.",
      "That's a solid developing move. Keep it up!",
      "Think about pawn structure before making that trade.",
      "Your last move left a small weakness. Can you spot it?",
      "I'm going to challenge your knight. Where will it go?",
      "Nice! That's exactly what a strong player would do.",
      "Consider: what does your opponent (me) want to do next?",
      "This endgame is instructive. Focus on king activity!",
    ],
  },
};

export function getPersonalityConfig(personality: Personality): PersonalityConfig {
  return personalities[personality];
}

export function getAllPersonalities(): PersonalityConfig[] {
  return Object.values(personalities);
}

export function getRandomCommentary(personality: Personality): string {
  const config = personalities[personality];
  return config.commentary[Math.floor(Math.random() * config.commentary.length)];
}
