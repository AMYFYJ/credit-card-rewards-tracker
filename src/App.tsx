import { useEffect, useMemo, useState } from 'react';
import type { ReactElement, SVGProps } from 'react';
import {
  BadgeDollarSign,
  Beef,
  Car,
  HeartHandshake,
  Home,
  Fuel,
  LayoutDashboard,
  LucideIcon,
  Music,
  Plane,
  BadgePercent,
  ShoppingBag,
  ShoppingCart,
  Store,
  Tag,
  Utensils,
  Zap,
} from 'lucide-react';

type TabId = 'dashboard' | 'setup' | 'bilt';
type TabIcon = LucideIcon | ((props: SVGProps<SVGSVGElement> & { size?: number }) => ReactElement);

type RewardsState = {
  quarterMonths: string;
  chaseCategories: string;
  discoverCategories: string;
  chaseActivated: boolean;
  discoverActivated: boolean;
  confirmedQuarterKey: string;
  reminderDismissedQuarterKey: string;
  biltSpend: number;
};

type HousingTier = {
  spendNeeded: number;
  label: string;
  multiplier: number;
  points: number;
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
  icon: LucideIcon;
};

const STORAGE_KEY = 'credit-card-rewards-tracker:v1';
const RENT_AMOUNT = 1600;
const PERSONAL_TARGET = 800;

const DEFAULT_STATE: RewardsState = {
  quarterMonths: getCurrentQuarterMonths(),
  chaseCategories: 'Gas stations, EV charging, live entertainment',
  discoverCategories: 'Restaurants, wholesale clubs',
  chaseActivated: false,
  discoverActivated: false,
  confirmedQuarterKey: '',
  reminderDismissedQuarterKey: '',
  biltSpend: 0,
};

const tabs: Array<{ id: TabId; label: string; icon: TabIcon }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'bilt', label: 'Bilt', icon: BiltLogoIcon },
  { id: 'setup', label: 'Quarterly', icon: BadgePercent },
];

