export type PriorityLevel = "H" | "M" | "L";

export type ActionStatus = "inbox" | "pending" | "ready" | "active" | "done";
/** @deprecated Use ActionStatus */
export type TaskStatus = ActionStatus;

export type ActionType = "normal" | "external";
/** @deprecated Use ActionType */
export type TaskType = ActionType;

export type ExternalStatus = "delegated" | "needs_review" | null;
export type DayLaneType = "focus" | "watch";

export interface Project {
  id: string;
  name: string;
  sourceType: string;
  sourceRef: string | null;
  priority: PriorityLevel;
  createdAt: string;
}

export interface Outcome {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  archived: boolean;
}
/** @deprecated Use Outcome */
export type Branch = Outcome;

export interface Action {
  id: string;
  projectId: string;
  branchId: string | null;
  title: string;
  description: string;
  status: ActionStatus;
  sortOrder: number;
  pinned: boolean;
  estimatedMinutes: number | null;
  taskType: ActionType;
  externalStatus: ExternalStatus;
  externalStartedAt: string | null;
  externalCompletedAt: string | null;
  externalNote: string | null;
  priority: PriorityLevel;
  archived: boolean;
  postponed: boolean;
  createdAt: string;
  completedAt: string | null;
}
/** @deprecated Use Action */
export type Task = Action;

export interface ActionDependency {
  taskId: string;
  dependsOnTaskId: string;
}
/** @deprecated Use ActionDependency */
export type TaskDependency = ActionDependency;

