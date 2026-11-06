/**
 * File Filter Manager
 *
 * Manages file and folder filtering rules for task indexing.
 * Provides efficient path matching and caching mechanisms.
 */

import { normalizePath, TFile, TFolder } from "obsidian";
import {
	FilterMode,
	type FileFilterScopeControls,
} from "../common/setting-definition";

/**
 * Filter rule types
 */
export interface FilterRule {
	type: "file" | "folder" | "pattern";
	path: string;
	enabled: boolean;
	scope?: "both" | "inline" | "file"; // per-rule scope
}

/**
 * File filter configuration
 */
export interface FileFilterConfig {
	enabled: boolean;
	mode: FilterMode;
	rules: FilterRule[];
	scopeControls?: FileFilterScopeControls;
}

/**
 * Path Trie Node for efficient path matching
 */
class PathTrieNode {
	children: Map<string, PathTrieNode> = new Map();
	isEndOfPath = false;
	isFolder = false;
}

/**
 * Path Trie for efficient folder path matching
 */
class PathTrie {
	private root: PathTrieNode = new PathTrieNode();

	/**
	 * Insert a path into the trie
	 */
	insert(path: string, isFolder = true): void {
		const parts = normalizePath(path)
			.split("/")
			.filter((part) => part.length > 0);
		let current = this.root;

		for (const part of parts) {
			if (!current.children.has(part)) {
				current.children.set(part, new PathTrieNode());
			}
			current = current.children.get(part)!;
		}

		current.isEndOfPath = true;
		current.isFolder = isFolder;
	}

	/**
	 * Check if a path or its parent is in the trie
	 */
	contains(path: string): boolean {
		const parts = normalizePath(path)
			.split("/")
			.filter((part) => part.length > 0);

		// Try to match the rule starting at any segment in the input path
		for (let start = 0; start < parts.length; start++) {
			let current = this.root;
			for (let i = start; i < parts.length; i++) {
				const part = parts[i];
				if (!current.children.has(part)) {
					break; // mismatch at this starting position; try next start
				}
				current = current.children.get(part)!;
				// If this is a folder rule and we're checking a path under it (or exact folder)
				if (current.isEndOfPath && current.isFolder) {
					return true;
				}
			}
		}

		// No folder rule matched anywhere in the path
		return false;
	}

	/**
	 * Clear all paths from the trie
	 */
	clear(): void {
		this.root = new PathTrieNode();
	}
}

/**
 * File Filter Manager
 *
 * Manages filtering rules and provides efficient file/folder filtering
 */
export class FileFilterManager {
	private config: FileFilterConfig;
	private folderTrie: PathTrie = new PathTrie(); // global (legacy)
	private fileSet: Set<string> = new Set(); // global (legacy)
	private patternRegexes: RegExp[] = []; // global (legacy)
	private cache: Map<string, boolean> = new Map();
	private scopeControls: FileFilterScopeControls = {
		inlineTasksEnabled: true,
		fileTasksEnabled: true,
	};

	// Scoped indexes for per-rule scope control
	private folderTrieInline: PathTrie = new PathTrie();
	private folderTrieFile: PathTrie = new PathTrie();
	private fileSetInline: Set<string> = new Set();
	private fileSetFile: Set<string> = new Set();
	private patternRegexesInline: RegExp[] = [];
	private patternRegexesFile: RegExp[] = [];

	constructor(config: FileFilterConfig) {
		this.config = config;
		this.scopeControls = this.normalizeScopeControls(
			config.scopeControls
		);
		this.rebuildIndexes();
	}

	/**
	 * Update filter configuration
	 */
	updateConfig(config: FileFilterConfig): void {
		this.config = config;
		this.scopeControls = this.normalizeScopeControls(
			config.scopeControls
		);
		this.rebuildIndexes();
		this.clearCache();
	}

	private normalizeScopeControls(
		scopeControls?: FileFilterScopeControls
	): FileFilterScopeControls {
		return {
			inlineTasksEnabled:
				scopeControls?.inlineTasksEnabled !== false,
			fileTasksEnabled:
				scopeControls?.fileTasksEnabled !== false,
		};
	}

	private isScopeEnabled(scope: "both" | "inline" | "file"): boolean {
		if (scope === "inline") {
			return this.scopeControls.inlineTasksEnabled !== false;
		}
		if (scope === "file") {
			return this.scopeControls.fileTasksEnabled !== false;
		}
		return (
			this.scopeControls.inlineTasksEnabled !== false ||
			this.scopeControls.fileTasksEnabled !== false
		);
	}

	/**
	 * Check if a file should be included in indexing
	 */
	shouldIncludeFile(
		file: TFile,
		scope: "both" | "inline" | "file" = "both"
	): boolean {
		if (!this.isScopeEnabled(scope)) {
			return false;
		}
		if (!this.config.enabled) {
			return true;
		}

		const filePath = file.path;
		const key = this.getCacheKey("file", filePath, scope);
		// Check cache first
		if (this.cache.has(key)) {
			return this.cache.get(key)!;
		}

		const result = this.evaluateFile(filePath, scope);
		this.cache.set(key, result);
		return result;
	}

	/**
	 * Check if a folder should be included in indexing
	 */
	shouldIncludeFolder(
		folder: TFolder,
		scope: "both" | "inline" | "file" = "both"
	): boolean {
		if (!this.isScopeEnabled(scope)) {
			return false;
		}
		if (!this.config.enabled) {
			return true;
		}

		const folderPath = folder.path;
		const key = this.getCacheKey("folder", folderPath, scope);
		// Check cache first
		if (this.cache.has(key)) {
			return this.cache.get(key)!;
		}

		const result = this.evaluateFolder(folderPath, scope);
		this.cache.set(key, result);
		return result;
	}

