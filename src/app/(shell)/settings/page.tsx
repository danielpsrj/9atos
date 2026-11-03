// Settings — placeholder. The full settings screen (streak mode + threshold,
// daily goal, timer, Zen Mode default, session size) lands in Phase 6 (#36),
// persisted via the settings API (Phase 4, #26).

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>
      <p className="mt-2 text-base text-text-secondary">
        The configurable tunables (streak, daily goal, timer, Zen Mode, session size) arrive in
        Phase 6.
      </p>
    </div>
  );
}
