type ScreenHeroProps = {
  className: string;
  eyebrow?: string;
  title: string;
  titleId: string;
  tagline: string;
};

export function ScreenHero({
  className,
  eyebrow,
  title,
  titleId,
  tagline,
}: ScreenHeroProps) {
  return (
    <header className={`screen-heading ${className}`} aria-labelledby={titleId}>
      <div className="screen-hero__content">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 id={titleId}>{title}</h1>
        <p>{tagline}</p>
      </div>
    </header>
  );
}
