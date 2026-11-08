export type FilterNode =
  | { type: "term"; value: string }
  | { type: "not"; child: FilterNode }
  | { type: "and" | "or"; left: FilterNode; right: FilterNode };

/** Parse boolean task filters with parentheses, field terms, and implicit AND. */
export function parseAdvancedFilterQuery(query: string): FilterNode {
  const tokens = query.match(/(?:[A-Za-z_][\w-]*\s*:\s*(?:(?:>=|<=|!=|>|<|=)\s*)?(?:"[^"]*"|'[^']*'|[^\s()]+)|"[^"]*"|'[^']*'|\(|\)|\bAND\b|\bOR\b|\bNOT\b|[^\s()]+)/gi) || [];
  let index = 0;
  const peek = () => tokens[index]?.toUpperCase();
  const take = () => tokens[index++];
  const parsePrimary = (): FilterNode | null => {
    if (peek() === "NOT") { take(); const child = parsePrimary(); return child ? { type: "not", child } : null; }
    if (take() === "(") { const node = parseOr(); if (take() !== ")") throw new Error("Missing closing parenthesis in filter"); return node; }
    const token = tokens[index - 1] === "(" ? take() : tokens[index - 1];
    if (!token || token === ")" || /^(AND|OR)$/i.test(token)) return null;
    return { type: "term", value: token };
  };
  const parseAnd = (): FilterNode | null => {
    let node = parsePrimary();
    while (index < tokens.length && peek() !== "OR" && peek() !== ")") {
      if (peek() === "AND") take();
      const right = parsePrimary();
      if (!right) break;
      node = node ? { type: "and", left: node, right } : right;
    }
    return node;
  };
  const parseOr = (): FilterNode | null => {
    let node = parseAnd();
    while (peek() === "OR") { take(); const right = parseAnd(); if (right) node = node ? { type: "or", left: node, right } : right; }
    return node;
  };
  if (!tokens.length) return { type: "term", value: "" };
  const result = parseOr();
  if (index < tokens.length) throw new Error("Unexpected token in filter: " + tokens[index]);
  return result || { type: "term", value: "" };
}

function compareFilterValue(actual: unknown, operator: string, expected: string, isDate = false): boolean {
	if (["none", "empty"].includes(expected.toLowerCase())) return operator === "!=" ? actual != null && actual !== "" : actual == null || actual === "";
  if (actual === undefined || actual === null) return false;
	if (isDate) {
		const key = expected.toLowerCase();
		const now = new Date();
		const offset = key === "tomorrow" ? 1 : key === "yesterday" ? -1 : 0;
		const date = ["today", "tomorrow", "yesterday"].includes(key) ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset) : /^\d{4}-\d{2}-\d{2}$/.test(expected) ? new Date(Number(expected.slice(0, 4)), Number(expected.slice(5, 7)) - 1, Number(expected.slice(8, 10))) : new Date(expected);
		const start = date.getTime(), end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
		const value = typeof actual === "number" ? actual : new Date(String(actual)).getTime();
		if (!Number.isFinite(start) || !Number.isFinite(value)) return false;
		return operator === ">" ? value >= end : operator === ">=" ? value >= start : operator === "<" ? value < start : operator === "<=" ? value < end : operator === "!=" ? value < start || value >= end : value >= start && value < end;
	}
  const text = String(actual).toLowerCase();
  const target = expected.toLowerCase();
  const actualNumber = Number(actual);
  const expectedNumber = parsePriorityFilterValue(expected);
  if ([">", "<", ">=", "<=", "!=", "="].includes(operator)) {
	  const a = Number.isFinite(actualNumber) ? actualNumber : Date.parse(text);
	  const b = isDate ? Date.parse(expected) : (expectedNumber !== null && Number.isFinite(expectedNumber) ? expectedNumber : Date.parse(expected));
    if (!Number.isFinite(a) || !Number.isFinite(b)) return operator === "!=" ? text !== target : operator === "=" && text === target;
    return operator === ">" ? a > b : operator === "<" ? a < b : operator === ">=" ? a >= b : operator === "<=" ? a <= b : operator === "!=" ? a !== b : a === b;
  }
  return Array.isArray(actual) ? actual.some(value => String(value).toLowerCase().includes(target)) : text.includes(target);
}

function evaluateTerm(raw: string, task: any): boolean {
  const term = raw.replace(/^("([\s\S]*)"|'([\s\S]*)')$/, "$2$3").trim();
  if (!term) return true;
  const field = term.match(/^([A-Za-z_][\w-]*)\s*:\s*(?:(>=|<=|!=|>|<|=)\s*)?(.*)$/);
  if (field) {
    const key = field[1].toLowerCase(); const op = field[2] || ""; const value = field[3].replace(/^("([\s\S]*)"|'([\s\S]*)')$/, "$2$3");
    const meta = task.metadata || {};
	    const status = task.statusName ?? (task.completed ? "completed" : ({ " ": "not-started", "?": "planned", "/": "in-progress", ">": "in-progress", "-": "abandoned", "~": "paused", "=": "paused" } as Record<string, string>)[task.status] ?? task.status);
	    const actual = key === "priority" ? (meta.priority ?? task.priority) : key === "path" || key === "file" ? task.filePath : key === "date" ? (meta.dueDate ?? meta.scheduledDate) : key === "due" || key === "duedate" ? meta.dueDate : key === "scheduled" || key === "scheduleddate" ? meta.scheduledDate : key === "start" || key === "startdate" ? meta.startDate : key === "tag" || key === "tags" ? (meta.tags ?? task.tags) : key === "project" ? (meta.project ?? task.project ?? meta.tgProject?.name) : key === "context" ? (meta.context ?? task.context) : key === "status" ? status : key === "text" || key === "content" ? task.content : meta[key] ?? task[key];
    if (key === "priority" && value.startsWith("#")) {
      const priority = parsePriorityFilterValue(value);
      if (priority !== null) return compareFilterValue(actual, op || "=", String(priority));
    }
	    if (key === "status" && !op) {
			const normalize = (status: unknown) => String(status ?? "").toLowerCase().replace(/[\s_-]/g, "");
			return normalize(actual).includes(normalize(value));
		}
	    return compareFilterValue(actual, op, value, ["date", "due", "scheduled", "start", "duedate", "scheduleddate", "startdate"].includes(key));
  }
  const needle = term.replace(/^[#@]/, "").toLowerCase();
  const haystacks = [task.content, task.metadata?.tags, task.tags, task.metadata?.project, task.metadata?.tgProject?.name, task.metadata?.context].flatMap(value => Array.isArray(value) ? value : [value]).filter(value => value != null).map(value => String(value).toLowerCase());
  return haystacks.some(value => value.includes(needle));
}

export function evaluateFilterNode(node: FilterNode | null, task: any): boolean {
  if (!node) return true;
  if (node.type === "term") return evaluateTerm(node.value, task);
  if (node.type === "not") return !evaluateFilterNode(node.child, task);
  if (node.type === "and") return evaluateFilterNode(node.left, task) && evaluateFilterNode(node.right, task);
  return evaluateFilterNode(node.left, task) || evaluateFilterNode(node.right, task);
}

// Parse priority expressions used by filter UI, returning a numeric 1..5 if recognized; otherwise null.
export function parsePriorityFilterValue(input: string | number | undefined | null): number | null {
  if (input == null) return null;
  if (typeof input === 'number') return input;
  const s = String(input).trim().toLowerCase().replace(/^#/, "");
  if (!s) return null;
  const map: Record<string, number> = {
    a: 5, b: 4, c: 3, d: 2, e: 1,
    highest: 5,
    high: 4,
    medium: 3,
    normal: 3,
    moderate: 3,
    low: 2,
    lowest: 1,
    urgent: 5,
    critical: 5,
    important: 4,
    minor: 2,
    trivial: 1,
  };
  if (s in map) return map[s];
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

