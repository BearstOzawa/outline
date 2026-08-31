type Props = {
  size?: number;
  color?: string;
};

export default function SamlIcon({
  size = 24,
  color = "currentColor",
}: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L4 6v6c0 5 3.4 9.4 8 10.7C16.6 21.4 20 17 20 12V6l-8-4z"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M8.5 12.5l2.2 2.2 4.8-5"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
