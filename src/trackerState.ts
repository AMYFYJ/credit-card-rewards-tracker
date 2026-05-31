export type TabId = 'dashboard' | 'setup' | 'bilt';
export type BiltMode = 'housing' | 'cash';

export type RewardsState = {
  quarterMonths: string;
  chaseCategories: string;
  discoverCategories: string;
  chaseActivated: boolean;
  discoverActivated: boolean;
  confirmedQuarterKey: string;
  reminderDismissedQuarterKey: string;
  biltSpend: number;
  biltRent: number;
  biltMode: BiltMode;
};

export type CachedRewardsDocument = {
  version: typeof CURRENT_STATE_VERSION;
  state: RewardsState;
  updatedAt: string;
  syncedAt: string | null;
};

export const CURRENT_STATE_VERSION = 2;
export const STORAGE_KEY = 'credit-card-rewards-tracker:v2';
export const LEGACY_STORAGE_KEY = 'credit-card-rewards-tracker:v1';
export const DEFAULT_RENT_AMOUNT = 1600;

export const DEFAULT_STATE: RewardsState = {
  quarterMonths: getCurrentQuarterMonths(),
  chaseCategories: 'Gas stations, EV charging, live entertainment',
  discoverCategories: 'Restaurants, wholesale clubs',
  chaseActivated: false,
  discoverActivated: false,
  confirmedQuarterKey: '',
  reminderDismissedQuarterKey: '',
  biltSpend: 0,
  biltRent: DEFAULT_RENT_AMOUNT,
  biltMode: 'housing',
};

export function getCurrentQuarterMonths(): string {
  const quarterMonths = [
    ['Jan', 'Feb', 'Mar'],
    ['Apr', 'May', 'Jun'],
    ['Jul', 'Aug', 'Sep'],
    ['Oct', 'Nov', 'Dec'],
  ];
  return quarterMonths[Math.floor(new Date().getMonth() / 3)].join(', ');
}

export function sanitizeSpend(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, numeric);
}

export function sanitizeRent(value: unknown): number {
  const numeric = sanitizeSpend(value);
  return numeric > 0 ? numeric : DEFAULT_RENT_AMOUNT;
}

export function normalizeRewardsState(value: unknown): RewardsState {
  const parsed =
    value && typeof value === 'object' ? (value as Partial<RewardsState>) : DEFAULT_STATE;

  return {
    ...DEFAULT_STATE,
    ...parsed,
    quarterMonths: getCurrentQuarterMonths(),
    biltSpend: sanitizeSpend(parsed.biltSpend),
    biltRent: sanitizeRent(parsed.biltRent),
    biltMode: parsed.biltMode === 'cash' ? 'cash' : 'housing',
    chaseActivated: Boolean(parsed.chaseActivated),
    discoverActivated: Boolean(parsed.discoverActivated),
    confirmedQuarterKey: parsed.confirmedQuarterKey ?? '',
    reminderDismissedQuarterKey: parsed.reminderDismissedQuarterKey ?? '',
  };
}

export function loadCachedDocument(): CachedRewardsDocument {
  const currentDocument = readCachedDocument(STORAGE_KEY);
  if (currentDocument) {
    return currentDocument;
  }

  const legacyDocument = readLegacyDocument();
  if (legacyDocument) {
    saveCachedDocument(legacyDocument);
    return legacyDocument;
  }

  return createCachedDocument(DEFAULT_STATE);
}

export function saveCachedDocument(document: CachedRewardsDocument): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
}

export function cacheState(
  state: RewardsState,
  updatedAt = new Date().toISOString(),
  syncedAt: string | null = null,
): CachedRewardsDocument {
  const document = createCachedDocument(state, updatedAt, syncedAt);
  saveCachedDocument(document);
  return document;
}

export function createCachedDocument(
  state: RewardsState,
  updatedAt = new Date().toISOString(),
  syncedAt: string | null = null,
): CachedRewardsDocument {
  return {
    version: CURRENT_STATE_VERSION,
    state: normalizeRewardsState(state),
    updatedAt: normalizeIsoDate(updatedAt),
    syncedAt: syncedAt ? normalizeIsoDate(syncedAt) : null,
  };
}

function readCachedDocument(key: string): CachedRewardsDocument | null {
  try {
    const saved = window.localStorage.getItem(key);
    if (!saved) {
      return null;
    }

    const parsed = JSON.parse(saved) as Partial<CachedRewardsDocument>;
    if (!parsed.state) {
      return null;
    }

    return createCachedDocument(parsed.state, parsed.updatedAt, parsed.syncedAt ?? null);
  } catch {
    return null;
  }
}

function readLegacyDocument(): CachedRewardsDocument | null {
  try {
    const saved = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!saved) {
      return null;
    }

    return createCachedDocument(JSON.parse(saved));
  } catch {
    return null;
  }
}

function normalizeIsoDate(value: unknown): string {
  if (typeof value !== 'string') {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}
