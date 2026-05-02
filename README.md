# hackathon-cpst

A web application for planning **scientific walking routes** in the Innopolis area: points of interest are displayed on the map (Leaflet), a route is built through **OSRM**. Three scenarios: ready-made **lectures** with a fixed set of points, **custom route** (basket of points and detour procedure), **route by length limit** — selection of the most useful path in the specified kilometers. There is a short **weather forecast** for the selected point.

Tech stack: **TanStack Start** (React, file-based router), **Tailwind CSS**, **Vitest** for routing logic tests.

## Presentation

SLides in repo: [slides.pdf](slides.pdf) · on GitHub: [open PDF](https://github.com/quintet-sdr/hackathon-cpst/blob/main/slides.pdf).

## Run

```bash
pnpm install
pnpm dev
```

Access by default: `http://localhost:3000`.

Build:

```bash
pnpm build
pnpm preview
```

Tests:

```bash
pnpm test
```

## Docker

```bash
docker build -t hackathon-cpst .
docker run -p 4173:4173 hackathon-cpst
```

Running at port **4173** (`vite` с `--host 0.0.0.0`).
