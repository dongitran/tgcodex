import { render, Text, Box } from 'ink';

export function runTui(): void {
  render(
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
      <Text bold color="cyan">
        tg-codex TUI (Phase 3 skeleton)
      </Text>
      <Text> </Text>
      <Text>✓ Auth + groups + research pack export already work via CLI commands.</Text>
      <Text>✓ Full interactive dashboard (multi-select groups, live scan, report viewer) is the next big step.</Text>
      <Text> </Text>
      <Text color="gray">Press Ctrl+C to exit. Run "tg-codex --help" for current commands.</Text>
      <Text color="gray">See AGENTS.md + docs/plans for the full vision.</Text>
    </Box>
  );
}
