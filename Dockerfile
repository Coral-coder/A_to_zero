# A to Zero — store mirror + shopping simulator, served by a tiny Node app.
# Build:  docker build -t a-to-zero .
# Run:    docker run -d -p 8080:8080 --name a-to-zero a-to-zero
#         (browse http://localhost:8080 — the mirrored store;
#          http://localhost:8080/__a2z/ — the simulator itself)
FROM node:20-alpine

WORKDIR /app
COPY index.html styles.css catalog.js app.js manifest.json icon.svg sw.js /app/
COPY mirror/ /app/mirror/

# Which real store to mirror. Override at run time, e.g.
#   docker run -e TARGET=https://www.walmart.com ...
ENV TARGET="https://www.amazon.com"
ENV PORT=8080
ENV APP_DIR=/app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -q --spider http://localhost:8080/__a2z/ || exit 1

CMD ["node", "mirror/server.js"]
