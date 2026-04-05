import type { Lecture, SciencePoint } from './types'

const pointDescriptions: Record<number, string> = {
  1: 'Наблюдение за геологическим составом камней и минералов в природной среде.',
  2: 'Точка для обсуждения химических процессов в растительности и почве.',
  3: 'Площадка для изучения фитонцидов и естественной биохимии леса.',
  4: 'Локация для анализа состояния речной воды и окружающей экосистемы.',
  5: 'Полевой разбор особенностей местных почвенных слоев и структуры.',
  6: 'Пункт наблюдения чистоты природных родников и источников воды.',
}

function buildDescription(id: number, name: string): string {
  const predefined = pointDescriptions[id]
  if (predefined) {
    return predefined
  }

  return `Научная точка «${name}». Здесь можно провести наблюдение и обсудить локальные природные и городские особенности.`
}

export const sciencePoints: SciencePoint[] = [
  { id: 1, lat: 55.74755, lon: 48.73742, name: 'Точка 1: Минералы в камнях', description: buildDescription(1, 'Точка 1: Минералы в камнях'), photoUrl: null },
  { id: 2, lat: 55.7513, lon: 48.73354, name: 'Точка 2: Химический состав растений', description: buildDescription(2, 'Точка 2: Химический состав растений'), photoUrl: null },
  { id: 3, lat: 55.75271, lon: 48.72941, name: 'Точка 3: Фитонциды', description: buildDescription(3, 'Точка 3: Фитонциды'), photoUrl: null },
  { id: 4, lat: 55.75757, lon: 48.72973, name: 'Точка 4: Речная вода', description: buildDescription(4, 'Точка 4: Речная вода'), photoUrl: null },
  { id: 5, lat: 55.7726, lon: 48.70116, name: 'Точка 5: Особенности почвы', description: buildDescription(5, 'Точка 5: Особенности почвы'), photoUrl: null },
  { id: 6, lat: 55.78222, lon: 48.70222, name: 'Точка 6: Чистота родников', description: buildDescription(6, 'Точка 6: Чистота родников'), photoUrl: null },
  { id: 7, lat: 55.75085, lon: 48.75377, name: 'Начало маршрута', description: buildDescription(7, 'Начало маршрута'), photoUrl: null },
  { id: 8, lat: 55.75596, lon: 48.764, name: 'История деревни', description: buildDescription(8, 'История деревни'), photoUrl: null },
  { id: 9, lat: 55.76287, lon: 48.75657, name: 'Следы животных и обглоданная лосями кора', description: buildDescription(9, 'Следы животных и обглоданная лосями кора'), photoUrl: null },
  { id: 10, lat: 55.76826, lon: 48.75715, name: 'Лесной перекресток', description: buildDescription(10, 'Лесной перекресток'), photoUrl: null },
  { id: 11, lat: 55.77406, lon: 48.75165, name: 'Переход через дорогу', description: buildDescription(11, 'Переход через дорогу'), photoUrl: null },
  { id: 12, lat: 55.77367, lon: 48.73758, name: 'Видовой состав деревьев', description: buildDescription(12, 'Видовой состав деревьев'), photoUrl: null },
  { id: 13, lat: 55.76013, lon: 48.75191, name: 'Обратная дорога', description: buildDescription(13, 'Обратная дорога'), photoUrl: null },
  { id: 14, lat: 55.75289, lon: 48.74423, name: 'Университет Иннополис', description: buildDescription(14, 'Университет Иннополис'), photoUrl: null },
  { id: 15, lat: 55.75275, lon: 48.74152, name: 'Шишкин парк', description: buildDescription(15, 'Шишкин парк'), photoUrl: null },
  { id: 16, lat: 55.75127, lon: 48.74336, name: 'Спорткомплекс', description: buildDescription(16, 'Спорткомплекс'), photoUrl: null },
  { id: 17, lat: 55.74883, lon: 48.74079, name: 'Стадион', description: buildDescription(17, 'Стадион'), photoUrl: null },
  { id: 18, lat: 55.74757, lon: 48.7403, name: 'Городской парк', description: buildDescription(18, 'Городской парк'), photoUrl: null },
  { id: 19, lat: 55.74447, lon: 48.74828, name: 'Артспейс', description: buildDescription(19, 'Артспейс'), photoUrl: null },
  { id: 20, lat: 55.74643, lon: 48.75179, name: 'ЖК ZION', description: buildDescription(20, 'ЖК ZION'), photoUrl: null },
  { id: 22, lat: 55.75177, lon: 48.75106, name: 'Технопарк имени Попова', description: buildDescription(22, 'Технопарк имени Попова'), photoUrl: null },
  { id: 21, lat: 55.74866, lon: 48.74856, name: 'Лицей Иннополис', description: buildDescription(21, 'Лицей Иннополис'), photoUrl: null },
  { id: 23, lat: 55.75188, lon: 48.74903, name: 'Технопарк имени Лобачевского', description: buildDescription(23, 'Технопарк имени Лобачевского'), photoUrl: null },
]

export const lectures: Lecture[] = [
  {
    id: 1,
    title: 'С профессором Огановым по Волжской тропе',
    description: 'Лекция по химии по участку Волжской тропы из Иннополиса до Макарьевского монастыря',
    type: 'линейный',
    includedPoints: [1, 2, 3, 4, 5, 6],
  },
  {
    id: 2,
    title: 'Природа рядом',
    description: 'Прогулка по Макарьевскому лесу с вниманием к природным деталям',
    type: 'круговой',
    includedPoints: [7, 8, 9, 10, 11, 12, 13],
  },
  {
    id: 3,
    title: 'Экскурсия вокруг города',
    description: 'Прогулка вокруг города по основным местам и достопримечательностям',
    type: 'круговой',
    includedPoints: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
  },
]

export const sciencePointsById = new Map<number, SciencePoint>(
  sciencePoints.map((point) => [point.id, point]),
)
