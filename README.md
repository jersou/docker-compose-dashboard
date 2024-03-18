# docker compose dashboard

Example from  [docker-compose.yml](example%2Fdocker-compose.yml) :

https://github.com/jersou/docker-compose-dashboard/assets/5874319/a24ddfc2-3f75-4b3d-89b4-8f98b53042e7

## install
```shell
deno install -f \
    --name docoda \
    --allow-net=localhost:5555 \
    --allow-env \
    --allow-read \
    --allow-run=/usr/bin/docker \
        https://deno.land/x/docker_compose_dashboard@0.1.2/docker-compose-dashboard.ts
# → run "docoda" from a docker compose project
# → open localhost:5555 in a browser
```


## or run directly from a docker compose project
```shell
deno run \
    --allow-net=localhost:5555 \
    --allow-env \
    --allow-read \
    --allow-run=/usr/bin/docker \
        https://deno.land/x/docker_compose_dashboard@0.1.2/docker-compose-dashboard.ts
# → open localhost:5555 in a browser
```


## Usage

```
$ ./docker-compose-dashboard.ts --help
Usage: <DockerComposeDashboard file> [Options] [command [command args]]

Commands:
  main          (default)
  updateAssets

Options:
  --hostname=<HOSTNAME>                                  (default "localhost")
  --port=<PORT>                                          (default "5555")
  --not-exit-if-no-client=<NOT_EXIT_IF_NO_CLIENT>        (default "false")
  --open-in-browser=<OPEN_IN_BROWSER>                    (default "false")
  --open-in-browser-app-mode=<OPEN_IN_BROWSER_APP_MODE>  (default "false")
  --update=<UPDATE>                                      update assets_bundle.json (default "false")
  --help                                                 Show this help
```

## Labels in docker-compose.yml file :

- dashboard.index: <number, used to sort cards>
- dashboard.title: <string, title in card, service name if missing>
- dashboard.material-symbols-outlined: <string, material symbol to use in card>
- dashboard.link: <string, link on card>
- dashboard.extra-link: <string, extra link>
- dashboard.extra-text: <string, extra link title>


## TODO :

- lib list
  - https://github.com/denoland/deno
  - https://github.com/developit/htm
  - https://github.com/preactjs/preact
  - https://github.com/denoland/deno
