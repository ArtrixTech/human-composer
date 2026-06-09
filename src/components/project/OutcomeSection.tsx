import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useMemo, useState } from "react";

import type { Outcome, ProjectGraph } from "../../types";
import { useAppStore } from "../../store/appStore";
import { AddTaskInline } from "./AddTaskInline";
import { OutcomeSectionHeader } from "./OutcomeSectionHeader";
import { TaskRow } from "./TaskRow";
import "./BranchSection.css";

export function OutcomeSection({
  branch,
  graph,
  hideDone,
}: {
  branch: Outcome;
  graph: ProjectGraph;
  hideDone: boolean;
}) {
  const topRecommendationId = useAppStore((s) => s.topRecommendationId);
  const reorderBranchTasks = useAppStore((s) => s.reorderBranchTasks);
  const [collapsed, setCollapsed] = useState(false);

  const branchTasks = useMemo(() => {
    return graph.actions
      .filter((t) => t.branchId === branch.id)
      .filter((t) => !hideDone || t.status !== "done");
  }, [graph.actions, branch.id, hideDone]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = branchTasks.map((t) => t.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = [...ids];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    void reorderBranchTasks(branch.id, next);
  };

  return (
    <section className="branch-section">
      <OutcomeSectionHeader
        branch={branch}
        tasks={graph.actions.filter((t) => t.branchId === branch.id)}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      {!collapsed && (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={branchTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="branch-section__tasks">
                {branchTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    tasks={graph.actions}
                    dependencies={graph.dependencies}
                    isRecommended={task.id === topRecommendationId}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <AddTaskInline branchId={branch.id} />
        </>
      )}
    </section>
  );
}
