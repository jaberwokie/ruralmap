import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
import Platform from "./pages/Platform.tsx";
import Briefing from "./pages/Briefing.tsx";
import Auth from "./pages/Auth.tsx";
import AdminHome from "./pages/AdminHome.tsx";
import AdminUsers from "./pages/AdminUsers.tsx";
import AdminUnmappedProviders from "./pages/AdminUnmappedProviders.tsx";
import AdminMapping from "./pages/AdminMapping.tsx";
import AdminMappingProviders from "./pages/AdminMappingProviders.tsx";
import AdminMappingProviderMetadata from "./pages/AdminMappingProviderMetadata.tsx";
import AdminMappingServices from "./pages/AdminMappingServices.tsx";
import AdminMappingBehavioralHealth from "./pages/AdminMappingBehavioralHealth.tsx";
import AdminMappingVerificationQueue from "./pages/AdminMappingVerificationQueue.tsx";
import AdminMappingAuditHistory from "./pages/AdminMappingAuditHistory.tsx";
import AdminMappingImport from "./pages/AdminMappingImport.tsx";
import AdminTraining from "./pages/AdminTraining.tsx";
import NotFound from "./pages/NotFound.tsx";
import BuildFingerprint from "./components/BuildFingerprint";
import { isPublicSafeModeActive } from "./hooks/usePublicSafeMode";

const queryClient = new QueryClient();

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
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/public" element={<Index />} />
                <Route path="/share" element={<ShareHardRedirect />} />
                <Route path="/platform" element={<Platform />} />
                <Route path="/briefing" element={<Briefing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/admin" element={<AdminHome />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/unmapped-providers" element={<AdminUnmappedProviders />} />

                {/* Admin > Mapping (canonical IA) */}
                <Route path="/admin/mapping" element={<AdminMapping />} />
                <Route path="/admin/mapping/providers" element={<AdminMappingProviders />} />
                <Route path="/admin/mapping/provider-metadata" element={<AdminMappingProviderMetadata />} />
                <Route path="/admin/mapping/services" element={<AdminMappingServices />} />
                <Route path="/admin/mapping/behavioral-health" element={<AdminMappingBehavioralHealth />} />
                <Route path="/admin/mapping/verification-queue" element={<AdminMappingVerificationQueue />} />
                <Route path="/admin/mapping/audit-history" element={<AdminMappingAuditHistory />} />
                <Route path="/admin/mapping/import" element={<AdminMappingImport />} />

                {/* Admin > Training (additive; rollback by removing this line and src/pages/AdminTraining.tsx + src/pages/admin-training/) */}
                <Route path="/admin/training" element={<AdminTraining />} />

                {/* Backward-compat: keep old bookmarks alive */}
                <Route
                  path="/admin/provider-mapping-import"
                  element={<Navigate to="/admin/mapping/providers" replace />}
                />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
