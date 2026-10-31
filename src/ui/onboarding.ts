const KEY = 'fp.tutorialSeen';

/** localStorage is a per-device convenience: never let it break the game. */
export function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}

export const TUTORIAL_STEPS: { title: string; body: string }[] = [
  {
    title: 'Welcome, Commander',
    body: 'The year is 2479 and an ancient network, the Nexus, has been found among the stars. The game starts paused: press ▶ Resume when you are ready. Use 1×, 2× or 4× to change speed, and pause any time to plan.',
  },
  {
    title: 'The galaxy map',
    body: 'Click a star to inspect it. Drag to rotate, scroll to zoom. Dim dots are unknown; systems next to your territory are detected and can be surveyed by sending an expedition. Switch to “Simple map” if the 3D view runs slowly.',
  },
  {
    title: 'Your economy',
    body: 'The top bar shows credits, minerals and research with their daily change. Minerals come only from Mining Complexes, so build one on your capital early. Research is spent on technologies; credits pay for everything else and for upkeep.',
  },
  {
    title: 'Expand before your rivals',
    body: 'Select an explored system and colonize habitable planets in or next to your territory. Three rival factions are doing the same, and most good planets are gone by around day 200. Controlling 8 of the 16 systems wins by Dominion.',
  },
  {
    title: 'Research, events and victory',
    body: 'The Research tab holds technologies; Objectives shows your three paths to victory and live standings. Story events pause time for a decision. Watch “Rival activity” in the feed to see what the other factions are doing and why.',
  },
];
