import { createClient } from "@/lib/supabase/server";
import { getPortalScope } from "@/lib/preview";
import { getProfile } from "@/lib/auth";
import { JobLog, type Job } from "@/components/job-log";

export default async function JobLogPage() {
  const supabase = await createClient();
  const profile = await getProfile();
  const scope = await getPortalScope();

  const only = <T,>(q: T): T =>
    scope.customerId
      ? ((q as { eq: (c: string, v: string) => T }).eq(
          "customer_id",
          scope.customerId,
        ) as T)
      : q;

  const { data: jobs } = await only(
    supabase.from("customer_jobs").select("*").is("deleted_at", null),
  )
    .order("status")
    .order("job_number", { ascending: false })
    .returns<Job[]>();

  const isAgency = profile?.user_type === "agency";
  // Staff read the log here but write it from the console, so the customer's
  // own screens stay the customer's record of what they did.
  const canWrite =
    !isAgency && profile?.customer_role !== "viewer" && !!profile?.customer_id;

  return (
    <>
      <div className="panel-head" style={{ marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 24 }}>Job information log</h2>
          <div className="sub">
            Your jobs, their numbers and site details — visible to US Trades so
            a job number does not have to travel by email.
          </div>
        </div>
      </div>

      <JobLog jobs={jobs ?? []} canWrite={canWrite} />
    </>
  );
}
