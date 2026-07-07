# A to Zero — static shopping simulator served by nginx.
# Build:  docker build -t a-to-zero .
# Run:    docker run -d -p 8080:80 --name a-to-zero a-to-zero
FROM nginx:alpine

COPY index.html styles.css catalog.js app.js manifest.json icon.svg sw.js /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -q --spider http://localhost/ || exit 1
