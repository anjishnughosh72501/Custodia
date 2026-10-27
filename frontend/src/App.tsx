import { Suspense } from "react";
import { useRoute } from "./router";
import Landing from "./pages/Landing";
import { ErrorBoundary } from "./ErrorBoundary";
import { lazyWithRetry } from "./lazyWithRetry";

const Checker = lazyWithRetry(() => import("./pages/Checker"));

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

  if (route.name === "checker" || route.name === "review") {
    const routeKey =
      route.name === "review"
        ? `r:${route.reviewId}`
        : `check:${route.exampleId ?? "default"}`;

    return (
      <ErrorBoundary>
        <Suspense fallback={<CheckerSkeleton />}>
          <Checker key={routeKey} exampleId={route.exampleId} reviewId={route.reviewId} />
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
