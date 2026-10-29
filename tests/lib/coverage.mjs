// Routing-case coverage ratchet: skills with no case naming them in `expect` must be
// listed in tests/cases/uncovered.json; the list can only shrink.

// skills: ["plugin/slug", ...] for every shipped skill
// covered: Set of slugs named by some case's `expect`
// listed: array from uncovered.json
export function coverageProblems(skills, covered, listed) {
  const failures = [];
  const byKey = new Set(skills);
  const listedSet = new Set(listed);
  for (const key of skills) {
    const slug = key.split("/").pop();
    if (!covered.has(slug) && !listedSet.has(key))
      failures.push(`no routing case expects skill ${key}; add a case to tests/cases/routing.jsonl or list it in tests/cases/uncovered.json`);
  }
  for (const key of listedSet) {
    if (!byKey.has(key))
      failures.push(`tests/cases/uncovered.json lists ${key} but no such skill exists; remove the stale entry`);
    else if (covered.has(key.split("/").pop()))
      failures.push(`tests/cases/uncovered.json lists ${key} but a routing case now covers it; remove the stale entry`);
  }
  return failures;
}
