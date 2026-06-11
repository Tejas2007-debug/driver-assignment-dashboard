const API_BASE = localStorage.getItem("apiBase") || "http://localhost:5000/api";

const modules = [
  { id: "dashboard", label: "Dashboard", icon: "fa-chart-line", subtitle: "Centralized driver assignment operations" },
  { id: "customers", label: "Customers", icon: "fa-users", subtitle: "Manage customer records and details" },
  { id: "bookings", label: "Bookings", icon: "fa-calendar-check", subtitle: "Create, filter, and manage trip bookings" },
  { id: "drivers", label: "Drivers", icon: "fa-id-card", subtitle: "Manage driver availability and profiles" },
  { id: "vehicles", label: "Vehicles", icon: "fa-car-side", subtitle: "Manage vehicle availability and details" },
  { id: "assignments", label: "Assignments", icon: "fa-clipboard-list", subtitle: "Assign drivers and vehicles without conflicts" },
  { id: "trips", label: "Trip Status", icon: "fa-location-dot", subtitle: "Track active and completed trip status" },
  { id: "reports", label: "Reports", icon: "fa-chart-pie", subtitle: "Assignment and utilization reports" },
];

const state = {
  active: "dashboard",
  user: null,
  data: { customers: [], bookings: [], drivers: [], vehicles: [], assignments: [], trips: [] },
  charts: {},
  modal: null,
  modalMode: null,
};

const $ = (selector) => document.querySelector(selector);
const content = $("#content");
const loader = $("#loader");

document.addEventListener("DOMContentLoaded", async () => {
  state.modal = new bootstrap.Modal($("#entityModal"));
  renderNav();
  bindShell();
  await boot();
});

function bindShell() {
  $("#loginForm").addEventListener("submit", login);
  $("#logoutBtn").addEventListener("click", logout);
  $("#sidebarToggle").addEventListener("click", () => {
    if (window.innerWidth < 993) $("#sidebar").classList.toggle("open");
    else $("#sidebar").classList.toggle("collapsed");
  });
  $("#entityForm").addEventListener("submit", saveModalForm);
}

async function boot() {
  try {
    const res = await api("/auth/me");
    state.user = res.user;
    showApp();
    await navigate("dashboard");
  } catch {
    showLogin();
  }
}

function showApp() {
  $("#loginScreen").classList.add("d-none");
  $("#appShell").classList.remove("d-none");
  $("#userName").textContent = state.user?.name || "Admin";
}

function showLogin() {
  $("#loginScreen").classList.remove("d-none");
  $("#appShell").classList.add("d-none");
}

async function login(event) {
  event.preventDefault();
  $("#loginError").classList.add("d-none");
  try {
    const res = await api("/auth/login", {
      method: "POST",
      body: { email: $("#loginEmail").value, password: $("#loginPassword").value },
    });
    state.user = res.user;
    showApp();
    await navigate("dashboard");
  } catch (error) {
    $("#loginError").textContent = error.message;
    $("#loginError").classList.remove("d-none");
  }
}

async function logout() {
  await api("/auth/logout", { method: "POST" }).catch(() => {});
  state.user = null;
  showLogin();
}

function renderNav() {
  $("#sidebarNav").innerHTML = modules
    .map((item) => `
      <button class="nav-link ${item.id === state.active ? "active" : ""}" data-module="${item.id}" type="button" title="${item.label}">
        <i class="fa-solid ${item.icon}"></i><span class="nav-label">${item.label}</span>
      </button>
    `)
    .join("");
  $("#sidebarNav").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-module]");
    if (!button) return;
    await navigate(button.dataset.module);
    $("#sidebar").classList.remove("open");
  });
}

