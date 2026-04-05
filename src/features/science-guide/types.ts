export type ScenarioType = 'lecture' | 'user-route' | 'distance-max'

export interface SciencePoint {
  id: number
  lat: number
  lon: number
  name: string
  description: string
  stopDurationMinutes: number
  photoUrl: string | null
}

export interface Lecture {
  id: number
  title: string
  description: string
  type: 'линейный' | 'круговой'
  includedPoints: number[]
}

export interface RouteMetrics {
  distanceMeters: number
  durationSeconds: number
}

export interface BuiltRoute {
  coordinates: Array<[number, number]>
  metrics: RouteMetrics
  waypointIds: number[]
}
