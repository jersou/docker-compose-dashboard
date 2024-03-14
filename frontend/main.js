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

function getColor(state, health) {
  switch (state) {
    case "not created":
    case "dead":
    case "removing":
    case "paused":
    case "exited":
      return health === "starting" ? "#fff594" : "#ffcccc";
    case "restarting":
    case "created":
      return "#f6ecd5";
    case "running":
      switch (health) {
        case "starting":
          return "#f5ffb4";
        case "healthy":
          return "#bbffbb";
        default:
          return "#bbffbb";
      }
    default:
      return "#8a8a8a";
  }
}

const wsUri =
  `ws://${window.location.host}${window.location.pathname}api/events-ws`;

function updateOnEvent(update) {
  const socket = new WebSocket(wsUri);
  socket.addEventListener("open", (event) => {
    console.log("ws ok");
    socket.send("ws ok");
    update();
  });
  socket.addEventListener("message", (event) => {
    console.log("update from server");
    update(JSON.parse(event.data));
  });
  socket.addEventListener("close", (event) => {
    console.log("close event", event);
    // retry in 5s
    setTimeout(() => updateOnEvent(update), 5000);
  });
}

function App() {
  const [services, setServices] = useState({});
  const update = useCallback(async (config) => {
    setServices(config || await getStatus());
  }, [setServices]);

  useEffect(async () => {
    update();
    updateOnEvent(update);
  }, []);
  const cards = Object.values(services)
    .sort((a, b) =>
      100 *
        ((a.labels?.["dashboard.index"] ?? 0) -
          (b.labels?.["dashboard.index"] ?? 0)) + a.name.localeCompare(b.name)
    )
    .map((service) => html`<${Service} service=${service} update=${update}/>`);
  return html`<div class="app">${cards}</div>`;
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
    const onclick = (e) => {
      e.stopPropagation();
      window.open(link, "_blank", "noreferrer");
    };
    return html`<div class="extra" onclick=${onclick}>${text}</div>`;
  } else return null;
}

function Service({ service, update }) {
  const color = getColor(service.status.State, service.status.Health);
  const link = service.labels?.["dashboard.link"];
  const onclick = () => link && window.open(link, "_blank", "noreferrer");
  return html`
        <div class="service ${link ? "hasLink" : ""}" onclick=${onclick}
             title=${service.status.Status} style="background-color: ${color}">
            <${Icon} service=${service}/>
            ${service.labels?.["dashboard.title"] ?? service.name}
            <${Control} service=${service} update=${update}/>
            <${ExtraLink} service=${service}/>
        </div>
    `;
}

render(html`<${App}/>`, document.body);
