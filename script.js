// HSPHU keeps the complete planner in one localStorage record.
const STORAGE_KEY = "hsphu-engineering-dashboard-v1";
const CATEGORIES = ["Hackathons", "Assignments", "Internals", "Homework", "Projects", "Labs", "Workshops", "Personal Goals"];
const PRIORITIES = ["High", "Medium", "Low"];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let state = loadState();
let activeView = "all";
let toastTimer;

// Use local dates for due-date comparisons and form defaults.
function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateOffset(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function makeTask(name, description, category, daysFromNow, priority = "Medium", status = "Pending") {
  return { id: createId(), name, description, category, dueDate: dateOffset(daysFromNow), priority, status };
}

function createSampleState() {
  return {
    profile: { name: "Yashaswi HU" },
    tasks: [
      makeTask("Complete Python programs", "Finish the remaining practice problems.", "Homework", 0, "High"),
      makeTask("Complete AE and LIC lab records", "Update observations and get the records ready.", "Labs", 0, "Medium"),
      makeTask("Review today's lecture notes", "整理 notes from the latest engineering classes.", "Internals", 0, "Medium"),
      makeTask("Plan the week’s study sessions", "Set aside focused blocks for coursework.", "Personal Goals", 0, "Low"),
      makeTask("Read one chapter of C++", "Continue the current programming chapter.", "Personal Goals", 0, "Low"),
      makeTask("Register for a hackathon", "Check the team details before submitting.", "Hackathons", 2, "High"),
      makeTask("Attend B10X AI workshop", "Join the upcoming AI workshop session.", "Workshops", 4, "High"),
      makeTask("Submit Network Analysis assignment", "Complete the calculations and final review.", "Assignments", 3, "Medium"),
      makeTask("Prepare for Maths subject", "Revise the next internal assessment topics.", "Internals", 5, "Low"),
      makeTask("Finish Student Dashboard", "Polish the responsive layout and test saved data.", "Projects", 6, "Low"),
      makeTask("Complete C++ course in SoloLearn", "Work through the next course module.", "Personal Goals", 8, "Medium"),
      makeTask("Review digital logic concepts", "Practice the key conversion problems.", "Assignments", 9, "Medium"),
      makeTask("Organize project references", "Collect links and notes for the project.", "Projects", 11, "Low"),
      makeTask("Explore upcoming coding events", "Shortlist events that fit the semester schedule.", "Hackathons", 13, "Low"),
      makeTask("Submit circuit analysis worksheet", "Check the final answers before submission.", "Assignments", -1, "High"),
      makeTask("Complete physics lab observations", "Finish the pending record pages.", "Labs", -3, "Medium"),
      makeTask("Set up Student Dashboard workspace", "Create the initial project files.", "Projects", -1, "Low", "Completed"),
      makeTask("Complete introductory Python lesson", "Finish the first lesson and review the examples.", "Homework", -4, "Medium", "Completed")
    ]
  };
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Load the saved planner or create the starter tasks on first use.
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.tasks)) {
        return { profile: { name: "Yashaswi HU", ...parsed.profile }, tasks: parsed.tasks };
      }
    }
  } catch (error) {
    console.warn("Could not load the saved HSPHU planner.", error);
  }
  const samples = createSampleState();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(samples)); } catch (error) { console.warn("Could not save the initial planner.", error); }
  return samples;
}

// Save the full planner object as JSON in the browser.
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Could not save the HSPHU planner.", error);
    showToast("Could not save changes in this browser.");
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
}

function friendlyDate(dateKey) {
  if (!dateKey) return "No due date";
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(year, month - 1, day));
}

function getTaskCounts() {
  const today = localDateKey(new Date());
  const counts = { today: 0, completed: 0, upcoming: 0, overdue: 0 };

  for (let index = 0; index < state.tasks.length; index += 1) {
    const task = state.tasks[index];

    if (task.status === "Completed") {
      counts.completed += 1;
    } else if (task.dueDate === today) {
      counts.today += 1;
    } else if (task.dueDate > today) {
      counts.upcoming += 1;
    } else {
      counts.overdue += 1;
    }
  }

  return counts;
}

function filteredTasks(view) {
  const today = localDateKey(new Date());
  const visibleTasks = [];
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  const daysSinceMonday = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - daysSinceMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  for (let index = 0; index < state.tasks.length; index += 1) {
    const task = state.tasks[index];
    let shouldShow = true;

    if (view === "completed") {
      shouldShow = task.status === "Completed";
    } else if (task.status === "Completed") {
      shouldShow = false;
    } else if (view === "today") {
      shouldShow = task.dueDate === today;
    } else if (view === "week") {
      const taskDate = new Date(`${task.dueDate}T12:00:00`);
      shouldShow = taskDate >= weekStart && taskDate < weekEnd && task.dueDate >= today;
    } else if (view === "upcoming") {
      shouldShow = task.dueDate > today;
    } else if (view === "overdue") {
      shouldShow = task.dueDate < today;
    }

    if (shouldShow) {
      visibleTasks.push(task);
    }
  }

  visibleTasks.sort(function (firstTask, secondTask) {
    const dateOrder = firstTask.dueDate.localeCompare(secondTask.dueDate);
    const firstPriority = PRIORITIES.indexOf(firstTask.priority);
    const secondPriority = PRIORITIES.indexOf(secondTask.priority);
    return dateOrder || firstPriority - secondPriority;
  });

  return visibleTasks;
}

