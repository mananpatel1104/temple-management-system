import { AppProviders } from '@app/providers/AppProviders';
import { AppRouter } from '@app/router/AppRouter';
import { ErrorBoundary } from '@app/ErrorBoundary';

/**
 * Application root. Composition only — no business logic, no feature UI.
 * AppProviders wires Theme/Language/Offline (+ React Router) context;
 * AppRouter renders whatever routes feature modules have registered.
 * ErrorBoundary sits inside AppProviders (so Theme/Language context and
 * the persisted 'ssm.language'/'ssm.theme' localStorage keys are already
 * available) but outside AppRouter, so a crash in any single screen
 * shows a recoverable fallback instead of a blank white screen.
 */
function App() {
  return (
    <AppProviders>
      <ErrorBoundary>
        <AppRouter />
      </ErrorBoundary>
    </AppProviders>
  );
}

export default App;
