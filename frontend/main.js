import {
  html,
  render,
  useCallback,
  useEffect,
  useState,
} from "./htm@3.1.1-preact-standalone.module.js"; // https://unpkg.com/htm@3.1.1/preact/standalone.module.js

const up = (service) => fetch(`/api/up/${service.name}`);
const kill = (service) => fetch(`/api/kill/${service.name}`);
const toggle = (service) =>
  service.status.State === "running" ? kill(service) : up(service);

const getStatus = async () => (await fetch(`/api/status`)).json();

function getColor(state, health, exitcode) {
  switch (state) {
    case "not created":
    case "dead":
    case "removing":
    case "paused":
    case "exited":
      return health === "starting"
        ? "#fff594"
        : exitcode === 0
        ? "#a1c59c"
        : exitcode === 137
        ? "#ffcccc"
        : "#ff8282";
    case "restarting":
    case "created":
      return "#f6ecd5";
    case "running":
      switch (health) {
        case "starting":
          return "#eefd83";
        case "healthy":
          return "#a1ffa1";
        default:
          return "#67efa2";
      }
    default:
      return "#8a8a8a";
  }
}

const wsUri =
  `ws://${window.location.host}${window.location.pathname}api/events-ws`;

function updateOnEvent(update, setWsOk) {
  const socket = new WebSocket(wsUri);
  socket.addEventListener("open", (event) => {
    console.log("WebSocket: open");
    setWsOk(true);
    update();
  });
  socket.addEventListener("message", (event) => {
    console.log("WebSocket: update from server");
    update(JSON.parse(event.data));
  });
  socket.addEventListener("error", (event) => {
    console.log("WebSocket: error event", event);
    setWsOk(false);
  });
  socket.addEventListener("close", (event) => {
    console.log("WebSocket: close event", event);
    setWsOk(false);
    // retry in 5s
    setTimeout(() => updateOnEvent(update, setWsOk), 5000);
  });
}

function App() {
  const [services, setServices] = useState({});
  const [wsOk, setWsOk] = useState(true);
  const update = useCallback(async (config) => {
    setServices(config || await getStatus());
  }, [setServices]);

  useEffect(async () => {
    update();
    updateOnEvent(update, setWsOk);
  }, []);
  const cards = Object.values(services)
    .sort((a, b) =>
      100 *
        ((a.labels?.["dashboard.index"] ?? 0) -
          (b.labels?.["dashboard.index"] ?? 0)) + a.name.localeCompare(b.name)
    )
    .map((service) => html`<${Service} service=${service} update=${update}/>`);
  const backendKo = wsOk
    ? null
    : html`<div class="ko">The backend is down !</div>`;
  return html`${backendKo}<div class="app">${cards}</div>`;
}

function Control({ service, update }) {
  const running = service.status.State === "running";
  const icon = running
    ? html`<span class="material-symbols-outlined" title="kill">stop</span>`
    : html`<span class="material-symbols-outlined" title="up">play_arrow</span>`;
  const onclick = async (e) => {
    e.stopPropagation();
    await toggle(service);
    update();
  };
  return html`<div class="control" onclick="${onclick}">${icon}</div>`;
}

function Icon({ service }) {
  const icon = service.labels?.["dashboard.material-symbols-outlined"] ??
    "settings";
  return html`<span class="material-symbols-outlined icon">${icon}</span>`;
}

function ExtraLink({ service }) {
  const link = service.labels?.["dashboard.extra-link"];
  const text = service.labels?.["dashboard.extra-text"];
  if (link && text) {
    return html`<a class="extra" href=${link}>${text}</a>`;
  } else return null;
}
function getTitle(status) {
  switch (status.State) {
    case "exited":
      return `Status : ${status.State} (${status.ExitCode})`;
    case "running":
      return `Status : ${status.State} (${status.Health})`;
    default:
      return `Status : ${status.State}`;
  }
}

function Service({ service, update }) {
  const color = getColor(
    service.status.State,
    service.status.Health,
    service.status.ExitCode,
  );
  const link = service.labels?.["dashboard.link"];
  const title = getTitle(service.status);
  return html`
    <div class="service" title=${title} style="background-color: ${color}">
        <a href=${link} class="service-link${link ? "" : " no-link"}">
            <${Icon} service=${service}/>
              <div class="service-name">
                ${service.labels?.["dashboard.title"] ?? service.name}
              </div>
        </a>
        <${Control} service=${service} update=${update}/>
        <${ExtraLink} service=${service}/>
    </div>
    `;
}

render(html`<${App}/>`, document.body);
