import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp,
  updateDoc, where, Timestamp, writeBatch
} from "firebase/firestore";
import {
  Activity, AlarmClock, ArrowUpRight, Bot, CalendarDays, Check, CheckCheck,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, Command, Flag,
  LayoutDashboard, ListTodo, Menu, Pencil, Plus, Search, Send, Sparkles,
  Target, Trash2, TrendingUp, X, Zap
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { db, firebaseReady, signInGuest } from "./firebase";

const NAV = [
  ["Overview", LayoutDashboard], ["My tasks", ListTodo], ["Board", Command],
  ["Calendar", CalendarDays], ["Analytics", Activity], ["Focus", AlarmClock],
  ["AI assistant", Bot],
];
const todayISO = () => new Date().toISOString().slice(0, 10);
const dateLabel = new Intl.DateTimeFormat("en", {
  weekday: "long", month: "long", day: "numeric"
});
const priorityRank = { High: 0, Medium: 1, Low: 2 };
const samplePrompts = [
  "Help me plan my day",
  "Break a big assignment into steps",
  "What should I prioritize?",
];

const emptyForm = () => ({
  title: "", description: "", category: "Study",
  priority: "Medium", dueDate: todayISO()
});

function App() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [demoLoading, setDemoLoading] = useState(false);
  const DEMO_BATCH_ID = "taskflow-demo-v1";
  const hasDemoData = tasks.some((t) => t.demoBatchId === DEMO_BATCH_ID);
  const [active, setActive] = useState("Overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [modal, setModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [month, setMonth] = useState(new Date());
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [focusSessions, setFocusSessions] = useState(0);
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState([
    { role: "assistant", text: "Hey! I'm your TaskFlow planning assistant. I can help you prioritize, break down goals, and make a realistic plan. I use your current tasks plus simple built-in planning logic — no external AI service is connected." }
  ]);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let cancelled = false;
    signInGuest()
      .then((u) => { if (!cancelled) setUser(u); })
      .catch((e) => {
        if (!cancelled) { setError(e.message); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const q = query(collection(db, "tasks"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setError("");
    }, (e) => {
      setError(`Could not load tasks: ${e.message}`);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setFocusSeconds((s) => {
        if (s <= 1) {
          setTimerRunning(false);
          setFocusSessions((n) => n + 1);
          setToast("Focus session complete. Take a short break!");
          return 25 * 60;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const completed = tasks.filter((t) => t.completed).length;
  const pending = tasks.length - completed;
  const overdue = tasks.filter(
    (t) => !t.completed && t.dueDate && t.dueDate < todayISO()
  ).length;
  const rate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  const visibleTasks = useMemo(() => tasks.filter((t) => {
    const matchesSearch =
      `${t.title || ""} ${t.description || ""} ${t.category || ""}`
        .toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "All" ||
      (filter === "Completed" ? t.completed : !t.completed);
    return matchesSearch && matchesFilter;
  }).sort((a, b) =>
    (priorityRank[a.priority || "Medium"] - priorityRank[b.priority || "Medium"]) ||
    ((a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
  ), [tasks, search, filter]);

  function openCreateModal() {
    setEditingTask(null);
    setForm(emptyForm());
    setModal(true);
  }

  function editTask(task) {
    setEditingTask(task);
    setForm({
      title: task.title || "",
      description: task.description || "",
      category: task.category || "Study",
      priority: task.priority || "Medium",
      dueDate: task.dueDate || ""
    });
    setModal(true);
  }

  function closeTaskModal() {
    setModal(false);
    setEditingTask(null);
    setForm(emptyForm());
  }

  async function saveTask(e) {
    e?.preventDefault();
    if (!form.title.trim() || !user || !db) return;

    const taskData = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      priority: form.priority,
      dueDate: form.dueDate || ""
    };

    try {
      if (editingTask) {
        if (editingTask.userId !== user.uid) return;
        await updateDoc(doc(db, "tasks", editingTask.id), taskData);
        setToast("Task updated successfully.");
      } else {
        await addDoc(collection(db, "tasks"), {
          ...taskData,
          completed: false,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
        setToast("Task added to your workspace.");
      }
      closeTaskModal();
    } catch (e) {
      setError(`Couldn't save task: ${e.message}`);
    }
  }

  async function loadDemoData() {
    if (!user || !db || demoLoading || hasDemoData) return;

    const confirmed = window.confirm(
      "Add 24 sample tasks to your Firebase workspace? Existing tasks will not be changed."
    );

    if (!confirmed) return;

    setDemoLoading(true);

    const dateOffset = (offset) => {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() + offset);
      return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0")
      ].join("-");
    };

    const demoTasks = [
      ["Complete React dashboard", "Finish the main dashboard components and responsive layout.", "Development", "High", -2, -6, true],
      ["Build REST API", "Implement and test the required API endpoints.", "Development", "High", 2, -5, false],
      ["Learn AWS fundamentals", "Study cloud computing basics and core AWS services.", "Learning", "Medium", 5, -5, false],
      ["Revise DSA concepts", "Practice arrays, strings, stacks and queues.", "Learning", "High", -1, -4, true],
      ["Complete DBMS assignment", "Finish SQL queries and database documentation.", "Study", "Medium", -3, -4, true],
      ["Prepare project presentation", "Create slides and prepare the project explanation.", "Project", "High", 3, -4, false],
      ["Update portfolio website", "Improve the projects section and responsive design.", "Development", "Medium", 7, -3, false],
      ["Explore AI development tools", "Compare coding assistants and productivity tools.", "Learning", "Low", 9, -3, true],
      ["Review weekly progress", "Review completed work and plan the next week.", "Personal", "Low", -1, -3, true],
      ["Write project documentation", "Document setup instructions and project architecture.", "Project", "Medium", 4, -2, false],
      ["Practice JavaScript", "Revise promises, async/await and array methods.", "Learning", "Medium", -2, -2, true],
      ["Plan next week's tasks", "Organize upcoming academic and development work.", "Personal", "Low", 6, -2, false],
      ["Design login page", "Create a clean and responsive authentication screen.", "Development", "High", 1, -2, false],
      ["Complete OOP revision", "Revise inheritance, polymorphism and abstraction.", "Study", "High", -4, -1, true],
      ["Test application features", "Check task creation, editing and deletion.", "Project", "High", 2, -1, false],
      ["Study operating systems", "Revise process management and memory management.", "Study", "Medium", 8, -1, false],
      ["Improve GitHub profile", "Organize repositories and update project descriptions.", "Development", "Low", 10, 0, true],
      ["Prepare for club meeting", "Review discussion points and project updates.", "Personal", "Medium", 1, 0, false],
      ["Learn React hooks", "Practice useState, useEffect and useMemo.", "Learning", "High", 5, 0, true],
      ["Finish UI improvements", "Polish spacing, typography and mobile navigation.", "Development", "Medium", 3, 0, false],
      ["Submit lab assignment", "Review and submit the pending practical work.", "Study", "High", -1, 0, false],
      ["Research final-year projects", "Explore project ideas involving AI and cloud.", "Project", "Low", 12, 0, false],
      ["Organize study materials", "Sort notes and resources for upcoming subjects.", "Personal", "Low", 14, 0, true],
      ["Review project milestones", "Check progress and identify remaining deliverables.", "Project", "Medium", 6, 0, false]
    ];

    try {
      const batch = writeBatch(db);

      demoTasks.forEach((item, index) => {
        const [title, description, category, priority, dueOffset, createdOffset, completed] = item;

        const status = completed
          ? "Completed"
          : index % 2 === 0
            ? "In Progress"
            : "To Do";

        const taskRef = doc(collection(db, "tasks"));

        const createdDate = new Date();
        createdDate.setHours(12, 0, 0, 0);
        createdDate.setDate(createdDate.getDate() + createdOffset);

        batch.set(taskRef, {
          title,
          description,
          category,
          priority,
          dueDate: dateOffset(dueOffset),
          completed,
          status,
          userId: user.uid,
          createdAt: Timestamp.fromDate(createdDate),
          demoBatchId: DEMO_BATCH_ID
        });
      });

      await batch.commit();
      setToast("24 demo tasks added successfully!");
    } catch (e) {
      setError(`Couldn't add demo tasks: ${e.message}`);
    } finally {
      setDemoLoading(false);
    }
  }

  async function patchTask(task, patch) {
    if (!db || !user || task.userId !== user.uid) return;
    try {
      await updateDoc(doc(db, "tasks", task.id), patch);
    } catch (e) {
      setError(`Couldn't update task: ${e.message}`);
    }
  }

  async function removeTask(task) {
    if (!db || !user || task.userId !== user.uid) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${task.title}"? This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, "tasks", task.id));
      setToast("Task deleted successfully.");
    } catch (e) {
      setError(`Couldn't delete task: ${e.message}`);
    }
  }

  function handleDrop(e, status) {
    const id = e.dataTransfer.getData("text/plain");
    const task = tasks.find((t) => t.id === id);
    if (task) {
      patchTask(task, {
        completed: status === "Completed",
        status
      });
    }
  }

  const chartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      return {
        day: d.toLocaleDateString("en", { weekday: "short" }),
        done: tasks.filter((t) =>
          t.completed && t.createdAt?.toDate &&
          t.createdAt.toDate().toISOString().slice(0, 10) === key
        ).length
      };
    });
  }, [tasks]);

  function sendAI(text = aiInput) {
    const prompt = text.trim();
    if (!prompt) return;
    const lower = prompt.toLowerCase();
    let reply;
    const openTasks = tasks.filter((t) => !t.completed);

    if (lower.includes("priorit") || lower.includes("day") || lower.includes("plan")) {
      const ranked = [...openTasks].sort((a, b) =>
        priorityRank[a.priority || "Medium"] - priorityRank[b.priority || "Medium"] ||
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999")
      ).slice(0, 4);
      reply = ranked.length
        ? `Here's a practical order based on priority and deadlines:\n${ranked.map((t, i) =>
          `${i + 1}. ${t.title} — ${t.priority || "Medium"} priority${t.dueDate ? `, due ${t.dueDate}` : ""}`
        ).join("\n")}\n\nStart with the first item and work in one focused 25-minute block.`
        : "Your task list is clear. Add a task and I'll help you organize it.";
    } else if (lower.includes("break") || lower.includes("step")) {
      reply = "Try this breakdown:\n1. Define the exact outcome.\n2. Gather the material or requirements.\n3. Split the work into 3–5 small deliverables.\n4. Complete the highest-impact deliverable first.\n5. Review, test, and submit.\n\nAdd each deliverable as a separate TaskFlow task.";
    } else {
      reply = `You currently have ${openTasks.length} open task(s), ${overdue} overdue, and a ${rate}% completion rate. A useful next move: choose one high-priority task, define its smallest next action, and give it a focused 25-minute session.`;
    }

    setAiMessages((m) => [
      ...m,
      { role: "user", text: prompt },
      { role: "assistant", text: reply }
    ]);
    setAiInput("");
  }

  const header = {
    "Overview": ["Good to see you.", "Here's your productivity snapshot for today."],
    "My tasks": ["My tasks", "Keep the next action clear and manageable."],
    "Board": ["Project board", "Move work forward, one stage at a time."],
    "Calendar": ["Calendar", "See what's coming up before it becomes urgent."],
    "Analytics": ["Your analytics", "A clear picture of your momentum."],
    "Focus": ["Focus room", "Protect a little time for meaningful work."],
    "AI assistant": ["TaskFlow assistant", "A lightweight planning companion for your workspace."]
  }[active];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Zap size={19} fill="currentColor" /></div>
          <span>taskflow<span className="brand-dot">.</span></span>
          <button className="icon-btn close-nav" onClick={() => setMobileNav(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {NAV.map(([name, Icon]) => (
            <button
              key={name}
              className={`nav-link ${active === name ? "active" : ""}`}
              onClick={() => { setActive(name); setMobileNav(false); }}
            >
              <Icon size={18} />
              <span>{name}</span>
              {name === "My tasks" && <span className="nav-count">{pending}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <div className="tip-icon"><Sparkles size={16} /></div>
            <b>Small steps add up.</b>
            <p>Consistency beats intensity. Keep showing up.</p>
          </div>
          <div className="profile">
            <div className="avatar">TF</div>
            <div><b>My workspace</b><small>{user ? "Guest session" : "Connecting…"}</small></div>
            <button className="icon-btn" title="Workspace info"><CircleHelp size={17} /></button>
          </div>
        </div>
      </aside>

      {mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="Close menu" />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setMobileNav(true)}>
            <Menu size={20} />
          </button>
          <div className="breadcrumb">Workspace <ChevronRight size={14} /> <b>{active}</b></div>
          <div className="top-actions">
            <div className="cloud-status"><span className="status-dot" /> Firebase connected</div>
            <div className="avatar small-avatar">TF</div>
          </div>
        </header>

        <section className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">{dateLabel.format(new Date())}</div>
              <h1>{header[0]}</h1>
              <p>{header[1]}</p>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                className="secondary-btn"
                onClick={loadDemoData}
                disabled={demoLoading || hasDemoData}
              >
                <Sparkles size={16} />
                {demoLoading
                  ? "Adding demo data..."
                  : hasDemoData
                    ? "Demo data loaded"
                    : "Load demo data"}
              </button>

              <button className="primary-btn" onClick={openCreateModal}>
                <Plus size={17} /> New task
              </button>
            </div>
          </div>

          {error && (
            <div className="alert">
              <span>{error}</span>
              <button onClick={() => setError("")}><X size={16} /></button>
            </div>
          )}
          {!firebaseReady && (
            <div className="alert">
              Firebase isn't configured yet. Copy <code>.env.example</code> to <code>.env</code> and add your existing Firebase web config.
            </div>
          )}
          {loading && firebaseReady && <div className="loading-line">Connecting to your workspace…</div>}

          {active === "Overview" && (
            <Overview
              tasks={tasks} completed={completed} pending={pending} overdue={overdue}
              rate={rate} chartData={chartData} onNavigate={setActive}
              onAdd={openCreateModal} onToggle={patchTask} onDelete={removeTask}
              onEdit={editTask}
            />
          )}
          {active === "My tasks" && (
            <TaskList
              tasks={visibleTasks} search={search} setSearch={setSearch}
              filter={filter} setFilter={setFilter} onToggle={patchTask}
              onDelete={removeTask} onAdd={openCreateModal} onEdit={editTask}
            />
          )}
          {active === "Board" && (
            <Board
              tasks={tasks} onDrop={handleDrop} onToggle={patchTask}
              onDelete={removeTask} onEdit={editTask}
            />
          )}
          {active === "Calendar" && <Calendar tasks={tasks} month={month} setMonth={setMonth} />}
          {active === "Analytics" && (
            <Analytics
              tasks={tasks} completed={completed} pending={pending}
              overdue={overdue} rate={rate} chartData={chartData}
            />
          )}
          {active === "Focus" && (
            <Focus
              seconds={focusSeconds} setSeconds={setFocusSeconds}
              running={timerRunning} setRunning={setTimerRunning}
              sessions={focusSessions}
            />
          )}
          {active === "AI assistant" && (
            <Assistant
              messages={aiMessages} input={aiInput} setInput={setAiInput}
              send={sendAI} prompts={samplePrompts}
            />
          )}
        </section>
      </main>

      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && closeTaskModal()}
        >
          <form className="task-modal" onSubmit={saveTask}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">WORKSPACE</span>
                <h2>{editingTask ? "Edit task" : "Create a task"}</h2>
              </div>
              <button type="button" className="icon-btn" onClick={closeTaskModal}>
                <X size={19} />
              </button>
            </div>

            <label>
              Task title
              <input
                autoFocus required maxLength="120"
                placeholder="e.g. Finish database assignment"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              Description <span className="optional">Optional</span>
              <textarea
                rows="3" placeholder="Add a little context…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Category
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {["Study", "Development", "Personal", "Project", "Other"].map((x) =>
                    <option key={x}>{x}</option>
                  )}
                </select>
              </label>
              <label>
                Priority
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  {["Low", "Medium", "High"].map((x) => <option key={x}>{x}</option>)}
                </select>
              </label>
            </div>
            <label>
              Due date
              <input
                type="date" value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={closeTaskModal}>
                Cancel
              </button>
              <button className="primary-btn" type="submit">
                {editingTask ? <Check size={16} /> : <Plus size={16} />}
                {editingTask ? "Save changes" : "Add task"}
              </button>
            </div>
          </form>
        </div>
      )}

      {toast && (
        <div className="toast">
          <Check size={16} />{toast}
          <button onClick={() => setToast("")}><X size={15} /></button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, tone = "purple" }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon size={18} /></div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function TaskRow({ task, onToggle, onDelete, onEdit }) {
  return (
    <div className={`task-row ${task.completed ? "is-done" : ""}`}>
      <button
        className={`check-circle ${task.completed ? "checked" : ""}`}
        onClick={() => onToggle(task, { completed: !task.completed })}
      >
        {task.completed && <Check size={13} />}
      </button>
      <div className="task-row-main">
        <b>{task.title}</b>
        {task.description && <small>{task.description}</small>}
        <div className="task-meta">
          <span className="category-chip">{task.category || "General"}</span>
          <span className={`priority ${String(task.priority || "Medium").toLowerCase()}`}>
            <Flag size={11} />{task.priority || "Medium"}
          </span>
          {task.dueDate && <span className="due-meta"><Clock3 size={11} />{task.dueDate}</span>}
        </div>
      </div>
      <button className="icon-btn" title="Edit task" aria-label="Edit task" onClick={() => onEdit(task)}>
        <Pencil size={15} />
      </button>
      <button className="icon-btn delete-btn" title="Delete task" aria-label="Delete task" onClick={() => onDelete(task)}>
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function Overview({ tasks, completed, pending, overdue, rate, chartData, onNavigate, onAdd, onToggle, onDelete, onEdit }) {
  const recent = [...tasks]
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 4);

  return (
    <>
      <div className="stats-grid">
        <StatCard label="Total tasks" value={tasks.length} sub="Across your workspace" icon={ListTodo} />
        <StatCard label="Completed" value={completed} sub="Nice progress so far" icon={CheckCheck} tone="green" />
        <StatCard label="In progress" value={pending} sub="Still on your radar" icon={Activity} tone="blue" />
        <StatCard label="Overdue" value={overdue} sub="Needs your attention" icon={AlarmClock} tone="orange" />
      </div>
      <div className="overview-grid">
        <div className="panel chart-panel">
          <div className="panel-head">
            <div><h3>Productivity overview</h3><p>Tasks completed over the last 7 days</p></div>
            <button className="text-btn" onClick={() => onNavigate("Analytics")}>View analytics <ArrowUpRight size={14} /></button>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9276ff" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#9276ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#252938" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#858ba0", fontSize: 12 }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#858ba0", fontSize: 12 }} width={26} />
                <Tooltip contentStyle={{ background: "#171b28", border: "1px solid #30364a", borderRadius: 12, color: "#fff" }} />
                <Area type="monotone" dataKey="done" stroke="#9b83ff" strokeWidth={2.5} fill="url(#chartFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel progress-panel">
          <div className="panel-head">
            <div><h3>Completion rate</h3><p>Your overall task progress</p></div>
            <Target size={18} className="muted-icon" />
          </div>
          <div className="progress-ring" style={{ "--progress": `${rate}%` }}>
            <div><strong>{rate}%</strong><small>completed</small></div>
          </div>
          <div className="progress-legend">
            <span><i className="legend-dot purple-dot" />Completed <b>{completed}</b></span>
            <span><i className="legend-dot gray-dot" />Remaining <b>{pending}</b></span>
          </div>
          <button className="secondary-btn full-btn" onClick={() => onNavigate("My tasks")}>Explore tasks <ArrowUpRight size={15} /></button>
        </div>
      </div>
      <div className="panel recent-panel">
        <div className="panel-head">
          <div><h3>Recent tasks</h3><p>Your latest additions</p></div>
          <button className="text-btn" onClick={() => onNavigate("My tasks")}>See all <ArrowUpRight size={14} /></button>
        </div>
        {recent.length
          ? <div className="task-list">{recent.map((t) =>
            <TaskRow key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} />
          )}</div>
          : <EmptyState title="Your workspace is clear" text="Add your first task and start building momentum." action={onAdd} />
        }
      </div>
    </>
  );
}

function TaskList({ tasks, search, setSearch, filter, setFilter, onToggle, onDelete, onAdd, onEdit }) {
  return (
    <div className="panel task-page">
      <div className="task-toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            placeholder="Search tasks, descriptions, categories…"
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          {["All", "Pending", "Completed"].map((x) =>
            <button key={x} className={filter === x ? "selected" : ""} onClick={() => setFilter(x)}>{x}</button>
          )}
        </div>
      </div>
      {tasks.length
        ? <div className="task-list">{tasks.map((t) =>
          <TaskRow key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} />
        )}</div>
        : <EmptyState title="No matching tasks" text="Try another filter or create a new task." action={onAdd} />
      }
    </div>
  );
}

function Board({ tasks, onDrop, onToggle, onDelete, onEdit }) {
  const columns = [["To Do", false], ["In Progress", "progress"], ["Completed", true]];
  return (
    <div className="board-grid">
      {columns.map(([name, status]) => {
        const items = tasks.filter((t) =>
          status === true ? t.completed :
          status === "progress" ? (t.status === "In Progress" && !t.completed) :
          !t.completed && t.status !== "In Progress"
        );
        return (
          <div
            className="board-column" key={name}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, name)}
          >
            <div className="column-head">
              <span><i className={`column-dot ${name.toLowerCase().replace(" ", "-")}`} />{name}</span>
              <b>{items.length}</b>
            </div>
            {items.map((t) => (
              <div
                className="board-card" key={t.id} draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
              >
                <div className="board-card-top">
                  <span className={`priority ${String(t.priority || "Medium").toLowerCase()}`}>
                    <Flag size={11} />{t.priority || "Medium"}
                  </span>
                  <div className="board-card-actions">
                    <button className="icon-btn" title="Edit task" aria-label="Edit task" onClick={() => onEdit(t)}>
                      <Pencil size={14} />
                    </button>
                    <button className="icon-btn" title="Delete task" aria-label="Delete task" onClick={() => onDelete(t)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <b>{t.title}</b>
                {t.description && <p>{t.description}</p>}
                <div className="board-card-foot">
                  <span>{t.category || "General"}</span>
                  {t.dueDate && <small>{t.dueDate}</small>}
                </div>
                {name !== "Completed" && (
                  <button
                    className="move-btn"
                    onClick={() => onToggle(t, name === "To Do"
                      ? { status: "In Progress" }
                      : { status: "Completed", completed: true })}
                  >
                    {name === "To Do" ? "Start task" : "Complete task"} <ArrowUpRight size={13} />
                  </button>
                )}
              </div>
            ))}
            {!items.length && <div className="column-empty">Drop tasks here</div>}
          </div>
        );
      })}
    </div>
  );
}

function Calendar({ tasks, month, setMonth }) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1).getDay();
  const count = new Date(year, m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];

  return (
    <div className="panel calendar-panel">
      <div className="calendar-head">
        <div><h3>{month.toLocaleDateString("en", { month: "long", year: "numeric" })}</h3><p>Tasks grouped by due date</p></div>
        <div className="calendar-nav">
          <button className="icon-btn" onClick={() => setMonth(new Date(year, m - 1, 1))}><ChevronLeft size={18} /></button>
          <button className="icon-btn" onClick={() => setMonth(new Date(year, m + 1, 1))}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div className="weekday" key={d}>{d}</div>)}
        {cells.map((day, i) => {
          const key = day ? `${year}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
          const dayTasks = tasks.filter((t) => t.dueDate === key);
          return (
            <div className={`calendar-cell ${key === todayISO() ? "today" : ""}`} key={i}>
              <span>{day || ""}</span>
              {dayTasks.slice(0, 2).map((t) =>
                <div title={t.title} className={`calendar-task ${t.completed ? "done" : ""}`} key={t.id}>{t.title}</div>
              )}
              {dayTasks.length > 2 && <small>+{dayTasks.length - 2} more</small>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Analytics({ tasks, completed, pending, overdue, rate, chartData }) {
  const categories = Object.entries(tasks.reduce((a, t) => {
    const k = t.category || "General";
    a[k] = (a[k] || 0) + 1;
    return a;
  }, {}));

  return (
    <>
      <div className="stats-grid">
        <StatCard label="Completion rate" value={`${rate}%`} sub="Completed / total tasks" icon={TrendingUp} />
        <StatCard label="Tasks completed" value={completed} sub="All-time total" icon={CheckCheck} tone="green" />
        <StatCard label="Open tasks" value={pending} sub="Not completed yet" icon={Activity} tone="blue" />
        <StatCard label="Overdue tasks" value={overdue} sub="Past their due date" icon={AlarmClock} tone="orange" />
      </div>
      <div className="analytics-grid">
        <div className="panel chart-panel">
          <div className="panel-head"><div><h3>Weekly activity</h3><p>Completion activity based on task creation dates</p></div></div>
          <div className="chart-wrap tall">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid stroke="#252938" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#858ba0", fontSize: 12 }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#858ba0", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#171b28", border: "1px solid #30364a", borderRadius: 12, color: "#fff" }} />
                <Area type="monotone" dataKey="done" stroke="#9b83ff" fill="#9276ff" fillOpacity={0.18} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel category-panel">
          <div className="panel-head"><div><h3>By category</h3><p>Where your tasks live</p></div></div>
          {categories.length
            ? categories.map(([name, n]) => (
              <div className="category-stat" key={name}>
                <div><span>{name}</span><b>{n}</b></div>
                <div className="mini-track"><i style={{ width: `${tasks.length ? n / tasks.length * 100 : 0}%` }} /></div>
              </div>
            ))
            : <p className="muted-copy">Your category breakdown will appear here.</p>
          }
        </div>
      </div>
    </>
  );
}

function Focus({ seconds, setSeconds, running, setRunning, sessions }) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  const pct = (1 - seconds / (25 * 60)) * 100;

  return (
    <div className="focus-layout">
      <div className="panel focus-main">
        <div className="focus-label"><span className="status-dot" /> DEEP WORK SESSION</div>
        <div className="focus-clock" style={{ "--timer-progress": `${pct}%` }}>
          <div><strong>{mins}:{secs}</strong><small>FOCUS TIME</small></div>
        </div>
        <p className="focus-copy">One thing at a time. Give your attention a place to land.</p>
        <div className="timer-actions">
          <button className="primary-btn" onClick={() => setRunning(!running)}>{running ? "Pause session" : "Start focusing"}</button>
          <button className="secondary-btn" onClick={() => { setRunning(false); setSeconds(25 * 60); }}>Reset</button>
        </div>
        <div className="timer-presets">
          {[15, 25, 45].map((n) =>
            <button key={n} onClick={() => { setRunning(false); setSeconds(n * 60); }}>{n} min</button>
          )}
        </div>
      </div>
      <div className="panel focus-side">
        <div className="stat-icon purple"><Zap size={18} /></div>
        <h3>Your focus stats</h3>
        <div className="focus-session-number">{sessions}</div>
        <p>Sessions completed this visit</p>
        <div className="focus-note"><Sparkles size={16} /><span>Try putting your phone away and choosing one clearly defined task before you begin.</span></div>
      </div>
    </div>
  );
}

function Assistant({ messages, input, setInput, send, prompts }) {
  return (
    <div className="assistant-layout">
      <div className="panel assistant-panel">
        <div className="assistant-title">
          <div className="ai-avatar"><Bot size={20} /></div>
          <div><h3>TaskFlow AI</h3><p><span className="status-dot" /> Mock assistant · local suggestions</p></div>
          <span className="beta-tag">BETA</span>
        </div>
        <div className="chat-messages">
          {messages.map((m, i) => {
            const lines = m.text.split("\n");
            return (
              <div className={`chat-message ${m.role}`} key={i}>
                <div className="chat-avatar">{m.role === "assistant" ? <Sparkles size={15} /> : "You"}</div>
                <div className="chat-bubble">
                  {lines.map((line, j) => <React.Fragment key={j}>{line}{j < lines.length - 1 && <br />}</React.Fragment>)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="prompt-chips">{prompts.map((p) => <button key={p} onClick={() => send(p)}>{p}</button>)}</div>
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask me to help plan your work…" />
          <button className="primary-btn" disabled={!input.trim()}><Send size={16} /></button>
        </form>
      </div>
      <div className="assistant-disclaimer">
        <Sparkles size={17} />
        <div><b>Helpful, not magical.</b><p>This is a rule-based demo assistant, not a connected large language model. It doesn't send your task data to an external AI service.</p></div>
      </div>
    </div>
  );
}

function EmptyState({ title, text, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><ListTodo size={23} /></div>
      <h3>{title}</h3>
      <p>{text}</p>
      <button className="secondary-btn" onClick={action}><Plus size={15} /> Create a task</button>
    </div>
  );
}

export default App;
