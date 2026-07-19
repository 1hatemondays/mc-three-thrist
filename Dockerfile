FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY host/package.json host/package.json
COPY player/package.json player/package.json
RUN npm ci

COPY server server
COPY host host
COPY player player
COPY shared shared
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY host/package.json host/package.json
COPY player/package.json player/package.json
RUN npm ci --omit=dev && npm cache clean --force

COPY server server
COPY shared shared
COPY --from=build /app/host/dist host/dist
COPY --from=build /app/player/dist player/dist

EXPOSE 8080
CMD ["npm", "run", "start"]
