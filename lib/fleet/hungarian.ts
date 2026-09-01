/**
 * Exact minimum-cost assignment.
 *
 * Given a cost for pairing each row with each column, this finds the pairing
 * of every row to a distinct column with the lowest total cost — not a good
 * one, the lowest one. It is the Kuhn–Munkres method in its shortest
 * augmenting-path form, O(n²m), which for a fleet this size is instant.
 *
 * It is here because dispatch is an assignment problem and has never been
 * treated as one. Choosing the nearest free driver for each booking in turn is
 * a greedy rule, and greedy rules on this structure are reliably worse than
 * the optimum — the third booking is cheap because the first two were placed
 * without knowing it existed. Solving all of them at once is not a refinement
 * of that; it is a different answer.
 *
 * Infeasible pairs are passed as `Infinity` and handled by substituting a
 * finite penalty larger than any real solution, then reporting any row that
 * could only be placed on one as unassigned. That keeps the algorithm's
 * arithmetic finite while still refusing to invent a schedule that cannot run.
 */

export type Assignment = {
  /** For each row, the column it was given, or -1 when none was feasible. */
  columnForRow: number[];
  /** Total cost of the feasible pairs only. */
  cost: number;
  /** Rows that had no feasible column. */
  unassignedRows: number[];
};

export function minimumCostAssignment(costs: number[][]): Assignment {
  const rows = costs.length;
  if (rows === 0) return { columnForRow: [], cost: 0, unassignedRows: [] };

  const cols = costs[0].length;
  if (cols === 0) {
    return {
      columnForRow: new Array(rows).fill(-1),
      cost: 0,
      unassignedRows: costs.map((_, index) => index),
    };
  }
  if (cols < rows) {
    throw new Error(
      `minimumCostAssignment needs at least as many columns as rows (${rows} rows, ${cols} columns)`,
    );
  }

  /**
   * A penalty that is worse than any complete real solution but still finite,
   * so the potentials stay numbers. Every finite cost, summed over every row,
   * cannot reach it.
   */
  let largest = 0;
  for (const row of costs) {
    for (const value of row) {
      if (Number.isFinite(value)) largest = Math.max(largest, Math.abs(value));
    }
  }
  const PENALTY = (largest + 1) * (rows + 1);

  // 1-indexed, which is what the algorithm's bookkeeping wants.
  const a = (i: number, j: number) => {
    const value = costs[i - 1][j - 1];
    return Number.isFinite(value) ? value : PENALTY;
  };

  const u = new Array<number>(rows + 1).fill(0);
  const v = new Array<number>(cols + 1).fill(0);
  /** rowForColumn[j] — which row currently holds column j; 0 means none. */
  const rowForColumn = new Array<number>(cols + 1).fill(0);
  const way = new Array<number>(cols + 1).fill(0);

  for (let i = 1; i <= rows; i++) {
    rowForColumn[0] = i;
    let j0 = 0;
    const minv = new Array<number>(cols + 1).fill(Infinity);
    const used = new Array<boolean>(cols + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = rowForColumn[j0];
      let delta = Infinity;
      let j1 = 0;

      for (let j = 1; j <= cols; j++) {
        if (used[j]) continue;
        const reduced = a(i0, j) - u[i0] - v[j];
        if (reduced < minv[j]) {
          minv[j] = reduced;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }

      for (let j = 0; j <= cols; j++) {
        if (used[j]) {
          u[rowForColumn[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (rowForColumn[j0] !== 0);

    do {
      const j1 = way[j0];
      rowForColumn[j0] = rowForColumn[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const columnForRow = new Array<number>(rows).fill(-1);
  for (let j = 1; j <= cols; j++) {
    const row = rowForColumn[j];
    if (row > 0) columnForRow[row - 1] = j - 1;
  }

  // A row placed on an infeasible pair was placed nowhere real.
  const unassignedRows: number[] = [];
  let cost = 0;
  for (let i = 0; i < rows; i++) {
    const j = columnForRow[i];
    if (j === -1 || !Number.isFinite(costs[i][j])) {
      columnForRow[i] = -1;
      unassignedRows.push(i);
    } else {
      cost += costs[i][j];
    }
  }

  return { columnForRow, cost, unassignedRows };
}
