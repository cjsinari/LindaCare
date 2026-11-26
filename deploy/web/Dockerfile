# One image, built from the repo root, that serves both web front ends through Caddy:
#   https://$DOMAIN      the administrator dashboard (frontend/) and the API under /api
#   https://$APP_DOMAIN  the Expo web build of the mobile app (mobile/)

FROM node:22-bookworm-slim AS dashboard
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# VITE_API_BASE_URL is deliberately unset: the dashboard calls /api on its own
# origin, which Caddy forwards to the auth service. That keeps the shipped CSP's
# connect-src 'self' true (see SECURITY.md, A05).
RUN npm run build

FROM node:22-bookworm-slim AS mobile-web
ARG API_URL
ARG DEMO_MODE=true
ENV API_URL=${API_URL} DEMO_MODE=${DEMO_MODE} CI=1
WORKDIR /build
COPY mobile/package.json mobile/package-lock.json ./
RUN npm ci
COPY mobile/ ./
RUN npx expo export --platform web --output-dir dist

FROM caddy:2-alpine
COPY --from=dashboard /build/dist /srv/dashboard
COPY --from=mobile-web /build/dist /srv/app
COPY deploy/Caddyfile /etc/caddy/Caddyfile
