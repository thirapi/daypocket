import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';

type PhotoRef = { id: string; name: string; type: string };
type Memory = { title: string; note: string; color?: string; seal?: string; photos?: PhotoRef[] };
type MemoryMap = Record<string, Memory>;
type SealName = 'star' | 'flower' | 'moon' | 'heart';
type StoredPhoto = { id: string; blob: Blob };

const STORAGE_KEY = 'pocket-calendar-memories-v1';
const PHOTO_DB = 'little-keeps-photo-store';
const PHOTO_STORE = 'photos';
const PHOTO_LIMIT = 8;
const PHOTO_SIZE_LIMIT = 10 * 1024 * 1024;
const COLORS = [
  { name: 'Petal', value: '#d8a39b' },
  { name: 'Apricot', value: '#e0b37f' },
  { name: 'Sage', value: '#9eae91' },
  { name: 'Bluebell', value: '#9eafbd' },
  { name: 'Lilac', value: '#b6a3bd' },
  { name: 'Linen', value: '#d0c3a9' },
];
const SEALS: { name: SealName; label: string; path: string }[] = [
  { name: 'star', label: 'Star', path: 'M12 2.8 14.7 8.3l6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 2.8Z' },
  { name: 'flower', label: 'Flower', path: 'M12 12c-2.6-1.5-2.5-5 .1-6.8 2.7 1.8 2.7 5.3-.1 6.8Zm0 0c1.5-2.6 5-2.5 6.8.1-1.8 2.7-5.3 2.7-6.8-.1Zm0 0c2.6 1.5 2.5 5-.1 6.8-2.7-1.8-2.7-5.3.1-6.8Zm0 0c-1.5 2.6-5 2.5-6.8-.1 1.8-2.7 5.3-2.7 6.8.1Z' },
  { name: 'moon', label: 'Crescent', path: 'M19.4 15.7A8.2 8.2 0 0 1 8.3 4.6a8.3 8.3 0 1 0 11.1 11.1Z' },
  { name: 'heart', label: 'Heart', path: 'M12 20.2 4.6 13A4.5 4.5 0 0 1 11 6.7l1 1 1-1a4.5 4.5 0 0 1 6.4 6.3L12 20.2Z' },
];
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d={direction === 'left' ? 'M9.7 3.5 5.2 8l4.5 4.5' : 'M6.3 3.5 10.8 8l-4.5 4.5'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CalendarIcon() {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.1" /><path d="M5 2.5v2M11 2.5v2M2.8 6.3h10.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /><path d="M5.3 8.6h1.2v1.2H5.3z" fill="currentColor" /></svg>;
}

function PocketMark() {
  return <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M10 5.5h9.2a3.8 3.8 0 0 1 3.8 3.8v17.2l-7.2-4-7.2 4V7.5A2 2 0 0 1 10.6 5.5Z" fill="#EEE7DC" stroke="#A58A68" strokeWidth="1.5" strokeLinejoin="round" /><path d="M12.7 11h7M12.7 14.5h7" stroke="#A58A68" strokeWidth="1.25" strokeLinecap="round" /></svg></span>;
}

function readMemories(): MemoryMap {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return {};
  const parsed: unknown = JSON.parse(saved);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Your saved memories could not be read. They have not been changed.');
  const result: MemoryMap = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (value && typeof value === 'object') {
      const item = value as Partial<Memory>;
      // Keep the original title/note-only entries intact while adding envelope defaults at display time.
      if (typeof item.title === 'string' && typeof item.note === 'string') result[key] = { ...item, title: item.title, note: item.note };
    }
  }
  return result;
}

function openPhotoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('This browser does not support local photo storage.')); return; }
    const request = window.indexedDB.open(PHOTO_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PHOTO_STORE)) request.result.createObjectStore(PHOTO_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local photo storage.'));
  });
}

async function putPhotos(photos: { id: string; blob: Blob }[]) {
  if (!photos.length) return;
  const db = await openPhotoDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite');
    photos.forEach(photo => tx.objectStore(PHOTO_STORE).put(photo));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not save your photos on this browser.'));
    tx.onabort = () => reject(tx.error ?? new Error('Photo saving was interrupted.'));
  }).finally(() => db.close());
}

async function removePhotos(ids: string[]) {
  if (!ids.length) return;
  const db = await openPhotoDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite');
    ids.forEach(id => tx.objectStore(PHOTO_STORE).delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not remove stored photos.'));
  }).finally(() => db.close());
}

