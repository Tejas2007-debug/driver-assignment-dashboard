const API_BASE = "https://driver-assignment-dashboard.onrender.com/api";
const modules = [
  { id: "dashboard", label: "Dashboard", icon: "fa-chart-line", page: "dashboard.html", subtitle: "Centralized driver assignment operations" },
  { id: "coordinator", label: "Coordinator", icon: "fa-bell", page: "coordinator.html", subtitle: "Operational monitoring and alerts" },
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
  data: { customers: [], bookings: [], drivers: [], vehicles: [], assignments: [], trips: [], activity: [] },
  charts: {},
  modal: null,
  modalMode: null,
};

const PAYMENT_STATUSES = ["Pending", "Partial", "Paid"];
const FOLLOW_UP_STATUSES = ["Pending", "Completed", "Missed"];
const DRIVER_STATUSES = ["Available", "On Trip", "Leave", "Unavailable"];
const BOOKING_STATUSES = ["Pending", "Confirmed", "Driver Assigned", "Trip Started", "Completed"];
const STATUS_TRANSITIONS = {
  Pending: ["Confirmed"],
  Confirmed: ["Driver Assigned"],
  "Driver Assigned": ["Trip Started"],
  "Trip Started": ["Completed"],
  Completed: [],
};
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
  if (moduleId === "coordinator") await renderCoordinator();
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

async function loadActivity(limit = 12) {
  try {
    const res = await api(`/activity?limit=${limit}`);
    state.data.activity = res.activity || [];
  } catch {
    state.data.activity = [];
  }
}

async function renderDashboard() {
  const [data] = await Promise.all([api("/dashboard"), loadCoreData()]);
  const timing = tripTimingSummary(state.data.bookings);
  content.innerHTML = `
    <div class="row g-3 mb-3">
      ${metric("Total Bookings", data.cards.total_bookings, "fa-calendar-check", "", "col-6 col-md-4 col-xl-2")}
      ${metric("Active Trips", data.cards.active_trips, "fa-route", "", "col-6 col-md-4 col-xl-2")}
      ${metric("Completed Trips", data.cards.completed_trips, "fa-circle-check", "", "col-6 col-md-4 col-xl-2")}
      ${metric("Available Drivers", data.cards.available_drivers, "fa-id-card", "", "col-6 col-md-4 col-xl-2")}
      ${metric("Assigned Drivers", data.cards.assigned_drivers, "fa-user-clock", "", "col-6 col-md-4 col-xl-2")}
      ${metric("Available Vehicles", data.cards.available_vehicles, "fa-car-side", "", "col-6 col-md-4 col-xl-2")}
    </div>
    <div class="row g-3 mb-3">
      ${metric("Ongoing Trips", timing.ongoing, "fa-route", "Assigned or started")}
      ${metric("Completed Today", timing.completedToday, "fa-calendar-check", "Closed today")}
      ${metric("Scheduled Pickups", timing.upcoming, "fa-calendar-plus", "Future open trips")}
      ${metric("Pending Payments", data.cards.pending_payments, "fa-file-invoice-dollar", "Invoices needing follow-up")}
      ${metric("Unassigned", data.cards.unassigned_bookings, "fa-calendar-xmark", "Bookings awaiting assignment")}
      ${metric("Drivers On Leave", data.cards.drivers_on_leave, "fa-user-clock", "Unavailable drivers")}
    </div>
    <div class="row g-3 mb-3">
      <div class="col-lg-4"><div class="card-lite panel"><div class="panel-title"><h3>Daily Bookings</h3></div><div class="chart-container"><canvas id="dailyChart"></canvas></div></div></div>
      <div class="col-lg-4"><div class="card-lite panel"><div class="panel-title"><h3>Weekly Bookings</h3></div><div class="chart-container"><canvas id="weeklyChart"></canvas></div></div></div>
      <div class="col-lg-4"><div class="card-lite panel"><div class="panel-title"><h3>Trip Status Overview</h3></div><div class="chart-container"><canvas id="statusChart"></canvas></div></div></div>
    </div>
    <div class="row g-3 mb-3">
      <div class="col-lg-4">
        <div class="card-lite panel fill-panel next-pickup-panel">
          <div class="panel-title"><h3>Next Scheduled Pickup</h3></div>
          ${nextPickupPanel(timing)}
        </div>
      </div>
      <div class="col-lg-8">${tablePanel("Upcoming Trips", upcomingTripRows(data.upcoming_trips), "compact-table responsive-card-table")}</div>
    </div>
    <div class="row g-3">
      <div class="col-12">${tablePanel("Recent Assignments", assignmentRows(data.recent_assignments), "compact-table responsive-card-table")}</div>
    </div>
  `;
  chart("dailyChart", "bar", data.daily_bookings, "#2563eb");
  chart("weeklyChart", "line", data.weekly_bookings, "#14b8a6");
  chart("statusChart", "doughnut", data.trip_status_overview, ["#f59e0b", "#2563eb", "#14b8a6", "#22c55e", "#64748b"]);
  applyResponsiveTableLabels();
}

