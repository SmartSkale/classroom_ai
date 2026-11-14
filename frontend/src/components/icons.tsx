const PATHS = {
  lesson: ['M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z', 'M4 19.5A2 2 0 0 0 6 21h13v-4'],
  quiz: ['M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7', 'M12 17h.01', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z'],
  slides: ['M3 4h18v12H3z', 'M8 20h8', 'M12 16v4'],
  cards: ['M3 6h18v12H3z', 'M3 10h18', 'M7 14h4'],
  image: ['M3 3h18v18H3z', 'M8.5 8.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0', 'M21 15l-5-5L5 21'],
  audio: ['M11 5L6 9H3v6h3l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 5.5a9 9 0 0 1 0 13'],
  video: ['M2 6h14v12H2z', 'M22 8l-6 4 6 4z'],
  presenter: ['M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2'],
  play: ['M7 4l13 8-13 8z'],
  pause: ['M6 4h4v16H6z', 'M14 4h4v16h-4z'],
  source: ['M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z', 'M14 3v6h6', 'M8 13h8', 'M8 17h8'],
  sparkle: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z'],
  download: ['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14'],
  flip: ['M4 4v6h6', 'M20 20v-6h-6', 'M20 9a8 8 0 0 0-14-3', 'M4 15a8 8 0 0 0 14 3'],
  left: ['M15 18l-6-6 6-6'],
  right: ['M9 18l6-6-6-6'],
  check: ['M20 6L9 17l-5-5'],
  alert: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8v4', 'M12 16h.01'],
  upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M4 16v4h16v-4'],
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}
