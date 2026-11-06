import { Component } from "obsidian";
import { VirtualScrollCallbacks, ViewportData } from "./TableTypes";

/**
 * Virtual scroll manager for handling large datasets with lazy loading
 */
export class VirtualScrollManager extends Component {
	private scrollContainer: HTMLElement;
	private viewport: ViewportData;
	private rowHeight = 40; // Default row height in pixels
	private bufferSize = 10; // Number of extra rows to render outside viewport
	private isLoading = false;
	private totalRows = 0;
	private loadedRows = 0;

	// Scroll handling
	private lastScrollTop = 0;
	private scrollDirection: "up" | "down" = "down";
	private scrollRAF: number | null = null;
	private pendingScrollUpdate = false;

	// Performance optimization
	private lastLoadTriggerTime = 0;
	private loadCooldown = 500; // Minimum 500ms between load attempts
	private isAtBottom = false;
	private isAtTop = true;

	// Height stability
	private heightStabilizer: HTMLElement | null = null;
	private stableHeight = 0;
	private heightUpdateThrottle = 0;

	constructor(
		private containerEl: HTMLElement,
		private pageSize: number,
		private callbacks: VirtualScrollCallbacks
	) {
		super();

		this.scrollContainer = containerEl;
		this.viewport = {
			startIndex: 0,
			endIndex: 0,
			visibleRows: [],
			totalHeight: 0,
			scrollTop: 0,
		};
	}

	onload() {
		this.setupScrollContainer();
		this.setupEventListeners();
		this.calculateViewport();
		this.initializeHeightStabilizer();
	}

	onunload() {
		this.cleanup();
	}

	/**
	 * Setup scroll container
	 */
	private setupScrollContainer() {
		// For table view, we need to find the actual scrollable container
		// which might be the table container, not the table itself
		const scrollableContainer = this.scrollContainer;

		// If the container is not scrollable, look for a parent that is
		if (
			scrollableContainer.style.overflowY !== "auto" &&
			scrollableContainer.style.overflowY !== "scroll"
		) {
			scrollableContainer.style.overflowY = "auto";
		}

		scrollableContainer.style.position = "relative";
	}

	/**
	 * Setup event listeners
	 */
	private setupEventListeners() {
		this.registerDomEvent(
			this.scrollContainer,
			"scroll",
			this.onScroll.bind(this)
		);

		// Handle resize events
		this.registerDomEvent(window, "resize", this.handleResize.bind(this));
	}

