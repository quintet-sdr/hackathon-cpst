import { divIcon } from 'leaflet'
import { useMemo } from 'react'
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import type { DivIcon } from 'leaflet'
import type { SciencePoint } from '#/features/science-guide/types'

type MarkerVariant = 'default' | 'route' | 'basket' | 'hovered' | 'selected'

export interface ScienceGuideMapProps {
  points: SciencePoint[]
  selectedPointIds: number[]
  selectedPointId: number | null
  hoveredPointId: number | null
  routeWaypointIds: number[]
  routeCoordinates: Array<[number, number]> | null
  onHoverPoint: (pointId: number | null) => void
  onSelectPoint: (pointId: number) => void
}

function makePointIcon(variant: MarkerVariant): DivIcon {
  return divIcon({
    className: `science-point-icon science-point-icon--${variant}`,
    html: '<span class="science-point-core"></span>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

export function ScienceGuideMap({
  points,
  selectedPointIds,
  selectedPointId,
  hoveredPointId,
  routeWaypointIds,
  routeCoordinates,
  onHoverPoint,
  onSelectPoint,
}: ScienceGuideMapProps) {
  const markerIcons = useMemo<Record<MarkerVariant, DivIcon>>(
    () => ({
      default: makePointIcon('default'),
      route: makePointIcon('route'),
      basket: makePointIcon('basket'),
      hovered: makePointIcon('hovered'),
      selected: makePointIcon('selected'),
    }),
    [],
  )

  const routeWaypointSet = useMemo(() => new Set(routeWaypointIds), [routeWaypointIds])

  return (
    <MapContainer
      bounds={[
        [55.741, 48.697],
        [55.785, 48.768],
      ]}
      className="planner-map rounded-[1.15rem]"
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {points.map((point) => {
        const isHovered = hoveredPointId === point.id
        const isSelected = selectedPointId === point.id
        const inBasket = selectedPointIds.includes(point.id)
        const inRoute = routeWaypointSet.has(point.id)
        const markerVariant: MarkerVariant = isSelected
          ? 'selected'
          : isHovered
            ? 'hovered'
            : inBasket
              ? 'basket'
              : inRoute
                ? 'route'
                : 'default'

        return (
          <Marker
            key={point.id}
            position={[point.lat, point.lon]}
            icon={markerIcons[markerVariant]}
            eventHandlers={{
              mouseover: () => onHoverPoint(point.id),
              mouseout: () => onHoverPoint(null),
              click: () => onSelectPoint(point.id),
            }}
          >
            <Tooltip>
              {point.name}
            </Tooltip>
          </Marker>
        )
      })}

      {routeCoordinates ? (
        <Polyline
          positions={routeCoordinates}
          pathOptions={{ color: '#1d7f86', weight: 5, opacity: 0.9 }}
        />
      ) : null}
    </MapContainer>
  )
}
