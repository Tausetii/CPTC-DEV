/**
 * admin/sample-data.js — view-helper data derivations for the console.
 *
 * `teamCharts()` turns the live teams summary into chart series, so the Teams
 * charts reflect real machine usage in production.
 */

/** Build the Teams-page chart series from a teamsSummary() array. */
export function teamCharts(teams = []) {
  const ranked = teams.slice().sort((a, b) => (b.used24h || 0) - (a.used24h || 0));
  return {
    teamUsage: ranked.map((t) => ({ label: t.name, value: t.used24h || 0 })),
    teamShare: ranked.slice(0, 6).map((t) => ({ label: t.name, value: t.used24h || 0 }))
  };
}
