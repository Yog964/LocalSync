FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm run install:all

COPY . .
RUN npm run build:client

EXPOSE 3000

CMD ["npm", "start"]
