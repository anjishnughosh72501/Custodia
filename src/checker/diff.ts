export interface DiffToken {
  type: "equal" | "insert" | "delete";
  text: string;
}

/**
 * Word-level diff using a standard Longest Common Subsequence (LCS) algorithm.
 * Splits on whitespace / word boundaries while preserving whitespace for clean rendering.
 */
export function computeWordDiff(original: string, suggested: string): DiffToken[] {
  if (!original && !suggested) return [];
  if (!original) return [{ type: "insert", text: suggested }];
  if (!suggested) return [{ type: "delete", text: original }];

  // Tokenize into words and punctuation/whitespace
  const origTokens = tokenizeWords(original);
  const suggTokens = tokenizeWords(suggested);

  // Compute LCS matrix
  const m = origTokens.length;
  const n = suggTokens.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (origTokens[i] === suggTokens[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack to build diff
  const rawDiff: DiffToken[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origTokens[i - 1] === suggTokens[j - 1]) {
      rawDiff.push({ type: "equal", text: origTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawDiff.push({ type: "insert", text: suggTokens[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawDiff.push({ type: "delete", text: origTokens[i - 1] });
      i--;
    }
  }

  rawDiff.reverse();

  // Consolidate adjacent tokens of the same type
  return consolidateTokens(rawDiff);
}

function tokenizeWords(text: string): string[] {
  // Matches whitespace or words or punctuation sequences
  const match = text.match(/\s+|[^\s]+/g);
  return match ?? [text];
}

function consolidateTokens(tokens: DiffToken[]): DiffToken[] {
  if (tokens.length === 0) return [];
  const result: DiffToken[] = [];
  let current = { ...tokens[0] };

  for (let k = 1; k < tokens.length; k++) {
    if (tokens[k].type === current.type) {
      current.text += tokens[k].text;
    } else {
      result.push(current);
      current = { ...tokens[k] };
    }
  }
  result.push(current);
  return result;
}
