FROM node:22-alpine AS frontend-build

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
COPY --from=frontend-build /frontend/dist/ /app/public/dashboard/

RUN mkdir -p /app/uploads

EXPOSE 3000
CMD ["npm", "start"]
