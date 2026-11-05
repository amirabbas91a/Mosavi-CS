FROM node:22-alpine

WORKDIR /app

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source and build frontend assets
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start persistent Express + WebSocket multiplayer server
CMD ["npm", "run", "start"]
