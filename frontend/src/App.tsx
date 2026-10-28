import { Suspense, useEffect } from "react";
import { useRoute } from "./router";
import Landing from "./pages/Landing";
import { ErrorBoundary } from "./ErrorBoundary";
import { lazyWithRetry } from "./lazyWithRetry";
import { pingServer } from "./api";

const Checker = lazyWithRetry(() => import("./pages/Checker"));
const Examples = lazyWithRetry(() => import("./pages/Examples"));

function CheckerSkeleton() {
  return (
    <div className="shell" style={{ paddingTop: 32 }}>
      <div className="panel checking" role="status" aria-live="polite">
        <div className="dots" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <i key={i} style={{ ["--i" as string]: i }} />
          ))}
        </div>
        <p>Loading claim checker…</p>
      </div>
    </div>
  );
}

export default function App() {
  const route = useRoute();

  // Fire-and-forget server warm-up on initial load so Render wakes while reading
  useEffect(() => {
    pingServer();
  }, []);

  if (route.name === "checker" || route.name === "review") {
    return (
      <ErrorBoundary>
        <Suspense fallback={<CheckerSkeleton />}>
          <Checker exampleId={route.exampleId} reviewId={route.reviewId} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (route.name === "examples") {
    return (
      <ErrorBoundary>
        <Suspense fallback={<CheckerSkeleton />}>
          <Examples />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Landing notFound={route.notFound} />
    </ErrorBoundary>
  );
}