function metric(label, value, icon, hint = "Live operations", colClass = "col-6 col-md-4 col-lg-2") {
  return `
  <div class="${colClass}">
      <div class="card-lite metric-card dashboard-metric-card">
          <div class="metric-content">
              <span>${escapeHtml(label)}</span>
              <strong title="${escapeHtml(String(hint || ""))}">${escapeHtml(String(value))}</strong>
              <small title="${escapeHtml(String(hint || ""))}">
                  <i class="fa-solid fa-arrow-trend-up"></i>
                  ${escapeHtml(hint || "Live operations")}
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
      ["follow_up_date", "Follow-Up Date", "date", { required: false }],
      ["follow_up_status", "Follow-Up Status", "select", FOLLOW_UP_STATUSES],
      ["follow_up_note", "Follow-Up Note", "textarea", { required: false }],
    ],
    headers: ["Booking ID", "Invoice", "Customer", "Pickup", "Drop", "Date", "Time", "Vehicle Type", "Status", "Payment", "Actions"],
    row: (x) => [`<strong class="booking-id">${x.booking_code}</strong>`, `<strong class="booking-id">${x.invoice_number || "-"}</strong>`, profileCell(x.customer_name, x.vehicle_type, "customer"), x.pickup_location, x.drop_location, x.trip_date, x.trip_time, x.vehicle_type, badge(x.status), badge(bookingPaymentStatus(x))],
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
      <div class="table-responsive responsive-card-table">${crudTable(config, state.data[config.key])}</div>
    </div>
  `;
  $("#addBtn").addEventListener("click", () => openEntityModal(type));
  $("#searchInput").addEventListener("input", () => filterCrud(type));
  $("#statusFilter")?.addEventListener("change", () => filterCrud(type));
  bindRowActions(type);
  applyResponsiveTableLabels();
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
  applyResponsiveTableLabels();
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
  const required = options?.required === false ? "" : "required";
  if (type === "textarea") {
    return `<div class="col-12"><div class="form-floating"><textarea class="form-control" name="${name}" placeholder="${label}" rows="3" ${required}>${escapeHtml(value)}</textarea><label>${label}</label></div></div>`;
  }
  if (type === "select") {
    const opts = options.map((option) => {
      const val = Array.isArray(option) ? option[0] : option;
      const text = Array.isArray(option) ? option[1] : option;
      return `<option value="${val}" ${String(val) === String(value) ? "selected" : ""}>${text}</option>`;
    });
    return `<div class="col-md-6"><div class="form-floating"><select class="form-select" name="${name}" ${required}>${opts.join("")}</select><label>${label}</label></div></div>`;
  }
  return `<div class="col-md-6"><div class="form-floating"><input class="form-control" name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${label}" ${required}><label>${label}</label></div></div>`;
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
    const isCompletedBooking = body.status === "Completed";

    today.setHours(0, 0, 0, 0);

    if (tripDate < today && !isCompletedBooking) {
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
      recordBookingAction(item ? "Booking Updated" : "Booking Created", response.booking, item ? "Booking record updated" : "Booking record created");
      if (item && bookingPaymentStatus(item) !== localPaymentStatus) recordBookingAction("Payment Updated", response.booking, `Payment changed to ${localPaymentStatus}`);
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
  await loadCoreData();
  await loadActivity();
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
            <div class="col-12"><div class="form-floating"><textarea class="form-control" name="route_notes" placeholder="Route Notes" rows="3"></textarea><label>Route Notes</label></div></div>
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
  document.querySelectorAll("[data-assignment-detail]").forEach((button) => button.addEventListener("click", () => openAssignmentDetailModal(Number(button.dataset.assignmentDetail))));
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
  if (!canReassignAssignment(assignment)) {
    toast("Only active, non-completed assignments can be reassigned", "danger");
    return;
  }
  state.modalMode = { type: "reassign", item: assignment };
  $("#modalTitle").textContent = `Reassign ${assignment.booking_code}`;
  setModalSaveVisible(true);
  $("#modalBody").innerHTML = `
    ${selectField("driver_id", "Driver", reassignableDrivers(assignment).map((d) => [d.id, `${d.name} (${driverStatus(d)})`]))}
    ${selectField("vehicle_id", "Vehicle", reassignableVehicles(assignment).map((v) => [v.id, `${v.name} - ${v.vehicle_number} (${v.status})`]))}
    <div class="col-12"><div class="form-floating"><textarea class="form-control" name="notes" placeholder="Notes" rows="3">Reassignment</textarea><label>Notes</label></div></div>
    <div class="col-12"><div class="form-floating"><textarea class="form-control" name="route_notes" placeholder="Route Notes" rows="3">${escapeHtml(assignment.route_notes || "")}</textarea><label>Route Notes</label></div></div>
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
    <div class="table-responsive responsive-card-table">
      <table class="table table-hover align-middle">
        <thead><tr><th>Booking ID</th><th>Customer</th><th>Assignment</th><th>Pickup</th><th>Drop</th><th>Route Notes</th><th>Date</th><th>Time</th><th>Status</th><th>Update</th><th>Payment</th><th>Action</th></tr></thead>
        <tbody>${state.data.trips.map(tripRow).join("") || emptyRow(12)}</tbody>
      </table>
    </div>
  </div>`;
  document.querySelectorAll("[data-trip-status]").forEach((select) => select.addEventListener("change", updateTripStatus));
  document.querySelectorAll("[data-payment-status]").forEach((select) => select.addEventListener("change", updatePaymentStatus));
  document.querySelectorAll("[data-trip-detail]").forEach((button) => button.addEventListener("click", () => openTripDetailModal(Number(button.dataset.tripDetail), state.data.trips)));
  applyResponsiveTableLabels();
}

function tripRow(item) {
  const options = tripStatusOptions(item.status);
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
    <td>${escapeHtml(item.assignment?.route_notes || "-")}</td>
    <td class="text-nowrap">${item.trip_date}</td>
    <td class="text-nowrap">${item.trip_time}</td>
    <td style="min-width: 130px;">
      <div class="mb-1">${statusProgress(item.status)}</div>
      ${badge(item.status)}
    </td>
    <td style="min-width: 160px;">
      <select class="form-select form-select-sm" data-trip-status="${item.id}">
        ${options.map((s) => `<option ${s === item.status ? "selected" : ""}>${s}</option>`).join("")}
      </select>
    </td>
    <td style="min-width: 150px;">${paymentControl(item)}</td>
    <td><button class="btn btn-outline-secondary btn-sm" data-trip-detail="${item.id}" title="View Details"><i class="fa-regular fa-eye"></i></button></td>
  </tr>`;
}

function tripStatusOptions(status) {
  return [status, ...(STATUS_TRANSITIONS[status] || [])];
}

async function updateTripStatus(event) {
  const trip = state.data.trips.find((item) => String(item.id) === String(event.target.dataset.tripStatus));
  try {
    await api(`/trips/${event.target.dataset.tripStatus}/status`, { method: "PUT", body: { status: event.target.value } });
    if (trip?.assignment) recordAssignmentAction("Status updated", trip.assignment, `${trip.booking_code} set to ${event.target.value}`);
    toast("Trip status updated");
    await renderTrips();
  } catch (error) {
    toast(error.message, "danger");
    await renderTrips();
  }
}

function paymentControl(item) {
  if (item.status !== "Completed") return badge(bookingPaymentStatus(item));
  return `<select class="form-select form-select-sm payment-status-select" data-payment-status="${item.id}" title="Payment status">
    ${PAYMENT_STATUSES.map((status) => `<option value="${status}" ${status === bookingPaymentStatus(item) ? "selected" : ""}>${status}</option>`).join("")}
  </select>`;
}

async function updatePaymentStatus(event) {
  const booking = state.data.trips.find((item) => String(item.id) === String(event.target.dataset.paymentStatus));
  const paymentStatus = event.target.value;
  try {
    const response = await api(`/bookings/${event.target.dataset.paymentStatus}`, {
      method: "PUT",
      body: { payment_status: paymentStatus },
    });
    saveBookingPaymentStatus(booking?.id || response.booking?.id, paymentStatus);
    toast("Payment status updated");
    await renderTrips();
  } catch (error) {
    toast(error.message, "danger");
    await renderTrips();
  }
}

async function renderReports(period = "daily") {
  const res = await api(`/reports?period=${period}`);
  const totalAssignments = res.assignments.length;
  const activeDrivers = res.driver_utilization.filter((item) => item.value > 0).length;
  const activeVehicles = res.vehicle_utilization.filter((item) => item.value > 0).length;
  const paidPayments = (res.payment_summary || []).find((item) => item.label === "Paid")?.value || 0;
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
      ${reportMetric("Paid Payments", paidPayments, "fa-file-invoice-dollar")} 
    </div>
    <div class="row g-3 mb-3">
      <div class="col-lg-6"><div class="card-lite panel"><div class="panel-title"><h3>Driver Utilization</h3></div><div class="chart-container"><canvas id="driverUtilChart"></canvas></div></div></div>
      <div class="col-lg-6"><div class="card-lite panel"><div class="panel-title"><h3>Vehicle Utilization</h3></div><div class="chart-container"><canvas id="vehicleUtilChart"></canvas></div></div></div>
    </div>
    <div class="row g-3 mb-3">
      <div class="col-lg-6"><div class="card-lite panel"><div class="panel-title"><h3>Payment Summary</h3></div>${summaryRows(res.payment_summary || [])}</div></div>
      <div class="col-lg-6"><div class="card-lite panel"><div class="panel-title"><h3>Assignment Summary</h3></div>${summaryRows(res.assignment_summary || [])}</div></div>
    </div>
    <div class="row g-3 mb-3">
      <div class="col-lg-6">${tablePanel("Driver Utilization Summary", summaryTableRows(res.driver_utilization))}</div>
      <div class="col-lg-6">${tablePanel("Vehicle Utilization Summary", summaryTableRows(res.vehicle_utilization))}</div>
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
                `${API_BASE}/reports/export/excel?period=${encodeURIComponent(period)}`,
                "_blank"
            );

        } else {

            window.open(
                `${API_BASE}/reports/export/pdf?period=${encodeURIComponent(period)}`,
                "_blank"
            );

        }

    });

});

chart("driverUtilChart", "bar", res.driver_utilization, "#2563eb");
chart("vehicleUtilChart", "bar", res.vehicle_utilization, "#14b8a6");
}

function tablePanel(title, rows, className = "") {
  return `<div class="card-lite panel fill-panel"><div class="panel-title"><h3>${escapeHtml(title)}</h3></div>
    <div class="table-responsive ${className}"><table class="table table-hover">${rows}</table></div></div>`;
}

function summaryRows(rows) {
  if (!rows.length) return `<div class="text-center text-secondary py-4">No summary data</div>`;
  return `<div class="alert-list">${rows.map((item) => `
    <div class="alert-item">
      <div class="timeline-head"><strong>${escapeHtml(item.label || "-")}</strong><span class="badge-soft status-Assigned">${item.value}</span></div>
    </div>`).join("")}</div>`;
}

function summaryTableRows(rows) {
  return `<thead><tr><th>Name</th><th>Total Assignments</th></tr></thead>
  <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.label || "-")}</td><td><strong>${item.value}</strong></td></tr>`).join("") || emptyRow(2)}</tbody>`;
}

