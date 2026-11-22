import { bankInitials, bankMark, bankSlug, inkFor } from "@/lib/bankIdentity";

/**
 * Logos dropped in assets/banks/ win over everything else, so a bank the
 * open collection lacks can still show its real mark: name the file after the
 * institution ("itau.svg", "banco-do-brasil.png").
 */
const customLogos = import.meta.glob<string>("../../../../assets/banks/*.{svg,png,webp}", {
  eager: true,
  query: "?url",
  import: "default",
});
const logoBySlug = new Map(
  Object.entries(customLogos).map(([file, url]) => [file.replace(/^.*\/|\.[a-z]+$/g, ""), url]),
);

const sizes = {
  sm: { box: "h-7 w-7 rounded-lg text-[10px]", glyph: 15 },
  md: { box: "h-9 w-9 rounded-xl text-xs", glyph: 18 },
  lg: { box: "h-11 w-11 rounded-2xl text-sm", glyph: 22 },
};

/** The institution's face: its logo when there is one, else its initials, on its color. */
export function InstitutionMark({
  name,
  color,
  size = "md",
}: {
  name: string;
  color: string;
  size?: keyof typeof sizes;
}) {
  const look = sizes[size];
  const custom = logoBySlug.get(bankSlug(name));
  if (custom) {
    return (
      <span className={`flex shrink-0 items-center justify-center overflow-hidden bg-white ${look.box}`}>
        <img src={custom} alt="" className="h-full w-full object-contain p-1" />
      </span>
    );
  }
  const ink = inkFor(color);
  const mark = bankMark(name);
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center font-medium tracking-tight ${look.box}`}
      style={{ background: color, color: ink }}
    >
      {mark ? (
        <svg width={look.glyph} height={look.glyph} viewBox="0 0 24 24" fill="currentColor">
          <path d={mark} />
        </svg>
      ) : (
        bankInitials(name)
      )}
    </span>
  );
}
