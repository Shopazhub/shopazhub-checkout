# Build stage
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Serve stage
FROM node:22-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist

EXPOSE ${PORT:-3003}
CMD serve -s dist -l ${PORT:-3003}