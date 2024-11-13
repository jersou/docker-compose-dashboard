# docker compose dashboard

Example from [docker-compose.yml](example%2Fdocker-compose.yml) :

https://github.com/jersou/docker-compose-dashboard/assets/5874319/a24ddfc2-3f75-4b3d-89b4-8f98b53042e7

## install

```shell
deno install -f \
    -g \
    --name docoda \
    --allow-net=localhost:5555 \
    --allow-env \
    --allow-read \
    --allow-run=/usr/bin/docker \
        jsr:@jersou/docker-compose-dashboard@0.3.0
# → run "docoda" from a docker compose project
# → open localhost:5555 in a browser
```

## or run directly from a docker compose project

```shell
deno run -A jsr:@jersou/docker-compose-dashboard@0.3.0
# → open localhost:5555 in a browser
```

or specify permissions :

```shell
deno run \
    --allow-net=localhost:5555 \
    --allow-env \
    --allow-read \
    --allow-run=/usr/bin/docker \
        jsr:@jersou/docker-compose-dashboard@0.3.0
# → open localhost:5555 in a browser
```

## Usage

```
$ ./docker-compose-dashboard.ts --help
Usage: ./docker-compose-dashboard.ts [Options] [--] [command [command args]]

Commands:
  main         [default]
  checkCompose

Options:
 -h, --help                     Show this help                                                        [default: false]
     --hostname                 Server hostname                                                 [default: "localhost"]
     --port                     Server port                                                            [default: 5555]
     --open-in-browser          Open with chromium/chrome/gio if true or with the parameter [default: "google-chrome"]
     --open-in-browser-app-mode Add --app= to browser command if openInBrowser is used                [default: false]
     --not-exit-if-no-client    Keep the server alive after the last client disconnects               [default: false]
```

## Labels in docker-compose.yml file :

- dashboard.index: <number, used to sort cards>
- dashboard.title: <string, title in card, service name if missing>
- dashboard.material-symbols-outlined: <string, material symbol to use in card>
- dashboard.link: <string, link on card>
- dashboard.extra-link: <string, extra link>
- dashboard.extra-text: <string, extra link title>

## To update the asset bundle after frontend update

Run from the source dir with :

```shell
./docker-compose-dashboard.ts updateAssetsBundle
```

## TODO :

- lib list
  - https://github.com/denoland/deno
  - https://github.com/developit/htm
  - https://github.com/preactjs/preact
  - https://github.com/denoland/deno
  - https://jsr.io/@jersou/desktop-web-app
  - https://jsr.io/@jersou/clite
