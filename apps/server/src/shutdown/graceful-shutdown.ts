export function registerGracefulShutdown(onShutdown: () => Promise<void>): void {
  const signals = ["SIGTERM", "SIGINT"] as const;

  for (const signal of signals) {
    process.on(signal, async () => {
      try {
        await onShutdown();
      } finally {
        process.exit(0);
      }
    });
  }
}