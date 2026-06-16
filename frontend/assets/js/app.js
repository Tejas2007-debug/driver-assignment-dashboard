const API_BASE = "https://driver-assignment-dashboard.onrender.com/api";
const modules = [
  { id: "dashboard", label: "Dashboard", icon: "fa-chart-line", page: "dashboard.html", subtitle: "Centralized driver assignment operations" },
  { id: "customers", label: "Customers", icon: "fa-users", page: "customers.html", subtitle: "Manage customer records and details" },
  { id: "bookings", label: "Bookings", icon: "fa-calendar-check", page: "bookings.html", subtitle: "Create, filter, and manage trip bookings" },
  { id: "drivers", label: "Drivers", icon: "fa-id-card", page: "drivers.html", subtitle: "Manage driver availability and profiles" },
  { id: "vehicles", label: "Vehicles", icon: "fa-car-side", page: "vehicles.html", subtitle: "Manage vehicle availability and details" },
  { id: "assignments", label: "Assignments", icon: "fa-clipboard-list", page: "assignments.html", subtitle: "Assign drivers and vehicles without conflicts" },
  { id: "trips", label: "Trip Status", icon: "fa-location-dot", page: "trips.html", subtitle: "Track active and completed trip status" },
  { id: "reports", label: "Reports", icon: "fa-chart-pie", page: "reports.html", subtitle: "Assignment and utilization reports" },
];

const state = {
  active: "dashboard",
  user: null,
  data: { customers: [], bookings: [], drivers: [], vehicles: [], assignments: [], trips: [] },
  charts: {},
  modal: null,
  modalMode: null,
};

const PAYMENT_STATUSES = ["Pending", "Partial", "Paid"];
const DRIVER_STATUSES = ["Available", "On Trip", "Leave", "Unavailable"];
const BOOKING_STATUSES = ["Pending", "Confirmed", "Driver Assigned", "Trip Started", "Completed"];
const VEHICLE_STATUSES = ["Available", "Assigned", "Maintenance"];
const STORAGE_KEYS = {
  payment: "mtt_booking_payment_status",
  driverStatus: "mtt_driver_status_overrides",
  actionHistory: "mtt_assignment_action_history",
  tripHistory: "mtt_trip_status_history",
};

const $ = (selector) => document.querySelector(selector);
const content = $("#content");
const loader = $("#loader");

document.addEventListener("DOMContentLoaded", async () => {
  state.active = detectModule();
  state.modal = $("#entityModal") ? new bootstrap.Modal($("#entityModal")) : null;
  enhanceTopbar();
  renderNav();
  bindShell();
  await boot();
});

function bindShell() {
  $("#loginForm")?.addEventListener("submit", login);
  $("#logoutBtn")?.addEventListener("click", logout);

  // Initialize a single, reusable sidebar system for all pages
  initSidebar();

  $("#entityForm")?.addEventListener("submit", saveModalForm);
  $("#togglePassword")?.addEventListener("click", togglePassword);
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".profile-menu")) document.querySelector(".profile-menu")?.classList.remove("open");
  });
}

/**
 * initSidebar
 * - Ensures a single overlay exists (created if missing)
 * - Adds accessible attributes to the toggle button
 * - Handles open/close for mobile/tablet/desktop using the same breakpoint as CSS (992px)
 * - Adds keyboard support (Escape) and focus management
 * - Closes sidebar when a navigation link is clicked on small viewports
 */
function initSidebar() {
  try {
    if (document.body.dataset.sidebarInitialized === "true") return;

    // Ensure overlay exists
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      document.body.insertBefore(overlay, document.body.firstChild);
    }

    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    if (!sidebar || !toggle) return;

    // Ensure semantic/ARIA attributes on sidebar
    sidebar.setAttribute('role', 'navigation');
    sidebar.setAttribute('aria-label', 'Main navigation');

    // Accessibility attributes on toggle
    toggle.setAttribute('aria-controls', 'sidebar');
    toggle.setAttribute('aria-label', 'Toggle navigation');
    toggle.setAttribute('aria-expanded', sidebar.classList.contains('open') ? 'true' : 'false');

    const mq = window.matchMedia('(max-width: 992px)');
    let previousFocus = null;

    function openSidebar() {
      sidebar.classList.add('open');
      overlay.classList.add('show');
      toggle.setAttribute('aria-expanded', 'true');
      previousFocus = document.activeElement;
      // focus first link for keyboard users
      const firstLink = sidebar.querySelector('.nav-link');
      if (firstLink) firstLink.focus();
      document.addEventListener('keydown', onKeydown);
    }

    function closeSidebar() {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
      toggle.setAttribute('aria-expanded', 'false');
      if (previousFocus) previousFocus.focus(); else toggle.focus();
      document.removeEventListener('keydown', onKeydown);
    }

    function onKeydown(e) {
      if (e.key === 'Escape') closeSidebar();
    }

    toggle.addEventListener('click', (e) => {
      // Use same breakpoint as CSS media queries (992px)
      if (mq.matches) {
        if (sidebar.classList.contains('open')) closeSidebar();
        else openSidebar();
      } else {
        // Desktop/tablet behavior: collapse/expand
        sidebar.classList.toggle('collapsed');
      }
    });

    overlay.addEventListener('click', () => {
      if (sidebar.classList.contains('open')) closeSidebar();
    });

    // Close sidebar when a nav item is clicked on small screens
    function bindNavLinks() {
      const links = document.querySelectorAll('#sidebarNav a.nav-link');
      links.forEach((a) => {
        // avoid double-binding
        if (a.dataset.sidebarBound === 'true') return;
        a.dataset.sidebarBound = 'true';
        a.addEventListener('click', () => {
          if (mq.matches) closeSidebar();
        });
      });
    }

    // monitor DOM changes to rebind nav links if sidebar content is re-rendered
    const navNode = document.getElementById('sidebarNav');
    if (navNode) {
      bindNavLinks();
      const obs = new MutationObserver(() => bindNavLinks());
      obs.observe(navNode, { childList: true, subtree: true });
    }

    // expose a window helper for debugging/tests
    window.__sidebar = { open: openSidebar, close: closeSidebar };

    document.body.dataset.sidebarInitialized = 'true';
  } catch (err) {
    console.error('initSidebar error', err);
  }
}

