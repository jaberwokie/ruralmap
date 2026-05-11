import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import OperationalReachDisclaimer from '@/components/OperationalReachDisclaimer';
import qrLaunchImage from '@/assets/nevada_rural_access_operations_qr.png';
import opsframeLogo from '@/assets/opsframe-logo.svg';

const CAPABILITIES: { title: string; body: string }[] = [
  {
    title: 'Access Viability Modeling',
    body: 'Evaluates whether nearby resources can realistically be used given distance, verification, and field conditions.',
  },
  {
    title: 'Response Capability Visibility',
    body: 'Surfaces where field response is strong, conditional, or remote-only across rural geography.',
  },
  {
    title: 'Transportation Feasibility Context',
    body: 'Combines corridor presence and local mobility signals to flag transportation friction.',
  },
  {
    title: 'Field Coordination Support',
    body: 'Provides operational context for staff deployment, hub reach, and outreach planning.',
  },
  {
    title: 'Operational Access Constraint Detection',
    body: 'Identifies regions where operational reach is limited or unavailable under current conditions.',
  },
  {
    title: 'Publication-Safe Operational Visibility',
    body: 'External-facing operational view that preserves framing without exposing internal controls.',
  },
];

const TRADITIONAL: string[] = [
  'Show resource locations',
  'Emphasize visualization',
  'Static coverage assumptions',
  'Limited operational context',
];

const OPERATIONAL: string[] = [
  'Evaluates operational viability',
  'Models response conditions',
  'Supports routing and coordination',
  'Incorporates staffing and field reach realities',
  'Supports external-facing coordination',
];

const WORKFLOW_STEPS: string[] = [
  'Review response capability',
  'Evaluate transportation feasibility',
  'Review provider access infrastructure',
  'Assess connectivity conditions',
  'Determine actionable coordination path',
];

const ARCHITECTURE_STAGES: string[] = [
  'Verified access data',
  'Operational overlays',
  'Access viability modeling',
  'Coordination and routing support',
  'Publication-safe stakeholder visibility',
];

const PUBLIC_SAFE_POINTS: string[] = [
  'External-facing operational review without exposing internal administrative tooling',
  'Supports stakeholder coordination while preserving governance boundaries',
  'Separates operational visibility from internal control systems',
  'Enables safer public and partner-facing operational context review',
];

const AUDIENCES: string[] = [
  'Medicaid agencies',
  'Managed care organizations',
  'Rural behavioral health operations',
  'Crisis response coordination',
  'Housing and outreach systems',
  'Rural field deployment planning',
];

const PROBLEM_POINTS: string[] = [
  'Rural access is not purely geographic.',
  'Distance alone does not determine viability.',
  'Theoretical network adequacy differs from operational access.',
  'Transportation, staffing reach, response capability, and connectivity constraints shape coordination reality.',
  'Most systems show locations. Few show operational conditions.',
];

const SectionHeader = ({
  eyebrow,
  heading,
}: {
  eyebrow?: string;
  heading: string;
}) => (
  <div className="space-y-1.5">
    {eyebrow ? (
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {eyebrow}
      </p>
    ) : null}
    <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
      {heading}
    </h2>
  </div>
);

const PendingCapture = ({ label }: { label: string }) => (
  <div className="flex h-40 w-full items-center justify-center rounded-md border border-border bg-muted/20 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
    {label}
  </div>
);

