# Build multi-stage com saída standalone do Next: a imagem final leva só o
# servidor e as dependências rastreadas, sem devDependencies nem código-fonte,
# e roda como usuário sem privilégio.
FROM node:24-slim AS build
WORKDIR /app
# Mesma versão de pnpm do check da pipeline (lockfile v9).
RUN npm i -g pnpm@10
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# NEXT_PUBLIC_* entram no bundle no build; vêm da variável BUILD_ENV do repositório.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_ROOT_DOMAIN
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_FB_APP_ID
ARG NEXT_PUBLIC_FB_CONFIG_ID
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
