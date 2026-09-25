import { useEffect, useState } from 'react';
import { StatusBanner } from './components/StatusBanner';
import { Notices } from './components/Toast';
import { useToday } from './hooks/useToday';
import { parseHash, toHash, type Route, type View } from './router';
import { useTaskState } from './store/TaskStore';
import { AllTasksView } from './views/AllTasksView';
import { LoadErrorView, LoadingView } from './views/LoadErrorView';
import { SettingsView } from './views/SettingsView';
import { TodayView } from './views/TodayView';
import { WeekView } from './views/WeekView';

const NAV: { view: View; label: string }[] = [
  { view: 'today', label: '오늘' },
  { view: 'all', label: '전체' },
  { view: 'week', label: '주간' },
  { view: 'settings', label: '설정' },
];

function readRoute(): Route {
  const route = parseHash(window.location.hash);
  if (route.redirected) window.history.replaceState(null, '', toHash('today'));
  return route;
}

export function App() {
  const [route, setRoute] = useState(readRoute);
  const today = useToday();
  const { status } = useTaskState();

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const changeQuery = (query: URLSearchParams) => {
    window.history.replaceState(null, '', toHash(route.view, query));
    setRoute({ ...route, query });
  };

  let content;
  if (route.view === 'settings') content = <SettingsView />;
  else if (status === 'loading') content = <LoadingView />;
  else if (status === 'error') content = <LoadErrorView />;
  else if (route.view === 'all') content = <AllTasksView today={today} query={route.query} onQueryChange={changeQuery} />;
  else if (route.view === 'week') content = <WeekView today={today} />;
  else content = <TodayView today={today} />;

  return (
    <div className="app">
      <nav className="nav" aria-label="주요 화면">
        {NAV.map(({ view, label }) => (
          <a
            key={view}
            href={toHash(view)}
            className="nav__link"
            aria-current={route.view === view ? 'page' : undefined}
          >
            {label}
          </a>
        ))}
      </nav>
      <main className="main">
        <StatusBanner />
        {content}
      </main>
      <div className="toasts" aria-live="polite">
        <Notices />
      </div>
    </div>
  );
}
