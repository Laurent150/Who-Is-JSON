FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node package.json server.mjs handler.mjs policy.mjs ./
USER node
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["node", "server.mjs"]
