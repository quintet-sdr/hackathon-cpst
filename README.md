# hackathon-cpst

Веб-приложение для планирования **научных пешеходных маршрутов** в районе Иннополиса: на карте (Leaflet) отображаются точки интереса, строится маршрут через **OSRM**. Три сценария: готовые **лекции** с фиксированным набором точек, **пользовательский маршрут** (корзина точек и порядок обхода), **маршрут по лимиту длины** — подбор максимально полезного пути в заданных километрах. Есть краткий **прогноз погоды** по выбранной точке.

Стек: **TanStack Start** (React, file-based router), **Tailwind CSS**, **Vitest** для тестов логики маршрутизации.

## Презентация

Слайды в репозитории: [slides.pdf](slides.pdf) · на GitHub: [открыть PDF](https://github.com/quintet-sdr/hackathon-cpst/blob/main/slides.pdf).

## Запуск

```bash
pnpm install
pnpm dev
```

Приложение по умолчанию: `http://localhost:3000`.

Сборка и предпросмотр:

```bash
pnpm build
pnpm preview
```

Тесты:

```bash
pnpm test
```

## Docker

```bash
docker build -t hackathon-cpst .
docker run -p 4173:4173 hackathon-cpst
```

Сервис слушает порт **4173** (`vite` с `--host 0.0.0.0`).
