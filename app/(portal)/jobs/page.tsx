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

  // Unlike sites, this log is shared by design — the whole point is that a job
  // number is agreed without an email — so staff write it here too, provided a
  // customer is selected so we know whose log it is.
  const canWrite = isAgency
    ? !!scope.customerId
    : profile?.customer_role !== "viewer" && !!profile?.customer_id;

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

      {isAgency && !scope.customerId && (
        <div className="panel">
          <div className="notice-warn">
            Choose a customer in the preview bar to see and add to their job
            log. Without one this is every customer&apos;s jobs at once.
          </div>
        </div>
      )}

      <JobLog
        jobs={jobs ?? []}
        canWrite={canWrite}
        customerId={isAgency ? (scope.customerId ?? undefined) : undefined}
      />
    </>
  );
}
