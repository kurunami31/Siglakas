import Image from "next/image";

/**
 * The institutions behind the festival, shown as the organiser strip.
 *
 * These are the real official marks (DOrSU, the Students' Sports and Wellness
 * office, OSCAL and the University Student Council) alongside the SIGLAKAS
 * festival logo — never recoloured, redrawn or cropped. Each sits in a white
 * disc so the mixed transparency of the masters reads as one set on the dark
 * footer. The alt text carries the full institution name, so the strip is
 * meaningful to a screen reader rather than decorative.
 */
const PARTNERS = [
  { src: "/brand/partners/dorsu.png", label: "Davao Oriental State University" },
  { src: "/brand/partners/oscal.png", label: "Office of Student Culture and Arts Literacy" },
  { src: "/brand/partners/students-sports.png", label: "Office of the Students Sports and Wellness" },
  { src: "/brand/partners/usc.png", label: "DOrSU University Student Council" },
];

export function PartnerLogos({ className = "" }: { className?: string }) {
  return (
    <ul
      aria-label="Festival organizers and offices"
      className={`flex flex-wrap items-start justify-center gap-x-2 gap-y-3 sm:gap-x-4 ${className}`}
    >
      {PARTNERS.map((p) => (
        <li key={p.src} className="flex w-[4.75rem] flex-col items-center gap-1 sm:w-[5.5rem]">
          <Image
            src={p.src}
            alt={p.label}
            width={128}
            height={128}
            className="h-14 w-14 rounded-full bg-white object-contain p-0.5 ring-1 ring-foam/25 sm:h-16 sm:w-16"
          />
          <span className="w-full text-center text-[0.6rem] leading-tight text-foam/60 sm:text-[0.65rem]">
            {p.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
