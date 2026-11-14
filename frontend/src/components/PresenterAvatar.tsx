import type { PresenterExpression } from '../api'

type Props = {
  /** Mouth openness from 0 (closed) to 1 (wide), driven by the narration's loudness. */
  mouth: number
  expression: PresenterExpression
  speaking: boolean
}

/** A friendly 2D presenter. Pure SVG, so it stays crisp at any size and needs no image assets. */
export function PresenterAvatar({ mouth, expression, speaking }: Props) {
  const open = Math.max(0, Math.min(1, mouth))
  const mouthRy = 2 + open * 14
  const mouthRx = 16 - open * 3
  const browLift = expression === 'excited' ? -4 : expression === 'thinking' ? -2 : 0
  const browTilt = expression === 'thinking' ? 4 : 0
  const smile = expression === 'happy' || expression === 'excited' ? 1 : 0

  return (
    <svg className={`avatar ${speaking ? 'is-speaking' : ''}`} viewBox="0 0 320 380" role="img" aria-label="Presenter">
      <defs>
        <linearGradient id="avatar-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e1b4b" />
          <stop offset="1" stopColor="#0b0b12" />
        </linearGradient>
        <linearGradient id="avatar-shirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>

      <rect width="320" height="380" rx="24" fill="url(#avatar-bg)" />
      <circle cx="260" cy="70" r="90" fill="#6366f1" opacity="0.12" />
      <circle cx="60" cy="300" r="70" fill="#34d399" opacity="0.08" />

      <g className="avatar-body">
        <path d="M70 380 Q70 268 160 262 Q250 268 250 380 Z" fill="url(#avatar-shirt)" />
        <path d="M140 262 L160 300 L180 262 Z" fill="#f4f4f5" opacity="0.9" />
      </g>

      <g className="avatar-head">
        <rect x="142" y="222" width="36" height="46" rx="12" fill="#e7b99a" />
        <ellipse cx="160" cy="165" rx="72" ry="78" fill="#f2c7a5" />
        <path d="M86 160 Q82 80 160 74 Q240 80 234 160 Q226 118 160 116 Q104 118 86 160 Z" fill="#1f1b16" />

        <g className="avatar-eyes">
          <ellipse className="avatar-eye" cx="132" cy="166" rx="7" ry="9" fill="#1f1b16" />
          <ellipse className="avatar-eye" cx="188" cy="166" rx="7" ry="9" fill="#1f1b16" />
          <circle cx="134" cy="163" r="2.2" fill="#fff" />
          <circle cx="190" cy="163" r="2.2" fill="#fff" />
        </g>

        <path
          d={`M118 ${142 + browLift} Q132 ${134 + browLift} 146 ${142 + browLift + browTilt}`}
          stroke="#1f1b16"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={`M174 ${142 + browLift + browTilt} Q188 ${134 + browLift} 202 ${142 + browLift}`}
          stroke="#1f1b16"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />

        <circle cx="116" cy="190" r="10" fill="#f08c8c" opacity="0.35" />
        <circle cx="204" cy="190" r="10" fill="#f08c8c" opacity="0.35" />

        <ellipse cx="160" cy="210" rx={mouthRx} ry={mouthRy} fill="#7f1d1d" />
        {open > 0.15 && <ellipse cx="160" cy={210 + mouthRy * 0.3} rx={mouthRx * 0.6} ry={mouthRy * 0.45} fill="#fca5a5" />}
        {smile > 0 && open < 0.2 && (
          <path d="M144 208 Q160 222 176 208" stroke="#7f1d1d" strokeWidth="3" strokeLinecap="round" fill="none" />
        )}
      </g>
    </svg>
  )
}
