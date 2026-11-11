FROM node:24-slim
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
RUN pnpm build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "start"]
