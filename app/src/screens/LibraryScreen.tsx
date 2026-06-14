import { useMemo, useState } from 'react';
import { Button, Card, EmptyState } from '../components';
import {
  CreateRhythmModal,
  createMockLibraryRhythm,
  type CreateRhythmInput,
} from '../features/library/CreateRhythmModal';
import { LibraryRhythmCard } from '../features/library/LibraryRhythmCard';
import { QuickPackCard } from '../features/library/QuickPackCard';
import {
  libraryCategories,
  mockLibraryRhythms,
  mockQuickPacks,
  type LibraryCategory,
  type LibraryRhythm,
  type QuickPack,
} from '../features/library/mockLibraryData';

export function LibraryScreen() {
  const [libraryRhythms, setLibraryRhythms] = useState<LibraryRhythm[]>(mockLibraryRhythms);
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>('All');
  const [enabledById, setEnabledById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(mockLibraryRhythms.map((rhythm) => [rhythm.id, rhythm.enabled])),
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [createRhythmOpen, setCreateRhythmOpen] = useState(false);
  const [previewPackId, setPreviewPackId] = useState<string | null>(null);

  const filteredRhythms = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return libraryRhythms.filter((rhythm) => {
      const matchesCategory = activeCategory === 'All' || rhythm.category === activeCategory;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        `${rhythm.title} ${rhythm.category} ${rhythm.purpose}`.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, libraryRhythms, searchTerm]);

  const groupedRhythms = useMemo(() => {
    return filteredRhythms.reduce<Record<string, LibraryRhythm[]>>((groups, rhythm) => {
      groups[rhythm.category] = [...(groups[rhythm.category] ?? []), rhythm];
      return groups;
    }, {});
  }, [filteredRhythms]);

  function clearFilters() {
    setActiveCategory('All');
    setSearchTerm('');
  }

  function toggleEnabled(rhythmId: string) {
    setEnabledById((current) => ({ ...current, [rhythmId]: !current[rhythmId] }));
  }

  function addToToday(rhythm: LibraryRhythm) {
    setConfirmation(`${rhythm.title} is shown as a mock Today add. Nothing was saved or created.`);
  }

  function enablePack(pack: QuickPack) {
    setEnabledById((current) => ({
      ...current,
      ...Object.fromEntries(pack.rhythmIds.map((rhythmId) => [rhythmId, true])),
    }));
    setConfirmation(`${pack.rhythmIds.length} rhythms enabled. Today only shows what fits.`);
  }

  function saveCreatedRhythm(input: CreateRhythmInput) {
    const rhythm = createMockLibraryRhythm(input);

    setLibraryRhythms((current) => [rhythm, ...current]);
    setEnabledById((current) => ({ ...current, [rhythm.id]: rhythm.enabled }));
    setActiveCategory(rhythm.category);
    setSearchTerm('');
    setConfirmation('Rhythm created in preview only.');
    setCreateRhythmOpen(false);
  }

  return (
    <div className="screen-stack library-screen">
      <section className="library-hero" aria-labelledby="library-title">
        <p className="eyebrow">Rhythm catalogue</p>
        <h1 id="library-title">Library</h1>
        <p>Turn on rhythms when they are useful. Today only shows what fits.</p>
      </section>

      <Card>
        <section aria-labelledby="library-create-title" className="library-create-card">
          <div>
            <h2 id="library-create-title">Create reusable support</h2>
            <p>
              Create rhythm makes a reusable template. Add to Today now is only for a one-off today action.
            </p>
          </div>
          <div className="library-create-card__actions">
            <Button onClick={() => setCreateRhythmOpen(true)} variant="primary">Create rhythm</Button>
            <Button disabled>Create pack later</Button>
          </div>
        </section>
      </Card>

      <Card>
        <div className="library-filters">
          <label>
            <span>Search rhythms</span>
            <input
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by rhythm, category, or purpose"
              type="search"
              value={searchTerm}
            />
          </label>
          <div aria-label="Library categories" className="library-category-row" role="list">
            {libraryCategories.map((category) => (
              <button
                aria-pressed={activeCategory === category}
                key={category}
                onClick={() => setActiveCategory(category)}
                type="button"
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {confirmation ? <p className="library-confirmation" role="status">{confirmation}</p> : null}

      <section className="quick-packs" aria-labelledby="quick-packs-title">
        <div className="section-heading">
          <h2 id="quick-packs-title">Quick packs</h2>
          <p>Preview first. Packs enable rhythms, not task piles.</p>
        </div>
        <div className="quick-pack-grid">
          {mockQuickPacks.map((pack) => (
            <QuickPackCard
              key={pack.id}
              onEnablePack={enablePack}
              onPreviewPack={(packId) => setPreviewPackId((current) => (current === packId ? null : packId))}
              pack={pack}
              previewOpen={previewPackId === pack.id}
              rhythms={libraryRhythms.filter((rhythm) => pack.rhythmIds.includes(rhythm.id))}
            />
          ))}
        </div>
      </section>

      {filteredRhythms.length > 0 ? (
        <div className="library-groups">
          {Object.entries(groupedRhythms).map(([category, rhythms]) => (
            <section aria-labelledby={`${category}-library-heading`} className="library-group" key={category}>
              <div className="section-heading">
                <h2 id={`${category}-library-heading`}>{category}</h2>
                <p>{rhythms.length} rhythm{rhythms.length === 1 ? '' : 's'} in this view.</p>
              </div>
              <div className="library-card-grid">
                {rhythms.map((rhythm) => (
                  <LibraryRhythmCard
                    enabled={Boolean(enabledById[rhythm.id])}
                    key={rhythm.id}
                    onAddToday={addToToday}
                    onToggleEnabled={toggleEnabled}
                    rhythm={rhythm}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          action={<Button onClick={clearFilters} variant="primary">Clear filters</Button>}
          message="Try another category or clear the search."
          title="No rhythms match this filter"
        />
      )}
      <CreateRhythmModal
        onClose={() => setCreateRhythmOpen(false)}
        onSave={saveCreatedRhythm}
        open={createRhythmOpen}
      />
    </div>
  );
}
