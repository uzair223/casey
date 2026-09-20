const C_PATH =
  "M379 162C342 112 286 91 221 96C132 103 72 162 72 254C72 344 133 402 225 409C295 414 350 389 384 334";
const TAIL_PATH = "M103 331L76 428L176 397L141 363L103 331Z";

export const BrandMark: React.FC<{
  size?: number;
  gradientId?: string;
}> = ({ size = 180, gradientId = "casey-mark" }) => {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      aria-hidden
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="88"
          y1="398"
          x2="420"
          y2="116"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#7357FF" />
          <stop offset="0.55" stopColor="#4E4BFF" />
          <stop offset="1" stopColor="#2D35E8" />
        </linearGradient>
      </defs>
      <path
        d={C_PATH}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="58"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d={TAIL_PATH} fill={`url(#${gradientId})`} />
      <path
        d="M174 211H254"
        stroke="#07122E"
        strokeWidth="25"
        strokeLinecap="round"
      />
      <path
        d="M174 258H309"
        stroke="#07122E"
        strokeWidth="25"
        strokeLinecap="round"
      />
      <path
        d="M174 305H252"
        stroke="#07122E"
        strokeWidth="25"
        strokeLinecap="round"
      />
    </svg>
  );
};
