import "./logo.css";

import Image from "next/image";

// Volcano logo: the multicolor pixel mark (exported asset) + the "VOLCANO"
// wordmark. The wordmark is inlined so its `currentColor` fills inherit the
// surrounding text color and adapt to light/dark themes; the mark stays an
// exported asset because it is multicolor.
type LogoProps = {
  /** Rendered height in px; width scales with the design aspect ratio. */
  height?: number;
  className?: string;
};

// Lava particles that erupt from the crater on hover (matches volcano-web).
const ERUPT_PARTICLES = ["a", "b", "c", "d"];

export function Logo({ height = 22, className }: LogoProps) {
  const markSize = height;
  const wordmarkHeight = Math.round(height * 0.84);

  return (
    <span className={`logo ${className ?? ""}`}>
      <span className="logo-mark-wrap">
        <Image
          src="/design/logo-mark.svg"
          alt="Volcano"
          width={markSize}
          height={markSize}
          className="logo-mark"
          priority
        />
        <span className="logo-erupt-particles" aria-hidden="true">
          {ERUPT_PARTICLES.map((id) => (
            <span key={id} className="logo-erupt-particle" />
          ))}
        </span>
      </span>
      <svg
        viewBox="0 0 139.556 18.5467"
        fill="none"
        height={wordmarkHeight}
        role="img"
        aria-label="Volcano"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M7.46283 18.5467V14.8376H3.73142V7.41933H0V0H3.73142V7.41827H7.46283V14.8365H11.1942V18.5457H7.46283V18.5467ZM11.1942 14.8376V7.41933H14.9257V14.8376H11.1942ZM14.9257 7.41827V0H18.6571V7.41827H14.9257Z" fill="currentColor" />
        <path d="M27.6123 18.5467V14.8376H23.8808V3.70914H27.6123V1.82261e-07H35.0751V3.70914H38.8065V14.8365H35.0751V18.5457H27.6123V18.5467ZM27.6123 14.6885H35.0751V3.85822H27.6123V14.6885Z" fill="currentColor" />
        <path d="M44.0313 18.5467V1.82261e-07H47.7628V14.8365H55.2256V18.5457H44.0313V18.5467Z" fill="currentColor" />
        <path d="M64.1808 18.5467V14.8376H60.4494V3.70914H64.1808V14.8365H71.6436V18.5457H64.1808V18.5467ZM71.6436 7.41827V3.70914H64.1808V1.82261e-07H71.6436V3.70914H75.375V7.41827H71.6436ZM71.6436 14.8376V11.1285H75.375V14.8376H71.6436Z" fill="currentColor" />
        <path d="M80.5999 18.5467V3.70914H84.3313V1.82261e-07H91.7941V3.70914H95.5255V18.5457H91.7941V11.1274H84.3313V18.5457H80.5999V18.5467ZM84.3313 7.41827H91.7941V3.85716H84.3313V7.41827Z" fill="currentColor" />
        <path d="M100.749 18.5467V1.82261e-07H104.481V3.70914H108.212V7.41827H111.944V11.1274H115.675V1.82261e-07H119.406V18.5457H115.675V14.8365H111.944V11.1274H108.212V7.41827H104.481V18.5457H100.749V18.5467Z" fill="currentColor" />
        <path d="M128.362 18.5467V14.8376H124.63V3.70914H128.362V1.82261e-07H135.824V3.70914H139.556V14.8365H135.824V18.5457H128.362V18.5467ZM128.362 14.6885H135.824V3.85822H128.362V14.6885Z" fill="currentColor" />
      </svg>
    </span>
  );
}
