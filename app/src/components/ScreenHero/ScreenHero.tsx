import { AppIcon, type AppIconName } from '../AppIcon/AppIcon';

type ScreenHeroProps = {
  className: string;
  eyebrow: string;
  icon: AppIconName;
  title: string;
  titleId: string;
  tagline: string;
};

export function ScreenHero({
  className,
  eyebrow,
  icon,
  title,
  titleId,
  tagline,
}: ScreenHeroProps) {
  return (
    <section className={className} aria-labelledby={titleId}>
      <span className="screen-hero__mark" aria-hidden="true">
        <AppIcon name={icon} size={26} />
      </span>
      <div className="screen-hero__content">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id={titleId}>{title}</h1>
        <p>{tagline}</p>
      </div>
    </section>
  );
}