function assignmentRows(rows, actions = false) {
  return `<thead><tr><th>Booking</th><th>Invoice</th><th>Customer</th><th>Driver</th><th>Vehicle</th><th>Date</th><th>Payment</th><th>Status</th>${actions ? "<th>Action</th>" : ""}</tr></thead>
  <tbody>${rows.map((item) => `<tr>
    <td>
    <strong class="booking-id">
        ${escapeHtml(item.booking_code)}
    </strong>
</td><td>${escapeHtml(item.invoice_number || "-")}</td><td>${escapeHtml(item.customer_name || "-")}</td><td>${escapeHtml(item.driver_name || "-")}</td><td>${escapeHtml(item.vehicle_name || "-")}</td>
    <td>${item.trip_date || "-"}</td><td>${badge(item.payment_status || "-")}</td><td>${badge(item.status || (item.is_active ? "Assigned" : "Reassigned"))}</td>
    ${actions ? `
<td><div class="actions">
${assignmentActionButtons(item)}
</div></td>
` : ""}
  </tr>`).join("") || emptyRow(actions ? 9 : 8)}</tbody>`;
}

function assignmentTimeline(rows, actions = false) {
  return `<div class="timeline-list">${rows.map((item) => `<div class="timeline-item">
    <div class="timeline-dot"></div>
    <div class="timeline-card">
      <div class="timeline-head"><strong class="booking-id">${escapeHtml(item.booking_code)}</strong>${badge(item.status || (item.is_active ? "Assigned" : "Reassigned"))}</div>
      <div class="timeline-grid"><span><i class="fa-regular fa-user"></i>${escapeHtml(item.customer_name || "-")}</span><span><i class="fa-solid fa-id-card"></i>${escapeHtml(item.driver_name || "-")}</span><span><i class="fa-solid fa-car-side"></i>${escapeHtml(item.vehicle_name || "-")}</span><span><i class="fa-regular fa-calendar"></i>${escapeHtml(item.trip_date || "-")}</span></div>
      ${actions ? `
<div class="mt-3 d-flex gap-2">

<button class="btn btn-outline-secondary btn-sm"
        data-assignment-detail="${item.id}">
    <i class="fa-regular fa-eye"></i>
</button>

${assignmentActionButtons(item)}

</div>
` : ""}
    </div>
  </div>`).join("") || `<div class="text-center text-secondary py-4">No records found</div>`}</div>`;
}

