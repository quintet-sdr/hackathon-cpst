import { lectures, sciencePointsById } from './data'
import {
  getOsrmDistanceTableFromSource,
  getOsrmRoute,
} from './osrm'
import type { OsrmWaypoint } from './osrm'
import type { BuiltRoute, Lecture, SciencePoint } from './types'

function toWaypoint(point: SciencePoint): OsrmWaypoint {
  return { lat: point.lat, lon: point.lon }
}

function resolvePoints(pointIds: number[]): SciencePoint[] {
  return pointIds
    .map((id) => sciencePointsById.get(id) ?? null)
    .filter((point): point is SciencePoint => point !== null)
}

function getStopDurationSeconds(pointIds: number[]): number {
  const uniquePointIds = Array.from(new Set(pointIds))

  return uniquePointIds.reduce((total, pointId) => {
    const point = sciencePointsById.get(pointId)
    return total + (point?.stopDurationMinutes ?? 0) * 60
  }, 0)
}

export async function buildLectureRoute(
  lectureId: number,
  signal?: AbortSignal,
): Promise<BuiltRoute> {
  const lecture = lectures.find((item) => item.id === lectureId)
  if (!lecture) {
    throw new Error('Lecture not found')
  }

  const routePointIds = [...lecture.includedPoints]
  if (lecture.type === 'круговой' && routePointIds.length > 1) {
    routePointIds.push(routePointIds[0])
  }

  const points = resolvePoints(routePointIds)
  if (points.length < 2) {
    throw new Error('Lecture contains not enough valid points')
  }

  const route = await getOsrmRoute(points.map(toWaypoint), signal)
  const stopDurationSeconds = getStopDurationSeconds(routePointIds)

  return {
    coordinates: route.coordinates,
    metrics: {
      ...route.metrics,
      durationSeconds: route.metrics.durationSeconds + stopDurationSeconds,
    },
    waypointIds: routePointIds,
  }
}

export async function buildUserRoute(
  pointIds: number[],
  signal?: AbortSignal,
): Promise<BuiltRoute> {
  const uniquePointIds = Array.from(new Set(pointIds))
  if (uniquePointIds.length < 2) {
    throw new Error('Select at least two different points for a custom route')
  }

  const points = resolvePoints(uniquePointIds)
  if (points.length !== uniquePointIds.length) {
    throw new Error('Could not resolve one or more selected points')
  }

  const route = await getOsrmRoute(points.map(toWaypoint), signal)
  const stopDurationSeconds = getStopDurationSeconds(uniquePointIds)

  return {
    coordinates: route.coordinates,
    metrics: {
      ...route.metrics,
      durationSeconds: route.metrics.durationSeconds + stopDurationSeconds,
    },
    waypointIds: uniquePointIds,
  }
}

interface DistanceRouteOptions {
  maxDistanceMeters: number
  candidatePointIds: number[]
  startPointId?: number
  maxOverrunMeters?: number
}

function removeByIndex<T>(items: T[], index: number): T[] {
  return [...items.slice(0, index), ...items.slice(index + 1)]
}

interface DistanceCandidate {
  route: BuiltRoute
}

function isBetterDistanceCandidate(
  candidate: DistanceCandidate,
  currentBest: DistanceCandidate | null,
  targetDistanceMeters: number,
): boolean {
  if (!currentBest) {
    return true
  }

  const candidateDistance = candidate.route.metrics.distanceMeters
  const bestDistance = currentBest.route.metrics.distanceMeters
  const candidateDelta = Math.abs(candidateDistance - targetDistanceMeters)
  const bestDelta = Math.abs(bestDistance - targetDistanceMeters)

  if (candidateDelta !== bestDelta) {
    return candidateDelta < bestDelta
  }

  const candidateWaypoints = candidate.route.waypointIds.length
  const bestWaypoints = currentBest.route.waypointIds.length
  if (candidateWaypoints !== bestWaypoints) {
    return candidateWaypoints > bestWaypoints
  }

  if (candidateDistance !== bestDistance) {
    return candidateDistance < bestDistance
  }

  return candidate.route.waypointIds.join(',') < currentBest.route.waypointIds.join(',')
}

