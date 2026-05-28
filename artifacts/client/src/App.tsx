import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { configureApiClient } from "@/lib/api-config";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import DatasetList from "@/pages/dataset-list";
import DatasetNew from "@/pages/dataset-new";
import DatasetDetail from "@/pages/dataset-detail";
import JobList from "@/pages/job-list";
import JobDetail from "@/pages/job-detail";
import ReviewCanvas from "@/pages/review-canvas";
import ExportPage from "@/pages/export-page";
import Settings from "@/pages/settings";

import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import {
  Database,
  Activity,
  LayoutDashboard,
  Settings as SettingsIcon,
  Download,
  Cpu,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/datasets", label: "Datasets", icon: Database, exact: false },
  { href: "/jobs", label: "Jobs", icon: Activity, exact: false },
  { href: "/settings", label: "Settings", icon: SettingsIcon, exact: false },
];

function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background dark">
        <Sidebar className="border-r border-border bg-sidebar">
          <SidebarContent>
            <div className="p-4 flex items-center gap-2.5 border-b border-border">
              <div className="w-6 h-6 bg-primary rounded-sm flex items-center justify-center">
                <Cpu className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground tracking-tight leading-none">SAM3_FACTORY</div>
                <div className="text-xs text-muted-foreground mt-0.5 font-mono">Auto Dataset</div>
              </div>
            </div>
            <SidebarGroup className="pt-2">
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const isActive = item.exact ? location === "/" : location.startsWith(item.href);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link href={item.href}>
                            <item.icon className="w-4 h-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <div className="mt-auto p-4 border-t border-border">
              <div className="text-xs text-muted-foreground font-mono">v0.1.0 · mock mode</div>
            </div>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/datasets" component={DatasetList} />
        <Route path="/datasets/new" component={DatasetNew} />
        <Route path="/jobs" component={JobList} />
        <Route path="/review/:datasetId">{(params) => <ReviewCanvas params={params as { datasetId: string }} />}</Route>
        <Route path="/export/:datasetId">{(params) => <ExportPage params={params as { datasetId: string }} />}</Route>
        <Route path="/settings" component={Settings} />
        <Route path="/jobs/:id">{(params) => <JobDetail params={params as { id: string }} />}</Route>
        <Route path="/datasets/:id">{(params) => <DatasetDetail params={params as { id: string }} />}</Route>
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

const routerBase = import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");

// Initialize API client from localStorage on module load (before first render)
(function initApiClient() {
  const rawSavedUrl = localStorage.getItem("sam3_api_url");
  const savedKey = localStorage.getItem("sam3_api_key");
  const savedUrl = configureApiClient(rawSavedUrl, savedKey);

  if (savedUrl !== rawSavedUrl) {
    localStorage.setItem("sam3_api_url", savedUrl);
  }
})();

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={routerBase}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
