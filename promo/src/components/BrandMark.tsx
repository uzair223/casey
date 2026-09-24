const C_PATH =
  "M379 162C342 112 286 91 221 96C132 103 72 162 72 254C72 344 133 402 225 409C295 414 350 389 384 334";
const TAIL_PATH = "M103 331L76 428L176 397L141 363L103 331Z";

export const BrandMark: React.FC<{
  size?: number;
  color?: string;
}> = ({ size = 180, color = "#f3efe6" }) => {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden>
      <path
        d={C_PATH}
        fill="none"
        stroke={color}
        strokeWidth="58"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d={TAIL_PATH} fill={color} />
      <path
        d="M174 211H254"
        stroke={color}
        strokeWidth="25"
        strokeLinecap="round"
      />
      <path
        d="M174 258H309"
        stroke={color}
        strokeWidth="25"
        strokeLinecap="round"
      />
      <path
        d="M174 305H252"
        stroke={color}
        strokeWidth="25"
        strokeLinecap="round"
      />
    </svg>
  );
};
