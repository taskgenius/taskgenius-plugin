/**
 * Google Calendar Provider
 *
 * Implementation of Google Calendar API v3 integration.
 * Uses OAuth 2.0 with PKCE for authentication.
 *
 * API Reference: https://developers.google.com/calendar/api/v3/reference
 *
 * @module google-calendar-provider
 */

import { requestUrl } from "obsidian";
import {
	CalendarProviderBase,
	CalendarListEntry,
	FetchEventsOptions,
	ProviderError,
	formatDateForApi,
	WriteResult,
	UpdateEventOptions,
} from "./calendar-provider-base";
import { GoogleCalendarSourceConfig } from "../types/calendar-provider";
import { CalendarAuthManager } from "../managers/calendar-auth-manager";
import { IcsEvent } from "../types/ics";

// ============================================================================
// Google Calendar API Configuration
// ============================================================================

const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * Maximum results per API request (Google's limit is 2500)
 */
const DEFAULT_MAX_RESULTS = 2500;

/**
 * Request timeout in milliseconds
 */
const REQUEST_TIMEOUT_MS = 30000;

// ============================================================================
// Google API Response Types
// ============================================================================

interface GoogleCalendarListResponse {
	kind: string;
	etag: string;
	nextPageToken?: string;
	items: GoogleCalendarEntry[];
}

interface GoogleCalendarEntry {
	kind: string;
	etag: string;
	id: string;
	summary: string;
	description?: string;
	timeZone?: string;
	colorId?: string;
	backgroundColor?: string;
	foregroundColor?: string;
	selected?: boolean;
	accessRole: "freeBusyReader" | "reader" | "writer" | "owner";
	primary?: boolean;
}

interface GoogleEventsResponse {
	kind: string;
	etag: string;
	summary: string;
	updated: string;
	timeZone: string;
	accessRole: string;
	nextPageToken?: string;
	nextSyncToken?: string;
	items: GoogleEvent[];
}

interface GoogleEvent {
	kind: string;
	etag: string;
	id: string;
	status: "confirmed" | "tentative" | "cancelled";
	htmlLink?: string;
	created: string;
	updated: string;
	summary?: string;
	description?: string;
	location?: string;
	colorId?: string;
	creator?: {
		id?: string;
		email?: string;
		displayName?: string;
		self?: boolean;
	};
	organizer?: {
		id?: string;
		email?: string;
		displayName?: string;
		self?: boolean;
	};
	start: GoogleEventDateTime;
	end: GoogleEventDateTime;
	endTimeUnspecified?: boolean;
	recurrence?: string[];
	recurringEventId?: string;
	originalStartTime?: GoogleEventDateTime;
	transparency?: "opaque" | "transparent";
	visibility?: "default" | "public" | "private" | "confidential";
	iCalUID?: string;
	sequence?: number;
	attendees?: GoogleAttendee[];
	extendedProperties?: {
		private?: Record<string, string>;
		shared?: Record<string, string>;
	};
	reminders?: {
		useDefault: boolean;
		overrides?: Array<{ method: string; minutes: number }>;
	};
}

interface GoogleEventDateTime {
	date?: string; // For all-day events (YYYY-MM-DD)
	dateTime?: string; // For timed events (RFC3339)
	timeZone?: string;
}

interface GoogleAttendee {
	id?: string;
	email?: string;
	displayName?: string;
	organizer?: boolean;
	self?: boolean;
	resource?: boolean;
	optional?: boolean;
	responseStatus?: "needsAction" | "declined" | "tentative" | "accepted";
	comment?: string;
	additionalGuests?: number;
}

// ============================================================================
// Google Calendar Provider
// ============================================================================

/**
 * Provider implementation for Google Calendar
 */
export class GoogleCalendarProvider extends CalendarProviderBase<GoogleCalendarSourceConfig> {
	private authManager: CalendarAuthManager;

	constructor(
		config: GoogleCalendarSourceConfig,
		authManager: CalendarAuthManager,
	) {
		super(config);
		this.authManager = authManager;
	}

	// =========================================================================
	// Connection Management
	// =========================================================================

	/**
	 * Connect and validate authentication
	 */
	async connect(): Promise<boolean> {
		if (!this.config.auth) {
			this.updateStatus({
				status: "error",
				error: "Not authenticated",
			});
			return false;
		}

		try {
			// Ensure token is valid (refresh if needed)
			const validToken = await this.authManager.ensureValidToken(
				"google",
				this.config.auth,
			);

			// Update config with refreshed token if changed
			if (validToken !== this.config.auth) {
				this.config.auth = validToken;
			}

			this.updateStatus({ status: "idle" });
			return true;
		} catch (error) {
			this.handleError(error, "Connection");
			return false;
		}
	}

	/**
	 * Disconnect and revoke tokens
	 */
	async disconnect(): Promise<void> {
		if (this.config.auth) {
			try {
				await this.authManager.revokeTokens("google", this.config.auth);
			} catch (error) {
				console.warn(
					"[GoogleCalendarProvider] Token revocation failed:",
					error,
				);
			}
			this.config.auth = undefined;
		}

		this.updateStatus({ status: "disabled" });
	}

	// =========================================================================
	// Calendar Operations
	// =========================================================================

	/**
	 * List all accessible calendars
	 */
	async listCalendars(): Promise<CalendarListEntry[]> {
		if (!(await this.connect())) {
			throw new ProviderError(
				"Not authenticated with Google Calendar",
				"auth",
			);
		}

		const calendars: CalendarListEntry[] = [];
		let pageToken: string | undefined;

		do {
			const params = new URLSearchParams({
				maxResults: "250",
			});
			if (pageToken) {
				params.set("pageToken", pageToken);
			}

			const url = `${GOOGLE_CALENDAR_API_BASE}/users/me/calendarList?${params}`;
			const response =
				await this.makeAuthenticatedRequest<GoogleCalendarListResponse>(
					url,
				);

			for (const cal of response.items) {
				calendars.push({
					id: cal.id,
					name: cal.summary,
					description: cal.description,
					color: cal.backgroundColor,
					primary: cal.primary || false,
					canWrite:
						cal.accessRole === "writer" ||
						cal.accessRole === "owner",
					timeZone: cal.timeZone,
				});
			}

			pageToken = response.nextPageToken;
		} while (pageToken);

		return calendars;
	}

	/**
	 * Fetch events within the specified options
	 */
	async getEvents(options: FetchEventsOptions): Promise<IcsEvent[]> {
		if (!(await this.connect())) {
			return [];
		}

		const allEvents: IcsEvent[] = [];
		this.setSyncing(true);

		try {
			// Determine which calendars to fetch
			const calendarIds = options.calendarIds?.length
				? options.calendarIds
				: this.config.calendarIds;

			if (calendarIds.length === 0) {
				console.warn(
					"[GoogleCalendarProvider] No calendars configured",
				);
				return [];
			}

			// Fetch events from each calendar in parallel
			const fetchPromises = calendarIds.map((calendarId) =>
				this.fetchEventsFromCalendar(calendarId, options).catch(
					(error) => {
						console.error(
							`[GoogleCalendarProvider] Error fetching ${calendarId}:`,
							error,
						);
						return [] as IcsEvent[];
					},
				),
			);

			const results = await Promise.all(fetchPromises);
			for (const events of results) {
				allEvents.push(...events);
			}

			this.updateStatus({
				status: "idle",
				lastSync: Date.now(),
				eventCount: allEvents.length,
			});
		} catch (error) {
			this.handleError(error, "Fetch events");
		} finally {
			this.setSyncing(false);
		}

		return allEvents;
	}

	/**
	 * Fetch events from a single calendar
	 */
	private async fetchEventsFromCalendar(
		calendarId: string,
		options: FetchEventsOptions,
	): Promise<IcsEvent[]> {
		const events: IcsEvent[] = [];
		let pageToken: string | undefined;

		do {
			// Check for cancellation
			if (options.signal?.aborted) {
				throw new ProviderError("Request cancelled", "unknown");
			}

			const params = new URLSearchParams({
				timeMin: formatDateForApi(options.range.start),
				timeMax: formatDateForApi(options.range.end),
				singleEvents: String(options.expandRecurring !== false), // Default true
				orderBy: "startTime",
				maxResults: String(options.maxResults || DEFAULT_MAX_RESULTS),
			});

			if (pageToken) {
				params.set("pageToken", pageToken);
			}

			const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(
				calendarId,
			)}/events?${params}`;

			const response =
				await this.makeAuthenticatedRequest<GoogleEventsResponse>(url);

			// Convert events
			for (const gEvent of response.items || []) {
				if (gEvent.status !== "cancelled") {
					events.push(this.convertGoogleEvent(gEvent, calendarId));
				}
			}

			pageToken = response.nextPageToken;
		} while (pageToken);

		return events;
	}

	// =========================================================================
	// Event Conversion
	// =========================================================================

	/**
	 * Convert Google event to IcsEvent format
	 */
	private convertGoogleEvent(
		gEvent: GoogleEvent,
		calendarId: string,
		canWrite = false,
	): IcsEvent {
		const isAllDay = !!gEvent.start.date;

		// Parse dates
		const dtstart = isAllDay
			? this.parseAllDayDate(gEvent.start.date!)
			: new Date(gEvent.start.dateTime!);

		// For all-day events, Google API's end date is EXCLUSIVE (the day after the last day)
		// We need to subtract one day to get the actual last day of the event
		const dtend = isAllDay
			? this.parseAllDayDateExclusive(gEvent.end.date!)
			: gEvent.end.dateTime
				? new Date(gEvent.end.dateTime)
				: undefined;

		return {
			uid: gEvent.iCalUID || gEvent.id,
			summary: gEvent.summary || "(No title)",
			description: gEvent.description,
			location: gEvent.location,
			dtstart,
			dtend,
			allDay: isAllDay,
			status: this.mapGoogleStatus(gEvent.status),
			transp: gEvent.transparency,
			created: gEvent.created ? new Date(gEvent.created) : undefined,
			lastModified: gEvent.updated ? new Date(gEvent.updated) : undefined,
			organizer: gEvent.organizer
				? {
						name: gEvent.organizer.displayName,
						email: gEvent.organizer.email,
					}
				: undefined,
			attendees: gEvent.attendees?.map((att) => ({
				name: att.displayName,
				email: att.email,
				role: att.optional ? "OPT-PARTICIPANT" : "REQ-PARTICIPANT",
				status: this.mapAttendeeStatus(att.responseStatus),
			})),
			rrule: gEvent.recurrence?.join("\n"),
			customProperties: {
				"X-GOOGLE-CALENDAR-ID": calendarId,
				"X-GOOGLE-EVENT-ID": gEvent.id,
				...(gEvent.htmlLink && {
					"X-GOOGLE-HTML-LINK": gEvent.htmlLink,
				}),
			},
			source: this.config as any, // Type assertion needed for now

			// Sync metadata for two-way sync
			providerEventId: gEvent.id,
			providerCalendarId: calendarId,
			etag: gEvent.etag,
			canEdit: canWrite && gEvent.status !== "cancelled",
			recurringEventId: gEvent.recurringEventId,
			isRecurringInstance: !!gEvent.recurringEventId,
		};
	}

	/**
	 * Parse all-day date string (YYYY-MM-DD)
	 */
	private parseAllDayDate(dateStr: string): Date {
		const [year, month, day] = dateStr.split("-").map(Number);
		return new Date(year, month - 1, day);
	}

	/**
	 * Parse all-day end date string (YYYY-MM-DD) - EXCLUSIVE
	 * Google Calendar API returns end date as exclusive (day after the last day)
	 * So we subtract one day to get the actual last day
	 */
	private parseAllDayDateExclusive(dateStr: string): Date {
		const [year, month, day] = dateStr.split("-").map(Number);
		const date = new Date(year, month - 1, day);
		// Subtract one day to convert from exclusive to inclusive
		date.setDate(date.getDate() - 1);
		return date;
	}

	/**
	 * Map Google event status to ICS status
	 */
	private mapGoogleStatus(status: GoogleEvent["status"]): string | undefined {
		switch (status) {
			case "confirmed":
				return "CONFIRMED";
			case "tentative":
				return "TENTATIVE";
			case "cancelled":
				return "CANCELLED";
			default:
				return undefined;
		}
	}

	/**
	 * Map Google attendee response status
	 */
	private mapAttendeeStatus(
		status?: GoogleAttendee["responseStatus"],
	): string | undefined {
		switch (status) {
			case "accepted":
				return "ACCEPTED";
			case "declined":
				return "DECLINED";
			case "tentative":
				return "TENTATIVE";
			case "needsAction":
				return "NEEDS-ACTION";
			default:
				return undefined;
		}
	}

	// =========================================================================
	// API Request Handling
	// =========================================================================

	/**
	 * Make an authenticated request to Google Calendar API
	 */
	private async makeAuthenticatedRequest<T>(
		url: string,
		method = "GET",
		body?: unknown,
	): Promise<T> {
		if (!this.config.auth) {
			throw new ProviderError("No authentication token", "auth");
		}

		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.config.auth.accessToken}`,
			Accept: "application/json",
		};

		if (body) {
			headers["Content-Type"] = "application/json";
		}

		try {
			const response = await requestUrl({
				url,
				method,
				headers,
				body: body ? JSON.stringify(body) : undefined,
				throw: false, // Handle errors manually
			});

			// Handle 401 - try token refresh once
			if (response.status === 401) {
				console.log(
					"[GoogleCalendarProvider] Received 401, attempting token refresh...",
				);

				if (await this.connect()) {
					// Retry with new token
					headers.Authorization = `Bearer ${this.config.auth!.accessToken}`;
					const retryResponse = await requestUrl({
						url,
						method,
						headers,
						body: body ? JSON.stringify(body) : undefined,
						throw: false,
					});

					if (retryResponse.status === 200) {
						return retryResponse.json as T;
					}

					throw new ProviderError(
						`API request failed after token refresh: ${retryResponse.status}`,
						"auth",
					);
				}

				throw new ProviderError(
					"Authentication failed - token refresh unsuccessful",
					"auth",
				);
			}

			// Handle other errors
			if (response.status >= 400) {
				const errorBody = response.json;
				const errorMessage =
					errorBody?.error?.message ||
					errorBody?.error ||
					`HTTP ${response.status}`;

				throw new ProviderError(
					`Google Calendar API error: ${errorMessage}`,
					response.status === 403 ? "permission" : "unknown",
				);
			}

			return response.json as T;
		} catch (error) {
			if (error instanceof ProviderError) {
				throw error;
			}
			throw ProviderError.from(error, "Google Calendar API request");
		}
	}

	/**
	 * Make an authenticated request with custom headers (for ETag support)
	 */
	private async makeAuthenticatedRequestWithHeaders<T>(
		url: string,
		method = "GET",
		body?: unknown,
		customHeaders?: Record<string, string>,
	): Promise<{ data: T; status: number; headers: Record<string, string> }> {
		if (!this.config.auth) {
			throw new ProviderError("No authentication token", "auth");
		}

		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.config.auth.accessToken}`,
			Accept: "application/json",
			...customHeaders,
		};

		if (body) {
			headers["Content-Type"] = "application/json";
		}

		try {
			const response = await requestUrl({
				url,
				method,
				headers,
				body: body ? JSON.stringify(body) : undefined,
				throw: false,
			});

			// Handle 401 - try token refresh once
			if (response.status === 401) {
				if (await this.connect()) {
					headers.Authorization = `Bearer ${this.config.auth!.accessToken}`;
					const retryResponse = await requestUrl({
						url,
						method,
						headers,
						body: body ? JSON.stringify(body) : undefined,
						throw: false,
					});

					return {
						data: retryResponse.json as T,
						status: retryResponse.status,
						headers: retryResponse.headers,
					};
				}
				throw new ProviderError("Authentication failed", "auth");
			}

			return {
				data: response.json as T,
				status: response.status,
				headers: response.headers,
			};
		} catch (error) {
			if (error instanceof ProviderError) {
				throw error;
			}
			throw ProviderError.from(error, "Google Calendar API request");
		}
	}

	// =========================================================================
	// Write Operations (Two-way Sync)
	// =========================================================================

	/**
	 * Check if this provider supports write operations
	 */
	override supportsWrite(): boolean {
		return true;
	}

	/**
	 * Check if a specific calendar can be written to
	 */
	override canWriteToCalendar(calendarId?: string): boolean {
		// For now, assume write access if authenticated
		// A more accurate check would require caching calendar access roles
		return !!this.config.auth;
	}

	/**
	 * Create a new event in Google Calendar
	 */
	override async createEvent(
		event: IcsEvent,
		calendarId?: string,
	): Promise<WriteResult> {
		if (!(await this.connect())) {
			return { success: false, error: "Not authenticated" };
		}

		const targetCalendarId =
			calendarId ||
			event.providerCalendarId ||
			this.config.calendarIds[0] ||
			"primary";

		try {
			const googleEvent = this.convertIcsEventToGoogleEvent(event);
			const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(targetCalendarId)}/events`;

			const response =
				await this.makeAuthenticatedRequestWithHeaders<GoogleEvent>(
					url,
					"POST",
					googleEvent,
				);

			if (response.status >= 400) {
				return {
					success: false,
					error: `Failed to create event: HTTP ${response.status}`,
				};
			}

			const createdEvent = this.convertGoogleEvent(
				response.data,
				targetCalendarId,
				true,
			);

			console.log(
				`[GoogleCalendarProvider] Created event: ${createdEvent.providerEventId}`,
			);

			return { success: true, event: createdEvent };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(
				"[GoogleCalendarProvider] Failed to create event:",
				error,
			);
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Update an existing event in Google Calendar
	 * Uses PATCH for partial updates to avoid overwriting untracked fields
	 */
	override async updateEvent(
		options: UpdateEventOptions,
	): Promise<WriteResult> {
		if (!(await this.connect())) {
			return { success: false, error: "Not authenticated" };
		}

		const { event, originalEvent, calendarId } = options;
		const eventId =
			event.providerEventId ||
			event.customProperties?.["X-GOOGLE-EVENT-ID"];
		const targetCalendarId =
			calendarId ||
			event.providerCalendarId ||
			event.customProperties?.["X-GOOGLE-CALENDAR-ID"] ||
			"primary";

		if (!eventId) {
			return { success: false, error: "Event ID not found" };
		}

		try {
			// Build PATCH body with only the fields we want to update
			const patchBody = this.buildPatchBody(event);
			const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(targetCalendarId)}/events/${encodeURIComponent(eventId)}`;

			// Use ETag for optimistic locking if available
			const customHeaders: Record<string, string> = {};
			const etag = originalEvent?.etag || event.etag;
			if (etag) {
				customHeaders["If-Match"] = etag;
			}

			let response =
				await this.makeAuthenticatedRequestWithHeaders<GoogleEvent>(
					url,
					"PATCH",
					patchBody,
					customHeaders,
				);

			// Handle conflict (412 Precondition Failed) - retry without ETag
			if (response.status === 412) {
				console.warn(
					"[GoogleCalendarProvider] Update conflict detected - retrying without ETag",
				);
				// Retry without ETag to force update
				response =
					await this.makeAuthenticatedRequestWithHeaders<GoogleEvent>(
						url,
						"PATCH",
						patchBody,
						{}, // No If-Match header
					);
			}

			if (response.status >= 400) {
				let errorMessage = `Failed to update event: HTTP ${response.status}`;
				if (response.status === 403) {
					// Check if this is a scope issue by examining current token scope
					const currentScope = this.config.auth?.scope || "";
					const hasWriteScope =
						currentScope.includes("calendar.events") &&
						!currentScope.includes("calendar.readonly");

					if (!hasWriteScope) {
						errorMessage =
							"Your Google Calendar authorization only has read-only permissions. " +
							"Please disconnect and reconnect your Google Calendar in settings to grant write access.";
					} else {
						errorMessage =
							"Permission denied. This may be a subscribed or shared calendar that you cannot edit. " +
							"Only events in your own calendars can be modified.";
					}
				} else if (response.status === 401) {
					errorMessage =
						"Authentication expired. Please re-authorize your Google Calendar connection.";
				}
				return {
					success: false,
					error: errorMessage,
				};
			}

			const updatedEvent = this.convertGoogleEvent(
				response.data,
				targetCalendarId,
				true,
			);

			console.log(
				`[GoogleCalendarProvider] Updated event: ${updatedEvent.providerEventId}`,
			);

			return { success: true, event: updatedEvent };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(
				"[GoogleCalendarProvider] Failed to update event:",
				error,
			);
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Delete an event from Google Calendar
	 */
	override async deleteEvent(
		eventId: string,
		calendarId?: string,
		etag?: string,
	): Promise<WriteResult> {
		if (!(await this.connect())) {
			return { success: false, error: "Not authenticated" };
		}

		const targetCalendarId = calendarId || "primary";

		try {
			const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(targetCalendarId)}/events/${encodeURIComponent(eventId)}`;

			const customHeaders: Record<string, string> = {};
			if (etag) {
				customHeaders["If-Match"] = etag;
			}

			const response =
				await this.makeAuthenticatedRequestWithHeaders<void>(
					url,
					"DELETE",
					undefined,
					customHeaders,
				);

			// Handle conflict
			if (response.status === 412) {
				return {
					success: false,
					error: "Conflict: The event was modified on the server.",
					conflict: true,
				};
			}

			// 204 No Content is success for DELETE
			if (response.status === 204 || response.status === 200) {
				console.log(
					`[GoogleCalendarProvider] Deleted event: ${eventId}`,
				);
				return { success: true };
			}

			// 410 Gone means already deleted
			if (response.status === 410) {
				return { success: true }; // Already deleted, consider success
			}

			return {
				success: false,
				error: `Failed to delete event: HTTP ${response.status}`,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(
				"[GoogleCalendarProvider] Failed to delete event:",
				error,
			);
			return { success: false, error: errorMessage };
		}
	}

	// =========================================================================
	// Event Conversion (IcsEvent -> Google Event)
	// =========================================================================

	/**
	 * Convert IcsEvent to Google Calendar event format
	 */
	private convertIcsEventToGoogleEvent(
		event: IcsEvent,
	): Partial<GoogleEvent> {
		const googleEvent: Partial<GoogleEvent> = {
			summary: event.summary,
			description: event.description,
			location: event.location,
			start: this.toGoogleDateTime(event.dtstart, event.allDay, false),
			end: this.toGoogleDateTime(
				event.dtend || event.dtstart,
				event.allDay,
				true, // isEndDate: convert to exclusive for Google API
			),
		};

		// Map status
		if (event.status) {
			googleEvent.status = this.mapIcsStatusToGoogle(event.status);
		}

		// Map transparency
		if (event.transp) {
			googleEvent.transparency =
				event.transp === "TRANSPARENT" ? "transparent" : "opaque";
		}

		return googleEvent;
	}

	/**
	 * Build PATCH body with only modified fields
	 * This avoids overwriting fields we don't track (like reminders, conferenceData, etc.)
	 */
	private buildPatchBody(event: IcsEvent): Partial<GoogleEvent> {
		const patchBody: Partial<GoogleEvent> = {};

		// Always include these core fields
		if (event.summary !== undefined) {
			patchBody.summary = event.summary;
		}
		if (event.description !== undefined) {
			patchBody.description = event.description;
		}
		if (event.location !== undefined) {
			patchBody.location = event.location;
		}
		if (event.dtstart) {
			patchBody.start = this.toGoogleDateTime(
				event.dtstart,
				event.allDay,
				false,
			);
		}
		if (event.dtend) {
			patchBody.end = this.toGoogleDateTime(
				event.dtend,
				event.allDay,
				true, // isEndDate: convert to exclusive for Google API
			);
		}
		if (event.status) {
			patchBody.status = this.mapIcsStatusToGoogle(event.status);
		}
		if (event.transp) {
			patchBody.transparency =
				event.transp === "TRANSPARENT" ? "transparent" : "opaque";
		}

		return patchBody;
	}

	/**
	 * Convert Date to Google DateTime format
	 */
	private toGoogleDateTime(
		date: Date,
		allDay: boolean,
		isEndDate = false,
	): GoogleEventDateTime {
		if (allDay) {
			// For all-day end dates, Google API expects EXCLUSIVE date (day after the last day)
			const targetDate = isEndDate
				? new Date(date.getTime() + 24 * 60 * 60 * 1000) // Add one day
				: date;
			const year = targetDate.getFullYear();
			const month = String(targetDate.getMonth() + 1).padStart(2, "0");
			const day = String(targetDate.getDate()).padStart(2, "0");
			return { date: `${year}-${month}-${day}` };
		} else {
			// Format as RFC3339
			return { dateTime: date.toISOString() };
		}
	}

	/**
	 * Map ICS status to Google event status
	 */
	private mapIcsStatusToGoogle(status: string): GoogleEvent["status"] {
		switch (status.toUpperCase()) {
			case "CONFIRMED":
				return "confirmed";
			case "TENTATIVE":
				return "tentative";
			case "CANCELLED":
				return "cancelled";
			default:
				return "confirmed";
		}
	}
}
