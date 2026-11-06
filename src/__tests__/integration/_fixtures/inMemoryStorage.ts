/**
 * In-memory Storage test double.
 *
 * Implements the public surface of `src/dataflow/persistence/Storage.ts` that the
 * Orchestrator, Repository, and integration tests actually call. Backed by a Map,
 * so cache tests don't need to touch IndexedDB / localStorage / localforage.
 *
 * Storage in production code is constructed internally by Repository and is not
 * injectable. This double exists for tests that exercise the cache layer directly
 * (e.g. cache invariants, scope-map verification) and for any future refactor
 * that makes Storage injectable. Keep the surface narrow — add methods only when
 * a test needs them.
 */

import type { Task, TaskCache } from "../../../types/task";
import type {
	RawRecord,
	ProjectRecord,
	AugmentedRecord,
	ConsolidatedRecord,
} from "../../../dataflow/persistence/Storage";

type Namespace = "raw" | "project" | "augmented" | "consolidated";

const PREFIX: Record<Namespace, string> = {
	raw: "tasks.raw:",
	project: "project.data:",
	augmented: "tasks.augmented:",
	consolidated: "consolidated:",
};

const META_PREFIX = "meta:";

export class InMemoryStorage {
	private map = new Map<string, any>();
	private currentVersion: string;
	private schemaVersion = 1;

	constructor(version = "1.0.0") {
		this.currentVersion = version;
	}

	// --- raw ---

	async loadRaw(path: string): Promise<RawRecord | null> {
		const rec = this.map.get(PREFIX.raw + path) as RawRecord | undefined;
		if (!rec) return null;
		if (!this.versionOk(rec)) {
			this.map.delete(PREFIX.raw + path);
			return null;
		}
		return rec;
	}

	async storeRaw(
		path: string,
		tasks: Task[],
		fileContent?: string,
		mtime?: number,
	): Promise<void> {
		const rec: RawRecord = {
			hash: this.hash(fileContent || tasks),
			time: Date.now(),
			version: this.currentVersion,
			schema: this.schemaVersion,
			data: tasks,
			mtime,
		};
		this.map.set(PREFIX.raw + path, rec);
	}

	isRawValid(
		_path: string,
		record: RawRecord,
		fileContent?: string,
		mtime?: number,
	): boolean {
		if (!this.versionOk(record)) return false;
		if (mtime !== undefined && record.mtime !== undefined && record.mtime !== mtime)
			return false;
		if (fileContent && record.hash !== this.hash(fileContent)) return false;
		return true;
	}

	// --- project ---

	async loadProject(path: string): Promise<ProjectRecord | null> {
		const rec = this.map.get(PREFIX.project + path) as ProjectRecord | undefined;
		if (!rec) return null;
		if (!this.versionOk(rec)) {
			this.map.delete(PREFIX.project + path);
			return null;
		}
		return rec;
	}

	async storeProject(
		path: string,
		data: { tgProject?: any; enhancedMetadata: Record<string, any> },
	): Promise<void> {
		const rec: ProjectRecord = {
			hash: this.hash(data),
			time: Date.now(),
			version: this.currentVersion,
			schema: this.schemaVersion,
			data,
		};
		this.map.set(PREFIX.project + path, rec);
	}

	// --- augmented ---

	async loadAugmented(path: string): Promise<AugmentedRecord | null> {
		const rec = this.map.get(PREFIX.augmented + path) as AugmentedRecord | undefined;
		if (!rec) return null;
		if (!this.versionOk(rec)) {
			this.map.delete(PREFIX.augmented + path);
			return null;
		}
		return rec;
	}

	async storeAugmented(path: string, tasks: Task[]): Promise<void> {
		const rec: AugmentedRecord = {
			hash: this.hash(tasks),
			time: Date.now(),
			version: this.currentVersion,
			schema: this.schemaVersion,
			data: tasks,
		};
		this.map.set(PREFIX.augmented + path, rec);
	}

	// --- consolidated ---

	async loadConsolidated(): Promise<ConsolidatedRecord | null> {
		const rec = this.map.get(PREFIX.consolidated + "taskIndex") as
			| ConsolidatedRecord
			| undefined;
		if (!rec) return null;
		if (!this.versionOk(rec)) {
			this.map.delete(PREFIX.consolidated + "taskIndex");
			return null;
		}
		return rec;
	}

	async storeConsolidated(taskCache: TaskCache): Promise<void> {
		const rec: ConsolidatedRecord = {
			time: Date.now(),
			version: this.currentVersion,
			schema: this.schemaVersion,
			data: taskCache,
		};
		this.map.set(PREFIX.consolidated + "taskIndex", rec);
	}

	// --- meta ---

	async saveMeta<T = any>(key: string, value: T): Promise<void> {
		this.map.set(META_PREFIX + key, value);
	}

	async loadMeta<T = any>(key: string): Promise<T | null> {
		return (this.map.get(META_PREFIX + key) as T) ?? null;
	}

	// --- listing / lifecycle ---

	async listRawPaths(): Promise<string[]> {
		const out: string[] = [];
		for (const k of this.map.keys()) {
			if (k.startsWith(PREFIX.raw)) out.push(k.substring(PREFIX.raw.length));
		}
		return out;
	}

	async listAugmentedPaths(): Promise<string[]> {
		const out: string[] = [];
		for (const k of this.map.keys()) {
			if (k.startsWith(PREFIX.augmented))
				out.push(k.substring(PREFIX.augmented.length));
		}
		return out;
	}

	async clearFile(path: string): Promise<void> {
		this.map.delete(PREFIX.raw + path);
		this.map.delete(PREFIX.project + path);
		this.map.delete(PREFIX.augmented + path);
	}

	async clear(): Promise<void> {
		this.map.clear();
	}

	async clearNamespace(namespace: Namespace): Promise<void> {
		const prefix = PREFIX[namespace];
		const toDelete: string[] = [];
		for (const k of this.map.keys()) {
			if (k.startsWith(prefix)) toDelete.push(k);
		}
		for (const k of toDelete) this.map.delete(k);
	}

	async getStats(): Promise<{
		totalKeys: number;
		byNamespace: Record<string, number>;
	}> {
		const byNamespace: Record<string, number> = {
			raw: 0,
			project: 0,
			augmented: 0,
			consolidated: 0,
			meta: 0,
		};
		for (const k of this.map.keys()) {
			if (k.startsWith(PREFIX.raw)) byNamespace.raw++;
			else if (k.startsWith(PREFIX.project)) byNamespace.project++;
			else if (k.startsWith(PREFIX.augmented)) byNamespace.augmented++;
			else if (k.startsWith(PREFIX.consolidated)) byNamespace.consolidated++;
			else if (k.startsWith(META_PREFIX)) byNamespace.meta++;
		}
		return { totalKeys: this.map.size, byNamespace };
	}

	// --- test helpers (not on real Storage) ---

	/** Direct access to underlying map for invariant checks. */
	__inspect(): ReadonlyMap<string, any> {
		return this.map;
	}

	__setVersion(version: string): void {
		this.currentVersion = version;
	}

	// --- private ---

	private versionOk(rec: { version?: string; schema?: number }): boolean {
		return rec.version === this.currentVersion && rec.schema === this.schemaVersion;
	}

	private hash(content: any): string {
		const str = JSON.stringify(content);
		let h = 0;
		for (let i = 0; i < str.length; i++) {
			h = (h << 5) - h + str.charCodeAt(i);
			h = h & h;
		}
		return Math.abs(h).toString(16);
	}
}
