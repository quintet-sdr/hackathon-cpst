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

  return {
    coordinates: route.coordinates,
    metrics: route.metrics,
    waypointIds: routePointIds,
  }
}

export async function buildUserRoute(
  startPointId: number,
  endPointId: number,
  signal?: AbortSignal,
): Promise<BuiltRoute> {
  if (startPointId === endPointId) {
    throw new Error('Start and end points must be different')
  }

  const startPoint = sciencePointsById.get(startPointId)
  const endPoint = sciencePointsById.get(endPointId)

  if (!startPoint || !endPoint) {
    throw new Error('Could not resolve one of selected points')
  }

  const route = await getOsrmRoute([toWaypoint(startPoint), toWaypoint(endPoint)], signal)

  return {
    coordinates: route.coordinates,
    metrics: route.metrics,
    waypointIds: [startPoint.id, endPoint.id],
  }
}

interface DistanceRouteOptions {
  maxDistanceMeters: number
  candidatePointIds: number[]
  startPointId?: number
}

function removeByIndex<T>(items: T[], index: number): T[] {
  return [...items.slice(0, index), ...items.slice(index + 1)]
}

export async function buildMaxPointsDistanceRoute(
  options: DistanceRouteOptions,
  signal?: AbortSignal,
): Promise<BuiltRoute> {
  const { maxDistanceMeters, candidatePointIds } = options

  if (!Number.isFinite(maxDistanceMeters) || maxDistanceMeters <= 0) {
    throw new Error('Distance budget must be a positive number')
  }

  const uniqueCandidateIds = Array.from(new Set(candidatePointIds))
  const resolvedCandidates = resolvePoints(uniqueCandidateIds)

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

  const maxIterations = 12
  let iteration = 0

  while (remaining.length > 0 && iteration < maxIterations) {
    iteration += 1

    const destinations = remaining.slice(0, 8)
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

      if (candidateDistance < bestDistance) {
        bestDistance = candidateDistance
        bestIndex = i
      }
    }

    if (bestIndex < 0) {
      break
    }

    const nextPoint = destinations[bestIndex]
    const tentativeDistance = currentDistance + bestDistance
    if (tentativeDistance > maxDistanceMeters) {
      break
    }

    selectedPointIds.push(nextPoint.id)
    currentPoint = nextPoint
    currentDistance = tentativeDistance
    const originalIndex = remaining.findIndex((point) => point.id === nextPoint.id)
    remaining = removeByIndex(remaining, originalIndex)
  }

  if (selectedPointIds.length < 2) {
    throw new Error('Distance budget is too small to include additional points')
  }

  const selectedPoints = resolvePoints(selectedPointIds)
  const route = await getOsrmRoute(selectedPoints.map(toWaypoint), signal)

  if (route.metrics.distanceMeters > maxDistanceMeters) {
    throw new Error('Could not build a route inside the selected distance budget')
  }

  return {
    coordinates: route.coordinates,
    metrics: route.metrics,
    waypointIds: selectedPointIds,
  }
}

export function getLectureById(lectureId: number): Lecture | undefined {
  return lectures.find((lecture) => lecture.id === lectureId)
}