async function navigate(moduleId) {
  state.active = moduleId;
  renderNav();
  const module = modules.find((item) => item.id === moduleId);
  $("#pageTitle").textContent = module.label;
  $("#pageSubtitle").textContent = module.subtitle;
  content.classList.remove("fade-in");
  void content.offsetWidth;
  content.classList.add("fade-in");

  if (moduleId === "dashboard") await renderDashboard();
  if (moduleId === "customers") await renderCrud("customers");
  if (moduleId === "bookings") await renderCrud("bookings");
  if (moduleId === "drivers") await renderCrud("drivers");
  if (moduleId === "vehicles") await renderCrud("vehicles");
  if (moduleId === "assignments") await renderAssignments();
  if (moduleId === "trips") await renderTrips();
  if (moduleId === "reports") await renderReports();
}

async function api(path, options = {}) {
  showLoader(true);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
  } finally {
    showLoader(false);
  }
}

function showLoader(show) {
  loader.classList.toggle("d-none", !show);
}

function toast(message, type = "success") {
  const id = `toast-${Date.now()}`;
  $("#toastHost").insertAdjacentHTML(
    "beforeend",
    `<div id="${id}" class="toast align-items-center text-bg-${type} border-0" role="alert">
      <div class="d-flex"><div class="toast-body">${escapeHtml(message)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>
    </div>`
  );
  const node = document.getElementById(id);
  bootstrap.Toast.getOrCreateInstance(node, { delay: 2600 }).show();
  node.addEventListener("hidden.bs.toast", () => node.remove());
}

async function loadCoreData() {
  const [customers, bookings, drivers, vehicles, assignments] = await Promise.all([
    api("/customers"),
    api("/bookings"),
    api("/drivers"),
    api("/vehicles"),
    api("/assignments"),
  ]);
  state.data.customers = customers.customers;
  state.data.bookings = bookings.bookings;
  state.data.drivers = drivers.drivers;
  state.data.vehicles = vehicles.vehicles;
  state.data.assignments = assignments.assignments;
}

async function renderDashboard() {
  const data = await api("/dashboard");
  content.innerHTML = `
    <div class="row g-3 mb-3">
      ${metric("Total Bookings", data.cards.total_bookings, "fa-calendar-check")}
      ${metric("Active Trips", data.cards.active_trips, "fa-route")}
      ${metric("Completed Trips", data.cards.completed_trips, "fa-circle-check")}
      ${metric("Available Drivers", data.cards.available_drivers, "fa-id-card")}
      ${metric("Assigned Drivers", data.cards.assigned_drivers, "fa-user-clock")}
      ${metric("Available Vehicles", data.cards.available_vehicles, "fa-car-side")}
    </div>
    <div class="row g-3 mb-3">
      <div class="col-lg-4"><div class="card-lite panel"><div class="panel-title"><h3>Daily Bookings</h3></div><canvas id="dailyChart" height="220"></canvas></div></div>
      <div class="col-lg-4"><div class="card-lite panel"><div class="panel-title"><h3>Weekly Bookings</h3></div><canvas id="weeklyChart" height="220"></canvas></div></div>
      <div class="col-lg-4"><div class="card-lite panel"><div class="panel-title"><h3>Trip Status Overview</h3></div><canvas id="statusChart" height="220"></canvas></div></div>
    </div>
    <div class="row g-3">
      <div class="col-xl-6">${tablePanel("Recent Assignments", assignmentRows(data.recent_assignments))}</div>
      <div class="col-xl-6">${tablePanel("Upcoming Trips", bookingRows(data.upcoming_trips, false))}</div>
    </div>
  `;
  chart("dailyChart", "bar", data.daily_bookings, "#2563eb");
  chart("weeklyChart", "line", data.weekly_bookings, "#14b8a6");
  chart("statusChart", "doughnut", data.trip_status_overview, ["#f59e0b", "#2563eb", "#14b8a6", "#22c55e", "#64748b"]);
}

function metric(label, value, icon) {
  return `<div class="col-sm-6 col-xl-4"><div class="card-lite metric-card">
    <div><span>${label}</span><strong>${value}</strong></div><div class="metric-icon"><i class="fa-solid ${icon}"></i></div>
  </div></div>`;
}

