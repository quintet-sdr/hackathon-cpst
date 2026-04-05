import type { RouteMetrics } from './types'

export interface OsrmWaypoint {
  lon: number
  lat: number
}

interface OsrmRouteResponse {
  code: string
  routes?: Array<{
    distance: number
    duration: number
    geometry: {
      type: 'LineString'
      coordinates: Array<[number, number]>
    }
  }>
}

interface OsrmTableResponse {
  code: string
  distances?: number[][]
  durations?: number[][]
}

export interface RouteResult {
  coordinates: Array<[number, number]>
  metrics: RouteMetrics
}

const DEFAULT_OSRM_BASE_URL = 'https://router.project-osrm.org'

function asCoordinatePath(waypoints: OsrmWaypoint[]): string {
  return waypoints.map((item) => `${item.lon},${item.lat}`).join(';')
}

function createTimeoutSignal(
  timeoutMs: number,
  externalSignal?: AbortSignal,
): AbortSignal {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  externalSignal?.addEventListener('abort', () => controller.abort(), {
    once: true,
  })

  controller.signal.addEventListener(
    'abort',
    () => {
      clearTimeout(timer)
    },
    { once: true },
  )

  return controller.signal
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`OSRM request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export async function getOsrmRoute(
  waypoints: OsrmWaypoint[],
  signal?: AbortSignal,
): Promise<RouteResult> {
  if (waypoints.length < 2) {
    throw new Error('At least two waypoints are required to build a route')
  }

  const coordinatesPath = asCoordinatePath(waypoints)
  const url = new URL(
    `/route/v1/foot/${coordinatesPath}`,
    DEFAULT_OSRM_BASE_URL,
  )
  url.searchParams.set('alternatives', 'false')
  url.searchParams.set('overview', 'full')
  url.searchParams.set('steps', 'false')
  url.searchParams.set('geometries', 'geojson')

  const response = await fetch(url, {
    signal: createTimeoutSignal(12000, signal),
  })
  const payload = await parseJson<OsrmRouteResponse>(response)

  if (payload.code !== 'Ok' || !payload.routes || payload.routes.length === 0) {
    throw new Error('OSRM returned no route for the provided waypoints')
  }

  const route = payload.routes[0]
  const coordinates = route.geometry.coordinates.map(
    ([lon, lat]) => [lat, lon] as [number, number],
  )

  return {
    coordinates,
    metrics: {
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    },
  }
}

export async function getOsrmDistanceTableFromSource(
  source: OsrmWaypoint,
  destinations: OsrmWaypoint[],
  signal?: AbortSignal,
): Promise<number[]> {
  if (destinations.length === 0) {
    return []
  }

  const allPoints = [source, ...destinations]
  const coordinatesPath = asCoordinatePath(allPoints)
  const url = new URL(
    `/table/v1/foot/${coordinatesPath}`,
    DEFAULT_OSRM_BASE_URL,
  )
  url.searchParams.set('sources', '0')
  url.searchParams.set('annotations', 'distance,duration')

  const response = await fetch(url, {
    signal: createTimeoutSignal(12000, signal),
  })
  const payload = await parseJson<OsrmTableResponse>(response)

  if (payload.code !== 'Ok' || !payload.distances || payload.distances.length === 0) {
    throw new Error('OSRM returned no table data')
  }

  const row = payload.distances[0]
  return row.slice(1)
}