async function boot() {
  try {
    const res = await api("/auth/me");
    state.user = res.user;
    showApp();
    await navigate(state.active);
  } catch {
    showLogin();
  }
}

function showApp() {
  $("#loginScreen")?.classList.add("d-none");
  $("#appShell")?.classList.remove("d-none");
  if ($("#userName")) $("#userName").textContent = state.user?.name || "Admin";
}

function showLogin() {
  if ($("#loginScreen")) {
    $("#loginScreen").classList.remove("d-none");
    $("#appShell")?.classList.add("d-none");
    return;
  }
  window.location.href = "index.html";
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
    window.location.href = "dashboard.html";
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
  if (!$("#sidebarNav")) return;
  $("#sidebarNav").innerHTML = modules
    .map((item) => `
      <a class="nav-link ${item.id === state.active ? "active" : ""}" href="${item.page}" title="${item.label}">
        <i class="fa-solid ${item.icon}"></i><span class="nav-label">${item.label}</span>
      </a>
    `)
    .join("");
}

function enhanceTopbar() {
  const actions = $(".topbar-actions");
  if (!actions || actions.dataset.enhanced === "true") return;
  actions.dataset.enhanced = "true";
  const userChip = actions.querySelector(".user-chip");
  const logoutBtn = actions.querySelector("#logoutBtn");
  userChip?.remove();
  logoutBtn?.remove();
  actions.insertAdjacentHTML(
    "afterbegin",
    `<div class="date-pill"><i class="fa-regular fa-calendar"></i><span id="currentDate"></span></div>
     <div class="profile-menu">
       <button class="profile-trigger" type="button" title="Profile menu">
         <span class="avatar avatar-admin">MT</span>
         <span class="profile-copy"><strong id="userName">Admin</strong><small>Operations Admin</small></span>
         <i class="fa-solid fa-chevron-down"></i>
       </button>
       <div class="profile-dropdown">
         <div class="profile-dropdown-head"><span class="avatar avatar-admin">MT</span><div><strong>Manivtha Admin</strong><small>Driver assignments</small></div></div>
         <button id="logoutBtn" class="dropdown-action" type="button"><i class="fa-solid fa-arrow-right-from-bracket"></i>Logout</button>
       </div>
     </div>`
  );
  $("#currentDate").textContent = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date());
  $(".profile-trigger")?.addEventListener("click", (event) => {
    event.stopPropagation();
    $(".profile-menu")?.classList.toggle("open");
  });
  $("#logoutBtn")?.addEventListener("click", logout);
}

async function navigate(moduleId) {
  if (!content) return;
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
  loader?.classList.toggle("d-none", !show);
}

