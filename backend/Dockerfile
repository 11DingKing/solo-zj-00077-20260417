# Development
FROM node:18-alpine
WORKDIR /backend
COPY package*.json /backend/
ENV NODE_ENV=development
RUN yarn install
COPY . /backend/
EXPOSE 3001
CMD ["yarn", "start"]
