// Server function to load a publicly-shared project by share_token.
// Uses the admin client to bypass RLS but only returns rows where is_public = true.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const fetchSharedProject = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("projects")
      .select(
        "id,name,address,start_date,finish_date,notes,snapshot,is_public,share_token,updated_at",
      )
      .eq("share_token", data.token)
      .eq("is_public", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Shared project not found or no longer public");
    return row;
  });