function canReassignAssignment(item) {
  return Boolean(item?.is_active && item.status !== "Completed");
}

function canDeleteAssignment(item) {
  return item?.status === "Completed";
}

function assignmentActionButtons(item) {
  const reassign = canReassignAssignment(item)
    ? `<button class="btn btn-outline-primary btn-sm" data-reassign="${item.id}" title="Reassign active assignment"><i class="fa-solid fa-rotate me-1"></i>Reassign</button>`
    : `<button class="btn btn-outline-secondary btn-sm" type="button" disabled title="Only active, non-completed assignments can be reassigned"><i class="fa-solid fa-lock me-1"></i>Reassign</button>`;
  const deleteButton = canDeleteAssignment(item)
    ? `<button class="btn btn-outline-danger btn-sm" data-delete-assignment="${item.id}" title="Delete completed assignment"><i class="fa-solid fa-trash"></i></button>`
    : "";
  return `${reassign}${deleteButton}`;
}

function bookingRows(rows) {
  return `<thead><tr><th>Booking</th><th>Customer</th><th>Route</th><th>Date</th><th>Status</th></tr></thead>
  <tbody>${rows.map((item) => `<tr><td><strong class="booking-id">${escapeHtml(item.booking_code)}</strong></td><td>${escapeHtml(item.customer_name || "-")}</td><td>
    <div class="route-cell">
        <span>${escapeHtml(item.pickup_location || "-")}</span>
        <i class="fa-solid fa-arrow-right mx-2"></i>
        <span>${escapeHtml(item.drop_location || "-")}</span>
    </div>
</td><td>${escapeHtml(item.trip_date || "-")} ${escapeHtml(item.trip_time || "")}</td><td>
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
    nextPickup: next ? next.trip_time : "-",
    nextPickupDetail: next ? `${next.booking_code} - ${next.customer_name || "Customer"} on ${next.trip_date}` : "No upcoming pickup",
  };
}

