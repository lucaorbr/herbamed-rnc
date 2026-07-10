FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install -g npm@11.6.2
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY public ./public
COPY src ./src
COPY scripts ./scripts
COPY package*.json ./
RUN npm run build

FROM nginx:1.27-alpine AS frontend
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
