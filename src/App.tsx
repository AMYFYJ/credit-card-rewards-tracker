import { type CSSProperties, type FormEvent, useEffect, useMemo, useState } from 'react';
import { UserRound, X } from 'lucide-react';
import {
  DEFAULT_RENT_AMOUNT,
  loadCachedDocument,
  sanitizeSpend,
  type BiltMode,
  type RewardsState,
  type TabId,
} from './trackerState';
import { useTrackerSync, type TrackerSync } from './useTrackerSync';

type HousingTier = {
  label: string;
  ratio: number;
  multiplier: number;
};

type ProgressTick = {
  id: string;
  left: number;
  label: string;
  on: boolean;
};

type CategorySuggestion = {
  key: string;
  quarterMonths: string;
  chaseCategories: string[];
  discoverCategories: string[];
  chaseSource: string;
  chaseSourceUrl: string;
  discoverSource: string;
  discoverSourceUrl: string;
};

type AlwaysOnReward = {
  label: string;
  rate: string;
  icon: string;
};

const BILT_CASH_RATE = 0.04;
const BILT_CASH_PER_POINT = 0.03;

const tabs: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'bilt', label: 'Bilt', icon: 'bilt' },
  { id: 'setup', label: 'Quarterly', icon: 'percent' },
];

/* ── inline icon set (ported from the Flavor A design handoff) ── */
const ICONS: Record<string, string> = {
  dashboard:
    '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  bilt: '<rect x="4" y="4" width="16" height="16" rx="1.6"/><line x1="4" y1="9.3" x2="20" y2="9.3"/><line x1="4" y1="14" x2="20" y2="14"/><line x1="9.2" y1="4" x2="9.2" y2="9.3"/><line x1="14.6" y1="9.3" x2="14.6" y2="14"/><line x1="10.8" y1="14" x2="10.8" y2="20"/>',
  percent:
    '<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  plane:
    '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  heart:
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.49 4.04 3 5.5l7 7Z"/>',
  utensils:
    '<path d="M3 2v7c0 1.1.9 2 2 2a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  store:
    '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  dollar:
    '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  /* extra icons for editable categories beyond the mock's fixed set */
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  fuel: '<line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>',
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
};

function Icon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] || '' }}
    />
  );
}

const housingTiers: HousingTier[] = [
  { label: '25%', ratio: 0.25, multiplier: 0.5 },
  { label: '50%', ratio: 0.5, multiplier: 0.75 },
  { label: '75%', ratio: 0.75, multiplier: 1 },
  { label: '100%', ratio: 1, multiplier: 1.25 },
];

const categorySuggestions: Record<string, CategorySuggestion> = {
  '2026-Q2': {
    key: '2026-Q2',
    quarterMonths: 'Apr, May, Jun',
    chaseCategories: ['Amazon', 'Whole Foods Market', 'Chase Travel', 'Feeding America'],
    discoverCategories: ['Restaurants', 'Home improvement stores'],
    chaseSource: 'Chase',
    chaseSourceUrl: 'https://www.chase.com/personal/credit-cards/freedom/flex',
    discoverSource: 'Doctor of Credit',
    discoverSourceUrl:
      'https://www.doctorofcredit.com/discover-q2-2026-5-categories-restaurants-home-improvement-stores/',
  },
};

const alwaysOnRewards: Array<{
  cardName: string;
  rewards: AlwaysOnReward[];
}> = [
  {
    cardName: 'Chase Freedom Flex',
    rewards: [
      { label: 'Chase Travel', rate: '5%', icon: 'plane' },
      { label: 'Dining', rate: '3%', icon: 'utensils' },
      { label: 'Drugstores', rate: '3%', icon: 'store' },
      { label: 'Lyft', rate: '2%', icon: 'car' },
      { label: 'Else', rate: '1%', icon: 'tag' },
    ],
  },
  {
    cardName: 'Discover',
    rewards: [{ label: 'All purchases', rate: '1%', icon: 'dollar' }],
  },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function getCurrentMonthName(): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date());
}

