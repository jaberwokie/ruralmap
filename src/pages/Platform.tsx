import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const CAPABILITIES: { title: string; body: string }[] = [
  {
    title: 'Access Viability Modeling',
    body: 'Evaluates whether nearby resources can realistically be used given distance, verification, and field conditions.',
  },
  {
    title: 'Response Capability Review',
    body: 'Surfaces where field response is strong, conditional, or remote-only across rural geography.',
  },
  {
    title: 'Field Coordination Support',
    body: 'Provides operational context for staff deployment, hub reach, and outreach planning.',
  },
  {
    title: 'Transportation Feasibility Context',
    body: 'Combines corridor presence and local mobility signals to flag transportation friction.',
  },
  {
    title: 'Behavioral Health Capacity Visibility',
    body: 'Highlights behavioral health access points and capacity context where available.',
  },
  {
    title: 'Provider Access Infrastructure',
    body: 'Verified hospitals, clinics, and service nodes treated as operational access points, not pins.',
  },
  {
    title: 'Operational Access Constraint Detection',
    body: 'Identifies regions where operational reach is limited or unavailable under current conditions.',
  },
  {
    title: 'Publication-Safe Operational View',
    body: 'A redacted external view that preserves operational framing without exposing payer-sensitive context.',
  },
];

const AUDIENCES: { title: string; body: string }[] = [
  {
    title: 'Medicaid agencies',
    body: 'Review rural access viability and coordination constraints across counties and tribal jurisdictions.',
  },
  {
    title: 'Managed care organizations',
    body: 'Assess network reach, response capability, and member-level access feasibility.',
  },
  {
    title: 'Providers',
    body: 'Understand where operational reach exists and where coordination gaps require alternative routing.',
  },
  {
    title: 'Rural field teams',
    body: 'Plan deployment and outreach around verified access points and field coverage reach.',
  },
  {
    title: 'Crisis and housing systems',
    body: 'Identify viable coordination paths in regions with limited in-person capacity.',
  },
];

const Section = ({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-3">
    <h2 className="text-xl font-semibold tracking-tight text-foreground">{heading}</h2>
    <div className="space-y-3 text-[14px] leading-relaxed text-foreground/85">{children}</div>
  </section>
);

const Platform = () => {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Operational Decision Infrastructure for Rural Medicaid Access';
    return () => {
      document.title = prevTitle;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-5 py-12 md:py-16">
        {/* Hero */}
        <header className="mb-12 space-y-4">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Nevada Rural Access Operations
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground md:text-4xl">
            Operational Decision Infrastructure for Rural Medicaid Access
          </h1>
          <p className="text-[14px] leading-relaxed text-foreground/80">
            The spatial interface is not the product. It is the operational surface of a decision
            infrastructure system built to evaluate rural access, response capability, field reach,
            transportation feasibility, service capacity, and coordination constraints.
          </p>
        </header>

        <div className="space-y-12">
          {/* 1. Category Definition */}
          <Section heading="What this system is">
            <p className="font-medium text-foreground">
              Operational decision infrastructure for rural Medicaid access.
            </p>
            <p>
              It helps teams move beyond theoretical coverage by evaluating what is realistically
              actionable across rural geography, verified access points, field response reach,
              transportation feasibility, connectivity context, access constraints, and operational
              routing conditions.
            </p>
          </Section>

          {/* 2. What It Is Not */}
          <Section heading="What this system is not">
            <p>
              It is not a GIS demo, dashboard toy, or static visualization project. Traditional
              mapping tools show where resources are located. This environment supports decisions
              about what can actually be coordinated under real-world operational constraints.
            </p>
          </Section>

          {/* 3. Operational Capabilities */}
          <Section heading="Operational capabilities">
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
          </Section>

          {/* 4. Decision Hierarchy */}
          <Section heading="From data to operational decision">
            <ol className="space-y-2">
              {[
                'Verified access data',
                'Operational overlays',
                'Access viability modeling',
                'Routing and coordination decisions',
                'Publication-safe stakeholder view',
              ].map((step, i, arr) => (
                <li
                  key={step}
                  className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5"
                >
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-medium text-foreground">
                    {i + 1}
                  </span>
                  <span className="text-[13px] leading-relaxed text-foreground/85">
                    {step}
                    {i < arr.length - 1 ? <span className="ml-2 text-muted-foreground">→</span> : null}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              The system is designed to support action under constraint, not simply display
              information.
            </p>
          </Section>

          {/* 5. Audience Framing */}
          <Section heading="Built for operational stakeholders">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {AUDIENCES.map((a) => (
                <Card key={a.title} className="h-full">
                  <CardHeader className="space-y-1.5 p-4">
                    <CardTitle className="text-[14px] font-semibold leading-tight">
                      {a.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-[13px] leading-relaxed text-foreground/80">{a.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Section>

          {/* 6. Core distinction */}
          <Section heading="The platform answers a different question">
            <p>
              <span className="font-medium text-foreground">A normal map asks:</span> Where are
              resources located?
            </p>
            <p>
              <span className="font-medium text-foreground">This operational environment asks:</span>{' '}
              What is realistically actionable from here, with the resources, staff reach,
              transportation conditions, and access constraints currently known?
            </p>
          </Section>

          {/* CTA */}
          <div className="flex flex-col items-start gap-3 border-t border-border pt-8">
            <Button asChild size="lg">
              <Link to="/">Launch Rural Access Operations</Link>
            </Button>
            <p className="text-[12px] text-muted-foreground">
              Operational reach is contextual. This environment supports coordination decisions; it
              does not guarantee access, availability, or transportation continuity.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Platform;