const Briefing = () => {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Operational Briefing — Nevada Rural Access Operations';
    return () => {
      document.title = prevTitle;
    };
  }, []);

  return (
    <main
      className="min-h-screen bg-background"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto max-w-4xl px-5 pb-12 pt-8 md:py-14">
        {/* Persistent return-to-operations link */}
        <div className="mb-6 flex items-center justify-between text-[11px]">
          <Link
            to="/"
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            ← Return to Operations
          </Link>
          <Link
            to="/platform"
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            View platform overview →
          </Link>
        </div>

        {/* Cover */}
        <section className="space-y-4 border-b border-border pb-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Operational briefing
          </p>
          <h1 className="text-3xl font-semibold leading-[1.15] tracking-tight text-foreground md:text-4xl">
            Nevada Rural Access Operations
          </h1>
          <p className="text-[15px] font-medium leading-relaxed text-foreground/85 md:text-[16px]">
            Operational Decision Infrastructure for Rural Medicaid Access
          </p>
          <p className="max-w-2xl text-[14px] leading-relaxed text-foreground/70">
            Supporting operational access decisions across rural healthcare, behavioral health,
            crisis response, and field coordination environments.
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            Operational views to be included before external distribution.
          </p>
        </section>

        <div className="space-y-12 pt-10">
          {/* Section 2 — The operational problem */}
          <section className="space-y-6">
            <SectionHeader heading="The operational problem" />
            <ul className="space-y-2.5">
              {PROBLEM_POINTS.map((p) => (
                <li
                  key={p}
                  className="flex gap-3 text-[14px] leading-relaxed text-foreground/85"
                >
                  <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-foreground/50" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <p className="border-l-2 border-border pl-4 text-[14px] font-medium italic leading-relaxed text-foreground/80">
              Coverage on paper is not the same as access in practice.
            </p>
            <PendingCapture label="Operational context view pending — response capability and access constraints" />
          </section>

          {/* Section 3 — What this platform is */}
          <section className="space-y-6">
            <SectionHeader heading="What this platform is" />
            <p className="max-w-3xl text-[14px] leading-relaxed text-foreground/85">
              Nevada Rural Access Operations is operational decision infrastructure for evaluating
              what can be coordinated under current rural access conditions.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CAPABILITIES.map((c) => (
                <Card key={c.title} className="h-full">
                  <CardHeader className="space-y-1.5 p-4">
                    <CardTitle className="text-[14px] font-semibold leading-tight">
                      {c.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-[13px] leading-relaxed text-foreground/80">{c.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Section 4 — Category distinction */}
          <section className="space-y-6">
            <SectionHeader
              
              heading="What makes this different from traditional mapping and directory systems"
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Card className="h-full">
                <CardHeader className="space-y-1.5 p-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Traditional
                  </p>
                  <CardTitle className="text-[14px] font-semibold leading-tight">
                    Mapping and directory systems
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <ul className="space-y-2">
                    {TRADITIONAL.map((t) => (
                      <li key={t} className="flex gap-2 text-[13px] leading-relaxed text-foreground/80">
                        <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card className="h-full">
                <CardHeader className="space-y-1.5 p-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    This environment
                  </p>
                  <CardTitle className="text-[14px] font-semibold leading-tight">
                    Operational decision infrastructure
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <ul className="space-y-2">
                    {OPERATIONAL.map((o) => (
                      <li key={o} className="flex gap-2 text-[13px] leading-relaxed text-foreground/80">
                        <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
                        <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Section 5 — Operational workflow */}
          <section className="space-y-6">
            <SectionHeader heading="Operational workflow example" />
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Scenario · Remote rural behavioral health coordination
            </p>
            <ol className="space-y-2">
              {WORKFLOW_STEPS.map((step, i) => (
                <li
                  key={step}
                  className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5"
                >
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-medium text-foreground">
                    {i + 1}
                  </span>
                  <span className="text-[13px] leading-relaxed text-foreground/85">{step}</span>
                </li>
              ))}
            </ol>
            <PendingCapture label="Operational example view pending — county detail with transportation and connectivity context" />
          </section>

          {/* Section 6 — Operational architecture */}
          <section className="space-y-6">
            <SectionHeader heading="Operational architecture" />
            <div className="rounded-md border border-border bg-card p-5">
              <ol className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
                {ARCHITECTURE_STAGES.map((stage, i, arr) => (
                  <li key={stage} className="flex items-center gap-2">
                    <span className="text-[13px] font-medium leading-tight text-foreground/85">
                      {stage}
                    </span>
                    {i < arr.length - 1 ? (
                      <span aria-hidden className="text-muted-foreground">→</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              The system is structured as operational infrastructure rather than a standalone
              visualization environment.
            </p>
          </section>

          {/* Section 7 — Publication-safe operational visibility */}
          <section className="space-y-6">
            <SectionHeader heading="Publication-safe operational visibility" />
            <ul className="space-y-2.5">
              {PUBLIC_SAFE_POINTS.map((p) => (
                <li
                  key={p}
                  className="flex gap-3 text-[14px] leading-relaxed text-foreground/85"
                >
                  <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-foreground/50" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <PendingCapture label="Publication-safe operational view pending" />
          </section>

          {/* Section 8 — Operational use environments */}
          <section className="space-y-6">
            <SectionHeader heading="Operational use environments" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {AUDIENCES.map((a) => (
                <Card key={a} className="h-full">
                  <CardContent className="p-4">
                    <p className="text-[13px] font-medium leading-tight text-foreground/85">{a}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Core distinction */}
          <section className="space-y-6 border-y border-border py-10 text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Core distinction
            </p>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  A normal map asks
                </p>
                <p className="text-xl font-semibold leading-snug tracking-tight text-foreground/70 md:text-2xl">
                  &ldquo;Where are resources located?&rdquo;
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Nevada Rural Access Operations asks
                </p>
                <p className="text-xl font-semibold leading-snug tracking-tight text-foreground md:text-2xl">
                  &ldquo;What is operationally actionable under current conditions?&rdquo;
                </p>
              </div>
            </div>
          </section>

          {/* Section 10 — Launch environment */}
          <section className="space-y-6">
            <SectionHeader heading="Nevada Rural Access Operations" />
            <p className="max-w-2xl text-[14px] leading-relaxed text-foreground/80">
              Operational decision infrastructure for rural Medicaid access coordination.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card className="h-full">
                <CardContent className="space-y-2 p-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    QR code
                  </p>
                  <div className="flex flex-col items-center gap-2">
                    <img
                      src={qrLaunchImage}
                      alt="QR code linking to the live Nevada Rural Access Operations environment"
                      width={140}
                      height={140}
                      className="h-auto w-[140px] max-w-full rounded-sm border border-border bg-background"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <p className="text-[11px] leading-tight text-muted-foreground">
                      Launch operational environment
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="h-full">
                <CardContent className="space-y-2 p-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    URL
                  </p>
                  <a
                    href="https://ruralmap.opsframe.io"
                    target="_blank"
                    rel="noreferrer"
                    className="block text-[13px] font-medium leading-tight text-foreground/85 underline-offset-2 hover:underline"
                  >
                    ruralmap.opsframe.io
                  </a>
                </CardContent>
              </Card>
              <Card className="h-full">
                <CardContent className="space-y-2 p-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Contact
                  </p>
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] font-medium leading-tight text-foreground/85">
                    <span>Maurice Cloutier ·</span>
                    <a
                      href="https://www.opsframe.io"
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label="OpsFrame.io"
                      className="inline-flex items-center gap-1.5 text-foreground/85 no-underline hover:text-foreground"
                    >
                      <img
                        src={opsframeLogo}
                        alt=""
                        aria-hidden="true"
                        className="inline-block h-[22px] w-[22px] shrink-0 rounded-[3px]"
                      />
                      <span className="font-semibold tracking-tight">OpsFrame<span className="text-foreground/55">.io</span></span>
                    </a>
                  </p>
                  <a
                    href="mailto:maurice@opsframe.io"
                    className="block text-[12px] leading-tight text-foreground/70 underline-offset-2 hover:text-foreground hover:underline"
                  >
                    maurice@opsframe.io
                  </a>
                </CardContent>
              </Card>
            </div>
            <div className="flex flex-col items-start gap-3 pt-4">
              <Button asChild size="lg" variant="outline">
                <Link to="/">Launch Rural Access Operations</Link>
              </Button>
              <OperationalReachDisclaimer />
              <Link
                to="/platform"
                className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                View platform overview
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};

export default Briefing;