function renderSummary() {
  const counts = getTaskCounts();
  $("#count-today").textContent = counts.today;
  $("#count-completed").textContent = counts.completed;
  $("#count-upcoming").textContent = counts.upcoming;
  $("#count-overdue").textContent = counts.overdue;
}

function taskCard(task) {
  const isCompleted = task.status === "Completed";
  const isOverdue = !isCompleted && task.dueDate < localDateKey(new Date());
  return `<article class="task-card${isCompleted ? " is-completed" : ""}" data-task-card="${escapeHtml(task.id)}">
    <input class="task-check" type="checkbox" data-action="complete-task" data-id="${escapeHtml(task.id)}" aria-label="Mark ${escapeHtml(task.name)} completed" ${isCompleted ? "checked" : ""}>
    <div class="task-main"><div class="task-title-row"><h4 class="task-title">${escapeHtml(task.name)}</h4><span class="priority-tag ${task.priority.toLowerCase()}">${escapeHtml(task.priority)}</span></div>
      ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ""}
      <div class="task-meta"><span>${escapeHtml(task.category)}</span><span class="task-date${isOverdue ? " overdue-date" : ""}">${isOverdue ? "Overdue · " : "Due "}${friendlyDate(task.dueDate)}</span>${task.status === "In Progress" ? "<span>In progress</span>" : ""}</div>
    </div><div class="task-actions"><button class="icon-button" type="button" data-action="edit-task" data-id="${escapeHtml(task.id)}" aria-label="Edit ${escapeHtml(task.name)}" title="Edit task">✎</button><button class="icon-button delete-button" type="button" data-action="delete-task" data-id="${escapeHtml(task.id)}" aria-label="Delete ${escapeHtml(task.name)}" title="Delete task">×</button></div>
  </article>`;
}

function renderTasks() {
  const tasks = filteredTasks(activeView);
  $("#task-total").textContent = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
  const content = $("#task-content");
  if (!tasks.length) {
    const labels = { today: "today", week: "this week", upcoming: "upcoming", completed: "completed", overdue: "overdue" };
    content.innerHTML = `<div class="empty-state"><strong>Nothing to show ${labels[activeView] ? `for ${labels[activeView]}` : "here"}.</strong>Your planner is clear for this view.</div>`;
    return;
  }
  if (activeView !== "all") {
    content.innerHTML = `<div class="task-group"><div class="task-list">${tasks.map(taskCard).join("")}</div></div>`;
    return;
  }
  content.innerHTML = CATEGORIES.map(category => {
    const categoryTasks = tasks.filter(task => task.category === category);
    if (!categoryTasks.length) return "";
    return `<section class="task-group"><h3 class="category-heading">${category}<span class="category-count">${categoryTasks.length}</span></h3><div class="task-list">${categoryTasks.map(taskCard).join("")}</div></section>`;
  }).join("") || `<div class="empty-state"><strong>Your task list is clear.</strong>Add a task whenever something needs a place in your plan.</div>`;
}

function renderPriorities() {
  PRIORITIES.forEach(priority => {
    const tasks = state.tasks.filter(task => task.priority === priority && task.status !== "Completed").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const key = priority.toLowerCase();
    $(`#${key}-count`).textContent = tasks.length;
    $(`#${key}-list`).innerHTML = tasks.length ? tasks.map(task => `<label class="priority-task"><input type="checkbox" data-action="complete-task" data-id="${escapeHtml(task.id)}" aria-label="Mark ${escapeHtml(task.name)} completed"><span class="priority-task-content"><span class="priority-task-title">${escapeHtml(task.name)}</span><span class="priority-task-date">${friendlyDate(task.dueDate)} · ${escapeHtml(task.category)}</span></span></label>`).join("") : `<div class="priority-empty">No active ${key} priority tasks.</div>`;
  });
}

// Refresh the dashboard after task data changes.
function renderAll() {
  renderSummary();
  renderTasks();
  renderPriorities();
}