function BiltLogoIcon({
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M4 5h16v14H4V5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M4 9.2h16M4 13.4h16" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.1 5v4.2M14.6 9.2v4.2M10.8 13.4V19" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

const housingTiers: HousingTier[] = [
  { spendNeeded: 400, label: '25%', multiplier: 0.5, points: 800 },
  { spendNeeded: 800, label: '50%', multiplier: 0.75, points: 1200 },
  { spendNeeded: 1200, label: '75%', multiplier: 1, points: 1600 },
  { spendNeeded: 1600, label: '100%', multiplier: 1.25, points: 2000 },
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
  sourceName: string;
  sourceUrl: string;
  rewards: AlwaysOnReward[];
}> = [
  {
    cardName: 'Chase Freedom Flex',
    sourceName: 'Chase',
    sourceUrl: 'https://creditcards.chase.com/cash-back-credit-cards/freedom/flex',
    rewards: [
      { label: 'Chase Travel', rate: '5%', icon: Plane },
      { label: 'Dining', rate: '3%', icon: Utensils },
      { label: 'Drugstores', rate: '3%', icon: Store },
      { label: 'Lyft', rate: '2%', icon: Car },
      { label: 'Everything else', rate: '1%', icon: Tag },
    ],
  },
  {
    cardName: 'Discover',
    sourceName: 'Discover',
    sourceUrl: 'https://www.discover.com/credit-cards/cash-back/cashback-bonus.html',
    rewards: [{ label: 'All purchases', rate: '1%', icon: BadgeDollarSign }],
  },
];


function loadState(): RewardsState {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return DEFAULT_STATE;
    }

    const parsed = JSON.parse(saved) as Partial<RewardsState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      quarterMonths: getCurrentQuarterMonths(),
      biltSpend: sanitizeSpend(parsed.biltSpend),
      chaseActivated: Boolean(parsed.chaseActivated),
      discoverActivated: Boolean(parsed.discoverActivated),
      confirmedQuarterKey: parsed.confirmedQuarterKey ?? '',
      reminderDismissedQuarterKey: parsed.reminderDismissedQuarterKey ?? '',
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function sanitizeSpend(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, numeric);
}

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

function getCurrentQuarterMonths(): string {
  const quarterMonths = [
    ['Jan', 'Feb', 'Mar'],
    ['Apr', 'May', 'Jun'],
    ['Jul', 'Aug', 'Sep'],
    ['Oct', 'Nov', 'Dec'],
  ];
  return quarterMonths[Math.floor(new Date().getMonth() / 3)].join(', ');
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

function getHousingProgress(spend: number) {
  const unlockedTier = [...housingTiers].reverse().find((tier) => spend >= tier.spendNeeded);
  const nextTier = housingTiers.find((tier) => spend < tier.spendNeeded);
  const progressPercent = Math.min((spend / RENT_AMOUNT) * 100, 100);
  const remainingToTarget = Math.max(PERSONAL_TARGET - spend, 0);

  return {
    progressPercent,
    currentTier: unlockedTier ?? null,
    nextTier: nextTier ?? null,
    rentPoints: unlockedTier?.points ?? 250,
    remainingToTarget,
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [state, setState] = useState<RewardsState>(() => loadState());
  const monthName = useMemo(() => getCurrentMonthName(), []);
  const currentQuarterKey = useMemo(() => getCurrentQuarterKey(), []);
  const currentQuarterSuggestion = categorySuggestions[currentQuarterKey] ?? null;
  const housingProgress = useMemo(() => getHousingProgress(state.biltSpend), [state.biltSpend]);
  const shouldShowQuarterReminder =
    state.confirmedQuarterKey !== currentQuarterKey &&
    state.reminderDismissedQuarterKey !== currentQuarterKey;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

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

      {activeTab === 'dashboard' && (
        <header className="app-header app-header--dashboard">
          <h1>{monthName}</h1>
        </header>
      )}

      <section className="tab-panel">
        {activeTab === 'dashboard' && (
          <Dashboard state={state} housingProgress={housingProgress} />
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
            housingProgress={housingProgress}
            onSpendChange={(value) => updateState('biltSpend', sanitizeSpend(value))}
          />
        )}
      </section>

      <nav className="bottom-tabs" aria-label="Primary navigation">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              type="button"
              className={isActive ? 'tab-button is-active' : 'tab-button'}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={20} aria-hidden="true" />
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
          Review the {quarterMonths} rotating categories, edit anything that looks off, then confirm
          after activating Chase and Discover.
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onDismiss}>
            Later
          </button>
          <button type="button" className="primary-button" onClick={onReview}>
            Review now
          </button>
        </div>
      </section>
    </div>
  );
}

function Dashboard({
  state,
  housingProgress,
}: {
  state: RewardsState;
  housingProgress: ReturnType<typeof getHousingProgress>;
}) {
  const currentTierLabel = housingProgress.currentTier
    ? `${housingProgress.currentTier.multiplier}x tier`
    : 'base tier';
  const nextStepLabel = housingProgress.nextTier
    ? `${formatCurrency(housingProgress.nextTier.spendNeeded - state.biltSpend)} to ${housingProgress.nextTier.multiplier}x`
    : 'Top tier reached';

  return (
    <div className="view-stack">
      <section className="dashboard-card bilt-overview">
        <div className="bilt-overview__meta">
          <p className="eyebrow">Bilt spend</p>
          <h2>{formatCurrency(state.biltSpend)}</h2>
          <p className="bilt-overview__subline">
            {housingProgress.rentPoints.toLocaleString()} rent pts · {currentTierLabel} ·{' '}
            <span className="bilt-overview__next">{nextStepLabel}</span>
          </p>
        </div>
        <BiltProgress
          spend={state.biltSpend}
          progressPercent={housingProgress.progressPercent}
          compact
        />
      </section>

      <RotatingCategoriesCard state={state} />
    </div>
  );
}

function RotatingCategoriesCard({ state }: { state: RewardsState }) {
  return (
    <section className="dashboard-card categories-overview">
      <div className="categories-heading">
        <div>
          <p className="eyebrow">Quarterly rotating</p>
          <h2>5% cash back</h2>
        </div>
        <span>{state.quarterMonths || 'Not set'}</span>
      </div>
      <RewardCard
        cardName="Chase Freedom Flex"
        categories={state.chaseCategories}
        activated={state.chaseActivated}
      />
      <RewardCard
        cardName="Discover"
        categories={state.discoverCategories}
        activated={state.discoverActivated}
      />
    </section>
  );
}

function RewardCard({
  cardName,
  categories,
  activated,
}: {
  cardName: string;
  categories: string;
  activated: boolean;
}) {
  const categoryList = splitCategories(categories);

  return (
    <article className={activated ? 'reward-card is-active' : 'reward-card'}>
      <div className="reward-card__header">
        <h3>{cardName}</h3>
        <span className={activated ? 'activation-pill is-active' : 'activation-pill'}>
          {activated ? 'Confirmed' : 'Unconfirmed'}
        </span>
      </div>
      {categoryList.length > 0 ? (
        <div className="category-icon-grid">
          {categoryList.map((category) => (
            <CategoryTile category={category} activated={activated} key={category} />
          ))}
        </div>
      ) : (
        <p className="empty-text">Add in Quarterly</p>
      )}
    </article>
  );
}

function CategoryTile({ category, activated }: { category: string; activated: boolean }) {
  const Icon = getCategoryIcon(category);

  return (
    <div className={activated ? 'category-tile is-active' : 'category-tile'}>
      <span>
        <Icon size={19} aria-hidden="true" />
      </span>
      <strong>{toTitleCase(category)}</strong>
    </div>
  );
}

function getCategoryIcon(category: string): LucideIcon {
  const normalized = category.toLowerCase();

  if (normalized.includes('ev') || normalized.includes('charging')) {
    return Zap;
  }
  if (normalized.includes('amazon')) {
    return ShoppingBag;
  }
  if (normalized.includes('whole foods')) {
    return Beef;
  }
  if (normalized.includes('feeding america') || normalized.includes('charity')) {
    return HeartHandshake;
  }
  if (normalized.includes('home improvement') || normalized.includes('home')) {
    return Home;
  }
  if (normalized.includes('cash') || normalized.includes('pay')) {
    return BadgeDollarSign;
  }
  if (normalized.includes('gas') || normalized.includes('fuel')) {
    return Fuel;
  }
  if (normalized.includes('restaurant') || normalized.includes('dining')) {
    return Utensils;
  }
  if (normalized.includes('entertainment') || normalized.includes('music') || normalized.includes('live')) {
    return Music;
  }
  if (normalized.includes('grocery')) {
    return ShoppingCart;
  }
  if (normalized.includes('wholesale') || normalized.includes('club')) {
    return Store;
  }
  if (normalized.includes('travel') || normalized.includes('flight')) {
    return Plane;
  }
  if (normalized.includes('shop')) {
    return ShoppingBag;
  }
  return Tag;
}

function BiltProgress({
  spend,
  progressPercent,
  compact = false,
}: {
  spend: number;
  progressPercent: number;
  compact?: boolean;
}) {
  return (
    <div className="progress-wrap" aria-label="Bilt housing-only spend progress">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        {housingTiers.map((tier) => (
          <span
            className={tier.spendNeeded === PERSONAL_TARGET ? 'tier-marker recommended' : 'tier-marker'}
            style={{ left: `${(tier.spendNeeded / RENT_AMOUNT) * 100}%` }}
            key={tier.spendNeeded}
          />
        ))}
      </div>
      <div className="marker-labels">
        {housingTiers.map((tier) => (
          <span
            className={[
              'marker-label',
              tier.spendNeeded === PERSONAL_TARGET ? 'recommended' : '',
              tier.spendNeeded === RENT_AMOUNT ? 'is-edge-end' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ left: `${(tier.spendNeeded / RENT_AMOUNT) * 100}%` }}
            key={tier.spendNeeded}
          >
            {formatCurrency(tier.spendNeeded)}
          </span>
        ))}
      </div>
      {!compact && (
        <div className="progress-caption">
          <span>{formatCurrency(spend)} non-housing spend</span>
          <span>{formatCurrency(PERSONAL_TARGET)} target</span>
        </div>
      )}
    </div>
  );
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
    if (!suggestion) {
      updateState('confirmedQuarterKey', getCurrentQuarterKey());
    } else {
      updateState('confirmedQuarterKey', suggestion.key);
    }

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
    <div className="view-stack page-pad">
      <header className="page-title page-title--quarterly">
        <h1>{state.quarterMonths}</h1>
      </header>

      <section className="field-card suggestion-card">
        <div className="suggestion-heading">
          <div>
            <span>{isConfirmed ? 'Quarterly Rotating Categories' : 'Review categories'}</span>
            <p>
              {isConfirmed
                ? 'These 5% categories are locked for the quarter.'
                : 'Edit if needed, then confirm after activating both cards.'}
            </p>
          </div>
          <button type="button" onClick={isConfirmed ? editAgain : confirmCategories}>
            {isConfirmed ? 'Edit' : 'Activated and Apply'}
          </button>
        </div>

        {isConfirmed ? (
          <div className="confirmed-category-preview">
            <RewardCard
              cardName="Chase Freedom Flex"
              categories={state.chaseCategories}
              activated={state.chaseActivated}
            />
            <RewardCard
              cardName="Discover"
              categories={state.discoverCategories}
              activated={state.discoverActivated}
            />
          </div>
        ) : suggestion ? (
          <div className="suggestion-list">
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
        ) : (
          <p className="empty-text">No sourced suggestions saved for this quarter yet.</p>
        )}
      </section>

      {isConfirmed && <AlwaysOnRewardsSection />}

      {!isConfirmed && (
        <>
          <label className="field-card">
            <span>Chase Freedom Flex</span>
            <textarea
              value={state.chaseCategories}
              onChange={(event) => updateState('chaseCategories', event.target.value)}
              placeholder="Gas stations, EV charging"
              rows={3}
            />
          </label>

          <label className="field-card">
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
    </div>
  );
}

function AlwaysOnRewardsSection() {
  return (
    <section className="field-card always-on-card">
      <div className="always-on-heading">
        <span>Always-On Rewards</span>
        <p>Earn these outside the quarterly rotating categories.</p>
      </div>

      <div className="always-on-list">
        {alwaysOnRewards.map((card) => (
          <article className="always-on-bank" key={card.cardName}>
            <div className="always-on-bank__header">
              <strong>{card.cardName}</strong>
            </div>
            <div className="always-on-grid">
              {card.rewards.map((reward) => {
                const Icon = reward.icon;

                return (
                  <div className="always-on-reward" key={`${card.cardName}-${reward.label}`}>
                    <span>
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <strong>{reward.rate}</strong>
                    <p>{toTitleCase(reward.label)}</p>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
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
    <article className="suggestion-row">
      <div>
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
  housingProgress,
  onSpendChange,
}: {
  spend: number;
  housingProgress: ReturnType<typeof getHousingProgress>;
  onSpendChange: (value: number) => void;
}) {
  const [inputValue, setInputValue] = useState(spend === 0 ? '' : String(spend));

  useEffect(() => {
    setInputValue(spend === 0 ? '' : String(spend));
  }, [spend]);

  const handleInputChange = (value: string) => {
    if (!/^\d*\.?\d*$/.test(value)) {
      return;
    }

    setInputValue(value);
    onSpendChange(value === '' ? 0 : Number(value));
  };

  const currentLabel = housingProgress.currentTier
    ? `${housingProgress.currentTier.multiplier}x on rent`
    : 'Base rent points';
  const nextLabel = housingProgress.nextTier
    ? `${formatCurrency(housingProgress.nextTier.spendNeeded - spend)} to ${housingProgress.nextTier.multiplier}x`
    : 'Top tier reached';

  return (
    <div className="view-stack page-pad">
      <label className="amount-input-card">
        <span>Non-housing spend</span>
        <div className="amount-input">
          <span>$</span>
          <input
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={(event) => handleInputChange(event.target.value)}
            onBlur={() => setInputValue(spend === 0 ? '' : String(spend))}
            placeholder="0"
            aria-label="Current month Bilt non-housing spend"
          />
        </div>
      </label>

      <section className="summary-card bilt-rule-card">
        <div className="metric-row">
          <span>Estimated rent points</span>
          <strong>{housingProgress.rentPoints.toLocaleString()}</strong>
        </div>
        <div className="metric-row">
          <span>Current result</span>
          <strong>{currentLabel}</strong>
        </div>
        <div className="metric-row">
          <span>Next step</span>
          <strong>{nextLabel}</strong>
        </div>
      </section>

      <section className="hero-card compact">
        <BiltProgress spend={spend} progressPercent={housingProgress.progressPercent} />
      </section>

      <section className="tier-list" aria-label="Housing-only tiers">
        {housingTiers.map((tier) => (
          <div
            className={spend >= tier.spendNeeded ? 'tier-row reached' : 'tier-row'}
            key={tier.spendNeeded}
          >
            <span>{tier.label} spend</span>
            <strong>
              {formatCurrency(tier.spendNeeded)} → {tier.multiplier}x
            </strong>
          </div>
        ))}
      </section>

      <p className="fine-print">
        Housing-only uses non-housing spend as a share of monthly housing payment. With{' '}
        {formatCurrency(RENT_AMOUNT)} rent, {formatCurrency(PERSONAL_TARGET)} is the 50% tier.
      </p>
    </div>
  );
}