async function getPhoto(id: string): Promise<Blob | undefined> {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(PHOTO_STORE, 'readonly').objectStore(PHOTO_STORE).get(id);
    request.onsuccess = () => { db.close(); resolve((request.result as StoredPhoto | undefined)?.blob); };
    request.onerror = () => { db.close(); reject(request.error ?? new Error('Could not open this saved photo.')); };
  });
}

function Seal({ name = 'star' }: { name?: string }) {
  const motif = SEALS.find(seal => seal.name === name) ?? SEALS[0];
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={motif.path} stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" fill={name === 'heart' || name === 'flower' ? 'currentColor' : 'none'} fillOpacity=".2" /></svg>;
}

function App() {
  const [shownMonth, setShownMonth] = useState(() => new Date(2026, 9, 1));
  const [memories, setMemories] = useState<MemoryMap>({});
  const [storageError, setStorageError] = useState('');
  const [storageReady, setStorageReady] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(2026);
  const [activeDate, setActiveDate] = useState<Date | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [color, setColor] = useState(COLORS[0].value);
  const [seal, setSeal] = useState<SealName>('star');
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [newPhotoUrls, setNewPhotoUrls] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try { setMemories(readMemories()); setStorageReady(true); }
    catch (error) { setStorageError(error instanceof Error ? error.message : 'Saved memories could not be read.'); }
  }, []);

  useEffect(() => {
    if (!activeDate) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) closeDialog();
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeDate, busy]);

  useEffect(() => {
    if (activeDate && memories[dateKey(activeDate)]) {
      window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>('.close-dialog')?.focus(), 0);
    }
  }, [activeDate, memories]);

  useEffect(() => {
    let cancelled = false;
    const urls: Record<string, string> = {};
    const load = async () => {
      const refs = activeDate ? memories[dateKey(activeDate)]?.photos ?? [] : [];
      try {
        await Promise.all(refs.map(async photo => {
          if (removedPhotoIds.includes(photo.id)) return;
          const blob = await getPhoto(photo.id);
          if (blob) urls[photo.id] = URL.createObjectURL(blob);
        }));
        if (!cancelled) setPhotoUrls(urls);
        else Object.values(urls).forEach(URL.revokeObjectURL);
      } catch (error) {
        if (!cancelled) setFormError(error instanceof Error ? error.message : 'Could not load saved photos.');
      }
    };
    setPhotoUrls({});
    void load();
    return () => { cancelled = true; Object.values(urls).forEach(URL.revokeObjectURL); };
  }, [activeDate, memories, removedPhotoIds]);

  useEffect(() => () => Object.values(photoUrls).forEach(URL.revokeObjectURL), [photoUrls]);

  useEffect(() => {
    const urls = newPhotos.map(file => URL.createObjectURL(file));
    setNewPhotoUrls(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [newPhotos]);

  const calendarDays = useMemo(() => {
    const year = shownMonth.getFullYear(), month = shownMonth.getMonth();
    const mondayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();
    const cells = Math.ceil((mondayOffset + count) / 7) * 7;
    return Array.from({ length: cells }, (_, index) => new Date(year, month, index - mondayOffset + 1));
  }, [shownMonth]);

  const memoryCount = Object.keys(memories).length;
  const monthName = MONTHS[shownMonth.getMonth()];
  const shownYear = shownMonth.getFullYear();
  const activeMemory = activeDate ? memories[dateKey(activeDate)] : undefined;
  const activePhotos = (activeMemory?.photos ?? []).filter(photo => !removedPhotoIds.includes(photo.id));

  function closeDialog() {
    setActiveDate(null); setEditing(false); setNewPhotos([]); setRemovedPhotoIds([]); setFormError('');
    window.setTimeout(() => openerRef.current?.focus(), 0);
  }
  const moveMonth = (offset: number) => {
    setShownMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    setPickerOpen(false);
  };

  const openMemory = (date: Date, target: HTMLElement) => {
    const saved = memories[dateKey(date)];
    openerRef.current = target;
    setActiveDate(date);
    setTitle(saved?.title ?? '');
    setNote(saved?.note ?? '');
    setColor(saved?.color ?? COLORS[0].value);
    setSeal((saved?.seal as SealName) ?? 'star');
    setNewPhotos([]); setRemovedPhotoIds([]); setFormError('');
    setEditing(!saved);
    setPickerOpen(false);
  };

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    setFormError('');
    const accepted = [...files];
    let failure = '';
    const currentCount = activePhotos.length + newPhotos.length;
    for (const file of accepted) {
      if (!file.type.startsWith('image/')) { failure = `${file.name} is not an image. Choose an image file.`; break; }
      if (file.size > PHOTO_SIZE_LIMIT) { failure = `${file.name} is larger than 10 MB. Choose a smaller image.`; break; }
      if (currentCount + accepted.indexOf(file) >= PHOTO_LIMIT) { failure = `You can keep up to ${PHOTO_LIMIT} photos with each date.`; break; }
    }
    if (failure) { setFormError(failure); if (fileInput.current) fileInput.current.value = ''; return; }
    setNewPhotos(current => [...current, ...accepted]);
    if (fileInput.current) fileInput.current.value = '';
  };

  const saveMemory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeDate) return;
    if (!storageReady) { setFormError('Saved memories are not available right now. Nothing has been changed.'); return; }
    const key = dateKey(activeDate);
    const existing = memories[key];
    const hasContent = title.trim() || note.trim() || activePhotos.length || newPhotos.length;
    if (!hasContent) {
      setFormError('Add a title, a note, or a photo before keeping this envelope.');
      return;
    }
    setBusy(true); setFormError('');
    const addedRefs: PhotoRef[] = newPhotos.map((file, index) => ({ id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`, name: file.name, type: file.type }));
    const nextPhotos = [...activePhotos, ...addedRefs];
    const next: Memory = { title: title.trim() || 'A little memory', note: note.trim(), color, seal, photos: nextPhotos };
    try {
      await putPhotos(newPhotos.map((file, index) => ({ id: addedRefs[index].id, blob: file })));
      const nextMap = { ...memories, [key]: next };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMap));
      setMemories(nextMap);
      try { await removePhotos([...(existing?.photos ?? []).filter(photo => removedPhotoIds.includes(photo.id)).map(photo => photo.id)]); }
      catch (error) { setStorageError(`Memory saved, but an old photo could not be cleared: ${error instanceof Error ? error.message : 'storage error'}`); }
      closeDialog();
    } catch (error) {
      // If the metadata write failed, remove newly added blobs so an incomplete save is not left behind.
      let cleanupMessage = '';
      try { await removePhotos(addedRefs.map(photo => photo.id)); }
      catch (cleanupError) { cleanupMessage = ` Newly added photo data may remain in browser storage: ${cleanupError instanceof Error ? cleanupError.message : 'cleanup failed'}.`; }
      setFormError(`${error instanceof Error ? `Could not save this memory: ${error.message}` : 'Could not save this memory. Check browser storage and try again.'}${cleanupMessage}`);
    } finally { setBusy(false); }
  };

  const deleteMemory = async () => {
    if (!activeDate) return;
    if (!storageReady) { setFormError('Saved memories are not available right now. Nothing has been changed.'); return; }
    const key = dateKey(activeDate);
    const nextMap = { ...memories };
    delete nextMap[key];
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMap));
      setMemories(nextMap);
      try { await removePhotos((memories[key]?.photos ?? []).map(photo => photo.id)); }
      catch (error) { setStorageError(`Memory removed, but its stored photos could not be cleared: ${error instanceof Error ? error.message : 'storage error'}`); }
      closeDialog();
    } catch (error) { setFormError(error instanceof Error ? `Could not remove this memory: ${error.message}` : 'Could not remove this memory.'); }
  };

  const jumpToStart = () => { setShownMonth(new Date(2026, 9, 1)); setPickerOpen(false); };

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="brand" aria-label="Little Keeps calendar">
          <PocketMark />
          <span className="brand-copy"><span className="brand-name">little keeps</span><span className="brand-tagline">a small place for days worth remembering</span></span>
        </div>
        <div className="popover-anchor month-controls">
          <button className="round-control" type="button" aria-label="Previous month" data-testid="button-previous-month" onClick={() => moveMonth(-1)}><ArrowIcon direction="left" /></button>
          <button className="month-pill" type="button" aria-expanded={pickerOpen} aria-label={`Choose month, currently ${monthName} ${shownYear}`} data-testid="button-open-month-picker" onClick={() => { setPickerYear(shownYear); setPickerOpen(value => !value); }}>
            <strong>{monthName}</strong><span>{shownYear}</span>
          </button>
          <button className="round-control" type="button" aria-label="Next month" data-testid="button-next-month" onClick={() => moveMonth(1)}><ArrowIcon direction="right" /></button>
          {pickerOpen && <div className="month-picker" role="dialog" aria-label="Choose a month"><div className="picker-head"><strong>{pickerYear}</strong><span className="picker-arrows"><button type="button" aria-label="Previous year" data-testid="button-previous-year" onClick={() => setPickerYear(year => year - 1)}><ArrowIcon direction="left" /></button><button type="button" aria-label="Next year" data-testid="button-next-year" onClick={() => setPickerYear(year => year + 1)}><ArrowIcon direction="right" /></button></span></div><div className="month-options">{SHORT_MONTHS.map((month, index) => <button type="button" className={`month-option${shownYear === pickerYear && shownMonth.getMonth() === index ? ' active' : ''}`} key={month} data-testid={`button-month-${index}`} onClick={() => { setShownMonth(new Date(pickerYear, index, 1)); setPickerOpen(false); }}>{month}</button>)}</div></div>}
        </div>
        <div className="top-actions"><span className="tucked-count" data-testid="text-memory-count"><CalendarIcon /> {memoryCount} tucked away</span><button className="today-pill" type="button" data-testid="button-return-to-october" onClick={jumpToStart}><CalendarIcon /> October</button></div>
      </header>

      {storageError && <div className="storage-notice" role="alert" data-testid="status-storage-error">{storageError}<button type="button" aria-label="Dismiss storage message" data-testid="button-dismiss-storage-error" onClick={() => setStorageError('')}>Dismiss</button></div>}

      <section className="calendar-card" aria-label={`${monthName} ${shownYear} calendar`}>
        <div className="calendar-intro"><div><div className="eyebrow">Your little time capsule</div><h1 className="calendar-title" data-testid="text-current-month">{monthName} {shownYear}</h1><p className="calendar-subtitle">One small pocket for each day worth remembering.</p></div><p className="memory-prompt"><span className="prompt-dot" />{memoryCount ? `${memoryCount} little ${memoryCount === 1 ? 'memory' : 'memories'} kept` : 'Ready for a first little memory?'}</p></div>
        <div className="weekdays" aria-hidden="true">{WEEKDAYS.map(day => <div className="weekday" key={day}>{day}</div>)}</div>
        <div className="calendar-grid" role="grid" aria-label={`${monthName} ${shownYear}`}>
          {calendarDays.map(date => {
            const key = dateKey(date), isCurrentMonth = date.getMonth() === shownMonth.getMonth(), saved = memories[key];
            const savedColor = saved?.color ?? COLORS[0].value;
            return <button className={`day-cell${isCurrentMonth ? '' : ' outside'}${saved ? ' has-memory' : ''}`} style={saved ? { '--envelope-color': savedColor } as CSSProperties : undefined} type="button" role="gridcell" key={key} aria-label={`${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}${saved ? `, memory: ${saved.title}` : ', add a memory'}`} data-testid={`button-day-${key}`} onClick={event => openMemory(date, event.currentTarget)}>
              <span className="day-number">{date.getDate()}</span><span className="capsule-art" aria-hidden="true" />
              {saved && <span className="day-envelope" aria-hidden="true"><span className="day-envelope-flap" /><span className="day-seal"><Seal name={(saved.seal as SealName) || 'star'} /></span></span>}
            </button>;
          })}
        </div>
      </section>

      {activeDate && <div className="memory-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) closeDialog(); }}>
        <form className={`memory-dialog${editing ? ' editing' : ' reading'}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title" onSubmit={saveMemory} ref={dialogRef} data-testid="dialog-memory">
          <div className="dialog-top"><div><p className="dialog-kicker">{activeMemory && !editing ? 'A note you tucked away' : 'A day to keep'}</p><h2 className="dialog-title" id="dialog-title">{activeDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</h2></div><button className="close-dialog" type="button" aria-label="Close memory editor" data-testid="button-close-memory" onClick={closeDialog}><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></button></div>
          {activeMemory && !editing ? <div className="envelope-reading">
            <div className="envelope-preview" style={{ '--envelope-color': activeMemory.color ?? COLORS[0].value } as CSSProperties}><div className="envelope-fold" /><div className="envelope-seal"><Seal name={(activeMemory.seal as SealName) || 'star'} /></div></div>
            <h3 className="reading-title" data-testid="text-memory-title">{activeMemory.title}</h3>
            {activeMemory.note && <p className="reading-note" data-testid="text-memory-note">{activeMemory.note}</p>}
            {!!activePhotos.length && <div className="photo-gallery" data-testid="gallery-memory-photos">{activePhotos.map(photo => <figure className="photo-item" key={photo.id}><img src={photoUrls[photo.id]} alt={photo.name} data-testid={`img-memory-${photo.id}`} /><figcaption>{photo.name}</figcaption></figure>)}</div>}
            <div className="reading-meta"><span><i style={{ backgroundColor: activeMemory.color ?? COLORS[0].value }} />{COLORS.find(item => item.value === activeMemory.color)?.name ?? 'Petal'} envelope</span><span><Seal name={(activeMemory.seal as SealName) || 'star'} />{SEALS.find(item => item.name === activeMemory.seal)?.label ?? 'Star'} seal</span></div>
            {formError && <p className="form-error" role="alert" data-testid="status-memory-error">{formError}</p>}
            <div className="dialog-actions reading-actions"><button className="delete-memory" type="button" data-testid="button-delete-memory" onClick={deleteMemory}>Remove memory</button><div className="dialog-actions-right"><button className="save-button" type="button" data-testid="button-edit-memory" onClick={() => setEditing(true)}>Open to edit</button></div></div>
          </div> : <>
            <p className="letter-hint">A little letter, photographs, or both. This stays on this browser.</p>
            <label className="memory-field-label" htmlFor="memory-title">What would you like to remember?</label>
            <input id="memory-title" className="memory-input" data-testid="input-memory-title" autoFocus maxLength={80} placeholder="Give this day a little name" value={title} onChange={event => setTitle(event.target.value)} />
            <label className="memory-field-label" htmlFor="memory-note">A few more details</label>
            <textarea id="memory-note" className="memory-textarea" data-testid="input-memory-note" maxLength={600} placeholder="The small things you want to keep..." value={note} onChange={event => setNote(event.target.value)} />
            <section className="envelope-options" aria-label="Envelope style"><div className="option-heading"><span>Envelope color</span><span className="option-caption">Choose a shade</span></div><div className="color-options">{COLORS.map(item => <button className={`color-swatch${color === item.value ? ' selected' : ''}`} type="button" key={item.value} title={item.name} aria-label={`${item.name} envelope`} aria-pressed={color === item.value} data-testid={`button-envelope-color-${item.name.toLowerCase()}`} style={{ '--swatch': item.value } as CSSProperties} onClick={() => setColor(item.value)}><span /></button>)}</div><div className="option-heading seal-heading"><span>Seal motif</span><span className="option-caption">A small finishing touch</span></div><div className="seal-options">{SEALS.map(item => <button className={`seal-choice${seal === item.name ? ' selected' : ''}`} type="button" key={item.name} aria-label={`${item.label} seal`} aria-pressed={seal === item.name} data-testid={`button-seal-${item.name}`} onClick={() => setSeal(item.name)}><Seal name={item.name} /><span>{item.label}</span></button>)}</div></section>
            <section className="photo-section"><div className="photo-heading"><div><label className="memory-field-label" htmlFor="memory-photos">Photographs</label><p>{activePhotos.length + newPhotos.length} of {PHOTO_LIMIT} · up to 10 MB each</p></div><button className="add-photos" type="button" data-testid="button-add-photos" disabled={activePhotos.length + newPhotos.length >= PHOTO_LIMIT} onClick={() => fileInput.current?.click()}>Add photos</button></div><input ref={fileInput} id="memory-photos" className="visually-hidden" type="file" accept="image/*" multiple data-testid="input-memory-photos" onChange={event => addPhotos(event.target.files)} /><div className="photo-list">{activePhotos.map(photo => <div className="photo-thumb" key={photo.id} data-testid={`photo-selected-${photo.id}`}>{photoUrls[photo.id] ? <img src={photoUrls[photo.id]} alt="" /> : <span className="photo-loading" aria-label="Loading saved photo" />}<button type="button" aria-label={`Remove ${photo.name}`} data-testid={`button-remove-photo-${photo.id}`} onClick={() => setRemovedPhotoIds(ids => [...ids, photo.id])}><span aria-hidden="true">×</span></button><small>{photo.name}</small></div>)}{newPhotos.map((photo, index) => <div className="photo-thumb" key={`${photo.name}-${index}`} data-testid={`photo-new-${index}`}><img src={newPhotoUrls[index]} alt="" /><button type="button" aria-label={`Remove ${photo.name}`} data-testid={`button-remove-new-photo-${index}`} onClick={() => setNewPhotos(files => files.filter((_, fileIndex) => fileIndex !== index))}><span aria-hidden="true">×</span></button><small>{photo.name}</small></div>)}{!activePhotos.length && !newPhotos.length && <p className="photo-empty">The little details you can see again.</p>}</div></section>
            {formError && <p className="form-error" role="alert" data-testid="status-memory-error">{formError}</p>}
            <div className="dialog-actions">{activeMemory ? <button className="delete-memory" type="button" data-testid="button-delete-memory" onClick={deleteMemory}>Remove memory</button> : <span /> }<div className="dialog-actions-right"><button className="cancel-button" type="button" data-testid="button-cancel-memory" onClick={closeDialog}>Cancel</button><button className="save-button" type="submit" data-testid="button-save-memory" disabled={busy}>{busy ? 'Keeping…' : 'Save memory'}</button></div></div>
          </>}
        </form>
      </div>}
    </main>
  );
}

export default App;