const configs = {
  customers: {
    endpoint: "/customers",
    key: "customers",
    title: "Customer",
    fields: [
      ["name", "Customer Name", "text"],
      ["phone", "Phone Number", "tel"],
      ["email", "Email", "email"],
      ["address", "Address", "textarea"],
    ],
    headers: ["Name", "Phone", "Email", "Address", "Actions"],
    row: (x) => [x.name, x.phone, x.email || "-", x.address || "-"],
  },
  drivers: {
    endpoint: "/drivers",
    key: "drivers",
    title: "Driver",
    fields: [
      ["name", "Driver Name", "text"],
      ["phone", "Phone Number", "tel"],
      ["license_number", "License Number", "text"],
      ["experience", "Experience", "number"],
      ["availability_status", "Availability Status", "select", ["Available", "Assigned", "Unavailable"]],
    ],
    headers: ["Name", "Phone", "License", "Experience", "Availability", "Actions"],
    row: (x) => [x.name, x.phone, x.license_number, `${x.experience} years`, badge(x.availability_status)],
  },
  vehicles: {
    endpoint: "/vehicles",
    key: "vehicles",
    title: "Vehicle",
    fields: [
      ["name", "Vehicle Name", "text"],
      ["vehicle_number", "Vehicle Number", "text"],
      ["vehicle_type", "Vehicle Type", "text"],
      ["capacity", "Capacity", "number"],
      ["status", "Status", "select", ["Available", "Assigned", "Maintenance"]],
    ],
    headers: ["Name", "Number", "Type", "Capacity", "Status", "Actions"],
    row: (x) => [x.name, x.vehicle_number, x.vehicle_type, x.capacity, badge(x.status)],
  },
  bookings: {
    endpoint: "/bookings",
    key: "bookings",
    title: "Booking",
    fields: () => [
      ["customer_id", "Customer Name", "select", state.data.customers.map((c) => [c.id, c.name])],
      ["pickup_location", "Pickup Location", "text"],
      ["drop_location", "Drop Location", "text"],
      ["trip_date", "Trip Date", "date"],
      ["trip_time", "Trip Time", "time"],
      ["vehicle_type", "Vehicle Type", "text"],
      ["status", "Status", "select", ["Pending", "Confirmed", "Driver Assigned", "Trip Started", "Completed"]],
    ],
    headers: ["Booking ID", "Customer", "Pickup", "Drop", "Date", "Time", "Vehicle Type", "Status", "Actions"],
    row: (x) => [x.booking_code, x.customer_name, x.pickup_location, x.drop_location, x.trip_date, x.trip_time, x.vehicle_type, badge(x.status)],
  },
};

async function renderCrud(type) {
  if (type === "bookings") await loadCoreData();
  const config = configs[type];
  const data = await api(config.endpoint);
  state.data[config.key] = data[config.key];
  content.innerHTML = `
    <div class="card-lite panel">
      <div class="toolbar">
        <div class="d-flex gap-2 flex-wrap">
          <input id="searchInput" class="form-control" placeholder="Search ${config.title.toLowerCase()}">
          ${type === "bookings" ? statusFilter() : ""}
        </div>
        <button class="btn btn-primary" id="addBtn"><i class="fa-solid fa-plus me-2"></i>Add ${config.title}</button>
      </div>
      <div class="table-responsive">${crudTable(config, state.data[config.key])}</div>
    </div>
  `;
  $("#addBtn").addEventListener("click", () => openEntityModal(type));
  $("#searchInput").addEventListener("input", () => filterCrud(type));
  $("#statusFilter")?.addEventListener("change", () => filterCrud(type));
  bindRowActions(type);
}

function statusFilter() {
  return `<select id="statusFilter" class="form-select">
    <option value="">All statuses</option>
    ${["Pending", "Confirmed", "Driver Assigned", "Trip Started", "Completed"].map((s) => `<option>${s}</option>`).join("")}
  </select>`;
}

function crudTable(config, rows) {
  return `<table class="table table-hover">
    <thead><tr>${config.headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((item) => crudRow(config, item)).join("") || emptyRow(config.headers.length)}</tbody>
  </table>`;
}

