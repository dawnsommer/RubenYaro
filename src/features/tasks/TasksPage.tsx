import { useState, useMemo } from 'react';
import { nanoid } from 'nanoid';
import {
  Plus,
  CheckCircle2,
  Calendar,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { costStatus, costTotal } from '../../store/selectors';
import { daysUntil, formatShortDate } from '../../lib/dates';
import { KeyDate, Phase, Priority, Task, TaskStatus } from '../../types';
import {
  Amount,
  Button,
  Card,
  Checkbox,
  Chip,
  DateInput,
  EmptyState,
  Progress,
  Segmented,
  Select,
  Sheet,
  Toast,
  ToastMessage,
} from '../../components/ui';
import { CostDetailSheet } from '../costs/CostDetailSheet';

type TaskViewMode = 'list' | 'board' | 'upcoming';

export function parseQuickTaskSyntax(
  raw: string,
  phases: Phase[]
): {
  title: string;
  phaseId?: string;
  priority: Priority;
  dueDate?: string;
} {
  let working = raw;
  let priority: Priority = 'must';
  let dueDate: string | undefined;
  let phaseId: string | undefined;

  const prioMatch = working.match(/!(must|should|nice)\b/i);
  if (prioMatch) {
    priority = prioMatch[1].toLowerCase() as Priority;
    working = working.replace(prioMatch[0], '');
  }

  const dateMatch = working.match(/@(\d{4}-\d{2}-\d{2})\b/);
  if (dateMatch) {
    dueDate = dateMatch[1];
    working = working.replace(dateMatch[0], '');
  }

  const phaseMatch = working.match(/#([a-z0-9_-]+)\b/i);
  if (phaseMatch) {
    const token = phaseMatch[1].toLowerCase();
    const found = phases.find(
      (p) =>
        p.id.toLowerCase() === token ||
        p.name.toLowerCase().replace(/\s+/g, '').includes(token)
    );
    if (found) phaseId = found.id;
    working = working.replace(phaseMatch[0], '');
  }

  return {
    title: working.replace(/\s+/g, ' ').trim(),
    phaseId,
    priority,
    dueDate,
  };
}

export function TasksPage() {
  const state = useStore();
  const { tasks, costs, settings, transactions, accounts } = state;

  const [view, setView] = useState<TaskViewMode>('list');
  const [quickText, setQuickText] = useState('');
  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});
  const [showCompleted, setShowCompleted] = useState(false);

  // Toast
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Linked cost payment sheet
  const [payingCostId, setPayingCostId] = useState<string | null>(null);

  // Edit / Add Task Sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [tTitle, setTTitle] = useState('');
  const [tPhaseId, setTPhaseId] = useState(settings.phases[0]?.id ?? 'general');
  const [tPriority, setTPriority] = useState<Priority>('must');
  const [tStatus, setTStatus] = useState<TaskStatus>('todo');
  const [tDueDate, setTDueDate] = useState<string | null>(null);
  const [tLinkedCostId, setTLinkedCostId] = useState<string>('');
  const [tChecklistText, setTChecklistText] = useState('');
  const [tHasProgress, setTHasProgress] = useState(false);
  const [tProgCurrent, setTProgCurrent] = useState(0);
  const [tProgTotal, setTProgTotal] = useState(1700);
  const [tProgUnit, setTProgUnit] = useState('questions');

  // Key Date Sheet
  const [keyDateOpen, setKeyDateOpen] = useState(false);
  const [kdLabel, setKdLabel] = useState('');
  const [kdDate, setKdDate] = useState<string | null>(null);
  const [kdKind, setKdKind] = useState<KeyDate['kind']>('exam');

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const overallPct = tasks.length > 0 ? (doneCount / tasks.length) * 100 : 0;

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickText.trim()) return;
    const parsed = parseQuickTaskSyntax(quickText, settings.phases);
    if (!parsed.title) return;
    state.addTask({
      title: parsed.title,
      phaseId: parsed.phaseId ?? settings.phases[0]?.id,
      priority: parsed.priority,
      status: 'todo',
      dueDate: parsed.dueDate,
    });
    setQuickText('');
  };

  const handleToggleTaskDone = (task: Task, nextDone: boolean) => {
    const prevStatus = task.status;
    const nextStatus: TaskStatus = nextDone ? 'done' : 'todo';
    state.updateTask(task.id, {
      status: nextStatus,
      completedAt: nextDone ? new Date().toISOString() : undefined,
    });

    if (nextDone) {
      // Check if linkedCost is unpaid (§6.4)
      const linkedCost = task.linkedCostId
        ? costs.find((c) => c.id === task.linkedCostId)
        : undefined;
      if (
        linkedCost &&
        costStatus(linkedCost, transactions, accounts, settings) !== 'paid'
      ) {
        setToast({
          id: nanoid(6),
          message: `Completed "${task.title}". Record payment for ${linkedCost.name}?`,
          actionLabel: 'Record payment',
          onAction: () => setPayingCostId(linkedCost.id),
        });
      } else {
        setToast({
          id: nanoid(6),
          message: `Completed "${task.title}"`,
          actionLabel: 'Undo',
          onAction: () =>
            state.updateTask(task.id, {
              status: prevStatus,
              completedAt: undefined,
            }),
        });
      }
    }
  };

  const handleIncrementProgress = (task: Task, delta: number) => {
    if (!task.progress) return;
    const nextCur = Math.min(
      task.progress.total,
      Math.max(0, task.progress.current + delta)
    );
    state.updateTask(task.id, {
      progress: { ...task.progress, current: nextCur },
    });
  };

  const openNewTaskSheet = () => {
    setEditingTask(null);
    setTTitle('');
    setTPhaseId(settings.phases[0]?.id ?? 'general');
    setTPriority('must');
    setTStatus('todo');
    setTDueDate(null);
    setTLinkedCostId('');
    setTChecklistText('');
    setTHasProgress(false);
    setTProgCurrent(0);
    setTProgTotal(1700);
    setTProgUnit('questions');
    setSheetOpen(true);
  };

  const openEditTaskSheet = (task: Task) => {
    setEditingTask(task);
    setTTitle(task.title);
    setTPhaseId(task.phaseId ?? settings.phases[0]?.id ?? 'general');
    setTPriority(task.priority);
    setTStatus(task.status);
    setTDueDate(task.dueDate ?? null);
    setTLinkedCostId(task.linkedCostId ?? '');
    setTChecklistText(task.checklist.map((c) => c.text).join('\n'));
    setTHasProgress(Boolean(task.progress));
    setTProgCurrent(task.progress?.current ?? 0);
    setTProgTotal(task.progress?.total ?? 1700);
    setTProgUnit(task.progress?.unit ?? 'questions');
    setSheetOpen(true);
  };

  const handleSaveTask = () => {
    if (!tTitle.trim()) return;
    const checklistItems = tChecklistText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((text, idx) => {
        const existing = editingTask?.checklist[idx];
        return {
          id: existing?.id ?? nanoid(8),
          text,
          done: existing?.done ?? false,
        };
      });

    const progress = tHasProgress
      ? {
          current: Math.max(0, tProgCurrent),
          total: Math.max(1, tProgTotal),
          unit: tProgUnit || 'items',
        }
      : undefined;

    if (editingTask) {
      state.updateTask(editingTask.id, {
        title: tTitle.trim(),
        phaseId: tPhaseId,
        priority: tPriority,
        status: tStatus,
        dueDate: tDueDate ?? undefined,
        linkedCostId: tLinkedCostId || undefined,
        checklist: checklistItems,
        progress,
      });
    } else {
      state.addTask({
        title: tTitle.trim(),
        phaseId: tPhaseId,
        priority: tPriority,
        status: tStatus,
        dueDate: tDueDate ?? undefined,
        linkedCostId: tLinkedCostId || undefined,
        checklist: checklistItems,
        progress,
      });
    }
    setSheetOpen(false);
  };

  const renderTaskRow = (task: Task) => {
    const linkedCost = task.linkedCostId
      ? costs.find((c) => c.id === task.linkedCostId)
      : undefined;
    const checkDone = task.checklist.filter((c) => c.done).length;
    const progPct = task.progress
      ? (task.progress.current / Math.max(1, task.progress.total)) * 100
      : 0;
    const dueDays = task.dueDate ? daysUntil(task.dueDate) : null;

    return (
      <div
        key={task.id}
        className="flex items-start justify-between gap-3 py-3 px-4 hover:bg-[var(--surface-2)]/50 transition-colors"
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-0.5">
            <Checkbox
              checked={task.status === 'done'}
              onChange={(done) => handleToggleTaskDone(task, done)}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => openEditTaskSheet(task)}
                className={`text-sm font-medium text-left hover:underline cursor-pointer ${
                  task.status === 'done'
                    ? 'line-through text-[var(--text-muted)]'
                    : ''
                }`}
              >
                {task.title}
              </button>
              <span
                className={`w-2 h-2 rounded-full ${
                  task.priority === 'must'
                    ? 'bg-[var(--negative)]'
                    : task.priority === 'should'
                      ? 'bg-[var(--warning)]'
                      : 'bg-[var(--text-muted)]'
                }`}
                title={`Priority: ${task.priority}`}
              />
              {task.dueDate && (
                <Chip
                  variant={
                    dueDays !== null && dueDays < 0
                      ? 'negative'
                      : dueDays !== null && dueDays <= 7
                        ? 'warning'
                        : 'default'
                  }
                >
                  {dueDays !== null && dueDays < 0
                    ? `Overdue (${formatShortDate(task.dueDate)})`
                    : formatShortDate(task.dueDate)}
                </Chip>
              )}
              {task.checklist.length > 0 && (
                <Chip>
                  ☑ {checkDone}/{task.checklist.length}
                </Chip>
              )}
              {linkedCost && (
                <button
                  type="button"
                  onClick={() => setPayingCostId(linkedCost.id)}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border border-[var(--accent)] text-[var(--accent)] cursor-pointer"
                >
                  <Amount
                    pkr={costTotal(linkedCost, settings)}
                    compact
                    tone="default"
                  />{' '}
                  →
                </button>
              )}
            </div>

            {/* Checklist items inline toggle */}
            {task.checklist.length > 0 && task.status !== 'done' && (
              <div className="mt-2 flex flex-wrap gap-2">
                {task.checklist.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const updated = task.checklist.map((c) =>
                        c.id === item.id ? { ...c, done: !c.done } : c
                      );
                      state.updateTask(task.id, { checklist: updated });
                    }}
                    className={`text-xs px-2 py-0.5 rounded-[6px] border cursor-pointer ${
                      item.done
                        ? 'border-[var(--positive)] text-[var(--positive)] line-through opacity-70'
                        : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {item.done ? '✓ ' : '○ '}
                    {item.text}
                  </button>
                ))}
              </div>
            )}

            {/* Progress tracker bar + +10 / +40 buttons (§6.4) */}
            {task.progress && (
              <div className="mt-2 flex items-center gap-2.5 max-w-md">
                <div className="flex-1">
                  <Progress value={progPct} />
                </div>
                <span className="text-xs text-[var(--text-muted)] num shrink-0">
                  {task.progress.current.toLocaleString()} /{' '}
                  {task.progress.total.toLocaleString()} {task.progress.unit}
                </span>
                <button
                  type="button"
                  onClick={() => handleIncrementProgress(task, 10)}
                  className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] font-medium hover:bg-[var(--surface-2)] cursor-pointer"
                >
                  +10
                </button>
                <button
                  type="button"
                  onClick={() => handleIncrementProgress(task, 40)}
                  className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] font-medium hover:bg-[var(--surface-2)] cursor-pointer"
                >
                  +40
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const upcomingBuckets = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const active = tasks.filter((t) => t.status !== 'done');
    return {
      Overdue: active.filter((t) => t.dueDate && t.dueDate < todayIso),
      Today: active.filter((t) => t.dueDate === todayIso),
      'This week': active.filter((t) => {
        if (!t.dueDate || t.dueDate <= todayIso) return false;
        return daysUntil(t.dueDate, todayIso) <= 7;
      }),
      Later: active.filter((t) => {
        if (!t.dueDate) return false;
        return daysUntil(t.dueDate, todayIso) > 7;
      }),
      'No date': active.filter((t) => !t.dueDate),
    };
  }, [tasks]);

  const payingCost = costs.find((c) => c.id === payingCostId) ?? null;

  return (
    <div className="space-y-5">
      {/* Header (§6.4) */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-micro">Checklist &amp; Milestones</p>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-[24px] leading-[32px] font-semibold">Tasks</h1>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] num">
              <Progress value={overallPct} variant="ring" size={26} />
              <span>
                {doneCount} of {tasks.length} done
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setKeyDateOpen(true)}>
            <Calendar className="w-3.5 h-3.5" />+ Key date
          </Button>
          <Button onClick={openNewTaskSheet}>
            <Plus className="w-4 h-4" />
            Add task
          </Button>
        </div>
      </div>

      {/* Countdowns strip */}
      {(settings.journey.examDates.length > 0 || settings.journey.targetDate) && (
        <div className="flex flex-wrap items-center gap-2">
          {settings.journey.targetDate && (
            <Chip variant="accent" className="text-xs py-1 px-3">
              Target · {daysUntil(settings.journey.targetDate)} days
            </Chip>
          )}
          {settings.journey.examDates.map((kd) => {
            const d = daysUntil(kd.date);
            return (
              <Chip
                key={kd.id}
                variant={d < 0 ? 'negative' : d <= 30 ? 'warning' : 'accent'}
                className="text-xs py-1 px-3"
              >
                {kd.label} · {d >= 0 ? `${d} days` : `${Math.abs(d)}d ago`}
              </Chip>
            );
          })}
        </div>
      )}

      {/* Inline quick-add input + view switch (§6.4) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleQuickAddSubmit} className="flex-1 min-w-[260px]">
          <input
            type="text"
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            placeholder="Quick add task… e.g. Book Step 3 date #step3 !must @2026-12-10 (Enter)"
            className="w-full rounded-[10px] bg-[var(--surface)] border border-[var(--border)] px-3.5 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </form>

        <Segmented
          ariaLabel="Tasks view switch"
          options={[
            { value: 'list', label: 'List by phase' },
            { value: 'board', label: 'Board' },
            { value: 'upcoming', label: 'Upcoming' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="w-6 h-6" />}
          message="No tasks in your checklist yet."
          actionLabel="Load USMLE starter checklist"
          onAction={() => state.loadStarterData()}
        />
      ) : (
        <>
          {/* VIEW 1: LIST BY PHASE */}
          {view === 'list' && (
            <div className="space-y-4">
              {settings.phases.map((phase) => {
                const phaseTasks = tasks.filter(
                  (t) => t.phaseId === phase.id && t.status !== 'done'
                );
                const allPhaseTasks = tasks.filter((t) => t.phaseId === phase.id);
                if (allPhaseTasks.length === 0) return null;
                const phaseDone = allPhaseTasks.filter(
                  (t) => t.status === 'done'
                ).length;
                const phasePct = (phaseDone / allPhaseTasks.length) * 100;
                const isCollapsed = Boolean(collapsedPhases[phase.id]);

                return (
                  <Card
                    key={phase.id}
                    noPadding
                    title={
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedPhases((p) => ({
                            ...p,
                            [phase.id]: !p[phase.id],
                          }))
                        }
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                        )}
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: phase.color }}
                        />
                        <span>{phase.name}</span>
                        <span className="text-xs font-normal text-[var(--text-muted)] num">
                          ({phaseDone}/{allPhaseTasks.length})
                        </span>
                      </button>
                    }
                    action={
                      <div className="w-24">
                        <Progress value={phasePct} tone="positive" />
                      </div>
                    }
                  >
                    {!isCollapsed && (
                      <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                        {phaseTasks.length === 0 ? (
                          <p className="text-xs text-[var(--text-muted)] px-4 py-3">
                            All tasks in this phase completed!
                          </p>
                        ) : (
                          phaseTasks.map(renderTaskRow)
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}

              {/* Completed collapsible section */}
              {doneCount > 0 && (
                <Card
                  noPadding
                  title={
                    <button
                      type="button"
                      onClick={() => setShowCompleted((s) => !s)}
                      className="flex items-center gap-2 text-sm text-[var(--text-muted)] cursor-pointer"
                    >
                      {showCompleted ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <span>Completed ({doneCount})</span>
                    </button>
                  }
                >
                  {showCompleted && (
                    <div className="divide-y divide-[var(--border)] border-t border-[var(--border)] opacity-70">
                      {tasks.filter((t) => t.status === 'done').map(renderTaskRow)}
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}

          {/* VIEW 2: BOARD (Kanban To do / Doing / Done) */}
          {view === 'board' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(
                [
                  { status: 'todo', label: 'To do' },
                  { status: 'doing', label: 'Doing' },
                  { status: 'done', label: 'Done' },
                ] as const
              ).map((col) => {
                const colTasks = tasks.filter((t) => t.status === col.status);
                return (
                  <Card
                    key={col.status}
                    title={`${col.label} (${col.status === 'done' ? doneCount : colTasks.length})`}
                  >
                    <div className="space-y-2.5">
                      {colTasks.map((t) => (
                        <div
                          key={t.id}
                          className="p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openEditTaskSheet(t)}
                              className="text-sm font-medium text-left hover:underline cursor-pointer"
                            >
                              {t.title}
                            </button>
                            <Chip>{t.priority}</Chip>
                          </div>
                          <div className="flex items-center justify-between gap-1 pt-1">
                            {(['todo', 'doing', 'done'] as const).map((st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => {
                                  if (st === 'done') handleToggleTaskDone(t, true);
                                  else state.updateTask(t.id, { status: st });
                                }}
                                className={`px-2 py-0.5 rounded-[6px] text-[11px] font-medium capitalize cursor-pointer ${
                                  t.status === st
                                    ? 'bg-[var(--accent)] text-white'
                                    : 'text-[var(--text-muted)] hover:bg-[var(--border)]'
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* VIEW 3: UPCOMING */}
          {view === 'upcoming' && (
            <div className="space-y-4">
              {Object.entries(upcomingBuckets).map(([bucketName, list]) => {
                if (list.length === 0) return null;
                return (
                  <Card key={bucketName} noPadding title={`${bucketName} (${list.length})`}>
                    <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                      {list.map(renderTaskRow)}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Task Add/Edit Sheet */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingTask ? 'Edit task' : 'Add task'}
        footer={
          <div className="w-full flex items-center justify-between">
            {editingTask ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  state.deleteTask(editingTask.id);
                  setSheetOpen(false);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTask}>Save</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Title
            </label>
            <input
              type="text"
              value={tTitle}
              onChange={(e) => setTTitle(e.target.value)}
              className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Phase"
              value={tPhaseId}
              onChange={setTPhaseId}
              options={settings.phases.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
            />
            <Select
              label="Status"
              value={tStatus}
              onChange={(v) => setTStatus(v as TaskStatus)}
              options={[
                { value: 'todo', label: 'To do' },
                { value: 'doing', label: 'Doing' },
                { value: 'done', label: 'Done' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Priority"
              value={tPriority}
              onChange={(v) => setTPriority(v as Priority)}
              options={[
                { value: 'must', label: 'Must' },
                { value: 'should', label: 'Should' },
                { value: 'nice', label: 'Nice' },
              ]}
            />
            <DateInput label="Due date" value={tDueDate} onChange={setTDueDate} />
          </div>

          <Select
            label="Linked cost (optional)"
            value={tLinkedCostId}
            onChange={setTLinkedCostId}
            options={[
              { value: '', label: 'None' },
              ...costs.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Checklist items (one per line)
            </label>
            <textarea
              rows={3}
              value={tChecklistText}
              onChange={(e) => setTChecklistText(e.target.value)}
              placeholder="CV&#10;Personal statement&#10;LoRs"
              className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="pt-2 border-t border-[var(--border)] space-y-2">
            <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={tHasProgress}
                onChange={(e) => setTHasProgress(e.target.checked)}
              />
              Enable numeric progress tracker (e.g. Qbank questions)
            </label>
            {tHasProgress && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">
                    Current
                  </label>
                  <input
                    type="number"
                    value={tProgCurrent}
                    onChange={(e) => setTProgCurrent(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-2.5 py-1.5 text-sm num outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">
                    Total
                  </label>
                  <input
                    type="number"
                    value={tProgTotal}
                    onChange={(e) => setTProgTotal(parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-2.5 py-1.5 text-sm num outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={tProgUnit}
                    onChange={(e) => setTProgUnit(e.target.value)}
                    className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-2.5 py-1.5 text-sm outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Sheet>

      {/* Key Date Add Sheet */}
      <Sheet
        open={keyDateOpen}
        onClose={() => setKeyDateOpen(false)}
        title="Add key countdown date"
        footer={
          <>
            <Button variant="secondary" onClick={() => setKeyDateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!kdLabel.trim() || !kdDate) return;
                state.addKeyDate({
                  label: kdLabel.trim(),
                  date: kdDate,
                  kind: kdKind,
                });
                setKdLabel('');
                setKdDate(null);
                setKeyDateOpen(false);
              }}
            >
              Add countdown
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Label
            </label>
            <input
              type="text"
              value={kdLabel}
              onChange={(e) => setKdLabel(e.target.value)}
              placeholder="e.g. Step 3 exam, ERAS opens"
              className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm outline-none"
              autoFocus
            />
          </div>
          <DateInput label="Date" value={kdDate} onChange={setKdDate} />
          <Select
            label="Kind"
            value={kdKind}
            onChange={(v) => setKdKind(v as KeyDate['kind'])}
            options={[
              { value: 'exam', label: 'Exam' },
              { value: 'deadline', label: 'Deadline' },
              { value: 'eligibility', label: 'Eligibility window' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </div>
      </Sheet>

      <CostDetailSheet
        cost={payingCost}
        open={Boolean(payingCost)}
        initialTab="payments"
        onClose={() => setPayingCostId(null)}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