export interface ProjectGraph {
  project: Project;
  outcomes: Outcome[];
  actions: Action[];
  dependencies: ActionDependency[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  activeCount: number;
  readyCount: number;
  doneCount: number;
  taskCount: number;
}

export interface ActionWithOutcome {
  action: Action;
  outcomeName: string | null;
}
/** @deprecated Use ActionWithOutcome */
export type TaskWithBranch = ActionWithOutcome;

export interface RecommendedAction {
  action: Action;
  outcomeName: string | null;
  projectId: string | null;
  projectName: string | null;
  score: number;
  blockedCount: number;
}
/** @deprecated Use RecommendedAction */
export type RecommendedTask = RecommendedAction;

export interface AppSnapshot {
  projectId: string;
  projectName: string;
  activeAction: ActionWithOutcome | null;
  readyActions: ActionWithOutcome[];
  recommendations: RecommendedAction[];
  inboxCount: number;
}

export interface TodayActionContext {
  action: Action;
  projectId: string;
  projectName: string;
  outcomeName: string | null;
}
/** @deprecated Use TodayActionContext */
export type TodayTaskContext = TodayActionContext;

export interface TodayScheduleItem {
  action: Action;
  projectId: string;
  projectName: string;
  outcomeName: string | null;
  estimatedMinutes: number;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface TimeBudget {
  remainingMinutes: number;
  availableMinutes: number;
  estimatedFinishTime: string | null;
  completedCount: number;
  remainingCount: number;
}

export interface TodaySnapshot {
  activeAction: TodayActionContext | null;
  schedule: TodayScheduleItem[];
  completedToday: TodayActionContext[];
  recommendations: RecommendedAction[];
  timeBudget: TimeBudget;
  dayEndTime: string;
}

export interface DayLane {
  id: string;
  date: string;
  name: string;
  laneType: DayLaneType;
  priorityTier: PriorityLevel;
  sortOrder: number;
  createdAt: string;
}

export interface LlmConfig {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  model: string;
}

export interface DayLaneSnapshot {
  lane: DayLane;
  actions: TodayActionContext[];
  activeActionId: string | null;
  completedCount: number;
  totalCount: number;
  estimatedFinishTime: string | null;
}

export interface DayRunwaySnapshot {
  date: string;
  lanes: DayLaneSnapshot[];
  backlog: TodayActionContext[];
  completedToday: TodayActionContext[];
  recommendations: RecommendedAction[];
  dependencies: ActionDependency[];
  timeBudget: TimeBudget;
  dayEndTime: string;
  carryOverCount: number;
  focusLaneCount: number;
}

export interface CompleteActionResult {
  completedAction: Action;
  recommendations: RecommendedAction[];
}
/** @deprecated Use CompleteActionResult */
export type CompleteTaskResult = CompleteActionResult;

export interface OutcomeSuggestion {
  branchId: string;
  branchName: string;
  confidence: number;
}
/** @deprecated Use OutcomeSuggestion */
export type BranchSuggestion = OutcomeSuggestion;

export interface CreateActionResult {
  action: Action;
  outcomeSuggestion: OutcomeSuggestion | null;
}
/** @deprecated Use CreateActionResult */
export type CreateTaskResult = CreateActionResult;

export type MainView = "today" | "project";

// --- Wire parsers (backend JSON still uses branches/tasks/branchName) ---

interface WireActionWithOutcome {
  task: Action;
  branchName: string | null;
}

interface WireRecommendedAction {
  task: Action;
  branchName: string | null;
  projectId: string | null;
  projectName: string | null;
  score: number;
  blockedCount: number;
}

interface WireTodayActionContext {
  task: Action;
  projectId: string;
  projectName: string;
  branchName: string | null;
}

interface WireProjectGraph {
  project: Project;
  branches: Outcome[];
  tasks: Action[];
  dependencies: ActionDependency[];
}

interface WireAppSnapshot {
  projectId: string;
  projectName: string;
  activeTask: WireActionWithOutcome | null;
  readyTasks: WireActionWithOutcome[];
  recommendations: WireRecommendedAction[];
  inboxCount: number;
}

interface WireDayLaneSnapshot {
  lane: DayLane;
  tasks: WireTodayActionContext[];
  activeTaskId: string | null;
  completedCount: number;
  totalCount: number;
  estimatedFinishTime: string | null;
}

interface WireDayRunwaySnapshot {
  date: string;
  lanes: WireDayLaneSnapshot[];
  backlog: WireTodayActionContext[];
  completedToday: WireTodayActionContext[];
  recommendations: WireRecommendedAction[];
  dependencies: ActionDependency[];
  timeBudget: TimeBudget;
  dayEndTime: string;
  carryOverCount: number;
  focusLaneCount: number;
}

interface WireTodaySnapshot {
  activeTask: WireTodayActionContext | null;
  schedule: Array<{
    task: Action;
    projectId: string;
    projectName: string;
    branchName: string | null;
    estimatedMinutes: number;
    scheduledStart: string;
    scheduledEnd: string;
  }>;
  completedToday: WireTodayActionContext[];
  recommendations: WireRecommendedAction[];
  timeBudget: TimeBudget;
  dayEndTime: string;
}

interface WireCompleteActionResult {
  completedTask: Action;
  recommendations: WireRecommendedAction[];
}

interface WireCreateActionResult {
  task: Action;
  branchSuggestion: OutcomeSuggestion | null;
}

function parseActionWithOutcome(w: WireActionWithOutcome): ActionWithOutcome {
  return { action: w.task, outcomeName: w.branchName };
}

function parseRecommendedAction(w: WireRecommendedAction): RecommendedAction {
  return {
    action: w.task,
    outcomeName: w.branchName,
    projectId: w.projectId,
    projectName: w.projectName,
    score: w.score,
    blockedCount: w.blockedCount,
  };
}

export function parseTodayActionContext(w: WireTodayActionContext): TodayActionContext {
  return {
    action: w.task,
    projectId: w.projectId,
    projectName: w.projectName,
    outcomeName: w.branchName,
  };
}

export function parseProjectGraph(w: WireProjectGraph): ProjectGraph {
  return {
    project: w.project,
    outcomes: w.branches,
    actions: w.tasks,
    dependencies: w.dependencies,
  };
}

export function parseAppSnapshot(w: WireAppSnapshot): AppSnapshot {
  return {
    projectId: w.projectId,
    projectName: w.projectName,
    activeAction: w.activeTask ? parseActionWithOutcome(w.activeTask) : null,
    readyActions: w.readyTasks.map(parseActionWithOutcome),
    recommendations: w.recommendations.map(parseRecommendedAction),
    inboxCount: w.inboxCount,
  };
}

export function parseDayRunwaySnapshot(w: WireDayRunwaySnapshot): DayRunwaySnapshot {
  return {
    date: w.date,
    lanes: w.lanes.map((lane) => ({
      lane: lane.lane,
      actions: lane.tasks.map(parseTodayActionContext),
      activeActionId: lane.activeTaskId,
      completedCount: lane.completedCount,
      totalCount: lane.totalCount,
      estimatedFinishTime: lane.estimatedFinishTime,
    })),
    backlog: w.backlog.map(parseTodayActionContext),
    completedToday: w.completedToday.map(parseTodayActionContext),
    recommendations: w.recommendations.map(parseRecommendedAction),
    dependencies: w.dependencies,
    timeBudget: w.timeBudget,
    dayEndTime: w.dayEndTime,
    carryOverCount: w.carryOverCount,
    focusLaneCount: w.focusLaneCount,
  };
}

export function parseTodaySnapshot(w: WireTodaySnapshot): TodaySnapshot {
  return {
    activeAction: w.activeTask ? parseTodayActionContext(w.activeTask) : null,
    schedule: w.schedule.map((item) => ({
      action: item.task,
      projectId: item.projectId,
      projectName: item.projectName,
      outcomeName: item.branchName,
      estimatedMinutes: item.estimatedMinutes,
      scheduledStart: item.scheduledStart,
      scheduledEnd: item.scheduledEnd,
    })),
    completedToday: w.completedToday.map(parseTodayActionContext),
    recommendations: w.recommendations.map(parseRecommendedAction),
    timeBudget: w.timeBudget,
    dayEndTime: w.dayEndTime,
  };
}

export function parseCompleteActionResult(w: WireCompleteActionResult): CompleteActionResult {
  return {
    completedAction: w.completedTask,
    recommendations: w.recommendations.map(parseRecommendedAction),
  };
}

export function parseCreateActionResult(w: WireCreateActionResult): CreateActionResult {
  return {
    action: w.task,
    outcomeSuggestion: w.branchSuggestion,
  };
}
