import { useId } from 'react'
import { FACADE_LABEL, formatArea } from '../domain/format'
import type { Apartment } from '../domain/types'
import './FloorPlan.css'

const SCALE = 40
const metres = (value: number) => `${value.toFixed(1).replace('.', ',')} m`

export function FloorPlan({ apartment }: { apartment: Apartment }) {
  const id = useId()
  const { plan, planW, planH } = apartment
  const width = planW * SCALE
  const height = planH * SCALE
  const bottom = Math.max(planH, ...plan.map((room) => room.y + room.h)) * SCALE
  const viewWidth = width + 72
  // Utrzymujemy co najmniej 11,5 px tekstu przy szerokości SVG 360 px.
  const unit = viewWidth / 360
  const fontSize = 12.5 * unit
  const dimensionY = bottom + 28 * unit
  const footerY = dimensionY + 36 * unit
  const viewHeight = footerY + 24 * unit
  const entrance = plan.find((room) => room.kind === 'hol' && room.y === 0)
  const doorX = entrance ? (entrance.x + 0.25) * SCALE : 0
  const doorWidth = entrance ? Math.min(0.9, entrance.w - 0.5) * SCALE : 0
  const description = plan.map((room) => `${room.label} ${formatArea(room.w * room.h)}`).join(', ')

  return (
    <svg
      className="floor-plan"
      viewBox={`-56 -44 ${viewWidth} ${viewHeight + 44}`}
      width="100%"
      role="img"
      aria-label={`Rzut mieszkania ${apartment.id}: ${description}. Okna: ${FACADE_LABEL[apartment.facade]}.`}
      fontSize={fontSize}
    >
      <defs>
        {plan.map((room, index) => (
          <clipPath id={`${id}-room-${index}`} key={index}>
            <rect
              x={room.x * SCALE + 5}
              y={room.y * SCALE + 5}
              width={Math.max(0, room.w * SCALE - 10)}
              height={Math.max(0, room.h * SCALE - 10)}
            />
          </clipPath>
        ))}
      </defs>

      {plan.map((room, index) => (
        <rect
          key={index}
          className={`floor-plan__room floor-plan__room--${room.kind}`}
          x={room.x * SCALE}
          y={room.y * SCALE}
          width={room.w * SCALE}
          height={room.h * SCALE}
        />
      ))}
      <rect className="floor-plan__outline" width={width} height={height} />

      {plan.filter((room) =>
        (room.kind === 'salon' || room.kind === 'sypialnia') &&
        Math.abs(room.y + room.h - planH) < 1e-6,
      ).map((room, index) => {
        const x1 = (room.x + room.w * 0.2) * SCALE
        const x2 = (room.x + room.w * 0.8) * SCALE
        return (
          <g key={index}>
            <path className="floor-plan__window-gap" d={`M ${x1} ${height} H ${x2}`} />
            <path
              className="floor-plan__window"
              d={`M ${x1} ${height - 2} H ${x2} M ${x1} ${height + 2} H ${x2} M ${x1} ${height - 4} V ${height + 4} M ${x2} ${height - 4} V ${height + 4}`}
            />
          </g>
        )
      })}

      {entrance && (
        <g>
          <path className="floor-plan__door-gap" d={`M ${doorX} 0 H ${doorX + doorWidth}`} />
          <path
            className="floor-plan__door"
            d={`M ${doorX} 0 V ${-doorWidth} M ${doorX + doorWidth} 0 A ${doorWidth} ${doorWidth} 0 0 0 ${doorX} ${-doorWidth}`}
          />
        </g>
      )}

      {plan.map((room, index) => {
        const x = (room.x + room.w / 2) * SCALE
        const y = (room.y + room.h / 2) * SCALE
        const compact = room.h * SCALE < fontSize * 3.2 || room.w * SCALE < fontSize * 5
        return (
          <g key={index} clipPath={`url(#${id}-room-${index})`}>
            <text
              className="floor-plan__name"
              x={x}
              y={compact ? y : y - fontSize * 0.65}
              fontSize={compact ? 11.5 * unit : fontSize}
            >
              {room.label}
            </text>
            {!compact && (
              <text className="floor-plan__area" x={x} y={y + fontSize * 0.85}>
                {formatArea(room.w * room.h)}
              </text>
            )}
          </g>
        )
      })}

      <g className="floor-plan__dimensions">
        <path d={`M 0 ${bottom + 8} V ${dimensionY + 6} M ${width} ${bottom + 8} V ${dimensionY + 6} M 0 ${dimensionY} H ${width} M -4 ${dimensionY + 4} l 8 -8 M ${width - 4} ${dimensionY + 4} l 8 -8`} />
        <text className="floor-plan__dimension-label" x={width / 2} y={dimensionY - 9 * unit}>
          {metres(planW)}
        </text>
        <path d={`M -8 0 H -30 M -8 ${height} H -30 M -24 0 V ${height} M -28 4 l 8 -8 M -28 ${height + 4} l 8 -8`} />
        <text
          className="floor-plan__dimension-label"
          transform={`translate(-37 ${height / 2}) rotate(-90)`}
        >
          {metres(planH)}
        </text>
      </g>
      <g transform={`translate(${width / 2} ${footerY})`}>
        <path className="floor-plan__direction" d="M -70 -10 V 6 m -5 -5 l 5 5 l 5 -5" />
        <text className="floor-plan__orientation" x={8 * unit}>
          okna: {FACADE_LABEL[apartment.facade]}
        </text>
      </g>
    </svg>
  )
}
