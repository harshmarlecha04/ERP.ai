import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ui/theme-provider";

// Lazy-loaded pages
const Auth = lazy(() => import("@/pages/Auth"));
const CompanyOnboarding = lazy(() => import("@/pages/CompanyOnboarding"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Profile = lazy(() => import("@/pages/Profile"));
const PurchaseOrders = lazy(() => import("@/pages/PurchaseOrders"));
const Inventory = lazy(() => import("@/pages/Inventory"));
const Formula = lazy(() => import("@/pages/Formula"));
const FormulaViewTemplate = lazy(() => import("@/components/formula/FormulaViewTemplate"));
const Production = lazy(() => import("@/pages/Production"));
const Quality = lazy(() => import("@/pages/Quality"));
const Packaging = lazy(() => import("@/pages/Packaging"));
const Forecasting = lazy(() => import("@/pages/Forecasting"));
const Vendor = lazy(() => import("@/pages/Supplier"));
const Maintenance = lazy(() => import("@/pages/Maintenance"));
const Users = lazy(() => import("@/pages/Users"));
const ArchivedMaterials = lazy(() => import("@/pages/ArchivedMaterials"));
const ActivityTracker = lazy(() => import("@/pages/ActivityTracker"));
const MaterialRequirements = lazy(() => import("@/pages/MaterialRequirements"));
const Profitability = lazy(() => import("@/pages/Profitability"));
const Orders = lazy(() => import("@/pages/Orders"));
const OrderDetail = lazy(() => import("@/pages/OrderDetail"));
const OrderApprovalReview = lazy(() => import("@/pages/OrderApprovalReview"));
const CustomersNew = lazy(() => import("@/pages/CustomersNew"));
const CustomerDetail = lazy(() => import("@/pages/CustomerDetail"));
const OfficeSupplies = lazy(() => import("@/pages/OfficeSupplies"));
const SubmitInquiry = lazy(() => import("@/pages/SubmitInquiry"));
const Inquiries = lazy(() => import("@/pages/Inquiries"));
const CommunicationHub = lazy(() => import("@/pages/CommunicationHub"));
const RDProjects = lazy(() => import("@/pages/RDProjects"));
const MVPVersion1 = lazy(() => import("@/pages/MVPVersion1"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
const Quoting = lazy(() => import("@/pages/Quoting"));
const CustomerInvoicing = lazy(() => import("@/pages/CustomerInvoicing"));
const Assistant = lazy(() => import("@/pages/Assistant"));
const ProductionCosts = lazy(() => import("@/pages/ProductionCosts"));
const ProjectsList = lazy(() => import("@/pages/projects/ProjectsList"));
const Tasks = lazy(() => import("@/pages/Tasks"));
const LabelReview = lazy(() => import("@/pages/agents/LabelReview"));
const Documents = lazy(() => import("@/pages/Documents"));
const Reports = lazy(() => import("@/pages/Reports"));
const Shipping = lazy(() => import("@/pages/Shipping"));
const LaunchDashboard = lazy(() => import("@/pages/launch/LaunchDashboard"));
const LaunchWork = lazy(() => import("@/pages/launch/LaunchWork"));
const LaunchTimeline = lazy(() => import("@/pages/launch/LaunchTimeline"));
const SupplementFactsTool = lazy(() => import("@/pages/tools/SupplementFactsTool"));

const LaunchProjectDetail = lazy(() => import("@/pages/launch/LaunchProjectDetail"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const ReceiveScan = lazy(() => import("@/pages/ReceiveScan"));

// Customer Portal
const PortalAuth = lazy(() => import("@/pages/portal/PortalAuth"));
const PortalSettings = lazy(() => import("@/pages/portal/PortalSettings"));
const PortalPurchaseOrders = lazy(() => import("@/pages/portal/PortalPurchaseOrders"));
const PortalNewPO = lazy(() => import("@/pages/portal/PortalNewPO"));
const PortalPODetail = lazy(() => import("@/pages/portal/PortalPODetail"));
const PortalSchedule = lazy(() => import("@/pages/portal/PortalSchedule"));
const PortalLabelInventory = lazy(() => import("@/pages/portal/PortalLabelInventory"));
const PortalDocumentation = lazy(() => import("@/pages/portal/PortalDocumentation"));
const PortalTeam = lazy(() => import("@/pages/portal/PortalTeam"));
const OnboardingWizard = lazy(() => import("@/pages/portal/onboarding/OnboardingWizard"));
const PortalResetPassword = lazy(() => import("@/pages/portal/PortalResetPassword"));
import { CustomerRoute } from "@/components/portal/CustomerRoute";
import { CustomerPortalLayout } from "@/layouts/CustomerPortalLayout";
import { useAuth } from "@/hooks/useAuth";

/** Root gate: signed in → dashboard, otherwise show Employee Auth. */
const CompanyRootGate = () => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Auth />;
};

// Optimized React Query client with better caching strategy
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
      refetchOnReconnect: true,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

import { useParams } from "react-router-dom";
const LegacyProjectRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/projects/${id}`} replace />;
};



/** Redirects to first-run company setup until it has been completed. */
const CompanySetupGate = ({ children }: { children: React.ReactNode }) => {
  const { settings, loading } = useCompanySettings();
  if (!loading && !settings?.setup_complete) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
};

/** Layout route wrapper for all protected pages */
const ProtectedLayout = () => (
  <ProtectedRoute>
    <CompanySetupGate>
      <Layout>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </Layout>
    </CompanySetupGate>
  </ProtectedRoute>
);

/** Company / staff route tree (mounted on every host). */
const CompanyRoutes = () => (
  <Routes>
    {/* Public routes */}
    <Route path="/auth" element={<Auth />} />
    <Route path="/onboarding" element={
      <ProtectedRoute>
        <Suspense fallback={<PageLoader />}>
          <CompanyOnboarding />
        </Suspense>
      </ProtectedRoute>
    } />
    <Route path="/submit-inquiry" element={<SubmitInquiry />} />
    <Route path="/portal/auth" element={<PortalAuth />} />
    <Route path="/portal/reset-password" element={<PortalResetPassword />} />
    <Route path="/" element={<CompanyRootGate />} />

    {/* Customer portal routes (kept for backwards compatibility on the main host) */}
    <Route
      path="/portal"
      element={
        <CustomerRoute>
          <CustomerPortalLayout />
        </CustomerRoute>
      }
    >
      <Route index element={<Navigate to="/portal/purchase-orders" replace />} />
      <Route path="purchase-orders" element={<PortalPurchaseOrders />} />
      <Route path="purchase-orders/new" element={<PortalNewPO />} />
      <Route path="purchase-orders/:id" element={<PortalPODetail />} />
      <Route path="schedule" element={<PortalSchedule />} />
      <Route path="label-inventory" element={<PortalLabelInventory />} />
      <Route path="documentation" element={<PortalDocumentation />} />
      <Route path="team" element={<PortalTeam />} />
      <Route path="onboarding" element={<OnboardingWizard />} />
      <Route path="settings" element={<PortalSettings />} />
    </Route>

    {/* Protected routes with shared layout */}
    <Route element={<ProtectedLayout />}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/purchase-orders" element={<PurchaseOrders />} />
      <Route path="/inventory" element={<Inventory />} />
      <Route path="/archived-materials" element={<ArchivedMaterials />} />
      <Route path="/formula" element={<Formula />} />
      <Route path="/formula/view/:id" element={<FormulaViewTemplate />} />
      <Route path="/rd-projects" element={<RDProjects />} />
      <Route path="/production" element={<Production />} />
      <Route path="/schedule" element={<Schedule />} />
      <Route path="/quality" element={<Quality />} />
      <Route path="/packaging" element={<Packaging />} />
      <Route path="/shipping" element={<Shipping />} />
      <Route path="/supplier" element={<Vendor />} />
      <Route path="/maintenance" element={<Maintenance />} />
      <Route path="/users" element={<Users />} />
      <Route path="/activity-tracker" element={<ActivityTracker />} />
      <Route path="/material-requirements" element={<MaterialRequirements />} />
      <Route path="/profitability" element={<Profitability />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/orders/:id" element={<OrderDetail />} />
      <Route path="/orders/:id/approve" element={<OrderApprovalReview />} />
      <Route path="/order-management" element={<MVPVersion1 />} />
      <Route path="/receive" element={<ReceiveScan />} />
      <Route path="/customers" element={<CustomersNew />} />
      <Route path="/customers/:customerId" element={<CustomerDetail />} />
      <Route path="/forecasting" element={<Forecasting />} />
      <Route path="/office-supplies" element={<OfficeSupplies />} />
      <Route path="/inquiries" element={<Inquiries />} />
      <Route path="/communications" element={<CommunicationHub />} />
      <Route path="/quoting" element={<Quoting />} />
      <Route path="/invoicing" element={<CustomerInvoicing />} />
      <Route path="/assistant" element={<Assistant />} />
      <Route path="/production-costs" element={<ProductionCosts />} />
      <Route path="/projects" element={<ProjectsList />} />
      <Route path="/projects/dashboard" element={<LaunchDashboard />} />
      <Route path="/projects/tasks" element={<LaunchWork />} />
      <Route path="/projects/board" element={<LaunchWork />} />
      <Route path="/projects/table" element={<LaunchWork />} />
      <Route path="/projects/timeline" element={<LaunchTimeline />} />
      <Route path="/projects/:id" element={<LaunchProjectDetail />} />
      <Route path="/tasks" element={<Tasks />} />
      <Route path="/agents/label-review" element={<LabelReview />} />
      <Route path="/documents" element={<Documents />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/tools/supplement-facts" element={<SupplementFactsTool />} />
      {/* Legacy /launch/* redirects */}
      <Route path="/launch" element={<Navigate to="/projects/dashboard" replace />} />
      <Route path="/launch/tasks" element={<Navigate to="/projects/tasks" replace />} />
      <Route path="/launch/board" element={<Navigate to="/projects/board" replace />} />
      <Route path="/launch/table" element={<Navigate to="/projects/table" replace />} />
      <Route path="/launch/timeline" element={<Navigate to="/projects/timeline" replace />} />
      <Route path="/launch/projects" element={<Navigate to="/projects" replace />} />
      <Route path="/launch/projects/:id" element={<LegacyProjectRedirect />} />

    </Route>

    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

const App = () => {
  return (
    <ThemeProvider defaultTheme="light" storageKey="erp-ai-theme" attribute="class">
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <Router>
            <Suspense fallback={<PageLoader />}>
              <CompanyRoutes />
            </Suspense>
            <Toaster />
            <SonnerToaster />
          </Router>
        </ErrorBoundary>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
