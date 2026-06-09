import type { PriorityLevel, ProjectSummary } from "../../types";
import { PriorityPicker } from "../shared/PriorityPicker";
import { ProjectIcon } from "../shared/ProjectIcon";
import { PROJECT_COLORS, PROJECT_ICONS, normalizeProjectIcon } from "../../utils/projectUtils";
import "./ProjectSettingsMenu.css";

export function ProjectSettingsMenu({
  project,
  onUpdatePriority,
  onUpdateColor,
  onUpdateIcon,
  onDelete,
  onClose,
}: {
  project: ProjectSummary;
  onUpdatePriority: (p: PriorityLevel) => void;
  onUpdateColor: (color: string) => void;
  onUpdateIcon: (icon: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="project-settings-menu"
      role="menu"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="project-settings-menu__section">
        <span className="project-settings-menu__label">优先级</span>
        <PriorityPicker value={project.priority} onChange={onUpdatePriority} />
      </div>
      <div className="project-settings-menu__section">
        <span className="project-settings-menu__label">主题色</span>
        <div className="project-settings-menu__colors">
          {PROJECT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`project-settings-menu__color${project.color === color ? " project-settings-menu__color--active" : ""}`}
              style={{ background: color }}
              title={color}
              onClick={() => onUpdateColor(color)}
            />
          ))}
        </div>
      </div>
      <div className="project-settings-menu__section">
        <span className="project-settings-menu__label">图标</span>
        <div className="project-settings-menu__icons">
          {PROJECT_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              className={`project-settings-menu__icon${normalizeProjectIcon(project.icon) === icon ? " project-settings-menu__icon--active" : ""}`}
              onClick={() => onUpdateIcon(icon)}
              title={icon}
            >
              <ProjectIcon name={icon} size={14} />
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="project-settings-menu__delete" onClick={onDelete}>
        删除项目
      </button>
    </div>
  );
}
