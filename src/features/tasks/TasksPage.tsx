import { useState, useMemo } from 'react';
import { nanoid } from 'nanoid';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Pin,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  costMarketPkr,
  costNativeUsd,
  costStatus,
} from '../../store/selectors';
import { formatShortDate } from '../../lib/dates';
import { Phase, Priority, Task, TaskStatus } from '../../types';
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
import { useNavigate } from 'react-router-dom';

type TaskViewMode = 'manual' | 'phase';

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

interface SortableTaskRowProps {
  task: Task;
  index: number;
  totalCount: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleDone: (done: boolean) => void;
  onTogglePin: () => void;
  onEdit: () => void;
  onOpenCost: (costId: string) => void;
  onIncrementProgress: (delta: number) => void;
}

function SortableTaskRow({
  task,
  index,
  totalCount,
  onMoveUp,
  onMoveDown,
  onToggleDone,
  onTogglePin,
  onEdit,
  onOpenCost,
  onIncrementProgress,
}: SortableTaskRowProps) {
  const state = useStore();
  const { costs, settings } = state;

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const linkedCost = task.linkedCostId
    ? costs.find((c) => c.id === task.linkedCostId)
    : undefined;
  const checkDone = task.checklist.filter((c) => c.done).length;
  const progPct = task.progress
    ? (task.progress.current / Math.max(1, task.progress.total)) * 100
    : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-start justify-between gap-2.5 py-3 px-3 sm:px-4 bg-[var(--surface)] hover:bg-[var(--surface-2)]/50 transition-colors"
    >
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder task"
          className="hidden sm:block mt-0.5 text-[var(--text-faint)] cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Round checkbox */}
        <div className="mt-0.5">
          <Checkbox
            checked={task.status === 'done'}
            onChange={onToggleDone}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onEdit}
              className={`text-sm font-medium text-left hover:underline cursor-pointer ${
                task.status === 'done'
                  ? 'line-through text-[var(--text-muted)]'
                  : ''
              }`}
            >
              {task.title}
            </button>


            {task.dueDate && (
              <Chip>{formatShortDate(task.dueDate)}</Chip>
            )}

            {task.checklist.length > 0 && (
              <Chip>
                ☑ {checkDone}/{task.checklist.length}
              </Chip>
            )}

            {linkedCost && (
              <button
                type="button"
                onClick={() => onOpenCost(linkedCost.id)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-[var(--accent-soft)] text-[var(--accent)] cursor-pointer"
              >
                <Amount
                  pkr={costMarketPkr(linkedCost, settings)}
                  usd={costNativeUsd(linkedCost) ?? undefined}
                  compact
                />
              </button>
            )}
          </div>

          {/* Inline checklist pills */}
          {task.checklist.length > 0 && task.status !== 'done' && (
            <div className="mt-2 flex flex-wrap gap-1.5">
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
                  className={`text-xs px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
                    item.done
                      ? 'bg-[var(--positive-soft)] text-[var(--positive)] line-through'
                      : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {item.done ? '✓ ' : '○ '}
                  {item.text}
                </button>
              ))}
            </div>
          )}

          {/* Progress tracker */}
          {task.progress && (
            <div className="mt-2 flex items-center gap-2 max-w-md">
              <div className="flex-1">
                <Progress value={progPct} />
              </div>
              <span className="text-xs text-[var(--text-muted)] num shrink-0">
                {task.progress.current}/{task.progress.total}
              </span>
              <button
                type="button"
                onClick={() => onIncrementProgress(10)}
                className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] font-medium hover:bg-[var(--surface-2)] cursor-pointer"
              >
                +10
              </button>
              <button
                type="button"
                onClick={() => onIncrementProgress(40)}
                className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] font-medium hover:bg-[var(--surface-2)] cursor-pointer"
              >
                +40
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right controls: Pin button + Up/Down mobile manual sort buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onTogglePin}
          aria-label={task.pinned ? 'Unpin task' : 'Pin task to top'}
          title={task.pinned ? 'Unpin' : 'Pin to top & Dashboard'}
          className={`p-1.5 rounded-full cursor-pointer transition-opacity ${
            task.pinned
              ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'text-[var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] sm:opacity-0 sm:group-hover:opacity-100'
          }`}
        >
          <Pin className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label="Move task up"
          title="Move up"
          className="p-1 rounded-full text-[var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:!opacity-20 cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === totalCount - 1}
          aria-label="Move task down"
          title="Move down"
          className="p-1 rounded-full text-[var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:!opacity-20 cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function TasksPage() {
  const state = useStore();
  const { tasks, costs, settings, transactions, accounts } = state;

  const [view, setView] = useState<TaskViewMode>('manual');
  const [quickText, setQuickText] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const navigate = useNavigate();
  const setPayingCostId = (id: string) => navigate(`/costs?open=${id}`);

  // Edit / Add Task Sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [tTitle, setTTitle] = useState('');
  const [tPhaseId, setTPhaseId] = useState(settings.phases[0]?.id ?? 'general');
  const [tPriority, setTPriority] = useState<Priority>('must');
  const [tStatus, setTStatus] = useState<TaskStatus>('todo');
  const [tDueDate, setTDueDate] = useState<string | null>(null);
  const [tLinkedCostId, setTLinkedCostId] = useState<string>('');
  const [tPinned, setTPinned] = useState<boolean>(false);
  const [tChecklistText, setTChecklistText] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Pending tasks ordered with pinned first or manual order
  const pendingTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'done')
      .slice()
      .sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) {
          return a.pinned ? -1 : 1;
        }
        return a.order - b.order;
      });
  }, [tasks]);

  const completedTasks = useMemo(
    () => tasks.filter((t) => t.status === 'done'),
    [tasks]
  );

  const overallPct =
    tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;

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
      pinned: false,
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = pendingTasks.findIndex((t) => t.id === active.id);
    const newIdx = pendingTasks.findIndex((t) => t.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(pendingTasks, oldIdx, newIdx);
    state.reorderTasks([
      ...reordered.map((t) => t.id),
      ...completedTasks.map((t) => t.id),
    ]);
  };

  const handleMoveIndex = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= pendingTasks.length) return;
    const reordered = arrayMove(pendingTasks, idx, targetIdx);
    state.reorderTasks([
      ...reordered.map((t) => t.id),
      ...completedTasks.map((t) => t.id),
    ]);
  };

  const openNewTaskSheet = () => {
    setEditingTask(null);
    setTTitle('');
    setTPhaseId(settings.phases[0]?.id ?? 'general');
    setTPriority('must');
    setTStatus('todo');
    setTDueDate(null);
    setTLinkedCostId('');
    setTPinned(false);
    setTChecklistText('');
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
    setTPinned(Boolean(task.pinned));
    setTChecklistText(task.checklist.map((c) => c.text).join('\n'));
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

    if (editingTask) {
      state.updateTask(editingTask.id, {
        title: tTitle.trim(),
        phaseId: tPhaseId,
        priority: tPriority,
        status: tStatus,
        dueDate: tDueDate ?? undefined,
        linkedCostId: tLinkedCostId || undefined,
        pinned: tPinned,
        checklist: checklistItems,
      });
    } else {
      state.addTask({
        title: tTitle.trim(),
        phaseId: tPhaseId,
        priority: tPriority,
        status: tStatus,
        dueDate: tDueDate ?? undefined,
        linkedCostId: tLinkedCostId || undefined,
        pinned: tPinned,
        checklist: checklistItems,
      });
    }
    setSheetOpen(false);
  };


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-[26px] leading-[32px] font-semibold tracking-[-0.03em]">Tasks</h1>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] num">
              <Progress value={overallPct} variant="ring" size={24} />
              <span>
                {completedTasks.length} / {tasks.length} done
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Segmented
            ariaLabel="Task view mode"
            options={[
              { value: 'manual', label: 'Manual sort' },
              { value: 'phase', label: 'By phase' },
            ]}
            value={view}
            onChange={setView}
          />
          <Button onClick={openNewTaskSheet}>
            <Plus className="w-4 h-4" />
            Add task
          </Button>
        </div>
      </div>

      {/* Quick add input */}
      <form onSubmit={handleQuickAddSubmit} className="flex gap-2">
        <input
          type="text"
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
          placeholder="Add a task and press Enter…"
          className="flex-1 rounded-[10px] bg-[var(--surface)] border border-[var(--border)] px-3.5 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <Button type="submit" variant="secondary">
          Add
        </Button>
      </form>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="w-6 h-6" />}
          message="No tasks yet."
          actionLabel="Load starter checklist"
          onAction={() => state.loadStarterData()}
        />
      ) : view === 'manual' ? (
        <Card
          noPadding
          title="To-do"
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pendingTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                {pendingTasks.map((task, idx) => (
                  <SortableTaskRow
                    key={task.id}
                    task={task}
                    index={idx}
                    totalCount={pendingTasks.length}
                    onMoveUp={() => handleMoveIndex(idx, -1)}
                    onMoveDown={() => handleMoveIndex(idx, 1)}
                    onToggleDone={(done) => handleToggleTaskDone(task, done)}
                    onTogglePin={() =>
                      state.updateTask(task.id, { pinned: !task.pinned })
                    }
                    onEdit={() => openEditTaskSheet(task)}
                    onOpenCost={(id) => setPayingCostId(id)}
                    onIncrementProgress={(delta) => {
                      if (!task.progress) return;
                      state.updateTask(task.id, {
                        progress: {
                          ...task.progress,
                          current: Math.min(
                            task.progress.total,
                            task.progress.current + delta
                          ),
                        },
                      });
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </Card>
      ) : (
        <div className="space-y-4">
          {settings.phases.map((phase) => {
            const phaseTasks = pendingTasks.filter((t) => t.phaseId === phase.id);
            if (phaseTasks.length === 0) return null;
            return (
              <Card key={phase.id} noPadding title={phase.name}>
                <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                  {phaseTasks.map((task) => {
                    const globalIdx = pendingTasks.findIndex((p) => p.id === task.id);
                    return (
                      <SortableTaskRow
                        key={task.id}
                        task={task}
                        index={globalIdx}
                        totalCount={pendingTasks.length}
                        onMoveUp={() => handleMoveIndex(globalIdx, -1)}
                        onMoveDown={() => handleMoveIndex(globalIdx, 1)}
                        onToggleDone={(done) => handleToggleTaskDone(task, done)}
                        onTogglePin={() =>
                          state.updateTask(task.id, { pinned: !task.pinned })
                        }
                        onEdit={() => openEditTaskSheet(task)}
                        onOpenCost={(id) => setPayingCostId(id)}
                        onIncrementProgress={(delta) => {
                          if (!task.progress) return;
                          state.updateTask(task.id, {
                            progress: {
                              ...task.progress,
                              current: Math.min(
                                task.progress.total,
                                task.progress.current + delta
                              ),
                            },
                          });
                        }}
                      />
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Completed section */}
      {completedTasks.length > 0 && (
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
              <span>Completed ({completedTasks.length})</span>
            </button>
          }
        >
          {showCompleted && (
            <div className="divide-y divide-[var(--border)] border-t border-[var(--border)] opacity-70">
              {completedTasks.map((t) => (
                <div key={t.id} className="p-3 flex items-center justify-between">
                  <Checkbox
                    checked={true}
                    onChange={(done) => handleToggleTaskDone(t, done)}
                    label={t.title}
                  />
                  <button
                    type="button"
                    onClick={() => state.deleteTask(t.id)}
                    aria-label="Delete task"
                    className="text-[var(--text-muted)] hover:text-[var(--negative)] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Add / Edit Task Sheet */}
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
              className="field"
              autoFocus
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={tPinned}
              onChange={(e) => setTPinned(e.target.checked)}
            />
            Pin to top of Dashboard &amp; Tasks
          </label>

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
              className="field"
            />
          </div>
        </div>
      </Sheet>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
