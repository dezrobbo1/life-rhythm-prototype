import { Button } from '../../components';
import type { LibraryRhythm, QuickPack } from './mockLibraryData';

type QuickPackCardProps = {
  onEnablePack: (pack: QuickPack) => void;
  onPreviewPack: (packId: string) => void;
  pack: QuickPack;
  previewOpen: boolean;
  rhythms: LibraryRhythm[];
};

export function QuickPackCard({
  onEnablePack,
  onPreviewPack,
  pack,
  previewOpen,
  rhythms,
}: QuickPackCardProps) {
  return (
    <article className="quick-pack" aria-labelledby={`${pack.id}-title`}>
      <div>
        <h3 id={`${pack.id}-title`}>{pack.title}</h3>
        <p>{pack.purpose}</p>
      </div>
      <div className="quick-pack__actions">
        <Button
          aria-controls={`${pack.id}-preview`}
          aria-expanded={previewOpen}
          onClick={() => onPreviewPack(pack.id)}
        >
          Preview pack
        </Button>
        <Button onClick={() => onEnablePack(pack)} variant="primary">
          Enable selected rhythms
        </Button>
      </div>
      {previewOpen ? (
        <div className="quick-pack__preview" id={`${pack.id}-preview`}>
          <p>Packs enable rhythms. Today only shows what fits.</p>
          <ul>
            {rhythms.map((rhythm) => (
              <li key={rhythm.id}>{rhythm.title}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