function crudRow(config, item) {
  const values = config.row(item).map((value) => `<td>${value}</td>`).join("");
  return `<tr data-id="${item.id}">${values}<td><div class="actions">
    <button class="btn btn-outline-primary btn-sm" data-action="edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
    <button class="btn btn-outline-danger btn-sm" data-action="delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
  </div></td></tr>`;
}

function filterCrud(type) {
  const config = configs[type];
  const search = $("#searchInput").value.toLowerCase();
  const selectedStatus = $("#statusFilter")?.value || "";
  const rows = state.data[config.key].filter((item) => {
    const textMatch = JSON.stringify(item).toLowerCase().includes(search);
    const statusMatch = !selectedStatus || item.status === selectedStatus;
    return textMatch && statusMatch;
  });
  $(".table-responsive").innerHTML = crudTable(config, rows);
  bindRowActions(type);
}

function bindRowActions(type) {
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.closest("tr").dataset.id);
      if (button.dataset.action === "edit") openEntityModal(type, state.data[configs[type].key].find((item) => item.id === id));
      if (button.dataset.action === "delete") await deleteEntity(type, id);
    });
  });
}

function openEntityModal(type, item = null) {
  state.modalMode = { type, item };
  const config = configs[type];
  const fields = typeof config.fields === "function" ? config.fields() : config.fields;
  $("#modalTitle").textContent = `${item ? "Edit" : "Add"} ${config.title}`;
  $("#modalBody").innerHTML = fields.map((field) => fieldControl(field, item)).join("");
  state.modal.show();
}

function fieldControl([name, label, type, options], item) {
  const value = item?.[name] ?? "";
  if (type === "textarea") {
    return `<div class="col-12"><label class="form-label">${label}</label><textarea class="form-control" name="${name}" rows="3">${escapeHtml(value)}</textarea></div>`;
  }
  if (type === "select") {
    const opts = options.map((option) => {
      const val = Array.isArray(option) ? option[0] : option;
      const text = Array.isArray(option) ? option[1] : option;
      return `<option value="${val}" ${String(val) === String(value) ? "selected" : ""}>${text}</option>`;
    });
    return `<div class="col-md-6"><label class="form-label">${label}</label><select class="form-select" name="${name}" required>${opts.join("")}</select></div>`;
  }
  return `<div class="col-md-6"><label class="form-label">${label}</label><input class="form-control" name="${name}" type="${type}" value="${escapeHtml(value)}" required></div>`;
}

async function saveModalForm(event) {
  event.preventDefault();
  if (state.modalMode?.type === "reassign") {
    await saveReassignment(event);
    return;
  }
  const { type, item } = state.modalMode;
  const config = configs[type];
  const body = Object.fromEntries(new FormData(event.target).entries());
  try {
    await api(item ? `${config.endpoint}/${item.id}` : config.endpoint, { method: item ? "PUT" : "POST", body });
    state.modal.hide();
    toast(`${config.title} saved`);
    await renderCrud(type);
  } catch (error) {
    toast(error.message, "danger");
  }
}

async function deleteEntity(type, id) {
  if (!confirm("Delete this record?")) return;
  const config = configs[type];
  try {
    await api(`${config.endpoint}/${id}`, { method: "DELETE" });
    toast(`${config.title} deleted`);
    await renderCrud(type);
  } catch (error) {
    toast(error.message, "danger");
  }
}

