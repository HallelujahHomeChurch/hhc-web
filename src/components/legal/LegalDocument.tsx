type LegalSection = {
  title: string;
  body: readonly string[];
};

type LegalDocumentProps = {
  content: {
    heroTitle: string;
    heroSubtitle: string;
    updatedAtLabel: string;
    updatedAt: string;
    intro: string;
    sections: readonly LegalSection[];
  };
};

export function LegalDocument({content}: LegalDocumentProps) {
  return (
    <section className="bg-[linear-gradient(180deg,var(--color-cream),#fffaf4)] py-16">
      <article className="shell max-w-[880px]">
        <h1 className="text-[clamp(34px,5vw,56px)] font-medium leading-tight text-ink">{content.heroTitle}</h1>
        {content.heroSubtitle ? <p className="mt-4 text-xl leading-8 text-muted">{content.heroSubtitle}</p> : null}
        <p className="mt-8 text-sm font-semibold text-primary">
          {content.updatedAtLabel} {content.updatedAt}
        </p>
        <p className="mt-5 text-lg leading-8 text-ink">{content.intro}</p>
        <div className="mt-10 grid gap-8">
          {content.sections.map((section) => (
            <section key={section.title} className="border-t border-line pt-7">
              <h2 className="text-2xl font-medium text-ink">{section.title}</h2>
              <div className="mt-4 grid gap-3 text-[16px] leading-8 text-muted">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </section>
  );
}