function toast(message, type = "success") {
  if (!$("#toastHost")) {
    alert(message);
    return;
  }
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
  const [data] = await Promise.all([api("/dashboard"), loadCoreData()]);
  const timing = tripTimingSummary(state.data.bookings);
  const alerts = coordinatorAlerts();
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
      ${metric("Upcoming Trips", timing.upcoming, "fa-calendar-plus")}
      ${metric("Ongoing Trips", timing.ongoing, "fa-route")}
      ${metric("Completed Today", timing.completedToday, "fa-calendar-check")}
      ${metric("Next Scheduled Pickup", timing.nextPickup, "fa-clock")}
    </div>
    <div class="row g-3 mb-3">
      <div class="col-lg-4"><div class="card-lite panel"><div class="panel-title"><h3>Daily Bookings</h3></div><div class="chart-container"><canvas id="dailyChart"></canvas></div></div></div>
      <div class="col-lg-4"><div class="card-lite panel"><div class="panel-title"><h3>Weekly Bookings</h3></div><div class="chart-container"><canvas id="weeklyChart"></canvas></div></div></div>
      <div class="col-lg-4"><div class="card-lite panel"><div class="panel-title"><h3>Trip Status Overview</h3></div><div class="chart-container"><canvas id="statusChart"></canvas></div></div></div>
    </div>
    <div class="row g-3">
      <div class="col-xl-4"><div class="card-lite panel"><div class="panel-title"><h3>Coordinator Alerts</h3></div>${alertList(alerts)}</div></div>
      <div class="col-xl-4">${tablePanel("Recent Assignments", assignmentRows(data.recent_assignments))}</div>
      <div class="col-xl-4">${tablePanel("Upcoming Trips", bookingRows(data.upcoming_trips, false))}</div>
    </div>
  `;
  chart("dailyChart", "bar", data.daily_bookings, "#2563eb");
  chart("weeklyChart", "line", data.weekly_bookings, "#14b8a6");
  chart("statusChart", "doughnut", data.trip_status_overview, ["#f59e0b", "#2563eb", "#14b8a6", "#22c55e", "#64748b"]);
}

function metric(label, value, icon) {
  return `
  <div class="col-6 col-md-4 col-lg-2">
      <div class="card-lite metric-card dashboard-metric-card">
          <div class="metric-content">
              <span>${label}</span>
              <strong>${value}</strong>
              <small>
                  <i class="fa-solid fa-arrow-trend-up"></i>
                  Live operations
              </small>
          </div>

          <div class="metric-icon">
              <i class="fa-solid ${icon}"></i>
          </div>
      </div>
  </div>`;
}

function reportMetric(label, value, icon) {
  return `
  <div class="col-12 col-md-4">
      <div class="card-lite metric-card report-metric-card">

          <div class="metric-content">
              <span>${label}</span>

              <strong>${value}</strong>

              <small>
                  <i class="fa-solid fa-arrow-trend-up"></i>
                  Live operations
              </small>
          </div>

          <div class="metric-icon">
              <i class="fa-solid ${icon}"></i>
          </div>

      </div>
  </div>`;
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
    row: (x) => [profileCell(x.name, x.email, "customer"), x.phone, x.email || "-", x.address || "-"],
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
      ["availability_status", "Availability Status", "select", DRIVER_STATUSES],
    ],
    headers: ["Name", "Phone", "License", "Experience", "Status", "Actions"],
    row: (x) => [profileCell(x.name, x.phone, "driver"), x.phone, x.license_number, expBadge(x.experience), badge(driverStatus(x))],
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
    row: (x) => [vehicleCell(x), x.vehicle_number, x.vehicle_type, `${x.capacity} seats`, badge(x.status)],
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
      ["payment_status", "Payment Status", "select", PAYMENT_STATUSES],
    ],
    headers: ["Booking ID", "Customer", "Pickup", "Drop", "Date", "Time", "Vehicle Type", "Status", "Payment", "Actions"],
    row: (x) => [`<strong class="booking-id">${x.booking_code}</strong>`, profileCell(x.customer_name, x.vehicle_type, "customer"), x.pickup_location, x.drop_location, x.trip_date, x.trip_time, x.vehicle_type, badge(x.status), badge(bookingPaymentStatus(x))],
    details: true,
  },
};

async function renderCrud(type) {
  if (["bookings", "drivers", "vehicles"].includes(type)) await loadCoreData();
  const config = configs[type];
  const data = await api(config.endpoint);
  state.data[config.key] = data[config.key];
  content.innerHTML = `
    <div class="card-lite panel">
      <div class="toolbar">
        <div class="d-flex gap-2 flex-wrap">
          <input id="searchInput" class="form-control" placeholder="Search ${config.title.toLowerCase()}">
          ${["bookings", "drivers", "vehicles"].includes(type) ? statusFilter(type) : ""}
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

function statusFilter(type = "bookings") {
  const options = {
    bookings: BOOKING_STATUSES,
    drivers: DRIVER_STATUSES,
    vehicles: VEHICLE_STATUSES,
  }[type] || [];
  return `<select id="statusFilter" class="form-select">
    <option value="">All statuses</option>
    ${options.map((s) => `<option>${s}</option>`).join("")}
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
    ${config.details ? `<button class="btn btn-outline-secondary btn-sm" data-action="view" title="View Details"><i class="fa-regular fa-eye"></i></button>` : ""}
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
    const itemStatus = type === "drivers" ? driverStatus(item) : item.status;
    const statusMatch = !selectedStatus || itemStatus === selectedStatus;
    return textMatch && statusMatch;
  });
  $(".table-responsive").innerHTML = crudTable(config, rows);
  bindRowActions(type);
}

function bindRowActions(type) {
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.closest("tr").dataset.id);
      if (button.dataset.action === "view") openTripDetailModal(id);
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
  setModalSaveVisible(true);
  $("#modalBody").innerHTML = fields.map((field) => fieldControl(field, modalItem(type, item))).join("");
  state.modal.show();
}

function fieldControl([name, label, type, options], item) {
  const value = item?.[name] ?? "";
  if (type === "textarea") {
    return `<div class="col-12"><div class="form-floating"><textarea class="form-control" name="${name}" placeholder="${label}" rows="3">${escapeHtml(value)}</textarea><label>${label}</label></div></div>`;
  }
  if (type === "select") {
    const opts = options.map((option) => {
      const val = Array.isArray(option) ? option[0] : option;
      const text = Array.isArray(option) ? option[1] : option;
      return `<option value="${val}" ${String(val) === String(value) ? "selected" : ""}>${text}</option>`;
    });
    return `<div class="col-md-6"><div class="form-floating"><select class="form-select" name="${name}" required>${opts.join("")}</select><label>${label}</label></div></div>`;
  }
  return `<div class="col-md-6"><div class="form-floating"><input class="form-control" name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${label}" required><label>${label}</label></div></div>`;
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
  const localPaymentStatus = type === "bookings" ? body.payment_status : null;
  const localDriverStatus = type === "drivers" ? body.availability_status : null;
  if (type === "bookings") delete body.payment_status;
  if (type === "drivers") body.availability_status = apiDriverStatus(localDriverStatus);
  // CUSTOMER VALIDATION
if (type === "customers") {

    if (!/^[A-Za-z ]+$/.test(body.name)) {
        toast("Customer name must contain only letters", "danger");
        return;
    }

    if (!/^[0-9]{10}$/.test(body.phone)) {
        toast("Phone number must be exactly 10 digits", "danger");
        return;
    }

    if (
        body.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
    ) {
        toast("Invalid email address", "danger");
        return;
    }
}

// DRIVER VALIDATION
if (type === "drivers") {

    if (!/^[0-9]{10}$/.test(body.phone)) {
        toast("Driver phone number must be 10 digits", "danger");
        return;
    }

    if (
        Number(body.experience) < 0 ||
        Number(body.experience) > 50
    ) {
        toast(
            "Experience must be between 0 and 50 years",
            "danger"
        );
        return;
    }
}

// VEHICLE VALIDATION
if (type === "vehicles") {

    if (Number(body.capacity) <= 0) {
        toast(
            "Vehicle capacity must be greater than zero",
            "danger"
        );
        return;
    }
}

// BOOKING VALIDATION
if (type === "bookings") {

    const tripDate = new Date(body.trip_date);
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    if (tripDate < today) {
        toast(
            "Trip date cannot be in the past",
            "danger"
        );
        return;
    }
}

  try {
    const response = await api(item ? `${config.endpoint}/${item.id}` : config.endpoint, { method: item ? "PUT" : "POST", body });
    if (type === "bookings") {
      saveBookingPaymentStatus(item?.id || response.booking?.id, localPaymentStatus);
    }
    if (type === "drivers") {
      saveDriverStatusOverride(item?.id || response.driver?.id, localDriverStatus);
    }
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
  console.log("LATEST VERSION LOADED");
  await loadCoreData();
  console.log("Assignments:", state.data.assignments);
  content.innerHTML = `
    <div class="row g-3">
      <div class="col-xl-4">
        <div class="card-lite panel assignment-form-card">
          <div class="panel-title"><h3>Assign Driver & Vehicle</h3></div>
          <form id="assignmentForm" class="row g-3">
            ${selectField("booking_id", "Booking", state.data.bookings.filter((b) => !b.assignment).map((b) => [b.id, `${b.booking_code} - ${b.customer_name}`]))}
            ${selectField("driver_id", "Driver", assignableDrivers().map((d) => [d.id, `${d.name} (${driverStatus(d)})`]))}
            ${selectField("vehicle_id", "Vehicle", assignableVehicles().map((v) => [v.id, `${v.name} - ${v.vehicle_number} (${v.status})`]))}
            <div class="col-12"><div class="form-floating"><textarea class="form-control" name="notes" placeholder="Notes" rows="3"></textarea><label>Notes</label></div></div>
            <div class="col-12"><button class="btn btn-primary w-100" type="submit"><i class="fa-solid fa-link me-2"></i>Create Assignment</button></div>
          </form>
        </div>
      </div>
    <div class="col-xl-8"><div class="card-lite panel"><div class="panel-title"><h3>Assignment History</h3></div>${assignmentTimeline(state.data.assignments, true)}</div></div>
      <div class="col-12"><div class="card-lite panel"><div class="panel-title"><h3>Action History</h3></div>${actionHistoryList()}</div></div>
    </div>
  `;
  $("#assignmentForm").addEventListener("submit", saveAssignment);
  document.querySelectorAll("[data-reassign]").forEach((button) => button.addEventListener("click", () => openReassignModal(Number(button.dataset.reassign))));
  document.querySelectorAll("[data-delete-assignment]")
.forEach((button) =>
    button.addEventListener("click", () =>
        deleteAssignment(
            Number(button.dataset.deleteAssignment)
        )
    )
);
}

function selectField(name, label, options) {
  return `<div class="col-12"><div class="form-floating"><select class="form-select" name="${name}" required>
    <option value="">Select ${label.toLowerCase()}</option>
    ${options.map((x) => `<option value="${x[0]}">${escapeHtml(x[1])}</option>`).join("")}
  </select><label>${label}</label></div></div>`;
}

async function deleteAssignment(id) {

    if (!confirm("Delete this completed assignment?"))
        return;

    try {

        await api(`/assignments/${id}`, {
            method: "DELETE"
        });

        toast("Assignment deleted");

        await renderAssignments();

    } catch (error) {

        toast(error.message, "danger");

    }
}

async function saveAssignment(event) {

    event.preventDefault();

    const body = Object.fromEntries(
        new FormData(event.target).entries()
    );
    if (!canAssignSelection(body.driver_id, body.vehicle_id)) return;

    try {

        const response = await api("/assignments", {
            method: "POST",
            body
        });
        recordAssignmentAction("Assignment created", response.assignment, "Driver and vehicle assigned");

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
  setModalSaveVisible(true);
  $("#modalBody").innerHTML = `
    ${selectField("driver_id", "Driver", reassignableDrivers(assignment).map((d) => [d.id, `${d.name} (${driverStatus(d)})`]))}
    ${selectField("vehicle_id", "Vehicle", reassignableVehicles(assignment).map((v) => [v.id, `${v.name} - ${v.vehicle_number} (${v.status})`]))}
    <div class="col-12"><div class="form-floating"><textarea class="form-control" name="notes" placeholder="Notes" rows="3">Reassignment</textarea><label>Notes</label></div></div>
  `;
  state.modal.show();
}

async function saveReassignment(event) {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(event.target).entries());
  if (!canAssignSelection(body.driver_id, body.vehicle_id, state.modalMode.item)) return;
  const previous = state.modalMode.item;
  try {
    const response = await api(`/assignments/${state.modalMode.item.id}`, { method: "PUT", body });
    if (String(previous.driver_id) !== String(body.driver_id)) recordAssignmentAction("Driver changed", response.assignment, `${previous.driver_name} changed`);
    if (String(previous.vehicle_id) !== String(body.vehicle_id)) recordAssignmentAction("Vehicle changed", response.assignment, `${previous.vehicle_name} changed`);
    recordAssignmentAction("Status updated", response.assignment, "Assignment updated");
    state.modal.hide();
    toast("Assignment updated");
    await renderAssignments();
  } catch (error) {
    toast(error.message, "danger");
  }
}

async function renderTrips() {
  await loadCoreData();
  const res = await api("/trips");
  state.data.trips = res.trips;
  content.innerHTML = `<div class="card-lite panel">
    <div class="table-responsive">
      <table class="table table-hover align-middle">
        <thead><tr><th>Booking ID</th><th>Customer</th><th>Assignment</th><th>Pickup</th><th>Drop</th><th>Date</th><th>Time</th><th>Status</th><th>Update</th><th>Action</th></tr></thead>
        <tbody>${state.data.trips.map(tripRow).join("") || emptyRow(10)}</tbody>
      </table>
    </div>
  </div>`;
  document.querySelectorAll("[data-trip-status]").forEach((select) => select.addEventListener("change", updateTripStatus));
  document.querySelectorAll("[data-trip-detail]").forEach((button) => button.addEventListener("click", () => openTripDetailModal(Number(button.dataset.tripDetail), state.data.trips)));
}

function tripRow(item) {
  return `
  <tr>
    <td class="text-nowrap">
      <strong>${item.booking_code}</strong>
    </td>
    <td class="text-nowrap">${item.customer_name}</td>
    <td class="text-nowrap">
      ${item.assignment ? `<strong>${item.assignment.driver_name}</strong><br><small>${item.assignment.vehicle_name}</small>` : `<span class="text-muted fw-semibold">Not Assigned</span>`}
    </td>
    <td>${item.pickup_location}</td>
    <td>${item.drop_location}</td>
    <td class="text-nowrap">${item.trip_date}</td>
    <td class="text-nowrap">${item.trip_time}</td>
    <td style="min-width: 130px;">
      <div class="mb-1">${statusProgress(item.status)}</div>
      ${badge(item.status)}
    </td>
    <td style="min-width: 160px;">
      <select class="form-select form-select-sm" data-trip-status="${item.id}">
        ${["Pending", "Confirmed", "Driver Assigned", "Trip Started", "Completed"].map((s) => `<option ${s === item.status ? "selected" : ""}>${s}</option>`).join("")}
      </select>
    </td>
    <td><button class="btn btn-outline-secondary btn-sm" data-trip-detail="${item.id}" title="View Details"><i class="fa-regular fa-eye"></i></button></td>
  </tr>`;
}

async function updateTripStatus(event) {
  const trip = state.data.trips.find((item) => String(item.id) === String(event.target.dataset.tripStatus));
  try {
    await api(`/trips/${event.target.dataset.tripStatus}/status`, { method: "PUT", body: { status: event.target.value } });
    recordTripHistory(Number(event.target.dataset.tripStatus), event.target.value, "Status updated");
    if (trip?.assignment) recordAssignmentAction("Status updated", trip.assignment, `${trip.booking_code} set to ${event.target.value}`);
    toast("Trip status updated");
    await renderTrips();
  } catch (error) {
    toast(error.message, "danger");
  }
}

async function renderReports(period = "daily") {
  const res = await api(`/reports?period=${period}`);
  const totalAssignments = res.assignments.length;
  const activeDrivers = res.driver_utilization.filter((item) => item.value > 0).length;
  const activeVehicles = res.vehicle_utilization.filter((item) => item.value > 0).length;
  content.innerHTML = `
    <div class="toolbar">
      <div class="btn-group" role="group">
        ${["daily", "weekly", "monthly"].map((p) => `<button class="btn ${p === period ? "btn-primary" : "btn-outline-primary"}" data-period="${p}">${capitalize(p)}</button>`).join("")}
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <button class="btn btn-light export-btn" data-export="pdf" type="button"><i class="fa-regular fa-file-pdf me-2"></i>Export PDF</button>
        <button class="btn btn-light export-btn" data-export="excel" type="button"><i class="fa-regular fa-file-excel me-2"></i>Export Excel</button>
      </div>
    </div>
    <div class="row g-3 mb-3">
      ${reportMetric("Assignments", totalAssignments, "fa-clipboard-check")}
      ${reportMetric("Active Drivers", activeDrivers, "fa-id-card")}
      ${reportMetric("Active Vehicles", activeVehicles, "fa-car-side")} 
    </div>
    <div class="row g-3 mb-3">
      <div class="col-lg-6"><div class="card-lite panel"><div class="panel-title"><h3>Driver Utilization</h3></div><div class="chart-container"><canvas id="driverUtilChart"></canvas></div></div></div>
      <div class="col-lg-6"><div class="card-lite panel"><div class="panel-title"><h3>Vehicle Utilization</h3></div><div class="chart-container"><canvas id="vehicleUtilChart"></canvas></div></div></div>
    </div>
    ${tablePanel(`${capitalize(period)} Assignment Report`, assignmentRows(res.assignments))}
  `;
  document.querySelectorAll("[data-period]").forEach((button) =>
    button.addEventListener("click", () =>
        renderReports(button.dataset.period)
    )
);

document.querySelectorAll("[data-export]").forEach((button) => {

    button.addEventListener("click", () => {

        if (button.dataset.export === "excel") {

            window.open(
                `${API_BASE}/reports/export/excel`,
                "_blank"
            );

        } else {

            window.open(
                `${API_BASE}/reports/export/pdf`,
                "_blank"
            );

        }

    });

});

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
    <td>
    <strong class="booking-id">
        ${item.booking_code}
    </strong>
</td><td>${item.customer_name || "-"}</td><td>${item.driver_name}</td><td>${item.vehicle_name}</td>
    <td>${item.trip_date || "-"}</td><td>${badge(item.status || (item.is_active ? "Assigned" : "Reassigned"))}</td>
    ${actions ? `
<td><div class="actions">
<button class="btn btn-outline-primary btn-sm" data-reassign="${item.id}" title="Reassign"><i class="fa-solid fa-rotate me-1"></i>Reassign</button>
<button class="btn btn-outline-danger btn-sm ms-2" data-delete-assignment="${item.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
</div></td>
` : ""}
  </tr>`).join("") || emptyRow(actions ? 7 : 6)}</tbody>`;
}

function assignmentTimeline(rows, actions = false) {
  return `<div class="timeline-list">${rows.map((item) => `<div class="timeline-item">
    <div class="timeline-dot"></div>
    <div class="timeline-card">
      <div class="timeline-head"><strong class="booking-id">${item.booking_code}</strong>${badge(item.status || (item.is_active ? "Assigned" : "Reassigned"))}</div>
      <div class="timeline-grid"><span><i class="fa-regular fa-user"></i>${item.customer_name || "-"}</span><span><i class="fa-solid fa-id-card"></i>${item.driver_name}</span><span><i class="fa-solid fa-car-side"></i>${item.vehicle_name}</span><span><i class="fa-regular fa-calendar"></i>${item.trip_date || "-"}</span></div>
      ${actions ? `
<div class="mt-3 d-flex gap-2">

<button class="btn btn-outline-primary btn-sm"
        data-reassign="${item.id}">
    <i class="fa-solid fa-rotate me-1"></i>Reassign
</button>

${true ? `
<button class="btn btn-outline-danger btn-sm"
        data-delete-assignment="${item.id}">
    <i class="fa-solid fa-trash"></i> Delete
</button>
` : ""}

</div>
` : ""}
    </div>
  </div>`).join("") || `<div class="text-center text-secondary py-4">No records found</div>`}</div>`;
}

function bookingRows(rows) {
  return `<thead><tr><th>Booking</th><th>Customer</th><th>Route</th><th>Date</th><th>Status</th></tr></thead>
  <tbody>${rows.map((item) => `<tr><td><strong class="booking-id">${item.booking_code}</strong></td><td>${item.customer_name}</td><td>
    <div class="route-cell">
        <span>${item.pickup_location}</span>
        <i class="fa-solid fa-arrow-right mx-2"></i>
        <span>${item.drop_location}</span>
    </div>
</td><td>${item.trip_date} ${item.trip_time}</td><td>
    ${statusProgress(item.status)}
    <div class="mt-2">
        ${badge(item.status)}
    </div>
</td></tr>`).join("") || emptyRow(6)}</tbody>`;
}

function modalItem(type, item) {
  if (!item) return null;
  if (type === "bookings") return { ...item, payment_status: bookingPaymentStatus(item) };
  if (type === "drivers") return { ...item, availability_status: driverStatus(item) };
  return item;
}

function storageObject(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function saveStorageObject(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function bookingPaymentStatus(booking) {
  return booking?.payment_status || storageObject(STORAGE_KEYS.payment)[booking?.id] || "Pending";
}

function saveBookingPaymentStatus(id, status) {
  if (!id || !status) return;
  const payments = storageObject(STORAGE_KEYS.payment);
  payments[id] = status;
  saveStorageObject(STORAGE_KEYS.payment, payments);
}

function driverStatus(driver) {
  const override = storageObject(STORAGE_KEYS.driverStatus)[driver?.id];
  if (override) return override;
  if (driver?.availability_status === "Assigned") return "On Trip";
  return driver?.availability_status || "Available";
}

function apiDriverStatus(status) {
  if (status === "On Trip") return "Assigned";
  if (status === "Leave") return "Unavailable";
  return status || "Available";
}

function saveDriverStatusOverride(id, status) {
  if (!id || !status) return;
  const statuses = storageObject(STORAGE_KEYS.driverStatus);
  statuses[id] = status;
  saveStorageObject(STORAGE_KEYS.driverStatus, statuses);
}

function assignableDrivers() {
  return state.data.drivers.filter((driver) => driverStatus(driver) === "Available");
}

function assignableVehicles() {
  return state.data.vehicles.filter((vehicle) => vehicle.status === "Available");
}

function reassignableDrivers(assignment) {
  return state.data.drivers.filter((driver) => driverStatus(driver) === "Available" || String(driver.id) === String(assignment.driver_id));
}

function reassignableVehicles(assignment) {
  return state.data.vehicles.filter((vehicle) => vehicle.status === "Available" || String(vehicle.id) === String(assignment.vehicle_id));
}

function canAssignSelection(driverId, vehicleId, currentAssignment = null) {
  const driver = state.data.drivers.find((item) => String(item.id) === String(driverId));
  const vehicle = state.data.vehicles.find((item) => String(item.id) === String(vehicleId));
  const driverAllowed = driver && (driverStatus(driver) === "Available" || String(driver.id) === String(currentAssignment?.driver_id));
  const vehicleAllowed = vehicle && (vehicle.status === "Available" || String(vehicle.id) === String(currentAssignment?.vehicle_id));
  if (!driverAllowed) {
    toast("Selected driver is not available for assignment", "danger");
    return false;
  }
  if (!vehicleAllowed) {
    toast("Selected vehicle is not available for assignment", "danger");
    return false;
  }
  return true;
}

function tripDateTime(booking) {
  return new Date(`${booking.trip_date}T${booking.trip_time || "00:00"}`);
}

function sameDay(dateA, dateB) {
  return dateA.getFullYear() === dateB.getFullYear() && dateA.getMonth() === dateB.getMonth() && dateA.getDate() === dateB.getDate();
}

function tripTimingSummary(bookings) {
  const now = new Date();
  const today = new Date();
  const upcomingTrips = bookings.filter((booking) => tripDateTime(booking) > now && booking.status !== "Completed");
  const next = upcomingTrips.sort((a, b) => tripDateTime(a) - tripDateTime(b))[0];
  return {
    upcoming: upcomingTrips.length,
    ongoing: bookings.filter((booking) => ["Driver Assigned", "Trip Started"].includes(booking.status)).length,
    completedToday: bookings.filter((booking) => booking.status === "Completed" && sameDay(tripDateTime(booking), today)).length,
    nextPickup: next ? `${next.trip_time} ${next.booking_code}` : "-",
  };
}

function coordinatorAlerts() {
  const alerts = [];
  const now = new Date();
  const soonLimit = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  state.data.drivers.filter((driver) => ["Leave", "Unavailable"].includes(driverStatus(driver))).forEach((driver) => {
    alerts.push({ type: "Driver unavailable", message: driver.name, level: "danger" });
  });
  state.data.vehicles.filter((vehicle) => vehicle.status === "Maintenance").forEach((vehicle) => {
    alerts.push({ type: "Vehicle unavailable", message: `${vehicle.name} ${vehicle.vehicle_number}`, level: "danger" });
  });
  state.data.bookings.forEach((booking) => {
    const startsAt = tripDateTime(booking);
    if (startsAt >= now && startsAt <= soonLimit && booking.status !== "Completed") {
      alerts.push({ type: "Trip starting soon", message: `${booking.booking_code} at ${booking.trip_time}`, level: "warning" });
    }
    if (startsAt < now && !["Trip Started", "Completed"].includes(booking.status)) {
      alerts.push({ type: "Trip delayed", message: `${booking.booking_code} was scheduled for ${booking.trip_date} ${booking.trip_time}`, level: "warning" });
    }
    if (booking.assignment && (driverStatus({ id: booking.assignment.driver_id, availability_status: "Assigned" }) === "Unavailable" || booking.assignment.vehicle_status === "Maintenance")) {
      alerts.push({ type: "Assignment conflict", message: booking.booking_code, level: "danger" });
    }
  });
  state.data.assignments.forEach((assignment) => {
    const booking = state.data.bookings.find((item) => item.id === assignment.booking_id);
    const driver = state.data.drivers.find((item) => item.id === assignment.driver_id);
    const vehicle = state.data.vehicles.find((item) => item.id === assignment.vehicle_id);
    if (assignment.is_active && booking && (driver && ["Leave", "Unavailable"].includes(driverStatus(driver)) || vehicle?.status === "Maintenance")) {
      alerts.push({ type: "Assignment conflict", message: `${assignment.booking_code} needs review`, level: "danger" });
    }
  });
  return alerts.slice(0, 8);
}

function alertList(alerts) {
  if (!alerts.length) return `<div class="text-center text-secondary py-4">No coordinator alerts</div>`;
  return `<div class="alert-list">${alerts.map((alert) => `
    <div class="alert-item alert-${alert.level}">
      <strong>${escapeHtml(alert.type)}</strong>
      <span>${escapeHtml(alert.message)}</span>
    </div>`).join("")}</div>`;
}

function recordAssignmentAction(action, assignment, detail = "") {
  if (!assignment) return;
  const history = storageObject(STORAGE_KEYS.actionHistory);
  const key = String(assignment.booking_id || assignment.id);
  history[key] = history[key] || [];
  history[key].unshift({
    action,
    detail,
    booking_code: assignment.booking_code,
    driver_name: assignment.driver_name,
    vehicle_name: assignment.vehicle_name,
    created_at: new Date().toISOString(),
  });
  saveStorageObject(STORAGE_KEYS.actionHistory, history);
}

function actionHistoryList(limit = 12) {
  const history = Object.values(storageObject(STORAGE_KEYS.actionHistory)).flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
  if (!history.length) return `<div class="text-center text-secondary py-4">No action history recorded yet</div>`;
  return `<div class="timeline-list compact-history">${history.map((item) => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-card">
        <div class="timeline-head"><strong>${escapeHtml(item.action)}</strong><small>${formatDateTime(item.created_at)}</small></div>
        <div class="timeline-grid"><span>${escapeHtml(item.booking_code || "-")}</span><span>${escapeHtml(item.driver_name || "-")}</span><span>${escapeHtml(item.vehicle_name || "-")}</span><span>${escapeHtml(item.detail || "")}</span></div>
      </div>
    </div>`).join("")}</div>`;
}

function recordTripHistory(bookingId, status, remarks = "") {
  const history = storageObject(STORAGE_KEYS.tripHistory);
  history[bookingId] = history[bookingId] || [];
  history[bookingId].unshift({ status, remarks, created_at: new Date().toISOString() });
  saveStorageObject(STORAGE_KEYS.tripHistory, history);
}

function tripStatusHistory(booking) {
  const saved = storageObject(STORAGE_KEYS.tripHistory)[booking.id] || [];
  const assignmentHistory = (storageObject(STORAGE_KEYS.actionHistory)[booking.id] || []).map((item) => ({
    status: item.action,
    remarks: item.detail,
    created_at: item.created_at,
  }));
  const base = [{ status: booking.status, remarks: "Current booking status", created_at: new Date().toISOString() }];
  return [...saved, ...assignmentHistory, ...base].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function openTripDetailModal(id, sourceRows = null) {
  const booking = (sourceRows || state.data.bookings || state.data.trips).find((item) => Number(item.id) === Number(id));
  if (!booking) return;
  const assignment = booking.assignment || state.data.assignments.find((item) => item.booking_id === booking.id && item.is_active);
  const customer = state.data.customers.find((item) => item.id === booking.customer_id);
  const driver = assignment ? state.data.drivers.find((item) => item.id === assignment.driver_id) : null;
  const vehicle = assignment ? state.data.vehicles.find((item) => item.id === assignment.vehicle_id) : null;
  state.modalMode = { type: "details", item: booking };
  $("#modalTitle").textContent = `Trip Details ${booking.booking_code}`;
  setModalSaveVisible(false);
  $("#modalBody").innerHTML = `
    <div class="col-md-6">${detailBlock("Customer information", [booking.customer_name || customer?.name, customer?.phone, customer?.email])}</div>
    <div class="col-md-6">${detailBlock("Driver information", [assignment?.driver_name || driver?.name || "Not assigned", driver?.phone, driver ? driverStatus(driver) : ""])}</div>
    <div class="col-md-6">${detailBlock("Vehicle information", [assignment?.vehicle_name || vehicle?.name || "Not assigned", assignment?.vehicle_number || vehicle?.vehicle_number, vehicle?.status])}</div>
    <div class="col-md-6">${detailBlock("Trip information", [booking.pickup_location, booking.drop_location, `${booking.trip_date} ${booking.trip_time}`, `Payment: ${bookingPaymentStatus(booking)}`])}</div>
    <div class="col-12">
      <div class="detail-card">
        <h4>Status history</h4>
        <div class="history-stack">${tripStatusHistory(booking).map((item) => `
          <div class="history-row"><div>${badge(item.status)}<span>${escapeHtml(item.remarks || "")}</span></div><small>${formatDateTime(item.created_at)}</small></div>
        `).join("")}</div>
      </div>
    </div>
  `;
  state.modal.show();
}

function detailBlock(title, lines) {
  return `<div class="detail-card"><h4>${title}</h4>${lines.filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join("") || "<p>-</p>"}</div>`;
}

function setModalSaveVisible(show) {
  const submit = $("#entityForm button[type='submit']");
  if (submit) submit.classList.toggle("d-none", !show);
}

function badge(status) {
  return `<span class="badge-soft status-${String(status).replaceAll(" ", "-")}">${status}</span>`;
}

function profileCell(name, meta, type) {
  const initials = String(name || "NA").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const icon = type === "driver" ? "fa-id-card" : "fa-user";
  return `<div class="profile-cell"><span class="avatar"><i class="fa-solid ${icon}"></i></span><div><strong class="text-nowrap">${escapeHtml(name || "-")}</strong><small>${escapeHtml(meta || "Profile")}</small></div></div>`;
}

function vehicleCell(vehicle) {
  return `<div class="profile-cell"><span class="avatar vehicle-avatar"><i class="fa-solid fa-car-side"></i></span><div><strong class="text-nowrap">${escapeHtml(vehicle.name)}</strong><small>${escapeHtml(vehicle.vehicle_number)}</small></div></div>`;
}

function expBadge(years) {
  return `<span class="experience-badge"><i class="fa-solid fa-award"></i>${years} years</span>`;
}

function statusProgress(status) {
  const steps = ["Pending", "Confirmed", "Driver Assigned", "Trip Started", "Completed"];
  const index = Math.max(0, steps.indexOf(status));
  return `<div class="status-steps">${steps.map((step, stepIndex) => `<span class="${stepIndex <= index ? "done" : ""}" title="${step}"></span>`).join("")}</div>`;
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
      labels: data.map(item => item.label),
      datasets: [{ data: data.map((item) => item.value), backgroundColor: colors, borderColor: colors, tension: 0.35, fill: false }],
    },
    options: {
    responsive: true,
    maintainAspectRatio: false,

    plugins: {
        legend: {
            display: type === "doughnut"
        }
    },

    scales: type === "doughnut"
        ? {}
        : {
            x: {
    ticks: {
        autoSkip: false,
        maxRotation: 45,
        minRotation: 45,
        font: {
            size: 11
        }
    }
},

            y: {
                beginAtZero: true,
                ticks: {
                    precision: 0
                }
            }
        }
},
  });
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function detectModule() {
  const explicit = document.body.dataset.module;
  if (explicit) return explicit;
  const filename = window.location.pathname.split("/").pop().replace(".html", "");
  return modules.some((item) => item.id === filename) ? filename : "dashboard";
}

function togglePassword() {
  const input = $("#loginPassword");
  const icon = $("#togglePassword i");
  const showing = input.type === "text";
  input.type = showing ? "password" : "text";
  icon.className = showing ? "fa-regular fa-eye" : "fa-regular fa-eye-slash";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}