function nextPickupPanel(timing) {
  return `<div class="next-pickup-summary">
    <span class="next-pickup-time">${escapeHtml(String(timing.nextPickup))}</span>
    <p>${escapeHtml(timing.nextPickupDetail)}</p>
  </div>`;
}

function upcomingTripRows(rows) {
  return `<thead><tr><th>Booking</th><th>Customer</th><th>Pickup</th><th>Drop</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
  <tbody>${(rows || []).map((item) => `<tr>
    <td><strong class="booking-id">${escapeHtml(item.booking_code)}</strong></td>
    <td>${escapeHtml(item.customer_name || "-")}</td>
    <td>${escapeHtml(item.pickup_location || "-")}</td>
    <td>${escapeHtml(item.drop_location || "-")}</td>
    <td>${escapeHtml(item.trip_date || "-")}</td>
    <td>${escapeHtml(item.trip_time || "-")}</td>
    <td>${badge(item.status)}</td>
  </tr>`).join("") || emptyRow(7)}</tbody>`;
}

function activeTripTimingCards(bookings) {
  const active = bookings.filter((booking) => ["Driver Assigned", "Trip Started"].includes(booking.status)).slice(0, 8);
  if (!active.length) return `<div class="text-center text-secondary py-4">No active trip timing cards</div>`;
  return `<div class="trip-card-grid">${active.map((booking) => `
    <div class="trip-timing-card">
      <div class="timeline-head"><strong class="booking-id">${escapeHtml(booking.booking_code)}</strong>${badge(booking.status)}</div>
      <div class="timeline-grid">
        <span><i class="fa-solid fa-id-card"></i>${escapeHtml(booking.assignment?.driver_name || "Not assigned")}</span>
        <span><i class="fa-solid fa-car-side"></i>${escapeHtml(booking.assignment?.vehicle_name || "Not assigned")}</span>
        <span><i class="fa-solid fa-location-dot"></i>${escapeHtml(booking.pickup_location)}</span>
        <span><i class="fa-solid fa-flag-checkered"></i>${escapeHtml(booking.drop_location)}</span>
        <span><i class="fa-regular fa-calendar"></i>${escapeHtml(booking.trip_date)}</span>
        <span><i class="fa-regular fa-clock"></i>${escapeHtml(booking.trip_time)}</span>
      </div>
    </div>`).join("")}</div>`;
}

function coordinatorAlerts() {
  const items = [];
  const now = new Date();
  const soonLimit = new Date(now.getTime() + getCoordinatorWindowHours() * 60 * 60 * 1000);
  const summary = {
    pendingPayments: state.data.bookings.filter((booking) => bookingPaymentStatus(booking) !== "Paid").length,
    unassignedBookings: state.data.bookings.filter((booking) => !booking.assignment && booking.status !== "Completed").length,
    driversOnLeave: state.data.drivers.filter((driver) => ["Leave", "Unavailable"].includes(driverStatus(driver))).length,
    upcomingTrips: state.data.bookings.filter((booking) => {
      const startsAt = tripDateTime(booking);
      return startsAt >= now && startsAt <= soonLimit && booking.status !== "Completed";
    }).length,
  };
  state.data.drivers.filter((driver) => ["Leave", "Unavailable"].includes(driverStatus(driver))).forEach((driver) => {
    items.push({ type: "Driver on leave", message: driver.name, severity: "High" });
  });
  state.data.vehicles.filter((vehicle) => vehicle.status === "Maintenance").forEach((vehicle) => {
    items.push({ type: "Vehicle unavailable", message: `${vehicle.name} ${vehicle.vehicle_number}`, severity: "High" });
  });
  state.data.bookings.forEach((booking) => {
    const startsAt = tripDateTime(booking);
    if (!booking.assignment && booking.status !== "Completed") {
      items.push({ type: "Unassigned booking", message: `${booking.booking_code} ${booking.trip_date} ${booking.trip_time}`, severity: "High" });
    }
    if (bookingPaymentStatus(booking) !== "Paid") {
      items.push({ type: "Pending payment", message: `${booking.invoice_number || booking.booking_code} - ${bookingPaymentStatus(booking)}`, severity: "Medium" });
    }
    if (booking.follow_up_date && new Date(`${booking.follow_up_date}T00:00`) < new Date(new Date().toDateString()) && (booking.follow_up_status || "Pending") === "Pending") {
      items.push({ type: "Overdue follow-up", message: `${booking.booking_code} - ${booking.follow_up_note || booking.follow_up_date}`, severity: "High" });
    }
    if (startsAt >= now && startsAt <= soonLimit && booking.status !== "Completed") {
      items.push({ type: "Upcoming trip", message: `${booking.booking_code} at ${booking.trip_time}`, severity: "Low" });
    }
    if (startsAt < now && !["Trip Started", "Completed"].includes(booking.status)) {
      items.push({ type: "Trip delayed", message: `${booking.booking_code} was scheduled for ${booking.trip_date} ${booking.trip_time}`, severity: "Medium" });
    }
    if (booking.assignment && (driverStatus({ id: booking.assignment.driver_id, availability_status: "Assigned" }) === "Unavailable" || booking.assignment.vehicle_status === "Maintenance")) {
      items.push({ type: "Assignment conflict", message: booking.booking_code, severity: "High" });
    }
  });
  state.data.assignments.forEach((assignment) => {
    const booking = state.data.bookings.find((item) => item.id === assignment.booking_id);
    const driver = state.data.drivers.find((item) => item.id === assignment.driver_id);
    const vehicle = state.data.vehicles.find((item) => item.id === assignment.vehicle_id);
    if (assignment.is_active && booking && (driver && ["Leave", "Unavailable"].includes(driverStatus(driver)) || vehicle?.status === "Maintenance")) {
      items.push({ type: "Assignment conflict", message: `${assignment.booking_code} needs review`, severity: "High", route_notes: assignment.route_notes });
    }
  });
  return { summary, items: items.slice(0, 12) };
}

