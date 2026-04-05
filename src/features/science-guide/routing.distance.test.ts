import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sciencePointsById } from './data'
import {
  getOsrmDistanceTableFromSource,
  getOsrmRoute,
} from './osrm'
import { buildMaxPointsDistanceRoute } from './routing'
import type { OsrmWaypoint } from './osrm'

vi.mock('./osrm', () => ({
  getOsrmDistanceTableFromSource: vi.fn(),
  getOsrmRoute: vi.fn(),
}))

type DistanceMatrix = Record<number, Record<number, number>>

type RouteDistanceMap = Record<string, number>

const mockedGetOsrmDistanceTableFromSource = vi.mocked(getOsrmDistanceTableFromSource)
const mockedGetOsrmRoute = vi.mocked(getOsrmRoute)

function toPointId(waypoint: OsrmWaypoint): number {
  for (const [id, point] of sciencePointsById.entries()) {
    if (point.lat === waypoint.lat && point.lon === waypoint.lon) {
      return id
    }
  }

  throw new Error(`Unknown waypoint ${waypoint.lat},${waypoint.lon}`)
}

function setupOsrmMocks(matrix: DistanceMatrix, routeDistances: RouteDistanceMap) {
  mockedGetOsrmDistanceTableFromSource.mockImplementation(async (source, destinations) => {
    const sourceId = toPointId(source)
    const row = matrix[sourceId] ?? {}

    return destinations.map((destination) => {
      const destinationId = toPointId(destination)
      return row[destinationId] ?? Number.POSITIVE_INFINITY
    })
  })

  mockedGetOsrmRoute.mockImplementation(async (waypoints) => {
    const pointIds = waypoints.map(toPointId)
    const routeKey = pointIds.join('-')
    const distanceMeters = routeDistances[routeKey]

    if (!Number.isFinite(distanceMeters)) {
      throw new Error(`Missing mocked route distance for ${routeKey}`)
    }

    return {
      coordinates: pointIds.map((id) => [id, id] as [number, number]),
      metrics: {
        distanceMeters,
        durationSeconds: Math.round(distanceMeters / 2),
      },
    }
  })
}

const defaultMatrix: DistanceMatrix = {
  1: { 2: 1000, 3: 2000, 4: 3000 },
  2: { 3: 1000, 4: 2000 },
  3: { 4: 1000 },
}

describe('buildMaxPointsDistanceRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns exact route when target-constrained route exists', async () => {
    setupOsrmMocks(defaultMatrix, {
      '1-2': 4300,
      '1-2-3': 5300,
      '1-2-3-4': 6400,
    })

    const result = await buildMaxPointsDistanceRoute({
      maxDistanceMeters: 5000,
      maxOverrunMeters: 1000,
      candidatePointIds: [4, 3, 2, 1],
      startPointId: 1,
    })

    expect(result.metrics.distanceMeters).toBe(4300)
    expect(result.waypointIds).toEqual([1, 2])
    expect(result.distanceSelectionMode).toBe('exact')
  })

  it('returns nearest route in +1km window when exact route does not exist', async () => {
    setupOsrmMocks(defaultMatrix, {
      '1-2': 5300,
      '1-2-3': 5600,
      '1-2-3-4': 5900,
    })

    const result = await buildMaxPointsDistanceRoute({
      maxDistanceMeters: 5000,
      maxOverrunMeters: 1000,
      candidatePointIds: [1, 2, 3, 4],
      startPointId: 1,
    })

    expect(result.metrics.distanceMeters).toBe(5300)
    expect(result.waypointIds).toEqual([1, 2])
    expect(result.distanceSelectionMode).toBe('nearest')
  })

  it('throws clear error when no route fits within target + 1km', async () => {
    setupOsrmMocks(defaultMatrix, {
      '1-2': 6100,
      '1-2-3': 6300,
      '1-2-3-4': 6700,
    })

    await expect(() =>
      buildMaxPointsDistanceRoute({
        maxDistanceMeters: 5000,
        maxOverrunMeters: 1000,
        candidatePointIds: [1, 2, 3, 4],
        startPointId: 1,
      }),
    ).rejects.toThrow('в пределах лимита +1 км')
  })

  it('applies tie-break by waypoint count, then distance', async () => {
    setupOsrmMocks(defaultMatrix, {
      '1-2': 5400,
      '1-2-3': 5400,
      '1-2-3-4': 6200,
    })

    const result = await buildMaxPointsDistanceRoute({
      maxDistanceMeters: 5000,
      maxOverrunMeters: 1000,
      candidatePointIds: [1, 2, 3, 4],
      startPointId: 1,
    })

    expect(result.metrics.distanceMeters).toBe(5400)
    expect(result.waypointIds).toEqual([1, 2, 3])
    expect(result.distanceSelectionMode).toBe('nearest')
  })
})
