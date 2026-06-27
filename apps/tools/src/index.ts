export function printToolingBanner(): string {
  return "Tile Fighter tools workspace ready.";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${printToolingBanner()}\n`);
}