function alertList(alerts) {
  if (!alerts.length) return `<div class="text-center text-secondary py-4">No coordinator alerts</div>`;
  return `<div class="alert-list">${alerts.map((alert) => `
    <div class="alert-item alert-${severityLevel(alert.severity)}">
      <div class="timeline-head"><strong>${escapeHtml(alert.type)}</strong>${severityBadge(alert.severity)}</div>
      <span>${escapeHtml(alert.message)}</span>
      ${alert.route_notes ? `<span>Route Notes: ${escapeHtml(alert.route_notes)}</span>` : ""}
    </div>`).join("")}</div>`;
}

function severityLevel(severity) {
  return severity === "High" ? "danger" : severity === "Medium" ? "warning" : "low";
}

function severityBadge(severity) {
  return `<span class="badge-soft severity-${severity}">${severity}</span>`;
}

function getCoordinatorWindowHours() {
  return Number(localStorage.getItem("mtt_coordinator_window_hours") || 24);
}

async function renderCoordinator() {
  await loadCoreData();
  await loadActivity();
  const hours = getCoordinatorWindowHours();
  let data = null;
  try {
    data = await api(`/coordinator?hours=${hours}`);
  } catch {
    const fallback = coordinatorAlerts();
    data = {
      counters: {
        unassigned_bookings: fallback.summary.unassignedBookings,
        drivers_on_leave: fallback.summary.driversOnLeave,
        vehicles_unavailable: state.data.vehicles.filter((vehicle) => vehicle.status === "Maintenance").length,
        upcoming_trips: fallback.summary.upcomingTrips,
        pending_payments: fallback.summary.pendingPayments,
        overdue_follow_ups: fallback.items.filter((item) => item.type === "Overdue follow-up").length,
      },
      unassigned_bookings: state.data.bookings.filter((booking) => !booking.assignment && booking.status !== "Completed"),
      drivers_on_leave: state.data.drivers.filter((driver) => ["Leave", "Unavailable"].includes(driverStatus(driver))),
      vehicles_unavailable: state.data.vehicles.filter((vehicle) => vehicle.status === "Maintenance"),
      upcoming_trips: state.data.bookings.filter((booking) => {
        const startsAt = tripDateTime(booking);
        const now = new Date();
        return startsAt >= now && startsAt <= new Date(now.getTime() + hours * 60 * 60 * 1000) && booking.status !== "Completed";
      }),
      pending_payments: state.data.bookings.filter((booking) => bookingPaymentStatus(booking) !== "Paid"),
      overdue_follow_ups: state.data.bookings.filter((booking) => booking.follow_up_date && new Date(`${booking.follow_up_date}T00:00`) < new Date(new Date().toDateString()) && (booking.follow_up_status || "Pending") === "Pending"),
      recent_activity: state.data.activity,
    };
  }
  data = normalizeCoordinatorData(data);
  content.innerHTML = `
    <div class="toolbar">
      <div class="d-flex gap-2 flex-wrap align-items-center">
        <select id="windowSelect" class="form-select">
          ${[2, 6, 12, 24, 48].map((value) => `<option value="${value}" ${value === hours ? "selected" : ""}>${value} hour window</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="row g-3 mb-3 coordinator-metrics">
      ${metric("Unassigned", data.counters.unassigned_bookings, "fa-calendar-xmark", "Needs driver and vehicle")}
      ${metric("Pending Pay", data.counters.pending_payments, "fa-file-invoice-dollar", "Payment follow-up")}
      ${metric("Upcoming", data.counters.upcoming_trips, "fa-clock", `${hours} hour dispatch window`)}
      ${metric("Driver Leave", data.counters.drivers_on_leave, "fa-user-clock", "Unavailable drivers")}
      ${metric("Maintenance", data.counters.vehicles_unavailable, "fa-screwdriver-wrench", "Vehicles unavailable")}
      ${metric("Follow-Ups", data.counters.overdue_follow_ups, "fa-phone-volume", "Overdue customer calls")}
    </div>
    <div class="row g-3 mb-3 coordinator-grid">
      <div class="col-xl-4">${tablePanel("Unassigned Bookings", coordinatorBookingRows(data.unassigned_bookings, "assignment"), "compact-table responsive-card-table")}</div>
      <div class="col-xl-4">${tablePanel("Pending Payments", coordinatorBookingRows(data.pending_payments, "payment"), "compact-table responsive-card-table")}</div>
      <div class="col-xl-4">${tablePanel("Upcoming Trips", coordinatorBookingRows(data.upcoming_trips, "route"), "compact-table responsive-card-table")}</div>
    </div>
    <div class="row g-3 mb-3 coordinator-grid">
      <div class="col-xl-6">${tablePanel("Driver Leave", driverRows(data.drivers_on_leave), "compact-table responsive-card-table")}</div>
      <div class="col-xl-6">${tablePanel("Vehicle Maintenance", vehicleRows(data.vehicles_unavailable), "compact-table responsive-card-table")}</div>
    </div>
    <div class="row g-3 coordinator-grid">
      <div class="col-xl-6">${tablePanel("Overdue Follow-Ups", followUpRows(data.overdue_follow_ups), "compact-table responsive-card-table")}</div>
      <div class="col-xl-6"><div class="card-lite panel fill-panel"><div class="panel-title"><h3>Recent Activity</h3></div>${activityList(data.recent_activity)}</div></div>
    </div>
  `;
  $("#windowSelect").addEventListener("change", (event) => {
    localStorage.setItem("mtt_coordinator_window_hours", event.target.value);
    renderCoordinator();
  });
  applyResponsiveTableLabels();
}

function applyResponsiveTableLabels(root = content) {
  root?.querySelectorAll(".responsive-card-table table").forEach((table) => {
    const labels = [...table.querySelectorAll("thead th")].map((cell) => cell.textContent.trim());
    table.querySelectorAll("tbody tr").forEach((row) => {
      [...row.children].forEach((cell, index) => {
        if (labels[index]) cell.dataset.label = labels[index];
      });
    });
  });
}

function recordAssignmentAction(action, assignment, detail = "") {
  return { action, assignment, detail };
}

function normalizeCoordinatorData(data) {
  const byId = (rows) => {
    const seen = new Set();
    return (rows || []).filter((item) => {
      const key = item?.id ?? item?.booking_id ?? item?.booking_code;
      if (key == null) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const unassigned = byId(data.unassigned_bookings);
  const pendingPayments = byId(data.pending_payments);
  const upcoming = byId(data.upcoming_trips);
  const overdueFollowUps = byId(data.overdue_follow_ups);
  const recentActivity = byId(data.recent_activity);
  return {
    ...data,
    counters: {
      ...data.counters,
      unassigned_bookings: unassigned.length,
      pending_payments: pendingPayments.length,
      upcoming_trips: upcoming.length,
      overdue_follow_ups: overdueFollowUps.length,
    },
    unassigned_bookings: unassigned,
    pending_payments: pendingPayments,
    upcoming_trips: upcoming,
    overdue_follow_ups: overdueFollowUps,
    recent_activity: recentActivity,
  };
}

function recordBookingAction(action, booking, detail = "") {
  return { action, booking, detail };
}

function recentActionHistory(limit = 12) {
  return (state.data.activity || []).slice(0, limit);
}

function actionHistoryList(limit = 12) {
  const history = recentActionHistory(limit);
  if (!history.length) return `<div class="text-center text-secondary py-4">No action history recorded yet</div>`;
  return activityList(history);
}

function activityList(history) {
  if (!history.length) return `<div class="text-center text-secondary py-4">No action history recorded yet</div>`;
  return `<div class="timeline-list compact-history">${history.map((item) => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-card">
        <div class="timeline-head"><strong>${escapeHtml(item.action)}</strong><small>${formatDateTime(item.created_at)}</small></div>
        <div class="timeline-grid"><span>${escapeHtml(item.booking_code || "-")}</span><span>${escapeHtml(item.invoice_number || "-")}</span><span>${escapeHtml(item.driver_name || "-")}</span><span>${escapeHtml(item.vehicle_name || "-")}</span><span>${escapeHtml(item.detail || "")}</span></div>
      </div>
    </div>`).join("")}</div>`;
}

function coordinatorBookingRows(rows, mode = "default") {
  const extraHeader = mode === "route" ? "<th>Route Notes</th>" : mode === "payment" ? "<th>Follow-Up</th>" : "";
  return `<thead><tr><th>Booking</th><th>Customer</th><th>Date</th><th>Payment</th><th>Status</th>${extraHeader}</tr></thead>
  <tbody>${rows.map((item) => `<tr>
    <td><strong class="booking-id">${escapeHtml(item.booking_code)}</strong></td>
    <td>${escapeHtml(item.customer_name || "-")}</td>
    <td>${escapeHtml(item.trip_date || "-")} ${escapeHtml(item.trip_time || "")}</td>
    <td>${badge(bookingPaymentStatus(item))}</td>
    <td>${badge(item.status)}</td>
    ${mode === "route" ? `<td>${escapeHtml(item.assignment?.route_notes || "-")}</td>` : ""}
    ${mode === "payment" ? `<td>${escapeHtml(item.invoice_number || "-")} ${escapeHtml(item.follow_up_date || "")}</td>` : ""}
  </tr>`).join("") || emptyRow(extraHeader ? 6 : 5)}</tbody>`;
}

function driverRows(rows) {
  return `<thead><tr><th>Driver</th><th>Phone</th><th>License</th><th>Status</th></tr></thead>
  <tbody>${rows.map((item) => `<tr><td>${profileCell(item.name, `${item.experience} years`, "driver")}</td><td>${escapeHtml(item.phone)}</td><td>${escapeHtml(item.license_number)}</td><td>${badge(driverStatus(item))}</td></tr>`).join("") || emptyRow(4)}</tbody>`;
}

function vehicleRows(rows) {
  return `<thead><tr><th>Vehicle</th><th>Number</th><th>Type</th><th>Status</th></tr></thead>
  <tbody>${rows.map((item) => `<tr><td>${vehicleCell(item)}</td><td>${escapeHtml(item.vehicle_number)}</td><td>${escapeHtml(item.vehicle_type)}</td><td>${badge(item.status)}</td></tr>`).join("") || emptyRow(4)}</tbody>`;
}

function followUpRows(rows) {
  return `<thead><tr><th>Booking</th><th>Customer</th><th>Follow-Up Date</th><th>Note</th><th>Status</th></tr></thead>
  <tbody>${rows.map((item) => `<tr><td><strong class="booking-id">${escapeHtml(item.booking_code)}</strong></td><td>${escapeHtml(item.customer_name || "-")}</td><td>${escapeHtml(item.follow_up_date || "-")}</td><td>${escapeHtml(item.follow_up_note || "-")}</td><td>${badge(item.follow_up_status || "Pending")}</td></tr>`).join("") || emptyRow(5)}</tbody>`;
}

function recordTripHistory(bookingId, status, remarks = "") {
  return { bookingId, status, remarks };
}

async function tripStatusHistory(booking) {
  try {
    const res = await api(`/trips/${booking.id}/history`);
    const history = res.history || [];
    if (history.length) return history;
  } catch {}
  return [{ status: booking.status, remarks: "Current booking status", created_at: booking.updated_at || new Date().toISOString() }];
}

async function openTripDetailModal(id, sourceRows = null) {
  const booking = (sourceRows || state.data.bookings || state.data.trips).find((item) => Number(item.id) === Number(id));
  if (!booking) return;
  const history = await tripStatusHistory(booking);
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
    <div class="col-md-6">${detailBlock("Invoice and follow-up", [`Invoice: ${booking.invoice_number || "-"}`, `Follow-Up: ${booking.follow_up_date || "-"}`, `Follow-Up Status: ${booking.follow_up_status || "Pending"}`, booking.follow_up_note])}</div>
    <div class="col-md-6">${detailBlock("Route Notes", [assignment?.route_notes || "-"])}</div>
    <div class="col-12">
      <div class="detail-card">
        <h4>Status history</h4>
        <div class="history-stack">${history.map((item) => `
          <div class="history-row"><div>${badge(item.status)}<span>${escapeHtml(item.remarks || "")}</span></div><small>${formatDateTime(item.created_at)}</small></div>
        `).join("")}</div>
      </div>
    </div>
  `;
  state.modal.show();
}

function openAssignmentDetailModal(id) {
  const assignment = state.data.assignments.find((item) => Number(item.id) === Number(id));
  if (!assignment) return;
  state.modalMode = { type: "assignment-details", item: assignment };
  $("#modalTitle").textContent = `Assignment Details ${assignment.booking_code}`;
  setModalSaveVisible(false);
  $("#modalBody").innerHTML = `
    <div class="col-md-6">${detailBlock("Assignment Details", [
      `Booking: ${assignment.booking_code}`,
      `Customer: ${assignment.customer_name || "-"}`,
      `Status: ${assignment.status || (assignment.is_active ? "Assigned" : "Reassigned")}`,
      `Notes: ${assignment.notes || "-"}`
    ])}</div>
    <div class="col-md-6">${detailBlock("Route Notes", [assignment.route_notes || "-"])}</div>
    <div class="col-12">
      <div class="detail-card">
        <h4>Driver Trip Briefing</h4>
        <div class="timeline-grid">
          <span><i class="fa-solid fa-id-card"></i>${escapeHtml(assignment.driver_name || "-")}</span>
          <span><i class="fa-solid fa-car-side"></i>${escapeHtml(`${assignment.vehicle_name || "-"} ${assignment.vehicle_number || ""}`)}</span>
          <span><i class="fa-solid fa-location-dot"></i>${escapeHtml(assignment.pickup_location || "-")}</span>
          <span><i class="fa-solid fa-flag-checkered"></i>${escapeHtml(assignment.drop_location || "-")}</span>
          <span><i class="fa-regular fa-calendar"></i>${escapeHtml(assignment.trip_date || "-")}</span>
          <span><i class="fa-regular fa-clock"></i>${escapeHtml(assignment.trip_time || "-")}</span>
          <span><i class="fa-regular fa-note-sticky"></i>${escapeHtml(assignment.route_notes || assignment.notes || "-")}</span>
        </div>
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
