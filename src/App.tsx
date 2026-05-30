import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import MetricsTracker from "@/components/MetricsTracker";
import BuildFingerprint from "./components/BuildFingerprint";
import { isPublicSafeModeActive } from "./hooks/usePublicSafeMode";
import Index from "./pages/Index.tsx";

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen bg-background text-foreground flex items-center justify-center" aria-label="Loading page">
    <div className="text-sm font-medium text-muted-foreground">Loading…</div>
  </div>
);


const Platform = lazy(() => import("./pages/Platform.tsx"));
const Briefing = lazy(() => import("./pages/Briefing.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const AdminHome = lazy(() => import("./pages/AdminHome.tsx"));
const AdminUsers = lazy(() => import("./pages/AdminUsers.tsx"));
const AdminUnmappedProviders = lazy(() => import("./pages/AdminUnmappedProviders.tsx"));
const AdminMapping = lazy(() => import("./pages/AdminMapping.tsx"));
const AdminMappingProviders = lazy(() => import("./pages/AdminMappingProviders.tsx"));
const AdminMappingProviderMetadata = lazy(() => import("./pages/AdminMappingProviderMetadata.tsx"));
const AdminMappingServices = lazy(() => import("./pages/AdminMappingServices.tsx"));
const AdminMappingBehavioralHealth = lazy(() => import("./pages/AdminMappingBehavioralHealth.tsx"));
const AdminMappingVerificationQueue = lazy(() => import("./pages/AdminMappingVerificationQueue.tsx"));
const AdminMappingAuditHistory = lazy(() => import("./pages/AdminMappingAuditHistory.tsx"));
const AdminMappingPipelineAudit = lazy(() => import("./pages/AdminMappingPipelineAudit.tsx"));
const AdminMappingImport = lazy(() => import("./pages/AdminMappingImport.tsx"));
const AdminMappingFacilities = lazy(() => import("./pages/AdminMappingFacilities"));
const AdminMappingRuralServices = lazy(() => import("./pages/AdminMappingRuralServices"));
const AdminMappingFacilitiesStaging = lazy(() => import("./pages/AdminMappingFacilitiesStaging"));
const AdminMappingRuralServicesStaging = lazy(() => import("./pages/AdminMappingRuralServicesStaging"));
const AdminMappingBehavioralHealthLive = lazy(() => import("./pages/AdminMappingBehavioralHealthLive.tsx"));
const AdminTraining = lazy(() => import("./pages/AdminTraining.tsx"));
const AdminGeocodeReview = lazy(() => import("./pages/AdminGeocodeReview.tsx"));
const AdminMetrics = lazy(() => import("./pages/AdminMetrics.tsx"));
const AdminOpsAccess = lazy(() => import("./pages/AdminOpsAccess.tsx"));
const OpsHome = lazy(() => import("./pages/OpsHome.tsx"));
const OpsDataCapture = lazy(() => import("./pages/OpsDataCapture.tsx"));
const OpsActivityLog = lazy(() => import("./pages/OpsActivityLog.tsx"));
const SysOpHome = lazy(() => import("./pages/SysOpHome.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const APP_VERSION = 'public-sharing-v2';

// Bare /share has no static raw-HTML representation on Lovable's host
// (SPA fallback intercepts extensionless paths before directory-index
// resolution). Force a hard browser navigation to /share.html so the
// static file actually loads instead of falling through to NotFound.
const ShareHardRedirect = () => {
  useEffect(() => {
    window.location.replace('/share.html');
  }, []);
  return null;
};

const App = () => {
  useEffect(() => {
    if (!isPublicSafeModeActive()) return;
    try {
      const storedVersion = sessionStorage.getItem('app_version');
      if (storedVersion !== APP_VERSION) {
        sessionStorage.setItem('app_version', APP_VERSION);
        window.location.reload();
      }
    } catch {
      // sessionStorage unavailable (private mode, etc.) — skip silently
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <Toaster />
            <Sonner />
            {!isPublicSafeModeActive() && <BuildFingerprint />}
            <BrowserRouter>
            <AuthProvider>
              <MetricsTracker />
              <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/public" element={<Index />} />
                <Route path="/share" element={<ShareHardRedirect />} />
                <Route path="/platform" element={<Platform />} />
                <Route path="/briefing" element={<Briefing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/admin" element={<AdminHome />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/ops-access" element={<AdminOpsAccess />} />
                <Route path="/admin/unmapped-providers" element={<AdminUnmappedProviders />} />
                <Route path="/admin/geocode-review" element={<AdminGeocodeReview />} />

                {/* Admin > Mapping (canonical IA) */}
                <Route path="/admin/mapping" element={<AdminMapping />} />
                <Route path="/admin/mapping/providers" element={<AdminMappingProviders />} />
                <Route path="/admin/mapping/provider-metadata" element={<AdminMappingProviderMetadata />} />
                <Route path="/admin/mapping/services" element={<AdminMappingServices />} />
                <Route path="/admin/mapping/behavioral-health" element={<AdminMappingBehavioralHealth />} />
                <Route path="/admin/mapping/verification-queue" element={<AdminMappingVerificationQueue />} />
                <Route path="/admin/mapping/audit-history" element={<AdminMappingAuditHistory />} />
                <Route path="/admin/mapping/pipeline-audit" element={<AdminMappingPipelineAudit />} />
                <Route path="/admin/mapping/import" element={<AdminMappingImport />} />
                <Route path="/admin/mapping/facilities" element={<AdminMappingFacilities />} />
                <Route path="/admin/mapping/rural-services" element={<AdminMappingRuralServices />} />
                <Route path="/admin/mapping/facilities-staging" element={<AdminMappingFacilitiesStaging />} />
                <Route path="/admin/mapping/rural-services-staging" element={<AdminMappingRuralServicesStaging />} />
                <Route path="/admin/mapping/behavioral-health-live" element={<AdminMappingBehavioralHealthLive />} />

                {/* Admin > Metrics */}
                <Route path="/admin/metrics" element={<AdminMetrics />} />

                {/* Admin > Training (additive; rollback by removing this line and src/pages/AdminTraining.tsx + src/pages/admin-training/) */}
                <Route path="/admin/training" element={<AdminTraining />} />

                {/* Field Ops */}
                <Route path="/ops" element={<OpsHome />} />
                <Route path="/ops/data-capture" element={<OpsDataCapture />} />
                <Route path="/ops/activity" element={<OpsActivityLog />} />

                {/* SysOp recovery console */}
                <Route path="/sysop" element={<SysOpHome />} />

                {/* Backward-compat: keep old bookmarks alive */}
                <Route
                  path="/admin/provider-mapping-import"
                  element={<Navigate to="/admin/mapping/providers" replace />}
                />

                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
