import { cn } from "@/lib/utils";

/** Section heading in the style of a legal opinion: "§ 2  How it works". */
export function SectionHeading({
  id,
  number,
  eyebrow,
  children,
  className,
}: {
  id?: string;
  number: string | number;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2
        id={id}
        className="flex items-baseline gap-3 text-2xl font-semibold text-primary sm:text-3xl"
      >
        <span className="section-mark text-xl sm:text-2xl" aria-hidden="true">
          §&thinsp;{number}
        </span>
        <span>{children}</span>
      </h2>
      <hr className="rule-brass w-16" />
    </div>
  );
}
