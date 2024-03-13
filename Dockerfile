FROM  alpine:3.19.1
RUN apk --no-cache add docker docker-cli-compose deno
COPY docker-compose-dashboard.ts /docker-compose-dashboard.ts
RUN deno cache /docker-compose-dashboard.ts
COPY frontend /frontend
CMD deno run \
        --allow-net=0.0.0.0:5555 \
        --allow-env \
        --allow-read \
        --allow-run=/usr/bin/docker \
            /docker-compose-dashboard.ts 0.0.0.0 5555