	/**
	 * Check if a path should be included (generic method)
	 */
	shouldIncludePath(
		path: string,
		scope: "both" | "inline" | "file" = "both"
	): boolean {
		if (!this.isScopeEnabled(scope)) {
			return false;
		}
		if (!this.config.enabled) {
			return true;
		}

		const key = this.getCacheKey("path", path, scope);
		// Check cache first
		if (this.cache.has(key)) {
			return this.cache.get(key)!;
		}

		const result = this.evaluatePath(path, scope);
		this.cache.set(key, result);
		return result;
	}

	/**
	 * Get filter statistics
	 */
	getStats(): { cacheSize: number; rulesCount: number; enabled: boolean } {
		return {
			cacheSize: this.cache.size,
			rulesCount: this.config.rules.filter((rule) => rule.enabled).length,
			enabled: this.config.enabled,
		};
	}

	/**
	 * Clear the filter cache
	 */
	clearCache(): void {
		this.cache.clear();
	}

	/**
	 * Build a cache key that is scoped by kind and scope to avoid cross-scope pollution
	 */
	private getCacheKey(
		kind: "file" | "folder" | "path",
		path: string,
		scope: "both" | "inline" | "file"
	): string {
		return `${kind}:${scope}:${this.normalizePath(path)}`;
	}

	/**
	 * Evaluate if a file should be included
	 */
	private evaluateFile(
		filePath: string,
		scope: "both" | "inline" | "file" = "both"
	): boolean {
		const matches = this.pathMatches(filePath, scope);

		if (this.config.mode === FilterMode.WHITELIST) {
			return matches;
		} else {
			return !matches;
		}
	}

	/**
	 * Evaluate if a folder should be included
	 */
	private evaluateFolder(
		folderPath: string,
		scope: "both" | "inline" | "file" = "both"
	): boolean {
		const matches = this.pathMatches(folderPath, scope);

		if (this.config.mode === FilterMode.WHITELIST) {
			return matches;
		} else {
			return !matches;
		}
	}

	/**
	 * Evaluate if a path should be included (generic)
	 */
	private evaluatePath(
		path: string,
		scope: "both" | "inline" | "file" = "both"
	): boolean {
		const matches = this.pathMatches(path, scope);
		const result =
			this.config.mode === FilterMode.WHITELIST ? matches : !matches;
		return result;
	}

	/**
	 * Check if a path matches any filter rule
	 */
	private pathMatches(
		path: string,
		scope: "both" | "inline" | "file"
	): boolean {
		const normalizedPath = this.normalizePath(path);

		// Pick the right indexes based on scope
		const fileSet =
			scope === "file"
				? this.fileSetFile
				: scope === "inline"
					? this.fileSetInline
					: this.fileSet;
		const folderTrie =
			scope === "file"
				? this.folderTrieFile
				: scope === "inline"
					? this.folderTrieInline
					: this.folderTrie;
		const patternRegexes =
			scope === "file"
				? this.patternRegexesFile
				: scope === "inline"
					? this.patternRegexesInline
					: this.patternRegexes;

		// Detailed match breakdown
		const fileHit = fileSet.has(normalizedPath);
		const folderHit = folderTrie.contains(normalizedPath);
		let patternHit = false;
		for (const regex of patternRegexes) {
			if (regex.test(normalizedPath)) {
				patternHit = true;
				break;
			}
		}
		const matched = fileHit || folderHit || patternHit;
		return matched;
	}

	/**
	 * Rebuild internal indexes when configuration changes
	 */
	private rebuildIndexes(): void {
		// Clear legacy and scoped indexes
		this.folderTrie.clear();
		this.fileSet.clear();
		this.patternRegexes = [];
		this.folderTrieInline.clear();
		this.folderTrieFile.clear();
		this.fileSetInline.clear();
		this.fileSetFile.clear();
		this.patternRegexesInline = [];
		this.patternRegexesFile = [];

		for (const rule of this.config.rules) {
			if (!rule.enabled) continue;
			const scope = rule.scope || "both";

			const addTo = (bucket: "both" | "inline" | "file") => {
				switch (rule.type) {
					case "file":
						(bucket === "file"
								? this.fileSetFile
								: bucket === "inline"
									? this.fileSetInline
									: this.fileSet
						).add(this.normalizePath(rule.path));
						break;
					case "folder":
						(bucket === "file"
								? this.folderTrieFile
								: bucket === "inline"
									? this.folderTrieInline
									: this.folderTrie
						).insert(rule.path, true);
						break;
					case "pattern":
						try {
							const regexPattern = this.globToRegex(rule.path);
							(bucket === "file"
									? this.patternRegexesFile
									: bucket === "inline"
										? this.patternRegexesInline
										: this.patternRegexes
							).push(new RegExp(regexPattern, "i"));
						} catch (error) {
							console.warn(
								`Invalid pattern rule: ${rule.path}`,
								error
							);
						}
						break;
				}
			};

			// IMPORTANT: When scope is 'both', ensure rules apply to both 'inline' and 'file' scoped indexes
			// Previously only the legacy 'both' index was filled, but lookups for scoped checks ignored it
			if (scope === "both") {
				addTo("both");
				addTo("inline");
				addTo("file");
			} else if (scope === "inline") {
				addTo("inline");
			} else if (scope === "file") {
				addTo("file");
			}
		}
	}

	/**
	 * Convert glob pattern to regex
	 */
	private globToRegex(pattern: string): string {
		return pattern
			.replace(/\./g, "\\.")
			.replace(/\*/g, ".*")
			.replace(/\?/g, ".")
			.replace(/\[([^\]]+)\]/g, "[$1]");
	}

	/**
	 * Normalize path for consistent matching
	 */
	private normalizePath(path: string): string {
		return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
	}
}
