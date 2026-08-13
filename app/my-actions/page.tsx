import { db } from "@/db/client";
import { listOpenTasksWithContext } from "@/db/tasks";
import { listAllProjects } from "@/db/projects";
import { todayInMexicoCity, bucketTasksByDueDate, projectsMissingNextAction } from "@/lib/my-actions";
import { MyActionsPanel } from "@/components/my-actions-panel";

export const dynamic = "force-dynamic";

export default async function MyActionsPage() {
  const openTasks = await listOpenTasksWithContext(db);
  const activeProjects = await listAllProjects(db, { archived: false });
  const today = todayInMexicoCity();
  const { overdue, dueToday, upcoming } = bucketTasksByDueDate(openTasks, today, 7);
  const missing = projectsMissingNextAction(activeProjects, openTasks);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="font-display font-bold text-4xl tracking-display">My Actions</h1>
      <MyActionsPanel overdue={overdue} dueToday={dueToday} upcoming={upcoming} missing={missing} />
    </main>
  );
}
