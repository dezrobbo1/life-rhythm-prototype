type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className = '' }: BrandMarkProps) {
  return (
    <span className={`brand-mark ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 64 64" focusable="false">
        <circle className="brand-mark__sky" cx="32" cy="32" r="30" />
        <path
          className="brand-mark__sun"
          d="M42 17.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"
        />
        <path
          className="brand-mark__hill brand-mark__hill--back"
          d="M8 40c7.8-10.2 15.7-15.3 23.8-15.3 9.2 0 16.6 6.4 24.2 13.4V56H8V40Z"
        />
        <path
          className="brand-mark__hill brand-mark__hill--front"
          d="M7 48.8c7.4-6.5 14.2-9.8 20.4-9.8 8.5 0 15.6 5.8 29.6 2.4V56H7v-7.2Z"
        />
        <path
          className="brand-mark__wave"
          d="M8 36.7c7.3 5.1 14.1 6.8 20.5 5.2 5-1.3 8.9-4.8 13.6-5.5 4.1-.6 8.8.9 14.1 4.6"
        />
      </svg>
    </span>
  );
}
