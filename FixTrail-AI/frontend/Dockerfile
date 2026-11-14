FROM node:22.12
WORKDIR /app
COPY /package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
RUN npm install -g serve
RUN npm run build
CMD ["npx","serve", "-s", "dist"]
