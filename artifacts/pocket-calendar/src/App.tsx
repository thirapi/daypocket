import { useEffect, useMemo, useState, type FormEvent } from 'react';

type Memory = { title: string; note: string };
type MemoryMap = Record<string, Memory>;

const STORAGE_KEY = 'pocket-calendar-memories-v1';
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d={direction === 'left' ? 'M9.7 3.5 5.2 8l4.5 4.5' : 'M6.3 3.5 10.8 8l-4.5 4.5'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="3.5" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.1" />
      <path d="M5 2.5v2M11 2.5v2M2.8 6.3h10.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M5.3 8.6h1.2v1.2H5.3z" fill="currentColor" />
    </svg>
  );
}

function PocketMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path
          d="M10 5.5h9.2a3.8 3.8 0 0 1 3.8 3.8v17.2l-7.2-4-7.2 4V7.5A2 2 0 0 1 10.6 5.5Z"
          fill="#EEE7DC"
          stroke="#A58A68"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M12.7 11h7M12.7 14.5h7"
          stroke="#A58A68"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function readMemories(): MemoryMap {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) as MemoryMap : {};
  } catch {
    return {};
  }
}

function App() {
  const [shownMonth, setShownMonth] = useState(() => new Date(2026, 9, 1));
  const [memories, setMemories] = useState<MemoryMap>(readMemories);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(2026);
  const [activeDate, setActiveDate] = useState<Date | null>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
    } catch {
      // The calendar remains usable if storage is disabled or full.
    }
  }, [memories]);

  useEffect(() => {
    if (!activeDate) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveDate(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeDate]);

  const calendarDays = useMemo(() => {
    const year = shownMonth.getFullYear();
    const month = shownMonth.getMonth();
    const first = new Date(year, month, 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();
    const cells = Math.ceil((mondayOffset + count) / 7) * 7;
    return Array.from({ length: cells }, (_, index) =>
      new Date(year, month, index - mondayOffset + 1),
    );
  }, [shownMonth]);

  const memoryCount = Object.keys(memories).length;
  const monthName = MONTHS[shownMonth.getMonth()];
  const shownYear = shownMonth.getFullYear();

  const moveMonth = (offset: number) => {
    setShownMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    setPickerOpen(false);
  };

  const openMemory = (date: Date) => {
    const saved = memories[dateKey(date)];
    setActiveDate(date);
    setTitle(saved?.title ?? '');
    setNote(saved?.note ?? '');
    setPickerOpen(false);
  };

  const saveMemory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeDate) return;
    const key = dateKey(activeDate);
    if (!title.trim() && !note.trim()) {
      setMemories(current => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    } else {
      setMemories(current => ({
        ...current,
        [key]: { title: title.trim() || 'A little memory', note: note.trim() },
      }));
    }
    setActiveDate(null);
  };

  const deleteMemory = () => {
    if (!activeDate) return;
    const key = dateKey(activeDate);
    setMemories(current => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setActiveDate(null);
  };

  const jumpToStart = () => {
    setShownMonth(new Date(2026, 9, 1));
    setPickerOpen(false);
  };

  const activeMemory = activeDate ? memories[dateKey(activeDate)] : undefined;

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="brand" aria-label="Little Keeps calendar">
          <PocketMark />
          <span className="brand-copy">
            <span className="brand-name">little keeps</span>
            <span className="brand-tagline">a small place for days worth remembering</span>
          </span>
        </div>

        <div className="popover-anchor month-controls">
          <button className="round-control" type="button" aria-label="Previous month" data-testid="button-previous-month" onClick={() => moveMonth(-1)}>
            <ArrowIcon direction="left" />
          </button>
          <button
            className="month-pill"
            type="button"
            aria-expanded={pickerOpen}
            aria-label={`Choose month, currently ${monthName} ${shownYear}`}
            data-testid="button-open-month-picker"
            onClick={() => {
              setPickerYear(shownYear);
              setPickerOpen(value => !value);
            }}
          >
            <strong>{monthName}</strong><span>{shownYear}</span>
          </button>
          <button className="round-control" type="button" aria-label="Next month" data-testid="button-next-month" onClick={() => moveMonth(1)}>
            <ArrowIcon direction="right" />
          </button>
          {pickerOpen && (
            <div className="month-picker" role="dialog" aria-label="Choose a month">
              <div className="picker-head">
                <strong>{pickerYear}</strong>
                <span className="picker-arrows">
                  <button type="button" aria-label="Previous year" onClick={() => setPickerYear(year => year - 1)}><ArrowIcon direction="left" /></button>
                  <button type="button" aria-label="Next year" onClick={() => setPickerYear(year => year + 1)}><ArrowIcon direction="right" /></button>
                </span>
              </div>
              <div className="month-options">
                {SHORT_MONTHS.map((month, index) => (
                  <button
                    type="button"
                    className={`month-option${shownYear === pickerYear && shownMonth.getMonth() === index ? ' active' : ''}`}
                    key={month}
                    onClick={() => {
                      setShownMonth(new Date(pickerYear, index, 1));
                      setPickerOpen(false);
                    }}
                  >
                    {month}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="top-actions">
          <span className="tucked-count" data-testid="text-memory-count">
            <CalendarIcon /> {memoryCount} tucked away
          </span>
          <button className="today-pill" type="button" data-testid="button-return-to-october" onClick={jumpToStart}>
            <CalendarIcon /> October
          </button>
        </div>
      </header>

      <section className="calendar-card" aria-label={`${monthName} ${shownYear} calendar`}>
        <div className="calendar-intro">
          <div>
            <div className="eyebrow">Your little time capsule</div>
            <h1 className="calendar-title" data-testid="text-current-month">{monthName} {shownYear}</h1>
            <p className="calendar-subtitle">One small pocket for each day worth remembering.</p>
          </div>
          <p className="memory-prompt"><span className="prompt-dot" />{memoryCount ? `${memoryCount} little ${memoryCount === 1 ? 'memory' : 'memories'} kept` : 'Ready for a first little memory?'}</p>
        </div>

        <div className="weekdays" aria-hidden="true">
          {WEEKDAYS.map(day => <div className="weekday" key={day}>{day}</div>)}
        </div>
        <div className="calendar-grid" role="grid" aria-label={`${monthName} ${shownYear}`}>
          {calendarDays.map(date => {
            const key = dateKey(date);
            const isCurrentMonth = date.getMonth() === shownMonth.getMonth();
            const saved = memories[key];
            return (
              <button
                className={`day-cell${isCurrentMonth ? '' : ' outside'}${saved ? ' has-memory' : ''}`}
                type="button"
                role="gridcell"
                key={key}
                aria-label={`${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}${saved ? `, memory: ${saved.title}` : ', add a memory'}`}
                data-testid={`button-day-${key}`}
                onClick={() => openMemory(date)}
              >
                <span className="day-number">{date.getDate()}</span>
                <span className="capsule-art" aria-hidden="true" />
                {saved && <span className="memory-mark" aria-hidden="true" />}
                {saved?.note && <span className="memory-mark multiple" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </section>

      {activeDate && (
        <div className="memory-overlay" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) setActiveDate(null);
        }}>
          <form className="memory-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onSubmit={saveMemory}>
            <div className="dialog-top">
              <div>
                <p className="dialog-kicker">A day to keep</p>
                <h2 className="dialog-title" id="dialog-title">
                  {activeDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </h2>
              </div>
              <button className="close-dialog" type="button" aria-label="Close memory editor" onClick={() => setActiveDate(null)}>
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <label className="memory-field-label" htmlFor="memory-title">What would you like to remember?</label>
            <input
              id="memory-title"
              className="memory-input"
              data-testid="input-memory-title"
              autoFocus
              maxLength={80}
              placeholder="Give this day a little name"
              value={title}
              onChange={event => setTitle(event.target.value)}
            />
            <label className="memory-field-label" htmlFor="memory-note">A few more details</label>
            <textarea
              id="memory-note"
              className="memory-textarea"
              data-testid="input-memory-note"
              maxLength={600}
              placeholder="The small things you want to keep..."
              value={note}
              onChange={event => setNote(event.target.value)}
            />
            <div className="dialog-actions">
              {activeMemory
                ? <button className="delete-memory" type="button" data-testid="button-delete-memory" onClick={deleteMemory}>Remove memory</button>
                : <span />}
              <div className="dialog-actions-right">
                <button className="cancel-button" type="button" onClick={() => setActiveDate(null)}>Cancel</button>
                <button className="save-button" type="submit" data-testid="button-save-memory">Save memory</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

export default App;
