import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseWithAuth(request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  return createClient(
    "https://jdvbfixrwhtwolbhwrzb.supabase.co",
    "sb_publishable_uiHYPsJomoaKXYQi_QOSPg_dmI6CYKd",
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}
  );
}

export async function GET(request) {
  const supabase = getSupabaseWithAuth(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, data, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data });
}

export async function POST(request) {
  const supabase = getSupabaseWithAuth(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, projectData, projectId } = body;
  if (!projectData) return NextResponse.json({ error: "projectData required" }, { status: 400 });

  if (projectId) {
    // Update existing
    const { data, error } = await supabase
      .from("projects")
      .update({ name: name || projectData.name, data: projectData, updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ project: data });
  }

  // Insert new
  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name: name || projectData.name, data: projectData })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}

export async function DELETE(request) {
  const supabase = getSupabaseWithAuth(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("projects").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
