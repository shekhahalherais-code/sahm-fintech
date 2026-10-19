import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import AskSahmChat from '@/components/AskSahmChat';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useSahmLanguage } from '@/lib/language';
import NotFound from '@/pages/not-found';
import HomePage from '@/pages/home';
import ReportReviewPage from '@/pages/report-review';
import ReportExplanationsPage from '@/pages/report-explanations';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  const [location] = useLocation();
  const language = useSahmLanguage();
  const reportId = location.match(/^\/reports\/([^/]+)(?:\/explanations)?\/?$/)?.[1];

  return (
    <>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/reports/:reportId" component={ReportReviewPage} />
          <Route path="/reports/:reportId/explanations" component={ReportExplanationsPage} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
      <AskSahmChat key={reportId ?? 'general'} reportId={reportId} language={language} />
    </>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