function getCurrentQuarterKey(): string {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()}-Q${quarter}`;
}

function getQuarterRange(months: string): string {
  const parts = months
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return months;
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return `${parts[0]}–${parts[parts.length - 1]}`;
}

function splitCategories(value: string): string[] {
  return value
    .split(',')
    .map((category) => category.trim())
    .filter(Boolean);
}

function toTitleCase(value: string): string {
  return value.replace(/\S+/g, (word) => {
    if (/^[A-Z]{2,}$/.test(word)) {
      return word;
    }
    return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
  });
}

function getSpendNeeded(rent: number, ratio: number) {
  return rent * ratio;
}

function getTierPoints(rent: number, multiplier: number) {
  return Math.round(rent * multiplier);
}

function getHousingProgress(spend: number, rent: number) {
  const unlockedTier = [...housingTiers]
    .reverse()
    .find((tier) => spend >= getSpendNeeded(rent, tier.ratio));
  const nextTier = housingTiers.find((tier) => spend < getSpendNeeded(rent, tier.ratio));
  const progressPercent = rent > 0 ? Math.min((spend / rent) * 100, 100) : 0;

  return {
    progressPercent,
    currentTier: unlockedTier ?? null,
    nextTier: nextTier ?? null,
    rentPoints: unlockedTier ? getTierPoints(rent, unlockedTier.multiplier) : 250,
  };
}

function getBiltCashProgress(spend: number, rent: number) {
  const biltCashEarned = spend * BILT_CASH_RATE;
  const fullUnlockCashNeeded = rent * BILT_CASH_PER_POINT;
  const spendNeededForFullUnlock = fullUnlockCashNeeded / BILT_CASH_RATE;
  const remainingSpendNeeded = Math.max(spendNeededForFullUnlock - spend, 0);
  const rentPoints = Math.min(rent, Math.floor(biltCashEarned / BILT_CASH_PER_POINT));
  const biltCashUsed = Math.min(biltCashEarned, fullUnlockCashNeeded);
  const remainingCashNeeded = Math.max(fullUnlockCashNeeded - biltCashEarned, 0);
  const leftoverBiltCash = Math.max(biltCashEarned - fullUnlockCashNeeded, 0);

  return {
    biltCashEarned,
    biltCashUsed,
    fullUnlockCashNeeded,
    leftoverBiltCash,
    remainingCashNeeded,
    remainingSpendNeeded,
    spendNeededForFullUnlock,
    progressPercent:
      fullUnlockCashNeeded > 0 ? Math.min((biltCashEarned / fullUnlockCashNeeded) * 100, 100) : 0,
    rentPoints,
  };
}

/* multiplication sign helper to match the mock's "0.75×" typography */
function mult(value: number): string {
  return `${value}×`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [state, setState] = useState<RewardsState>(() => loadCachedDocument().state);
  const sync = useTrackerSync(state, setState);
  const monthName = useMemo(() => getCurrentMonthName(), []);
  const currentQuarterKey = useMemo(() => getCurrentQuarterKey(), []);
  const currentQuarterSuggestion = categorySuggestions[currentQuarterKey] ?? null;
  const effectiveBiltRent = state.biltRent > 0 ? state.biltRent : DEFAULT_RENT_AMOUNT;
  const housingProgress = useMemo(
    () => getHousingProgress(state.biltSpend, effectiveBiltRent),
    [effectiveBiltRent, state.biltSpend],
  );
  const shouldShowQuarterReminder =
    state.confirmedQuarterKey !== currentQuarterKey &&
    state.reminderDismissedQuarterKey !== currentQuarterKey;

  useEffect(() => {
    if (!currentQuarterSuggestion || state.confirmedQuarterKey === currentQuarterSuggestion.key) {
      return;
    }

    setState((current) => ({
      ...current,
      quarterMonths: currentQuarterSuggestion.quarterMonths,
      chaseCategories: currentQuarterSuggestion.chaseCategories.join(', '),
      discoverCategories: currentQuarterSuggestion.discoverCategories.join(', '),
      chaseActivated: false,
      discoverActivated: false,
      confirmedQuarterKey: '',
      reminderDismissedQuarterKey:
        current.reminderDismissedQuarterKey === currentQuarterSuggestion.key
          ? ''
          : current.reminderDismissedQuarterKey,
    }));
  }, [currentQuarterSuggestion, state.confirmedQuarterKey]);

  const updateState = <Key extends keyof RewardsState>(key: Key, value: RewardsState[Key]) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  return (
    <main className="app-shell">
      {shouldShowQuarterReminder && (
        <QuarterReminderModal
          quarterMonths={state.quarterMonths}
          onReview={() => {
            updateState('reminderDismissedQuarterKey', currentQuarterKey);
            setActiveTab('setup');
          }}
          onDismiss={() => updateState('reminderDismissedQuarterKey', currentQuarterKey)}
        />
      )}

      <div className="screen-scroll">
        {activeTab === 'dashboard' && (
          <Dashboard
            monthName={monthName}
            state={state}
            housingProgress={housingProgress}
            sync={sync}
            onOpenSync={() => setIsSyncOpen(true)}
          />
        )}
        {activeTab === 'setup' && (
          <QuarterlySetup
            state={state}
            updateState={updateState}
            suggestion={currentQuarterSuggestion}
          />
        )}
        {activeTab === 'bilt' && (
          <BiltTracker
            spend={state.biltSpend}
            rent={state.biltRent}
            mode={state.biltMode}
            housingProgress={housingProgress}
            onSpendChange={(value) => updateState('biltSpend', sanitizeSpend(value))}
            onRentChange={(value) => updateState('biltRent', sanitizeSpend(value))}
            onModeChange={(value) => updateState('biltMode', value)}
          />
        )}
      </div>

      {isSyncOpen && <SyncDialog sync={sync} onClose={() => setIsSyncOpen(false)} />}

      <nav className="tabbar" aria-label="Primary navigation">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              type="button"
              className={isActive ? 'tab on' : 'tab'}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon name={tab.icon} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}

function QuarterReminderModal({
  quarterMonths,
  onReview,
  onDismiss,
}: {
  quarterMonths: string;
  onReview: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="quarter-reminder-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quarter-reminder-title"
      >
        <p className="eyebrow">New quarter</p>
        <h2 id="quarter-reminder-title">Activate 5% categories</h2>
        <p>
          Review the {getQuarterRange(quarterMonths)} rotating categories, edit anything that looks
          off, then confirm after activating Chase and Discover.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onDismiss}>
            Later
          </button>
          <button type="button" className="btn" onClick={onReview}>
            Review now
          </button>
        </div>
      </section>
    </div>
  );
}

/* progress bar with tier ticks + optional best-value marker */
function Progress({
  percent,
  ticks,
  hero,
  recAt,
}: {
  percent: number;
  ticks: ProgressTick[];
  hero?: boolean;
  recAt?: number;
}) {
  return (
    <div className="progress">
      {!hero && <span className="progress-cap">Spend progress</span>}
      <div className="track">
        <div className="fill" style={{ width: `${percent}%` }} />
        {recAt != null && <span className="rec-line" style={{ left: `${recAt}%` }} />}
      </div>
      <div className="ticks">
        {ticks.map((tick, index) => (
          <span
            key={tick.id}
            className={[
              'tick-lab',
              tick.on ? 'on' : '',
              index === 0 ? 'first' : '',
              index === ticks.length - 1 ? 'end' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ '--tick-left': `${tick.left}%` } as CSSProperties}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function buildTicks(spend: number, rent: number) {
  return housingTiers.map((tier) => ({
    id: tier.label,
    left: tier.ratio * 100,
    label: formatCurrency(getSpendNeeded(rent, tier.ratio)),
    on: spend >= getSpendNeeded(rent, tier.ratio),
  }));
}

function Dashboard({
  monthName,
  state,
  housingProgress,
  sync,
  onOpenSync,
}: {
  monthName: string;
  state: RewardsState;
  housingProgress: ReturnType<typeof getHousingProgress>;
  sync: TrackerSync;
  onOpenSync: () => void;
}) {
  const rent = state.biltRent > 0 ? state.biltRent : DEFAULT_RENT_AMOUNT;
  const tierLabel = housingProgress.currentTier
    ? `${mult(housingProgress.currentTier.multiplier)} tier`
    : 'base tier';
  const nextLabel = housingProgress.nextTier
    ? `${formatCurrency(
        getSpendNeeded(rent, housingProgress.nextTier.ratio) - state.biltSpend,
      )} to ${mult(housingProgress.nextTier.multiplier)}`
    : 'Top tier reached';

  return (
    <>
      <header className="scr-head dashboard-head">
        <div>
          <p className="eyebrow">Overview</p>
          <h1 className="scr-title">{monthName}</h1>
        </div>
        <button
          type="button"
          className={`sync-trigger ${sync.status === 'error' ? 'warn' : ''}`}
          onClick={onOpenSync}
          aria-label={`Open account sync (${getSyncStatusLabel(sync.status)})`}
        >
          <UserRound size={18} aria-hidden="true" />
          <span className={`sync-dot ${sync.status}`} aria-hidden="true" />
        </button>
      </header>

      <section className="card hero">
        <div className="card-head">
          <div className="stack" style={{ gap: 5 }}>
            <p className="eyebrow">Bilt spend</p>
            <div className="hero-amount">{formatCurrency(state.biltSpend)}</div>
          </div>
        </div>
        <p className="hero-sub">
          <b>{housingProgress.rentPoints.toLocaleString()} rent pts</b> &middot; {tierLabel} &middot;{' '}
          <b>{nextLabel}</b>
        </p>
        <Progress
          percent={housingProgress.progressPercent}
          ticks={buildTicks(state.biltSpend, rent)}
          hero
        />
      </section>

      <section className="card">
        <div className="card-head">
          <div className="stack">
            <p className="eyebrow">Quarterly rotating</p>
            <h2 className="card-title">5% cash back</h2>
          </div>
          <span className="tag">{getQuarterRange(state.quarterMonths) || 'Not set'}</span>
        </div>
        <Reward
          name="Chase Freedom Flex"
          activated={state.chaseActivated}
          categories={state.chaseCategories}
        />
        <Reward
          name="Discover"
          activated={state.discoverActivated}
          categories={state.discoverCategories}
        />
      </section>
    </>
  );
}

function SyncDialog({ sync, onClose }: { sync: TrackerSync; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="sync-backdrop" role="presentation" onClick={onClose}>
      <section
        className="sync-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="icon-btn close" onClick={onClose} aria-label="Close sync">
          <X size={17} aria-hidden="true" />
        </button>
        <SyncPanel sync={sync} titleId="sync-dialog-title" />
      </section>
    </div>
  );
}

function SyncPanel({ sync, titleId }: { sync: TrackerSync; titleId?: string }) {
  const [email, setEmail] = useState(sync.userEmail ?? '');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (sync.userEmail) {
      setEmail(sync.userEmail);
    }
  }, [sync.userEmail]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!canSubmitAuth(trimmedEmail, password, sync)) {
      return;
    }

    void sync.signInWithPassword(trimmedEmail, password);
  };

  const handleCreateAccount = () => {
    const trimmedEmail = email.trim();
    if (!canSubmitAuth(trimmedEmail, password, sync)) {
      return;
    }

    void sync.signUpWithPassword(trimmedEmail, password);
  };

  const statusLabel = getSyncStatusLabel(sync.status);
  const canSubmit = canSubmitAuth(email.trim(), password, sync);

  return (
    <div className="sync-card">
      <div className="card-head">
        <div className="stack">
          <p className="eyebrow">Account</p>
          <h2 className="card-title" id={titleId}>
            Sync
          </h2>
        </div>
        <span className={sync.status === 'error' ? 'tag warn' : 'tag ok'}>{statusLabel}</span>
      </div>

      {sync.userEmail ? (
        <>
          <div className="sync-detail">
            <span>{sync.userEmail}</span>
            <b>{formatSyncTime(sync.lastSavedAt)}</b>
          </div>
          <button type="button" className="btn ghost" onClick={() => void sync.signOut()}>
            Sign out
          </button>
        </>
      ) : (
        <form className="sync-form" onSubmit={handleSubmit}>
          <div className="sync-fields">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
              disabled={!sync.isConfigured || sync.isSubmittingAuth}
            />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              aria-label="Password"
              minLength={6}
              disabled={!sync.isConfigured || sync.isSubmittingAuth}
            />
          </div>
          <div className="sync-actions">
            <button type="submit" className="btn" disabled={!canSubmit}>
              {sync.isSubmittingAuth ? 'Signing in' : 'Sign in'}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={handleCreateAccount}
              disabled={!canSubmit}
            >
              Create account
            </button>
          </div>
        </form>
      )}

      {sync.message && (
        <p className={sync.status === 'error' ? 'sync-note error' : 'sync-note'}>
          {sync.message}
        </p>
      )}
    </div>
  );
}

function canSubmitAuth(email: string, password: string, sync: TrackerSync): boolean {
  return Boolean(email && password.length >= 6 && sync.isConfigured && !sync.isSubmittingAuth);
}

function getSyncStatusLabel(status: TrackerSync['status']): string {
  const labels: Record<TrackerSync['status'], string> = {
    'sign-in': 'Sign in',
    saving: 'Saving',
    saved: 'Saved',
    offline: 'Offline',
    error: 'Sync error',
  };

  return labels[status];
}

function formatSyncTime(value: string | null): string {
  if (!value) {
    return 'Not synced';
  }

  return `Saved ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))}`;
}

function Reward({
  name,
  activated,
  categories,
}: {
  name: string;
  activated: boolean;
  categories: string;
}) {
  const categoryList = splitCategories(categories);
  const two = categoryList.length > 0 && categoryList.length <= 2;

  return (
    <article className={activated ? 'reward on' : 'reward'}>
      <div className="reward-head">
        <h4 className="reward-name">{name}</h4>
        <span className={activated ? 'pill ok' : 'pill'}>
          {activated ? 'Confirmed' : 'Unconfirmed'}
        </span>
      </div>
      {categoryList.length > 0 ? (
        <div className={two ? 'tiles two' : 'tiles'}>
          {categoryList.map((category) => (
            <div className="tile" key={category}>
              <span className="tile-ic">
                <Icon name={getCategoryIcon(category)} />
              </span>
              <span>{toTitleCase(category)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="fine">Add categories in Quarterly</p>
      )}
    </article>
  );
}

function getCategoryIcon(category: string): string {
  const normalized = category.toLowerCase();

  if (normalized.includes('ev') || normalized.includes('charging')) {
    return 'zap';
  }
  if (normalized.includes('amazon')) {
    return 'bag';
  }
  if (normalized.includes('whole foods')) {
    return 'leaf';
  }
  if (normalized.includes('feeding america') || normalized.includes('charity')) {
    return 'heart';
  }
  if (normalized.includes('home improvement') || normalized.includes('home')) {
    return 'home';
  }
  if (normalized.includes('cash') || normalized.includes('pay')) {
    return 'dollar';
  }
  if (normalized.includes('gas') || normalized.includes('fuel')) {
    return 'fuel';
  }
  if (normalized.includes('restaurant') || normalized.includes('dining')) {
    return 'utensils';
  }
  if (
    normalized.includes('entertainment') ||
    normalized.includes('music') ||
    normalized.includes('live')
  ) {
    return 'music';
  }
  if (normalized.includes('grocery')) {
    return 'cart';
  }
  if (
    normalized.includes('wholesale') ||
    normalized.includes('club') ||
    normalized.includes('drugstore')
  ) {
    return 'store';
  }
  if (normalized.includes('travel') || normalized.includes('flight')) {
    return 'plane';
  }
  if (normalized.includes('lyft') || normalized.includes('uber')) {
    return 'car';
  }
  if (normalized.includes('shop')) {
    return 'bag';
  }
  return 'tag';
}

function QuarterlySetup({
  state,
  updateState,
  suggestion,
}: {
  state: RewardsState;
  updateState: <Key extends keyof RewardsState>(key: Key, value: RewardsState[Key]) => void;
  suggestion: CategorySuggestion | null;
}) {
  const isConfirmed = state.chaseActivated && state.discoverActivated;

  const confirmCategories = () => {
    updateState('confirmedQuarterKey', suggestion ? suggestion.key : getCurrentQuarterKey());
    updateState('chaseActivated', true);
    updateState('discoverActivated', true);
    updateState('reminderDismissedQuarterKey', getCurrentQuarterKey());
  };

  const editAgain = () => {
    updateState('chaseActivated', false);
    updateState('discoverActivated', false);
    updateState('confirmedQuarterKey', '');
    updateState('reminderDismissedQuarterKey', getCurrentQuarterKey());
  };

  return (
    <>
      <header className="scr-head">
        <p className="eyebrow">Rotating categories</p>
        <h1 className="scr-title">{getQuarterRange(state.quarterMonths)}</h1>
      </header>

      <section className="card">
        <div className="card-head">
          <div className="stack">
            <h2 className="card-title">Quarterly rotating</h2>
            <p className="fine">
              {isConfirmed
                ? 'These 5% categories are locked for the quarter.'
                : 'Edit if needed, then confirm after activating both cards.'}
            </p>
          </div>
          <button
            type="button"
            className={isConfirmed ? 'btn ghost' : 'btn'}
            onClick={isConfirmed ? editAgain : confirmCategories}
          >
            {isConfirmed ? 'Edit' : 'Confirm'}
          </button>
        </div>

        {isConfirmed ? (
          <>
            <Reward
              name="Chase Freedom Flex"
              activated={state.chaseActivated}
              categories={state.chaseCategories}
            />
            <Reward
              name="Discover"
              activated={state.discoverActivated}
              categories={state.discoverCategories}
            />
          </>
        ) : (
          <>
            {suggestion && (
              <div className="suggest">
                <SuggestionRow
                  label="Chase"
                  categories={splitCategories(state.chaseCategories)}
                  source={suggestion.chaseSource}
                  sourceUrl={suggestion.chaseSourceUrl}
                />
                <SuggestionRow
                  label="Discover"
                  categories={splitCategories(state.discoverCategories)}
                  source={suggestion.discoverSource}
                  sourceUrl={suggestion.discoverSourceUrl}
                />
              </div>
            )}
            <label className="field">
              <span>Chase Freedom Flex</span>
              <textarea
                value={state.chaseCategories}
                onChange={(event) => updateState('chaseCategories', event.target.value)}
                placeholder="Gas stations, EV charging"
                rows={3}
              />
            </label>
            <label className="field">
              <span>Discover</span>
              <textarea
                value={state.discoverCategories}
                onChange={(event) => updateState('discoverCategories', event.target.value)}
                placeholder="Restaurants, grocery stores"
                rows={3}
              />
            </label>
          </>
        )}
      </section>

      {isConfirmed && (
        <section className="card">
          <div className="card-head">
            <div className="stack">
              <p className="eyebrow">Always on</p>
              <h2 className="card-title">Outside the rotation</h2>
            </div>
          </div>
          {alwaysOnRewards.map((bank) => (
            <div className="bank" key={bank.cardName}>
              <strong>{bank.cardName}</strong>
              <div className="bank-grid">
                {bank.rewards.map((reward) => (
                  <div className="bank-cell" key={`${bank.cardName}-${reward.label}`}>
                    <span className="ic">
                      <Icon name={reward.icon} />
                    </span>
                    <span className="rate">{reward.rate}</span>
                    <span className="nm">{toTitleCase(reward.label)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function SuggestionRow({
  label,
  categories,
  source,
  sourceUrl,
}: {
  label: string;
  categories: string[];
  source: string;
  sourceUrl: string;
}) {
  return (
    <article className="suggest-row">
      <div className="row-top">
        <strong>{label}</strong>
        <a href={sourceUrl} target="_blank" rel="noreferrer">
          {source}
        </a>
      </div>
      <p>{categories.map(toTitleCase).join(', ')}</p>
    </article>
  );
}

function BiltTracker({
  spend,
  rent,
  mode,
  housingProgress,
  onSpendChange,
  onRentChange,
  onModeChange,
}: {
  spend: number;
  rent: number;
  mode: BiltMode;
  housingProgress: ReturnType<typeof getHousingProgress>;
  onSpendChange: (value: number) => void;
  onRentChange: (value: number) => void;
  onModeChange: (value: BiltMode) => void;
}) {
  const effectiveRent = rent > 0 ? rent : DEFAULT_RENT_AMOUNT;
  const biltCashProgress = useMemo(
    () => getBiltCashProgress(spend, effectiveRent),
    [effectiveRent, spend],
  );
  const housingPoints = housingProgress.rentPoints;
  const biltCashPoints = biltCashProgress.rentPoints;
  const currentLabel = housingProgress.currentTier
    ? `${mult(housingProgress.currentTier.multiplier)} on rent`
    : 'Base rent points';
  const nextLabel = housingProgress.nextTier
    ? `${formatCurrency(
        getSpendNeeded(effectiveRent, housingProgress.nextTier.ratio) - spend,
      )} to ${mult(housingProgress.nextTier.multiplier)}`
    : 'Top tier reached';
  const biltCashFullUnlockLabel =
    biltCashProgress.remainingCashNeeded > 0
      ? formatCurrency(biltCashProgress.remainingCashNeeded)
      : `${formatCurrency(biltCashProgress.leftoverBiltCash)} BC left`;
  const biltCashSpendGapLabel =
    biltCashProgress.remainingSpendNeeded > 0
      ? formatCurrency(biltCashProgress.remainingSpendNeeded)
      : 'Full unlock reached';
  const biltCashStatusLabel =
    biltCashProgress.rentPoints >= effectiveRent
      ? `${mult(1)} on rent unlocked`
      : `Partial ${mult(1)} unlock`;

  return (
    <>
      <header className="scr-head">
        <p className="eyebrow">Rent rewards</p>
        <h1 className="scr-title">Bilt</h1>
      </header>

      <div className="amount-form">
        <AmountField
          label="Non-housing spend"
          value={spend}
          onValueChange={onSpendChange}
          ariaLabel="Current month Bilt non-housing spend"
        />
        <AmountField
          label="Rent"
          value={rent}
          onValueChange={onRentChange}
          ariaLabel="Current month rent amount"
        />
      </div>

      <div className="seg" role="group" aria-label="Bilt earning mode">
        <button
          type="button"
          className={mode === 'housing' ? 'on' : ''}
          onClick={() => onModeChange('housing')}
          aria-pressed={mode === 'housing'}
        >
          Housing-only
        </button>
        <button
          type="button"
          className={mode === 'cash' ? 'on' : ''}
          onClick={() => onModeChange('cash')}
          aria-pressed={mode === 'cash'}
        >
          Bilt Cash
        </button>
      </div>

      <div className="compare" aria-label="Rent points unlocked by mode">
        <div className={mode === 'housing' ? 'compare-cell on' : 'compare-cell'}>
          <span className="lab">Housing-only</span>
          <span className="big">{housingPoints.toLocaleString()} pts</span>
        </div>
        <div className={mode === 'cash' ? 'compare-cell on' : 'compare-cell'}>
          <span className="lab">Bilt Cash</span>
          <span className="big">{biltCashPoints.toLocaleString()} pts</span>
        </div>
      </div>

      {mode === 'housing' ? (
        <>
          <section className="card">
            <div className="card-head">
              <div className="stack">
                <p className="eyebrow">Housing-only</p>
                <h2 className="card-title">
                  {housingPoints.toLocaleString()} rent points unlocked
                </h2>
              </div>
              <span className="tag ok">{currentLabel}</span>
            </div>
            <Progress
              percent={housingProgress.progressPercent}
              ticks={buildTicks(spend, effectiveRent)}
              recAt={50}
            />
            <div className="metrics">
              <div className="metric">
                <span className="lab">Next step</span>
                <span className="val">{nextLabel}</span>
              </div>
              <div className="metric">
                <span className="lab">Best-value target</span>
                <span className="val">{formatCurrency(getSpendNeeded(effectiveRent, 0.5))}</span>
              </div>
            </div>
          </section>

          <section className="tiers" aria-label="Housing-only tiers">
            {housingTiers.map((tier) => {
              const reached = spend >= getSpendNeeded(effectiveRent, tier.ratio);
              return (
                <div className={reached ? 'tier hit' : 'tier'} key={tier.ratio}>
                  <span>{tier.label} spend</span>
                  <b>
                    {formatCurrency(getSpendNeeded(effectiveRent, tier.ratio))} &rarr;{' '}
                    {mult(tier.multiplier)}
                  </b>
                </div>
              );
            })}
          </section>

          <p className="fine">
            Housing-only skips 4% Bilt Cash and applies an automatic rent multiplier after statement
            close.
          </p>
        </>
      ) : (
        <>
          <section className="card">
            <div className="card-head">
              <div className="stack">
                <p className="eyebrow">Flexible Bilt Cash</p>
                <h2 className="card-title">To unlock {mult(1)} on rent</h2>
              </div>
              <span className="tag ok">{biltCashStatusLabel}</span>
            </div>
            <div className="metrics">
              <div className="metric">
                <span className="lab">BC still needed</span>
                <span className="val">{biltCashFullUnlockLabel}</span>
              </div>
              <div className="metric">
                <span className="lab">Spend still needed</span>
                <span className="val">{biltCashSpendGapLabel}</span>
              </div>
            </div>
            <div className="progress">
              <div className="track">
                <div className="fill" style={{ width: `${biltCashProgress.progressPercent}%` }} />
              </div>
              <div className="bar-cap">
                <span>{formatCurrency(biltCashProgress.biltCashEarned)} BC earned</span>
                <span>
                  {formatCurrency(biltCashProgress.fullUnlockCashNeeded)} BC for {mult(1)} rent
                </span>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="row">
              <span>Rent points unlocked</span>
              <b>{biltCashPoints.toLocaleString()} pts</b>
            </div>
            <div className="row">
              <span>Maximum rent points</span>
              <b>{effectiveRent.toLocaleString()} pts</b>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <p className="eyebrow">Conversion</p>
              <div className="conv">
                <div className="conv-row">
                  <span>Bilt Cash earned</span>
                  <b>4% of spend</b>
                </div>
                <div className="conv-row">
                  <span>Rent points unlocked</span>
                  <b>$3 Bilt Cash = 100 pts</b>
                </div>
              </div>
            </div>
          </section>

          <p className="fine">
            Bilt Cash mode earns 4% back on non-housing spend, then applies Bilt Cash to unlock up to{' '}
            {mult(1)} points on rent.
          </p>
        </>
      )}
    </>
  );
}

function AmountField({
  label,
  value,
  onValueChange,
  ariaLabel,
  emptyValue = 0,
}: {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  ariaLabel: string;
  emptyValue?: number;
}) {
  const [inputValue, setInputValue] = useState(value === 0 ? '' : String(value));

  useEffect(() => {
    setInputValue(value === 0 ? '' : String(value));
  }, [value]);

  const handleInputChange = (nextValue: string) => {
    if (!/^\d*\.?\d*$/.test(nextValue)) {
      return;
    }

    setInputValue(nextValue);
    onValueChange(nextValue === '' ? emptyValue : Number(nextValue));
  };

  return (
    <label className="amount">
      <span>{label}</span>
      <div className="amount-val">
        <span className="cur">$</span>
        <input
          className="num"
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={(event) => handleInputChange(event.target.value)}
          placeholder="0"
          aria-label={ariaLabel}
        />
      </div>
    </label>
  );
}
