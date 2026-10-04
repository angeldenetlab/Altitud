export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1.5 hidden h-8 w-1 shrink-0 rounded-full bg-gradient-to-b from-primary to-accent sm:block"
        />
        <div>
          <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h2>
          {description && (
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
