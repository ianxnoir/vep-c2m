FROM node:17-alpine3.14

WORKDIR /srv
ADD . .
RUN npm config set unsafe-perm true
# RUN npm install --global del-cli
# RUN npm install --global @nestjs/cli
RUN npm run build

EXPOSE 80
EXPOSE 3000

CMD ["node", "dist/src/app"]