async function renderAssignments() {
  await loadCoreData();
  content.innerHTML = `
    <div class="row g-3">
      <div class="col-xl-4">
        <div class="card-lite panel">
          <div class="panel-title"><h3>Assign Driver & Vehicle</h3></div>
          <form id="assignmentForm" class="row g-3">
            ${selectField("booking_id", "Booking", state.data.bookings.filter((b) => !b.assignment).map((b) => [b.id, `${b.booking_code} - ${b.customer_name}`]))}
            ${selectField("driver_id", "Driver", state.data.drivers.map((d) => [d.id, `${d.name} (${d.availability_status})`]))}
            ${selectField("vehicle_id", "Vehicle", state.data.vehicles.map((v) => [v.id, `${v.name} - ${v.vehicle_number} (${v.status})`]))}
            <div class="col-12"><label class="form-label">Notes</label><textarea class="form-control" name="notes" rows="3"></textarea></div>
            <div class="col-12"><button class="btn btn-primary w-100" type="submit"><i class="fa-solid fa-link me-2"></i>Create Assignment</button></div>
          </form>
        </div>
      </div>
      <div class="col-xl-8">${tablePanel("Assignment History", assignmentRows(state.data.assignments, true))}</div>
    </div>
  `;
  $("#assignmentForm").addEventListener("submit", saveAssignment);
  document.querySelectorAll("[data-reassign]").forEach((button) => button.addEventListener("click", () => openReassignModal(Number(button.dataset.reassign))));
}

function selectField(name, label, options) {
  return `<div class="col-12"><label class="form-label">${label}</label><select class="form-select" name="${name}" required>
    <option value="">Select ${label.toLowerCase()}</option>
    ${options.map((x) => `<option value="${x[0]}">${escapeHtml(x[1])}</option>`).join("")}
  </select></div>`;
}

async function saveAssignment(event) {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(event.target).entries());
  try {
    await api("/assignments", { method: "POST", body });
    toast("Assignment created");
    await renderAssignments();
  } catch (error) {
    toast(error.message, "danger");
  }
}

function openReassignModal(id) {
  const assignment = state.data.assignments.find((item) => item.id === id);
  state.modalMode = { type: "reassign", item: assignment };
  $("#modalTitle").textContent = `Reassign ${assignment.booking_code}`;
  $("#modalBody").innerHTML = `
    ${selectField("driver_id", "Driver", state.data.drivers.map((d) => [d.id, `${d.name} (${d.availability_status})`]))}
    ${selectField("vehicle_id", "Vehicle", state.data.vehicles.map((v) => [v.id, `${v.name} - ${v.vehicle_number} (${v.status})`]))}
    <div class="col-12"><label class="form-label">Notes</label><textarea class="form-control" name="notes" rows="3">Reassignment</textarea></div>
  `;
  state.modal.show();
}

async function saveReassignment(event) {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(event.target).entries());
  try {
    await api(`/assignments/${state.modalMode.item.id}`, { method: "PUT", body });
    state.modal.hide();
    toast("Assignment updated");
    await renderAssignments();
  } catch (error) {
    toast(error.message, "danger");
  }
}

async function renderTrips() {
  const res = await api("/trips");
  state.data.trips = res.trips;
  content.innerHTML = `<div class="card-lite panel">
    <div class="table-responsive">
      <table class="table table-hover">
        <thead><tr><th>Booking ID</th><th>Customer</th><th>Driver</th><th>Vehicle</th><th>Pickup</th><th>Drop</th><th>Date</th><th>Time</th><th>Status</th><th>Update</th></tr></thead>
        <tbody>${state.data.trips.map(tripRow).join("") || emptyRow(10)}</tbody>
      </table>
    </div>
  </div>`;
  document.querySelectorAll("[data-trip-status]").forEach((select) => select.addEventListener("change", updateTripStatus));
}

function tripRow(item) {
  return `<tr>
    <td>${item.booking_code}</td><td>${item.customer_name}</td><td>${item.assignment?.driver_name || "-"}</td>
    <td>${item.assignment?.vehicle_name || "-"}</td><td>${item.pickup_location}</td><td>${item.drop_location}</td>
    <td>${item.trip_date}</td><td>${item.trip_time}</td><td>${badge(item.status)}</td>
    <td><select class="form-select form-select-sm" data-trip-status="${item.id}">
      ${["Pending", "Confirmed", "Driver Assigned", "Trip Started", "Completed"].map((s) => `<option ${s === item.status ? "selected" : ""}>${s}</option>`).join("")}
    </select></td>
  </tr>`;
}

