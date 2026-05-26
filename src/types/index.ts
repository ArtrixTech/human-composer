export type TaskStatus = 'inbox' | 'pending' | 'ready' | 'active' | 'done';

export interface Project {
  id: string;
  name: string;
  source_type: string;
  source_ref: string | null;
  created_at: string;
}

export interface Branch {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  archived: boolean;
}

export interface Task {
  id: string;
  branch_id: string | null;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  sort_order: number;
  created_at: string;
  completed_at: string | null;
}
