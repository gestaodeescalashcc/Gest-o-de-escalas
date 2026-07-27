# =============================================================================
# MedScale — build do SPA (Vite) e serve estático via nginx.
# Pensado para EasyPanel (Build method: Dockerfile).
# =============================================================================

# ---- 1) Build ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# IMPORTANTE: variáveis do Vite (VITE_*) são embutidas no bundle em TEMPO DE
# BUILD, não em runtime. No EasyPanel, defina-as em "Environment" — o EasyPanel
# as passa como build args. Quando presentes, sobrescrevem o .env do repo.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN if [ -n "$VITE_SUPABASE_URL" ]; then echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL" > .env.production.local; fi; \
    if [ -n "$VITE_SUPABASE_ANON_KEY" ]; then echo "VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY" >> .env.production.local; fi

RUN npm run build

# ---- 2) Serve ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
