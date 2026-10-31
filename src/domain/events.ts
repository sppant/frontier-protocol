export interface EventEffects {
  credits?: number;
  minerals?: number;
  research?: number;
  /** Added to every player colony's population (capped at capacity). */
  population?: number;
}

export interface EventChoice {
  id: string;
  label: string;
  description: string;
  effects: EventEffects;
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  choices: EventChoice[];
}

export const CHAPTERS = [
  'First Contact',
  'Expansion',
  'Competition',
  'The Signal',
  'Awakening',
  'Convergence',
] as const;

/** Story events fire in order once their day is reached. Index = story stage. */
export const STORY_SCHEDULE: { eventId: string; tick: number }[] = [
  { eventId: 'firstContact', tick: 1 },
  { eventId: 'colonialCharter', tick: 40 },
  { eventId: 'borderTensions', tick: 90 },
  { eventId: 'theSignal', tick: 150 },
  { eventId: 'awakening', tick: 220 },
  { eventId: 'convergence', tick: 300 },
];

export const STORY_EVENTS: EventDef[] = [
  {
    id: 'firstContact',
    title: 'First Contact',
    text: 'Survey probes confirm it: vast structures of unknown origin sit dormant across the nearby stars. Command calls them the Nexus. Your analysts ask how to proceed.',
    choices: [
      {
        id: 'scan',
        label: 'Fund long-range scans',
        description: '−30 credits, +20 research.',
        effects: { credits: -30, research: 20 },
      },
      {
        id: 'conserve',
        label: 'Conserve resources',
        description: '+40 credits.',
        effects: { credits: 40 },
      },
    ],
  },
  {
    id: 'colonialCharter',
    title: 'Colonial Charter',
    text: 'Settlers petition for a charter to expand beyond the capital. The treasury can subsidize their passage — or tax them for the privilege.',
    choices: [
      {
        id: 'subsidize',
        label: 'Subsidize settlers',
        description: '−50 credits, +2 population on every colony.',
        effects: { credits: -50, population: 2 },
      },
      {
        id: 'tax',
        label: 'Tax the colonists',
        description: '+60 credits.',
        effects: { credits: 60 },
      },
    ],
  },
  {
    id: 'borderTensions',
    title: 'Border Tensions',
    text: 'Rival fleets probe your frontier. The factions are racing for the same systems, and every claim matters.',
    choices: [
      {
        id: 'fortify',
        label: 'Divert minerals to border works',
        description: '−40 minerals, +30 research from the defensive survey data.',
        effects: { minerals: -40, research: 30 },
      },
      {
        id: 'envoys',
        label: 'Send trade envoys',
        description: '+50 credits.',
        effects: { credits: 50 },
      },
    ],
  },
  {
    id: 'theSignal',
    title: 'The Signal',
    text: 'A rhythmic pulse radiates from the nearest Nexus structure, repeating every 11.3 hours. It is not natural. It is not random. It is, perhaps, a greeting.',
    choices: [
      {
        id: 'decode',
        label: 'Commit labs to decoding',
        description: '−40 credits, +60 research.',
        effects: { credits: -40, research: 60 },
      },
      {
        id: 'ignore',
        label: 'Treat it as noise',
        description: '+40 minerals diverted to industry.',
        effects: { minerals: 40 },
      },
    ],
  },
  {
    id: 'awakening',
    title: 'Awakening',
    text: 'Across the galaxy, the dormant structures light up in unison. Gravity gauges swing wildly. The Nexus is waking — and it appears to be listening.',
    choices: [
      {
        id: 'study',
        label: 'Study the awakening',
        description: '+80 research.',
        effects: { research: 80 },
      },
      {
        id: 'exploit',
        label: 'Harvest the energy surge',
        description: '+80 credits, +40 minerals.',
        effects: { credits: 80, minerals: 40 },
      },
    ],
  },
  {
    id: 'convergence',
    title: 'Convergence',
    text: 'Every faction receives the same message at once. The Nexus was never abandoned — its builders are, in some sense, still here. Whoever attunes to the network first will shape what comes next.',
    choices: [
      {
        id: 'race',
        label: 'Redirect everything to the race',
        description: '+100 research.',
        effects: { research: 100 },
      },
      {
        id: 'consolidate',
        label: 'Consolidate your holdings',
        description: '+100 credits, +3 population on every colony.',
        effects: { credits: 100, population: 3 },
      },
    ],
  },
];

/** Minor events: drawn at random (seeded), each at most once per game. */
export const RANDOM_EVENTS: EventDef[] = [
  {
    id: 'derelictProbe',
    title: 'Derelict Probe',
    text: 'A centuries-old probe drifts into your space, its memory banks intact.',
    choices: [
      {
        id: 'download',
        label: 'Download its logs',
        description: '+35 research.',
        effects: { research: 35 },
      },
      {
        id: 'salvage',
        label: 'Salvage the hull',
        description: '+30 minerals.',
        effects: { minerals: 30 },
      },
    ],
  },
  {
    id: 'mineralWindfall',
    title: 'Mineral Windfall',
    text: 'Prospectors report a rich vein just beneath a surface settlement.',
    choices: [
      {
        id: 'mine',
        label: 'Open the vein at once',
        description: '+50 minerals.',
        effects: { minerals: 50 },
      },
      {
        id: 'license',
        label: 'Sell mining licenses',
        description: '+45 credits.',
        effects: { credits: 45 },
      },
    ],
  },
  {
    id: 'solarFlare',
    title: 'Solar Flare',
    text: 'A violent flare rakes your inner colonies. Repairs are costly, but the radiation data is valuable.',
    choices: [
      {
        id: 'repair',
        label: 'Repair immediately',
        description: '−30 credits.',
        effects: { credits: -30 },
      },
      {
        id: 'study',
        label: 'Study it, repair later',
        description: '−20 credits, +20 research.',
        effects: { credits: -20, research: 20 },
      },
    ],
  },
  {
    id: 'smugglers',
    title: 'Smuggler Fleet',
    text: 'A smuggler captain offers a quiet deal at the edge of your territory.',
    choices: [
      {
        id: 'buy',
        label: 'Buy their cargo',
        description: '−40 credits, +45 minerals.',
        effects: { credits: -40, minerals: 45 },
      },
      {
        id: 'decline',
        label: 'Decline politely',
        description: 'Nothing happens.',
        effects: {},
      },
    ],
  },
  {
    id: 'researchGrant',
    title: 'Research Grant',
    text: 'A university consortium offers funding for a joint project.',
    choices: [
      {
        id: 'accept',
        label: 'Accept the grant',
        description: '+30 research.',
        effects: { research: 30 },
      },
      {
        id: 'sponsor',
        label: 'Sponsor the consortium',
        description: '−25 credits, +2 population on every colony.',
        effects: { credits: -25, population: 2 },
      },
    ],
  },
];

export const EVENTS_BY_ID: Record<string, EventDef> = Object.fromEntries(
  [...STORY_EVENTS, ...RANDOM_EVENTS].map((e) => [e.id, e]),
);
