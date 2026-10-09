FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node package.json server.mjs handler.mjs policy.mjs followup.cjs reading.cjs module-output.cjs ./
COPY --chown=node:node runtime ./runtime
COPY --chown=node:node node_modules/typescript ./node_modules/typescript
USER node
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["node", "server.mjs"]
