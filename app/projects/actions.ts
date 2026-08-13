"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { createClient } from "@/lib/supabase/server";
import { archiveProject, restoreProject } from "@/db/projects";
import { runCreateProject, runUpdateProject, runMoveProjectStage } from "@/lib/project-mutations";
import { runCreateNote } from "@/lib/activity-mutations";
import { runCreateTask, runCompleteTask } from "@/lib/task-mutations";
import type { ActionResult } from "@/lib/company-mutations";

const idSchema = z.string().uuid();

export async function createProjectAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const result = await runCreateProject(db, formData, user?.id ?? null);
  if (result.ok) {
    revalidatePath("/projects");
    const companyId = idSchema.safeParse(formData.get("companyId"));
    if (companyId.success) revalidatePath(`/companies/${companyId.data}`);
  }
  return result;
}

export async function updateProjectAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const result = await runUpdateProject(db, formData, user?.id ?? null);
  if (result.ok) {
    revalidatePath("/projects");
    const id = formData.get("id");
    if (typeof id === "string" && id.length > 0) revalidatePath(`/projects/${id}`);
    const companyId = idSchema.safeParse(formData.get("companyId"));
    if (companyId.success) revalidatePath(`/companies/${companyId.data}`);
  }
  return result;
}

export async function archiveProjectAction(formData: FormData): Promise<void> {
  const id = idSchema.safeParse(formData.get("id"));
  if (id.success) await archiveProject(db, id.data);
  revalidatePath("/projects");
  redirect(id.success ? `/projects/${id.data}` : "/projects");
}

export async function restoreProjectAction(formData: FormData): Promise<void> {
  const id = idSchema.safeParse(formData.get("id"));
  if (id.success) await restoreProject(db, id.data);
  revalidatePath("/projects");
  redirect(id.success ? `/projects/${id.data}` : "/projects");
}

export async function createNoteAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const result = await runCreateNote(db, formData, user?.id ?? null);
  if (result.ok) {
    const projectId = idSchema.safeParse(formData.get("projectId"));
    if (projectId.success) revalidatePath(`/projects/${projectId.data}`);
  }
  return result;
}

export async function createTaskAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const result = await runCreateTask(db, formData, user?.id ?? null);
  if (result.ok) {
    const projectId = idSchema.safeParse(formData.get("projectId"));
    if (projectId.success) revalidatePath(`/projects/${projectId.data}`);
  }
  return result;
}

export async function completeTaskAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await runCompleteTask(db, formData, user?.id ?? null);
  const projectId = idSchema.safeParse(formData.get("projectId"));
  if (projectId.success) revalidatePath(`/projects/${projectId.data}`);
}

export async function moveStageAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await runMoveProjectStage(db, formData, user?.id ?? null);
  revalidatePath("/pipeline");
  const projectId = idSchema.safeParse(formData.get("projectId"));
  if (projectId.success) revalidatePath(`/projects/${projectId.data}`);
}
