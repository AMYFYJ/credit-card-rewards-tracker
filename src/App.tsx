import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  Clipboard,
  CreditCard,
  Gauge,
  LayoutDashboard,
  Settings2,
  Sparkles,
} from 'lucide-react';

type TabId = 'dashboard' | 'setup' | 'bilt' | 'reminders';

type RewardsState = {
  quarterMonths: string;
  chaseCategories: string;
  discoverCategories: string;
  chaseActivated: boolean;
  discoverActivated: boolean;
  biltSpend: number;
};

type Reminder = {
  id: string;
  title: string;
  cadence: string;
  text: string;
};

const STORAGE_KEY = 'credit-card-rewards-tracker:v1';
const RENT_AMOUNT = 1600;
const RECOMMENDED_BILT_TARGET = 800;

const DEFAULT_STATE: RewardsState = {
  quarterMonths: 'Jul, Aug, Sep',
  chaseCategories: 'Gas stations, EV charging, live entertainment',
  discoverCategories: 'Restaurants, wholesale clubs',
  chaseActivated: false,
  discoverActivated: false,
  biltSpend: 0,
};

const tabs: Array<{ id: TabId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'setup', label: 'Quarterly', icon: Settings2 },
  { id: 'bilt', label: 'Bilt', icon: Gauge },
  { id: 'reminders', label: 'Reminders', icon: Bell },
];