function setView(view) {
  activeView = view;
  $$("[data-view]").forEach(button => {
    const selected = button.dataset.view === view;
    if (button.classList.contains("view-tab")) {
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
    } else button.classList.toggle("active", selected);
  });
  renderTasks();
  if (["today", "week", "upcoming", "completed", "overdue"].includes(view)) {
    $("#all-tasks").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function updateProfile() {
  const nameInput = $("#student-name");
  const name = nameInput.value.trim() || "Yashaswi HU";
  state.profile.name = name;
  nameInput.value = name;

  $("#avatar-initials").textContent = getInitials(name);
  saveState();
}

// Use the first letter of the first two name parts for the avatar.
function getInitials(name) {
  const nameParts = name.trim().split(/\s+/);
  let initials = "";

  for (let index = 0; index < nameParts.length && index < 2; index += 1) {
    initials += nameParts[index][0];
  }

  return initials.toUpperCase();
}

function openTaskDialog(task = null) {
  const dialog = $("#task-dialog");
  const categorySelect = $("#task-category");
  categorySelect.innerHTML = CATEGORIES.map(category => `<option>${category}</option>`).join("");
  $("#task-dialog-title").textContent = task ? "Edit task" : "Add a task";
  $("#task-id").value = task?.id || "";
  $("#task-name").value = task?.name || "";
  $("#task-description").value = task?.description || "";
  $("#task-category").value = task?.category || CATEGORIES[0];
  $("#task-date").value = task?.dueDate || localDateKey(new Date());
  $("#task-priority").value = task?.priority || "Medium";
  $("#task-status").value = task?.status || "Pending";
  dialog.showModal();
  $("#task-name").focus();
}

// Add a task, or replace the task with the matching ID when editing.
function saveTask(event) {
  event.preventDefault();
  const taskId = $("#task-id").value;
  const task = {
    id: taskId || createId(),
    name: $("#task-name").value.trim(),
    description: $("#task-description").value.trim(),
    category: $("#task-category").value,
    dueDate: $("#task-date").value,
    priority: $("#task-priority").value,
    status: $("#task-status").value
  };
  if (!task.name || !task.dueDate) return;

  let existingTaskIndex = -1;
  for (let index = 0; index < state.tasks.length; index += 1) {
    if (state.tasks[index].id === taskId) {
      existingTaskIndex = index;
      break;
    }
  }

  if (existingTaskIndex >= 0) {
    state.tasks[existingTaskIndex] = task;
  } else {
    state.tasks.push(task);
  }

  saveState();
  $("#task-dialog").close();
  renderAll();
  showToast(existingTaskIndex >= 0 ? "Task updated." : "Task added to your planner.");
}

function completeTask(id, checked) {
  let task = null;
  for (let index = 0; index < state.tasks.length; index += 1) {
    if (state.tasks[index].id === id) {
      task = state.tasks[index];
      break;
    }
  }

  if (!task) return;
  task.status = checked ? "Completed" : "Pending";
  saveState();
  renderAll();
  showToast(checked ? "Task marked completed." : "Task moved back to pending.");
}

function handleAction(action, id) {
  if (action === "edit-task") openTaskDialog(state.tasks.find(task => task.id === id));
  if (action === "delete-task") {
    const task = state.tasks.find(item => item.id === id);
    if (task && confirm(`Delete “${task.name}” from your planner?`)) {
      const remainingTasks = [];
      for (let index = 0; index < state.tasks.length; index += 1) {
        if (state.tasks[index].id !== id) {
          remainingTasks.push(state.tasks[index]);
        }
      }
      state.tasks = remainingTasks;
      saveState(); renderAll(); showToast("Task deleted.");
    }
  }
}

function initializeDates() {
  const now = new Date();
  const fullDate = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(now);
  $("#header-date").textContent = fullDate;
  $("#overview-date").textContent = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(now);
}

$("#student-name").value = state.profile.name;
$("#student-name").addEventListener("change", updateProfile);
$("#student-name").addEventListener("keydown", event => { if (event.key === "Enter") event.currentTarget.blur(); });
$("#add-task-button").addEventListener("click", () => openTaskDialog());
$("#section-add-task").addEventListener("click", () => openTaskDialog());
$("#task-form").addEventListener("submit", saveTask);
$$("[data-close-dialog]").forEach(button => button.addEventListener("click", () => $(`#${button.dataset.closeDialog}`).close()));
$$("[data-view]").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
$$("[data-section]").forEach(link => link.addEventListener("click", () => {
  $$("[data-section]").forEach(item => item.classList.toggle("active", item === link));
  if (link.dataset.section === "all-tasks") setView("all");
}));
// These listeners also work for task cards created after page load.
document.addEventListener("change", event => {
  if (event.target.matches('[data-action="complete-task"]')) completeTask(event.target.dataset.id, event.target.checked);
});
document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (button && !button.matches('[data-action="complete-task"]')) handleAction(button.dataset.action, button.dataset.id);
});

initializeDates();
$("#avatar-initials").textContent = getInitials(state.profile.name);
renderAll();