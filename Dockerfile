FROM dhi.io/node:24-alpine3.22-dev AS builder

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install -g pnpm

RUN --mount=type=cache,target=/root/.pnpm-store pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

EXPOSE 3000

CMD [ "pnpm", "run" ]