const reminders: Reminder[] = [
  {
    id: 'quarter-start',
    title: 'Activate rotating categories',
    cadence: 'Quarterly, first day',
    text: 'Activate Chase Freedom Flex and Discover it Cash Back 5% categories for this quarter.',
  },
  {
    id: 'quarter-check',
    title: 'Review card categories',
    cadence: 'Quarterly, first week',
    text: 'Update my rewards tracker with this quarter’s Chase Freedom Flex and Discover it Cash Back categories.',
  },
  {
    id: 'bilt-midmonth',
    title: 'Check Bilt progress',
    cadence: 'Monthly, 15th',
    text: 'Check current month Bilt non-rent spend and aim for the $800 recommended target.',
  },
  {
    id: 'bilt-month-end',
    title: 'Finish Bilt spend target',
    cadence: 'Monthly, last week',
    text: 'Review Bilt non-rent spend before month end and confirm rent points are on track.',
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
      biltSpend: sanitizeSpend(parsed.biltSpend),
      chaseActivated: Boolean(parsed.chaseActivated),
      discoverActivated: Boolean(parsed.discoverActivated),
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

function splitCategories(value: string): string[] {
  return value
    .split(',')
    .map((category) => category.trim())
    .filter(Boolean);
}

function getTier(spend: number) {
  const unlocked = [400, 800, 1200, 1600].filter((threshold) => spend >= threshold);
  const rentPoints = unlocked.at(-1) ?? 0;

  if (spend >= 1600) {
    return { label: '$1,600 max tier', rentPoints };
  }
  if (spend >= 1200) {
    return { label: '$1,200 tier', rentPoints };
  }
  if (spend >= 800) {
    return { label: '$800 target tier', rentPoints };
  }
  if (spend >= 400) {
    return { label: '$400 starter tier', rentPoints };
  }
  return { label: 'Below first tier', rentPoints };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [state, setState] = useState<RewardsState>(() => loadState());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const updateState = <Key extends keyof RewardsState>(key: Key, value: RewardsState[Key]) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  const progressPercent = Math.min((state.biltSpend / RENT_AMOUNT) * 100, 100);
  const tier = useMemo(() => getTier(state.biltSpend), [state.biltSpend]);

  const copyReminder = async (reminder: Reminder) => {
    const text = `${reminder.title}\n${reminder.text}`;
    await copyText(text);
    setCopiedId(reminder.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Credit card rewards</p>
          <h1>Monthly tracker</h1>
        </div>
        <div className="rent-pill">
          <CreditCard size={18} aria-hidden="true" />
          <span>$1,600 rent</span>
        </div>
      </header>

      <section className="tab-panel">
        {activeTab === 'dashboard' && (
          <Dashboard
            state={state}
            progressPercent={progressPercent}
            tierLabel={tier.label}
            rentPoints={tier.rentPoints}
          />
        )}
        {activeTab === 'setup' && <QuarterlySetup state={state} updateState={updateState} />}
        {activeTab === 'bilt' && (
          <BiltTracker
            spend={state.biltSpend}
            progressPercent={progressPercent}
            tierLabel={tier.label}
            rentPoints={tier.rentPoints}
            onSpendChange={(value) => updateState('biltSpend', sanitizeSpend(value))}
          />
        )}
        {activeTab === 'reminders' && (
          <Reminders copiedId={copiedId} onCopyReminder={copyReminder} />
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

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function Dashboard({
  state,
  progressPercent,
  tierLabel,
  rentPoints,
}: {
  state: RewardsState;
  progressPercent: number;
  tierLabel: string;
  rentPoints: number;
}) {
  return (
    <div className="view-stack">
      <section className="hero-card">
        <div className="hero-topline">
          <span>{state.quarterMonths || 'Quarter not set'}</span>
          <Sparkles size={18} aria-hidden="true" />
        </div>
        <h2>{formatCurrency(state.biltSpend)} Bilt non-rent spend</h2>
        <p>
          {tierLabel} · {rentPoints.toLocaleString()} rent points earned
        </p>
        <BiltProgress spend={state.biltSpend} progressPercent={progressPercent} />
      </section>

      <section className="card-grid">
        <CategoryCard
          title="Chase Freedom Flex"
          categories={state.chaseCategories}
          activated={state.chaseActivated}
        />
        <CategoryCard
          title="Discover it Cash Back"
          categories={state.discoverCategories}
          activated={state.discoverActivated}
        />
      </section>

      <section className="summary-card">
        <p className="label">Bilt Blue Card target</p>
        <div className="metric-row">
          <span>Recommended monthly non-rent spend</span>
          <strong>{formatCurrency(RECOMMENDED_BILT_TARGET)}</strong>
        </div>
        <div className="metric-row">
          <span>Monthly rent</span>
          <strong>{formatCurrency(RENT_AMOUNT)}</strong>
        </div>
      </section>
    </div>
  );
}

function CategoryCard({
  title,
  categories,
  activated,
}: {
  title: string;
  categories: string;
  activated: boolean;
}) {
  const categoryList = splitCategories(categories);

  return (
    <article className="category-card">
      <div className="card-heading">
        <h3>{title}</h3>
        <ActivationBadge activated={activated} />
      </div>
      <p className="label">5% categories</p>
      {categoryList.length > 0 ? (
        <div className="chip-list">
          {categoryList.map((category) => (
            <span className="category-chip" key={category}>
              {category}
            </span>
          ))}
        </div>
      ) : (
        <p className="empty-text">Add categories in Quarterly Setup.</p>
      )}
    </article>
  );
}

function ActivationBadge({ activated }: { activated: boolean }) {
  return (
    <span className={activated ? 'status-badge active' : 'status-badge'}>
      {activated ? <Check size={14} aria-hidden="true" /> : <Bell size={14} aria-hidden="true" />}
      {activated ? 'Activated' : 'Needs activation'}
    </span>
  );
}

function BiltProgress({
  spend,
  progressPercent,
}: {
  spend: number;
  progressPercent: number;
}) {
  return (
    <div className="progress-wrap" aria-label="Bilt non-rent spend progress">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        {[400, 800, 1200, 1600].map((marker) => (
          <span
            className={marker === RECOMMENDED_BILT_TARGET ? 'tier-marker recommended' : 'tier-marker'}
            style={{ left: `${(marker / RENT_AMOUNT) * 100}%` }}
            key={marker}
          />
        ))}
      </div>
      <div className="marker-labels">
        {[400, 800, 1200, 1600].map((marker) => (
          <span
            className={marker === RECOMMENDED_BILT_TARGET ? 'marker-label recommended' : 'marker-label'}
            key={marker}
          >
            {formatCurrency(marker)}
          </span>
        ))}
      </div>
      <div className="progress-caption">
        <span>{formatCurrency(spend)} entered</span>
        <span>Visual cap: {formatCurrency(RENT_AMOUNT)}</span>
      </div>
    </div>
  );
}

function QuarterlySetup({
  state,
  updateState,
}: {
  state: RewardsState;
  updateState: <Key extends keyof RewardsState>(key: Key, value: RewardsState[Key]) => void;
}) {
  return (
    <div className="view-stack">
      <section className="section-heading">
        <p className="eyebrow">Quarterly setup</p>
        <h2>Rotating category details</h2>
      </section>

      <label className="field-card">
        <span>Quarter duration</span>
        <input
          value={state.quarterMonths}
          onChange={(event) => updateState('quarterMonths', event.target.value)}
          placeholder="Jul, Aug, Sep"
        />
      </label>

      <label className="field-card">
        <span>Chase Freedom Flex 5% categories</span>
        <textarea
          value={state.chaseCategories}
          onChange={(event) => updateState('chaseCategories', event.target.value)}
          placeholder="Gas stations, EV charging"
          rows={3}
        />
      </label>

      <label className="field-card">
        <span>Discover it Cash Back 5% categories</span>
        <textarea
          value={state.discoverCategories}
          onChange={(event) => updateState('discoverCategories', event.target.value)}
          placeholder="Restaurants, grocery stores"
          rows={3}
        />
      </label>

      <div className="toggle-card">
        <div>
          <strong>Chase activated</strong>
          <p>Mark after enrolling this quarter.</p>
        </div>
        <Switch
          checked={state.chaseActivated}
          onChange={(checked) => updateState('chaseActivated', checked)}
          label="Toggle Chase activation"
        />
      </div>

      <div className="toggle-card">
        <div>
          <strong>Discover activated</strong>
          <p>Mark after enrolling this quarter.</p>
        </div>
        <Switch
          checked={state.discoverActivated}
          onChange={(checked) => updateState('discoverActivated', checked)}
          label="Toggle Discover activation"
        />
      </div>
    </div>
  );
}

function BiltTracker({
  spend,
  progressPercent,
  tierLabel,
  rentPoints,
  onSpendChange,
}: {
  spend: number;
  progressPercent: number;
  tierLabel: string;
  rentPoints: number;
  onSpendChange: (value: number) => void;
}) {
  return (
    <div className="view-stack">
      <section className="section-heading">
        <p className="eyebrow">Bilt tracker</p>
        <h2>Current month non-rent spend</h2>
      </section>

      <label className="amount-input-card">
        <span>Amount spent</span>
        <div className="amount-input">
          <span>$</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={spend}
            onChange={(event) => onSpendChange(Number(event.target.value))}
            onBlur={(event) => onSpendChange(Number(event.target.value))}
            aria-label="Current month Bilt non-rent spend"
          />
        </div>
      </label>

      <section className="summary-card">
        <div className="metric-row">
          <span>Current tier</span>
          <strong>{tierLabel}</strong>
        </div>
        <div className="metric-row">
          <span>Rent points earned</span>
          <strong>{rentPoints.toLocaleString()}</strong>
        </div>
      </section>

      <section className="hero-card compact">
        <BiltProgress spend={spend} progressPercent={progressPercent} />
      </section>
    </div>
  );
}

function Reminders({
  copiedId,
  onCopyReminder,
}: {
  copiedId: string | null;
  onCopyReminder: (reminder: Reminder) => void;
}) {
  return (
    <div className="view-stack">
      <section className="section-heading">
        <p className="eyebrow">Reminder schedule</p>
        <h2>Apple Reminders copy text</h2>
      </section>

      {reminders.map((reminder) => (
        <article className="reminder-card" key={reminder.id}>
          <div className="check-dot" aria-hidden="true">
            <Check size={16} />
          </div>
          <div>
            <h3>{reminder.title}</h3>
            <p className="cadence">{reminder.cadence}</p>
            <p>{reminder.text}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => onCopyReminder(reminder)}
            aria-label={`Copy ${reminder.title} reminder text`}
            title="Copy reminder text"
          >
            {copiedId === reminder.id ? <Check size={19} /> : <Clipboard size={19} />}
          </button>
        </article>
      ))}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={checked ? 'switch is-on' : 'switch'}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}