async function updateTripStatus(event) {
  try {
    await api(`/trips/${event.target.dataset.tripStatus}/status`, { method: "PUT", body: { status: event.target.value } });
    toast("Trip status updated");
    await renderTrips();
  } catch (error) {
    toast(error.message, "danger");
  }
}

async function renderReports(period = "daily") {
  const res = await api(`/reports?period=${period}`);
  content.innerHTML = `
    <div class="toolbar">
      <div class="btn-group" role="group">
        ${["daily", "weekly", "monthly"].map((p) => `<button class="btn ${p === period ? "btn-primary" : "btn-outline-primary"}" data-period="${p}">${capitalize(p)}</button>`).join("")}
      </div>
    </div>
    <div class="row g-3 mb-3">
      <div class="col-lg-6"><div class="card-lite panel"><div class="panel-title"><h3>Driver Utilization</h3></div><canvas id="driverUtilChart" height="220"></canvas></div></div>
      <div class="col-lg-6"><div class="card-lite panel"><div class="panel-title"><h3>Vehicle Utilization</h3></div><canvas id="vehicleUtilChart" height="220"></canvas></div></div>
    </div>
    ${tablePanel(`${capitalize(period)} Assignment Report`, assignmentRows(res.assignments))}
  `;
  document.querySelectorAll("[data-period]").forEach((button) => button.addEventListener("click", () => renderReports(button.dataset.period)));
  chart("driverUtilChart", "bar", res.driver_utilization, "#2563eb");
  chart("vehicleUtilChart", "bar", res.vehicle_utilization, "#14b8a6");
}

function tablePanel(title, rows) {
  return `<div class="card-lite panel"><div class="panel-title"><h3>${title}</h3></div>
    <div class="table-responsive"><table class="table table-hover">${rows}</table></div></div>`;
}

function assignmentRows(rows, actions = false) {
  return `<thead><tr><th>Booking</th><th>Customer</th><th>Driver</th><th>Vehicle</th><th>Date</th><th>Status</th>${actions ? "<th>Action</th>" : ""}</tr></thead>
  <tbody>${rows.map((item) => `<tr>
    <td>${item.booking_code}</td><td>${item.customer_name || "-"}</td><td>${item.driver_name}</td><td>${item.vehicle_name}</td>
    <td>${item.trip_date || "-"}</td><td>${badge(item.status || (item.is_active ? "Assigned" : "Reassigned"))}</td>
    ${actions ? `<td><button class="btn btn-outline-primary btn-sm" data-reassign="${item.id}"><i class="fa-solid fa-rotate me-1"></i>Reassign</button></td>` : ""}
  </tr>`).join("") || emptyRow(actions ? 7 : 6)}</tbody>`;
}

function bookingRows(rows) {
  return `<thead><tr><th>Booking</th><th>Customer</th><th>Pickup</th><th>Drop</th><th>Date</th><th>Status</th></tr></thead>
  <tbody>${rows.map((item) => `<tr><td>${item.booking_code}</td><td>${item.customer_name}</td><td>${item.pickup_location}</td><td>${item.drop_location}</td><td>${item.trip_date} ${item.trip_time}</td><td>${badge(item.status)}</td></tr>`).join("") || emptyRow(6)}</tbody>`;
}

function badge(status) {
  return `<span class="badge-soft status-${String(status).replaceAll(" ", "-")}">${status}</span>`;
}

function emptyRow(cols) {
  return `<tr><td colspan="${cols}" class="text-center text-secondary py-4">No records found</td></tr>`;
}

function chart(id, type, data, colors) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  state.charts[id]?.destroy();
  state.charts[id] = new Chart(ctx, {
    type,
    data: {
      labels: data.map((item) => item.label),
      datasets: [{ data: data.map((item) => item.value), backgroundColor: colors, borderColor: colors, tension: 0.35, fill: false }],
    },
    options: { responsive: true, plugins: { legend: { display: type === "doughnut" } }, scales: type === "doughnut" ? {} : { y: { beginAtZero: true, ticks: { precision: 0 } } } },
  });
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}