	/**
	 * Initialize height stabilizer to prevent scrollbar jitter
	 */
	private initializeHeightStabilizer() {
		// Create a transparent element that maintains consistent height
		this.heightStabilizer = document.createElement("div");
		this.heightStabilizer.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			width: 1px;
			height: ${this.totalRows * this.rowHeight}px;
			pointer-events: none;
			visibility: hidden;
			z-index: -1;
		`;
		this.scrollContainer.appendChild(this.heightStabilizer);
		this.stableHeight = this.totalRows * this.rowHeight;
	}

	/**
	 * Update content and recalculate viewport with height stability
	 */
	public updateContent(totalRowCount: number) {
		this.totalRows = totalRowCount;
		this.isAtBottom = false;
		this.isAtTop = true;

		// Update stable height gradually to prevent jumps
		const newHeight = this.totalRows * this.rowHeight;
		if (Math.abs(newHeight - this.stableHeight) > this.rowHeight) {
			this.updateStableHeight(newHeight);
		}

		this.calculateViewport();
		this.updateVirtualHeight();
	}

	/**
	 * Update stable height with throttling to prevent frequent changes
	 */
	private updateStableHeight(newHeight: number) {
		const now = performance.now();
		if (now - this.heightUpdateThrottle < 100) {
			// Max 10 updates per second
			return;
		}

		this.heightUpdateThrottle = now;
		this.stableHeight = newHeight;

		if (this.heightStabilizer) {
			this.heightStabilizer.style.height = `${newHeight}px`;
		}
	}

	/**
	 * Handle scroll events with requestAnimationFrame
	 */
	private onScroll() {
		// Set pending flag to prevent multiple RAF calls
		if (this.pendingScrollUpdate) {
			return;
		}

		this.pendingScrollUpdate = true;

		// Cancel any existing RAF
		if (this.scrollRAF) {
			cancelAnimationFrame(this.scrollRAF);
		}

		// Use requestAnimationFrame for smooth updates
		this.scrollRAF = requestAnimationFrame(() => {
			this.handleScroll();
			this.pendingScrollUpdate = false;
			this.scrollRAF = null;
		});
	}

	/**
	 * Handle scroll logic with improved stability and reduced frequency
	 */
	public handleScroll() {
		const scrollTop = this.scrollContainer.scrollTop;
		const scrollHeight = this.scrollContainer.scrollHeight;
		const clientHeight = this.scrollContainer.clientHeight;

		// Calculate scroll delta for direction detection
		const scrollDelta = Math.abs(scrollTop - this.lastScrollTop);

		// Update scroll direction
		this.scrollDirection = scrollTop > this.lastScrollTop ? "down" : "up";
		this.lastScrollTop = scrollTop;

		// Update viewport - always calculate to ensure consistency
		this.viewport.scrollTop = scrollTop;
		const viewportChanged = this.calculateViewport();

		// Always notify callback for scroll position changes to ensure smooth rendering
		// Remove the excessive throttling that was causing white screens
		if (viewportChanged || scrollDelta > 0) {
			// Use immediate callback instead of queueMicrotask to reduce delay
			this.callbacks.onScroll(scrollTop);
		}

		// Boundary detection
		this.isAtTop = scrollTop <= 1;
		this.isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;

		// Load more data logic - keep this conservative
		const currentTime = performance.now();
		const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

		const shouldLoadMore =
			!this.isLoading &&
			!this.isAtBottom &&
			this.scrollDirection === "down" &&
			this.loadedRows < this.totalRows &&
			scrollPercentage > 0.85 &&
			currentTime - this.lastLoadTriggerTime > this.loadCooldown;

		if (shouldLoadMore) {
			this.lastLoadTriggerTime = currentTime;
			this.loadMoreData();
		}
	}

	/**
	 * Calculate visible viewport with improved stability
	 */
	private calculateViewport(): boolean {
		const scrollTop = this.viewport.scrollTop;
		const containerHeight = this.scrollContainer.clientHeight;

		// Calculate visible row range with bounds checking
		// Special handling for top boundary to prevent white space
		let startIndex: number;
		if (scrollTop <= this.rowHeight) {
			// When very close to top, always start from 0 to avoid white space
			startIndex = 0;
		} else {
			startIndex = Math.max(
				0,
				Math.floor(scrollTop / this.rowHeight) - this.bufferSize
			);
		}

		const visibleRowCount = Math.ceil(containerHeight / this.rowHeight);
		const endIndex = Math.min(
			this.totalRows - 1,
			startIndex + visibleRowCount + this.bufferSize * 2
		);

		// Reduce threshold for viewport changes to ensure responsive rendering during fast scrolling
		const VIEWPORT_CHANGE_THRESHOLD = 1; // Reduced from 2 to 1 for more responsive updates
		const startIndexDiff = Math.abs(this.viewport.startIndex - startIndex);
		const endIndexDiff = Math.abs(this.viewport.endIndex - endIndex);

		const viewportChanged =
			startIndexDiff >= VIEWPORT_CHANGE_THRESHOLD ||
			endIndexDiff >= VIEWPORT_CHANGE_THRESHOLD;

		if (viewportChanged) {
			this.viewport.startIndex = startIndex;
			this.viewport.endIndex = endIndex;
			this.viewport.totalHeight = this.stableHeight; // Use stable height
		}

		return viewportChanged;
	}

	/**
	 * Update virtual height using stable height reference
	 */
	private updateVirtualHeight() {
		// Use the stable height instead of recalculating
		this.viewport.totalHeight = this.stableHeight;
	}

	/**
	 * Get the expected total content height
	 */
	public getExpectedTotalHeight(): number {
		return this.totalRows * this.rowHeight;
	}

	/**
	 * Check if the scroll container height needs adjustment
	 */
	public needsHeightAdjustment(): boolean {
		const expectedHeight = this.getExpectedTotalHeight();
		const currentHeight = this.scrollContainer.scrollHeight;
		return Math.abs(currentHeight - expectedHeight) > this.rowHeight;
	}

	/**
	 * Load more data with improved state management
	 */
	private loadMoreData() {
		if (this.isLoading || this.isAtBottom) return;

		// Don't load if we've already loaded all data
		if (this.loadedRows >= this.totalRows) {
			this.isLoading = false;
			return;
		}

		this.isLoading = true;

		// Use microtask to ensure smooth scrolling
		queueMicrotask(() => {
			if (this.callbacks.onLoadMore) {
				this.callbacks.onLoadMore();
			}
			this.loadNextBatch();
		});
	}

	/**
	 * Load next batch with better completion detection
	 */
	public loadNextBatch() {
		const nextBatchSize = Math.min(
			this.pageSize,
			this.totalRows - this.loadedRows
		);

		if (nextBatchSize <= 0) {
			this.isLoading = false;
			this.isAtBottom = true; // Mark as bottom reached
			return;
		}

		// Simulate loading delay (in real implementation, this would be async data loading)
		setTimeout(() => {
			this.loadedRows += nextBatchSize;
			this.isLoading = false;

			// Check if we've loaded everything
			if (this.loadedRows >= this.totalRows) {
				this.isAtBottom = true;
			}

			// Recalculate viewport after loading
			this.calculateViewport();
		}, 100);
	}

	/**
	 * Get current viewport data
	 */
	public getViewport(): ViewportData {
		return { ...this.viewport };
	}

	/**
	 * Scroll to specific row
	 */
	public scrollToRow(rowIndex: number, behavior: ScrollBehavior = "smooth") {
		const targetScrollTop = rowIndex * this.rowHeight;
		this.scrollContainer.scrollTo({
			top: targetScrollTop,
			behavior: behavior,
		});
	}

	/**
	 * Scroll to top
	 */
	public scrollToTop(behavior: ScrollBehavior = "smooth") {
		this.scrollToRow(0, behavior);
	}

	/**
	 * Scroll to bottom
	 */
	public scrollToBottom(behavior: ScrollBehavior = "smooth") {
		this.scrollToRow(this.totalRows - 1, behavior);
	}

	/**
	 * Set row height (affects all calculations)
	 */
	public setRowHeight(height: number) {
		this.rowHeight = height;
		this.calculateViewport();
		this.updateVirtualHeight();
	}

	/**
	 * Set buffer size (number of extra rows to render)
	 */
	public setBufferSize(size: number) {
		this.bufferSize = size;
		this.calculateViewport();
	}

	/**
	 * Check if a row is currently visible
	 */
	public isRowVisible(rowIndex: number): boolean {
		return (
			rowIndex >= this.viewport.startIndex &&
			rowIndex <= this.viewport.endIndex
		);
	}

	/**
	 * Get visible row indices
	 */
	public getVisibleRowIndices(): number[] {
		const indices: number[] = [];
		for (
			let i = this.viewport.startIndex;
			i <= this.viewport.endIndex;
			i++
		) {
			indices.push(i);
		}
		return indices;
	}

	/**
	 * Handle container resize
	 */
	private handleResize() {
		// Recalculate viewport on resize
		this.calculateViewport();
	}

	/**
	 * Reset virtual scroll state with improved cleanup
	 */
	public reset() {
		this.totalRows = 0;
		this.loadedRows = 0;
		this.isLoading = false;
		this.lastScrollTop = 0;
		this.isAtBottom = false;
		this.isAtTop = true;
		this.lastLoadTriggerTime = 0;
		this.stableHeight = 0;

		this.viewport = {
			startIndex: 0,
			endIndex: 0,
			visibleRows: [],
			totalHeight: 0,
			scrollTop: 0,
		};

		// Cancel any pending scroll RAF
		if (this.scrollRAF) {
			cancelAnimationFrame(this.scrollRAF);
			this.scrollRAF = null;
		}

		// Reset height stabilizer
		if (this.heightStabilizer) {
			this.heightStabilizer.style.height = "0px";
		}

		// Scroll to top and recalculate viewport
		this.scrollToTop("auto");
		this.calculateViewport();
	}

	/**
	 * Get scroll statistics
	 */
	public getScrollStats() {
		const scrollTop = this.viewport.scrollTop;
		const scrollHeight = this.scrollContainer.scrollHeight;
		const clientHeight = this.scrollContainer.clientHeight;
		const scrollPercentage =
			scrollHeight > 0 ? (scrollTop + clientHeight) / scrollHeight : 0;

		return {
			scrollTop,
			scrollHeight,
			clientHeight,
			scrollPercentage,
			direction: this.scrollDirection,
			visibleRowCount:
				this.viewport.endIndex - this.viewport.startIndex + 1,
			totalRows: this.totalRows,
			loadedRows: this.loadedRows,
			isLoading: this.isLoading,
		};
	}

	/**
	 * Enable or disable virtual scrolling
	 */
	public setEnabled(enabled: boolean) {
		if (enabled) {
			this.registerDomEvent(
				this.scrollContainer,
				"scroll",
				this.onScroll.bind(this)
			);
		} else {
			this.scrollContainer.removeEventListener(
				"scroll",
				this.onScroll.bind(this)
			);
		}
	}

	/**
	 * Cleanup resources including height stabilizer
	 */
	private cleanup() {
		// Cancel any pending animation frame
		if (this.scrollRAF) {
			cancelAnimationFrame(this.scrollRAF);
			this.scrollRAF = null;
		}

		// Remove height stabilizer
		if (this.heightStabilizer && this.heightStabilizer.parentNode) {
			this.heightStabilizer.parentNode.removeChild(this.heightStabilizer);
			this.heightStabilizer = null;
		}

		this.scrollContainer.removeEventListener(
			"scroll",
			this.onScroll.bind(this)
		);
		window.removeEventListener("resize", this.handleResize.bind(this));
	}
}