export async function buildMaxPointsDistanceRoute(
  options: DistanceRouteOptions,
  signal?: AbortSignal,
): Promise<BuiltRoute> {
  const {
    maxDistanceMeters,
    candidatePointIds,
    maxOverrunMeters = 1000,
  } = options

  const targetDistanceMeters = maxDistanceMeters
  const upperBoundDistanceMeters = targetDistanceMeters + maxOverrunMeters

  if (!Number.isFinite(targetDistanceMeters) || targetDistanceMeters <= 0) {
    throw new Error('Distance budget must be a positive number')
  }

  if (!Number.isFinite(maxOverrunMeters) || maxOverrunMeters < 0) {
    throw new Error('Distance overrun must be a non-negative number')
  }

  const uniqueCandidateIds = Array.from(new Set(candidatePointIds))
  const resolvedCandidates = resolvePoints(uniqueCandidateIds)
    .slice()
    .sort((a, b) => a.id - b.id)

  if (resolvedCandidates.length < 2) {
    throw new Error('Select at least two points for distance-based routing')
  }

  const defaultStartId = options.startPointId ?? resolvedCandidates[0].id
  const startPoint = sciencePointsById.get(defaultStartId)
  if (!startPoint) {
    throw new Error('Failed to resolve start point')
  }

  let remaining = resolvedCandidates.filter((point) => point.id !== startPoint.id)
  if (remaining.length === 0) {
    throw new Error('Need at least one destination in addition to start point')
  }

  const selectedPointIds: number[] = [startPoint.id]
  let currentPoint = startPoint
  let currentDistance = 0
  let exactBest: DistanceCandidate | null = null
  let nearestBest: DistanceCandidate | null = null

  const maxIterations = Math.max(16, resolvedCandidates.length * 2)
  let iteration = 0

  while (remaining.length > 0 && iteration < maxIterations) {
    iteration += 1

    const destinations = remaining
    const distances = await getOsrmDistanceTableFromSource(
      toWaypoint(currentPoint),
      destinations.map(toWaypoint),
      signal,
    )

    let bestIndex = -1
    let bestDistance = Number.POSITIVE_INFINITY

    for (let i = 0; i < distances.length; i += 1) {
      const candidateDistance = distances[i]
      if (!Number.isFinite(candidateDistance)) {
        continue
      }

      if (
        candidateDistance < bestDistance
        || (candidateDistance === bestDistance && destinations[i].id < destinations[bestIndex]?.id)
      ) {
        bestDistance = candidateDistance
        bestIndex = i
      }
    }

    if (bestIndex < 0) {
      break
    }

    const nextPoint = destinations[bestIndex]
    const tentativeDistance = currentDistance + bestDistance
    if (tentativeDistance > upperBoundDistanceMeters) {
      break
    }

    selectedPointIds.push(nextPoint.id)
    currentPoint = nextPoint
    currentDistance = tentativeDistance
    const originalIndex = remaining.findIndex((point) => point.id === nextPoint.id)
    if (originalIndex < 0) {
      throw new Error('Failed to progress distance-based route selection')
    }

    remaining = removeByIndex(remaining, originalIndex)

    if (selectedPointIds.length >= 2) {
      const selectedPoints = resolvePoints(selectedPointIds)
      const route = await getOsrmRoute(selectedPoints.map(toWaypoint), signal)

      if (route.metrics.distanceMeters <= upperBoundDistanceMeters) {
        const stopDurationSeconds = getStopDurationSeconds(selectedPointIds)
        const builtRoute: BuiltRoute = {
          coordinates: route.coordinates,
          metrics: {
            ...route.metrics,
            durationSeconds: route.metrics.durationSeconds + stopDurationSeconds,
          },
          waypointIds: [...selectedPointIds],
          distanceSelectionMode:
            route.metrics.distanceMeters <= targetDistanceMeters ? 'exact' : 'nearest',
        }

        const candidate = { route: builtRoute }
        if (builtRoute.distanceSelectionMode === 'exact') {
          if (isBetterDistanceCandidate(candidate, exactBest, targetDistanceMeters)) {
            exactBest = candidate
          }
        } else if (isBetterDistanceCandidate(candidate, nearestBest, targetDistanceMeters)) {
          nearestBest = candidate
        }
      }
    }
  }

  if (iteration >= maxIterations && remaining.length > 0) {
    throw new Error('Route selection exceeded safe iteration limit')
  }

  const bestCandidate = exactBest ?? nearestBest
  if (!bestCandidate) {
    throw new Error(
      `Не удалось построить маршрут в пределах лимита +${Math.round(maxOverrunMeters / 1000)} км`,
    )
  }

  return bestCandidate.route
}

export function getLectureById(lectureId: number): Lecture | undefined {
  return lectures.find((lecture) => lecture.id === lectureId)
}
