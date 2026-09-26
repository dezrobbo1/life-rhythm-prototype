import { Button } from '../../components';
import type { LibraryRhythm, QuickPack } from './mockLibraryData';

type QuickPackCardProps = {
  onPreviewPack: (packId: string) => void;
  pack: QuickPack;
  previewOpen: boolean;
  rhythms: LibraryRhythm[];
};

export function QuickPackCard({
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
      </div>
      {previewOpen ? (
        <div className="quick-pack__preview" id={`${pack.id}-preview`}>
          <p>Preview only. Configure any rhythm individually before it can schedule.</p>
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
