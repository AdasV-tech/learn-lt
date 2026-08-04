import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LessonPlayer } from './features/lesson/LessonPlayer';
import { LandingPage, LoginPage, RegisterPage } from './pages/Auth';
import { DictionaryPage } from './pages/Dictionary';
import { GrammarDetailPage, GrammarIndexPage } from './pages/Grammar';
import { HomePage } from './pages/Home';
import { AchievementsPage, LeaderboardPage, ProfilePage } from './pages/Profile';
import { ReviewPage } from './pages/Review';
import { SettingsPage } from './pages/Settings';
import { TutorPage } from './pages/Tutor';
import { Button, Spinner } from './components/ui';
import { useAuth } from './store/auth';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAuth((state) => state.status);
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/welcome" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}

function NotFoundPage() {
  return (
    <div className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 text-center">
      <div>
        <p className="mb-3 text-6xl" aria-hidden>
          🧭
        </p>
        <h1 className="text-2xl font-extrabold">Nėra tokio maršruto</h1>
        <p className="muted mt-1 text-sm">There’s no such route. Let’s get you back on the path.</p>
        <a href="/" className="mt-5 inline-block">
          <Button size="lg">Back to the path</Button>
        </a>
      </div>
    </div>
  );
}

/** Scroll to the top whenever the route changes — expected on mobile. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const bootstrap = useAuth((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Public */}
        <Route path="/welcome" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Authenticated */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/lesson/:slug"
          element={
            <RequireAuth>
              <LessonPlayer />
            </RequireAuth>
          }
        />
        <Route
          path="/review"
          element={
            <RequireAuth>
              <ReviewPage />
            </RequireAuth>
          }
        />
        <Route
          path="/dictionary"
          element={
            <RequireAuth>
              <DictionaryPage />
            </RequireAuth>
          }
        />
        <Route
          path="/grammar"
          element={
            <RequireAuth>
              <GrammarIndexPage />
            </RequireAuth>
          }
        />
        <Route
          path="/grammar/:slug"
          element={
            <RequireAuth>
              <GrammarDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/tutor"
          element={
            <RequireAuth>
              <TutorPage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/achievements"
          element={
            <RequireAuth>
              <AchievementsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <RequireAuth>
              <LeaderboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
