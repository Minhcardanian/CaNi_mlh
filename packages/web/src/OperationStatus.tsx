import { useEffect, useState } from "react";

export type OperationDescriptor = {
  title: string;
  boundary: string;
};

export function OperationStatus({
  descriptor,
  startedAt,
}: {
  descriptor: OperationDescriptor;
  startedAt: number;
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const updateElapsed = () => setElapsedMs(Math.max(0, Date.now() - startedAt));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 250);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return <div className="operation-status" role="status" aria-live="polite">
    <div><strong>{descriptor.title}</strong><small>{descriptor.boundary}</small></div>
    <span>{(elapsedMs / 1_000).toFixed(1)}s elapsed</span>
  </div>;
}
