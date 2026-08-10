/**
 * Artwork for the domain cards.
 *
 * Drawn as inline SVG rather than shipped as images: it stays crisp at any
 * size, takes its colour from the card it sits in, adds nothing to the page
 * weight, and needs no build step. Each motif shares one 240x130 frame so the
 * cards line up whatever the domain.
 */

function Frame({ accent, children }) {
  return (
    <svg viewBox="0 0 240 130" role="presentation" aria-hidden="true" className="domainArt">
      <g fill="none" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

/** Evenly spaced nodes for the neural-net motif. */
function netColumn(x, count, accent) {
  const gap = 96 / (count + 1);
  return Array.from({ length: count }, (_, i) => (
    <circle key={`${x}-${i}`} cx={x} cy={22 + gap * (i + 1)} r="5" fill={accent} fillOpacity=".22" />
  ));
}

const MOTIFS = {
  // Browser chrome with a hero block and copy lines
  web: (c) => (
    <>
      <rect x="24" y="16" width="192" height="98" rx="9" strokeOpacity=".55" />
      <path d="M24 42h192" strokeOpacity=".55" />
      <circle cx="39" cy="29" r="3.4" fill={c} stroke="none" fillOpacity=".9" />
      <circle cx="51" cy="29" r="3.4" fill={c} stroke="none" fillOpacity=".55" />
      <circle cx="63" cy="29" r="3.4" fill={c} stroke="none" fillOpacity=".3" />
      <rect x="38" y="56" width="64" height="44" rx="6" fill={c} fillOpacity=".18" strokeOpacity=".5" />
      <rect x="114" y="56" width="88" height="13" rx="5" fill={c} fillOpacity=".3" stroke="none" />
      <rect x="114" y="76" width="66" height="9" rx="4.5" fill={c} fillOpacity=".16" stroke="none" />
      <rect x="114" y="91" width="48" height="9" rx="4.5" fill={c} fillOpacity=".16" stroke="none" />
    </>
  ),

  // Three-layer network with weighted edges
  aiml: (c) => (
    <>
      <g strokeOpacity=".32">
        {[46, 70, 94].map((y1) =>
          [40, 65, 90].map((y2) => <path key={`a${y1}-${y2}`} d={`M66 ${y1}L120 ${y2}`} />)
        )}
        {[40, 65, 90].map((y1) =>
          [53, 82].map((y2) => <path key={`b${y1}-${y2}`} d={`M120 ${y1}L174 ${y2}`} />)
        )}
      </g>
      {netColumn(66, 3, c)}
      <circle cx="120" cy="40" r="5" fill={c} fillOpacity=".22" />
      <circle cx="120" cy="65" r="5" fill={c} fillOpacity=".22" />
      <circle cx="120" cy="90" r="5" fill={c} fillOpacity=".22" />
      <circle cx="174" cy="53" r="6" fill={c} fillOpacity=".45" />
      <circle cx="174" cy="82" r="6" fill={c} fillOpacity=".45" />
    </>
  ),

  // Phone with a card stack
  app: (c) => (
    <>
      <rect x="88" y="10" width="64" height="110" rx="11" strokeOpacity=".6" />
      <path d="M110 18h20" strokeOpacity=".7" />
      <rect x="96" y="30" width="48" height="28" rx="5" fill={c} fillOpacity=".24" strokeOpacity=".4" />
      <rect x="96" y="64" width="48" height="8" rx="4" fill={c} fillOpacity=".16" stroke="none" />
      <rect x="96" y="78" width="34" height="8" rx="4" fill={c} fillOpacity=".16" stroke="none" />
      <circle cx="120" cy="105" r="4" strokeOpacity=".7" />
      <path d="M58 40v50M182 40v50" strokeOpacity=".22" />
      <path d="M52 52l6-8 6 8M176 52l6-8 6 8" strokeOpacity=".35" />
    </>
  ),

  // Checklist under a magnifier
  qa: (c) => (
    <>
      <rect x="30" y="18" width="112" height="94" rx="8" strokeOpacity=".5" />
      {[40, 62, 84].map((y, i) => (
        <g key={y}>
          <rect x="44" y={y} width="14" height="14" rx="4" fill={c} fillOpacity={i === 2 ? ".1" : ".28"} strokeOpacity=".5" />
          {i !== 2 && <path d={`M47.5 ${y + 7.5}l3 3 6-6.5`} strokeWidth="2" />}
          {i === 2 && <path d={`M47.5 ${y + 4}l7 7M54.5 ${y + 4}l-7 7`} strokeWidth="2" />}
          <rect x="68" y={y + 4} width={i === 1 ? 44 : 58} height="7" rx="3.5" fill={c} fillOpacity=".16" stroke="none" />
        </g>
      ))}
      <circle cx="168" cy="60" r="30" strokeWidth="2.4" strokeOpacity=".85" fill={c} fillOpacity=".07" />
      <path d="M190 82l18 18" strokeWidth="3.4" strokeOpacity=".85" />
      <path d="M158 60h20M168 50v20" strokeOpacity=".5" />
    </>
  ),

  // Shield with a keyhole and scanning lines
  cyber: (c) => (
    <>
      <path d="M120 12l44 17v34c0 26-19 46-44 55-25-9-44-29-44-55V29z" strokeOpacity=".7" fill={c} fillOpacity=".09" />
      <circle cx="120" cy="58" r="11" strokeWidth="2.2" />
      <path d="M120 69v16" strokeWidth="2.2" />
      <path d="M40 44h26M40 62h18M40 80h26" strokeOpacity=".35" />
      <path d="M174 44h26M182 62h18M174 80h26" strokeOpacity=".35" />
    </>
  ),

  // Overlapping shapes with a pen nib
  creatives: (c) => (
    <>
      <circle cx="92" cy="60" r="34" fill={c} fillOpacity=".16" strokeOpacity=".5" />
      <rect x="104" y="30" width="60" height="60" rx="8" fill={c} fillOpacity=".12" strokeOpacity=".5" />
      <path d="M150 92l30-52 30 52z" fill={c} fillOpacity=".1" strokeOpacity=".45" transform="scale(.62) translate(90 34)" />
      <path d="M168 34l12 12-30 30-16 4 4-16z" strokeWidth="2" strokeOpacity=".85" />
      <path d="M138 64l16 16" strokeOpacity=".5" />
    </>
  ),

  // Rising bars, a coin and an upward arrow
  sponsi: (c) => (
    <>
      <path d="M34 106h172" strokeOpacity=".45" />
      {[
        [56, 38], [86, 56], [116, 74],
      ].map(([x, h]) => (
        <rect key={x} x={x} y={106 - h} width="22" height={h} rx="4" fill={c} fillOpacity=".2" strokeOpacity=".5" />
      ))}
      <rect x="146" y="24" width="22" height="82" rx="4" fill={c} fillOpacity=".42" strokeOpacity=".7" />
      <circle cx="192" cy="42" r="17" strokeWidth="2.2" fill={c} fillOpacity=".14" />
      <path d="M192 33v18M187 38h10M187 46h10" strokeOpacity=".8" />
      <path d="M46 66l28-18 28 18 30-24" strokeOpacity=".35" strokeDasharray="4 5" />
    </>
  ),

  // Megaphone with broadcast arcs
  pr: (c) => (
    <>
      <path d="M46 52h22l44-24v74l-44-24H46z" fill={c} fillOpacity=".18" strokeOpacity=".7" />
      <path d="M68 78v20a8 8 0 0 0 16 0V86" strokeOpacity=".6" />
      <path d="M132 44a34 34 0 0 1 0 42" strokeOpacity=".7" />
      <path d="M148 32a54 54 0 0 1 0 66" strokeOpacity=".45" />
      <path d="M164 20a74 74 0 0 1 0 90" strokeOpacity=".25" />
    </>
  ),

  // Calendar with a marked day
  events: (c) => (
    <>
      <rect x="46" y="24" width="148" height="90" rx="9" strokeOpacity=".6" />
      <path d="M46 50h148" strokeOpacity=".6" />
      <path d="M78 16v18M162 16v18" strokeWidth="2.4" strokeOpacity=".8" />
      {[0, 1, 2, 3].map((col) =>
        [0, 1].map((row) => {
          const marked = col === 2 && row === 1;
          return (
            <rect
              key={`${col}-${row}`}
              x={62 + col * 34} y={62 + row * 26} width="22" height="16" rx="4"
              fill={c} fillOpacity={marked ? ".55" : ".14"} strokeOpacity={marked ? ".9" : ".3"}
            />
          );
        })
      )}
    </>
  ),

  // Film strip with a play head
  video: (c) => (
    <>
      <rect x="30" y="34" width="180" height="62" rx="7" strokeOpacity=".6" />
      <path d="M30 50h180M30 80h180" strokeOpacity=".35" />
      {[38, 62, 86, 158, 182].map((x) => (
        <rect key={x} x={x} y="38" width="12" height="8" rx="2" fill={c} fillOpacity=".3" stroke="none" />
      ))}
      {[38, 62, 86, 158, 182].map((x) => (
        <rect key={`b${x}`} x={x} y="84" width="12" height="8" rx="2" fill={c} fillOpacity=".3" stroke="none" />
      ))}
      <circle cx="120" cy="65" r="20" fill={c} fillOpacity=".16" strokeOpacity=".7" />
      <path d="M114 55l16 10-16 10z" fill={c} fillOpacity=".85" stroke="none" />
    </>
  ),
};

export default function DomainArt({ motif, accent }) {
  const draw = MOTIFS[motif];
  if (!draw) return null;
  return <Frame accent={accent}>{draw(accent)}</Frame>;
}
