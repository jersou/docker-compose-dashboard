# docker compose dashboard

Example from  [docker-compose.yml](example%2Fdocker-compose.yml) :

https://github.com/jersou/docker-compose-dashboard/assets/5874319/a24ddfc2-3f75-4b3d-89b4-8f98b53042e7

## install
```shell
deno install -f \
    --name dacoda \
    --allow-net=localhost:5555 \
    --allow-env \
    --allow-read \
    --allow-run=/usr/bin/docker \
        https://deno.land/x/docker_compose_dashboard@0.1.0/docker-compose-dashboard.ts
# → run "dacoda" from a docker compose project
# → open localhost:5555 in a browser
```


## or run directly from a docker compose project
```shell
deno run \
    --allow-net=localhost:5555 \
    --allow-env \
    --allow-read \
    --allow-run=/usr/bin/docker \
        https://deno.land/x/docker_compose_dashboard@0.1.0/docker-compose-dashboard.ts
# → open localhost:5555 in a browser
```

/docker-compose-dashboard.ts --help
Usage: <DockerComposeDashboard file> [Options] [command [command args]]

## Usage

```
Commands:
main          (default)
updateAssets

Options:
--hostname=<HOSTNAME>                            (default "localhost")
--port=<PORT>                                    (default "5555")
--not-exit-if-no-client=<NOT_EXIT_IF_NO_CLIENT>  (default "false")
--open-in-browser=<OPEN_IN_BROWSER>              (default "false")
--update=<UPDATE>                                update assets_bundle.json (default "false")
--help                                           Show this help
```



## TODO :


- README.md
  - lib list
    - https://github.com/denoland/deno
    - https://github.com/developit/htm
    - https://github.com/preactjs/preact
    - https://github.com/denoland/deno
- labels
  - dashboard.index:
    - dashboard.title:
    - dashboard.material-symbols-outlined:
    - dashboard.link:
    - dashboard.extra-link:
    - dashboard.extra-text:
