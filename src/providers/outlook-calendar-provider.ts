/**
 * Outlook / Microsoft 365 Calendar Provider
 *
 * Implementation of Microsoft Graph API for calendar integration.
 * Uses OAuth 2.0 with PKCE for authentication.
 *
 * API Reference: https://docs.microsoft.com/en-us/graph/api/resources/calendar
 *
 * @module outlook-calendar-provider
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
import { OutlookCalendarSourceConfig } from "../types/calendar-provider";
import { CalendarAuthManager } from "../managers/calendar-auth-manager";
import { IcsEvent } from "../types/ics";

// ============================================================================
// Microsoft Graph API Configuration
// ============================================================================

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";

/**
 * Default page size for list operations
 */
const DEFAULT_PAGE_SIZE = 100;

/**
 * Maximum events per calendar view request
 */
const MAX_EVENTS_PER_REQUEST = 999;

// ============================================================================
// Microsoft Graph API Response Types
// ============================================================================

interface GraphCalendarListResponse {
	"@odata.context"?: string;
	"@odata.nextLink"?: string;
	value: GraphCalendar[];
}

interface GraphCalendar {
	id: string;
	name: string;
	color?:
		| "auto"
		| "lightBlue"
		| "lightGreen"
		| "lightOrange"
		| "lightGray"
		| "lightYellow"
		| "lightTeal"
		| "lightPink"
		| "lightBrown"
		| "lightRed"
		| "maxColor";
	hexColor?: string;
	isDefaultCalendar?: boolean;
	canShare?: boolean;
	canViewPrivateItems?: boolean;
	canEdit?: boolean;
	allowedOnlineMeetingProviders?: string[];
	defaultOnlineMeetingProvider?: string;
	isTallyingResponses?: boolean;
	isRemovable?: boolean;
	owner?: {
		name?: string;
		address?: string;
	};
}

interface GraphEventsResponse {
	"@odata.context"?: string;
	"@odata.nextLink"?: string;
	value: GraphEvent[];
}

interface GraphEvent {
	id: string;
	createdDateTime: string;
	lastModifiedDateTime: string;
	changeKey?: string;
	categories?: string[];
	transactionId?: string;
	originalStartTimeZone?: string;
	originalEndTimeZone?: string;
	iCalUId?: string;
	reminderMinutesBeforeStart?: number;
	isReminderOn?: boolean;
	hasAttachments?: boolean;
	subject?: string;
	bodyPreview?: string;
	importance?: "low" | "normal" | "high";
	sensitivity?: "normal" | "personal" | "private" | "confidential";
	isAllDay?: boolean;
	isCancelled?: boolean;
	isOrganizer?: boolean;
	responseRequested?: boolean;
	seriesMasterId?: string;
	showAs?:
		| "free"
		| "tentative"
		| "busy"
		| "oof"
		| "workingElsewhere"
		| "unknown";
	type?: "singleInstance" | "occurrence" | "exception" | "seriesMaster";
	webLink?: string;
	onlineMeetingUrl?: string;
	isOnlineMeeting?: boolean;
	onlineMeetingProvider?: string;
	allowNewTimeProposals?: boolean;
	isDraft?: boolean;
	hideAttendees?: boolean;
	responseStatus?: {
		response?:
			| "none"
			| "organizer"
			| "tentativelyAccepted"
			| "accepted"
			| "declined"
			| "notResponded";
		time?: string;
	};
	body?: {
		contentType?: "text" | "html";
		content?: string;
	};
	start?: GraphDateTime;
	end?: GraphDateTime;
	location?: {
		displayName?: string;
		locationType?: string;
		uniqueId?: string;
		uniqueIdType?: string;
		address?: {
			street?: string;
			city?: string;
			state?: string;
			countryOrRegion?: string;
			postalCode?: string;
		};
		coordinates?: {
			latitude?: number;
			longitude?: number;
		};
	};
	locations?: Array<{
		displayName?: string;
		locationType?: string;
	}>;
	recurrence?: {
		pattern?: {
			type?: string;
			interval?: number;
			month?: number;
			dayOfMonth?: number;
			daysOfWeek?: string[];
			firstDayOfWeek?: string;
			index?: string;
		};
		range?: {
			type?: string;
			startDate?: string;
			endDate?: string;
			recurrenceTimeZone?: string;
			numberOfOccurrences?: number;
		};
	};
	attendees?: GraphAttendee[];
	organizer?: {
		emailAddress?: {
			name?: string;
			address?: string;
		};
	};
}

interface GraphDateTime {
	dateTime: string; // ISO 8601 format without timezone (e.g., "2024-01-15T10:00:00.0000000")
	timeZone: string; // Windows timezone ID (e.g., "Pacific Standard Time")
}

interface GraphAttendee {
	type?: "required" | "optional" | "resource";
	status?: {
		response?:
			| "none"
			| "organizer"
			| "tentativelyAccepted"
			| "accepted"
			| "declined"
			| "notResponded";
		time?: string;
	};
	emailAddress?: {
		name?: string;
		address?: string;
	};
}

// ============================================================================
// Outlook Calendar Provider
// ============================================================================

/**
 * Provider implementation for Outlook/Microsoft 365 Calendar
 */
export class OutlookCalendarProvider extends CalendarProviderBase<OutlookCalendarSourceConfig> {
	private authManager: CalendarAuthManager;

	constructor(
		config: OutlookCalendarSourceConfig,
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
				"outlook",
				this.config.auth,
				this.config.tenantId,
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
	 * Disconnect (client-side cleanup only)
	 * Microsoft doesn't support programmatic token revocation for public clients
	 */
	async disconnect(): Promise<void> {
		this.config.auth = undefined;
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
			throw new ProviderError("Not authenticated with Microsoft", "auth");
		}

		const calendars: CalendarListEntry[] = [];
		let nextLink: string | undefined =
			`${GRAPH_API_BASE}/me/calendars?$top=${DEFAULT_PAGE_SIZE}`;

		while (nextLink) {
			const response: GraphCalendarListResponse =
				await this.makeGraphRequest<GraphCalendarListResponse>(
					nextLink,
				);

			for (const cal of response.value) {
				calendars.push({
					id: cal.id,
					name: cal.name,
					color: this.mapOutlookColor(cal.color, cal.hexColor),
					primary: cal.isDefaultCalendar || false,
					canWrite: cal.canEdit || false,
				});
			}

			nextLink = response["@odata.nextLink"];
		}

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
					"[OutlookCalendarProvider] No calendars configured",
				);
				return [];
			}

			// Fetch events from each calendar in parallel
			const fetchPromises = calendarIds.map((calendarId) =>
				this.fetchEventsFromCalendar(calendarId, options).catch(
					(error) => {
						console.error(
							`[OutlookCalendarProvider] Error fetching ${calendarId}:`,
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
	 * Fetch events from a single calendar using calendarView
	 */
	private async fetchEventsFromCalendar(
		calendarId: string,
		options: FetchEventsOptions,
	): Promise<IcsEvent[]> {
		const events: IcsEvent[] = [];

		// Use calendarView endpoint which expands recurring events
		const params = new URLSearchParams({
			startDateTime: formatDateForApi(options.range.start),
			endDateTime: formatDateForApi(options.range.end),
			$top: String(
				Math.min(
					options.maxResults || MAX_EVENTS_PER_REQUEST,
					MAX_EVENTS_PER_REQUEST,
				),
			),
			$orderby: "start/dateTime",
		});

		let nextLink: string | undefined =
			`${GRAPH_API_BASE}/me/calendars/${calendarId}/calendarView?${params}`;

		while (nextLink) {
			// Check for cancellation
			if (options.signal?.aborted) {
				throw new ProviderError("Request cancelled", "unknown");
			}

			const response: GraphEventsResponse =
				await this.makeGraphRequest<GraphEventsResponse>(nextLink);

			// Convert events
			for (const oEvent of response.value || []) {
				if (!oEvent.isCancelled) {
					events.push(this.convertOutlookEvent(oEvent, calendarId));
				}
			}

			nextLink = response["@odata.nextLink"];
		}

		return events;
	}

	// =========================================================================
	// Event Conversion
	// =========================================================================

	/**
	 * Convert Outlook event to IcsEvent format
	 */
	private convertOutlookEvent(
		oEvent: GraphEvent,
		calendarId: string,
		canWrite = false,
	): IcsEvent {
		const isAllDay = oEvent.isAllDay || false;

		// Parse dates
		// Graph API returns dates without timezone info, but we request UTC
		const dtstart = oEvent.start
			? this.parseGraphDateTime(oEvent.start, isAllDay)
			: new Date();

		const dtend = oEvent.end
			? this.parseGraphDateTime(oEvent.end, isAllDay)
			: undefined;

		// Adjust all-day end date: Outlook Graph API returns exclusive end date (next day),
		// but IcsEvent uses inclusive end dates for consistency with Google provider.
		// Subtract one day to convert from exclusive to inclusive.
		if (isAllDay && dtend) {
			dtend.setDate(dtend.getDate() - 1);
		}

		return {
			uid: oEvent.iCalUId || oEvent.id,
			summary: oEvent.subject || "(No subject)",
			description: oEvent.bodyPreview || oEvent.body?.content,
			location: oEvent.location?.displayName,
			dtstart,
			dtend,
			allDay: isAllDay,
			status: this.mapOutlookStatus(oEvent),
			transp: this.mapShowAsToTransparency(oEvent.showAs),
			created: oEvent.createdDateTime
				? new Date(oEvent.createdDateTime)
				: undefined,
			lastModified: oEvent.lastModifiedDateTime
				? new Date(oEvent.lastModifiedDateTime)
				: undefined,
			priority: this.mapImportanceToPriority(oEvent.importance),
			organizer: oEvent.organizer?.emailAddress
				? {
						name: oEvent.organizer.emailAddress.name,
						email: oEvent.organizer.emailAddress.address,
					}
				: undefined,
			attendees: oEvent.attendees?.map((att) => ({
				name: att.emailAddress?.name,
				email: att.emailAddress?.address,
				role: this.mapAttendeeType(att.type),
				status: this.mapAttendeeStatus(att.status?.response),
			})),
			categories: oEvent.categories,
			customProperties: {
				"X-OUTLOOK-CALENDAR-ID": calendarId,
				"X-OUTLOOK-EVENT-ID": oEvent.id,
				...(oEvent.webLink && { "X-OUTLOOK-WEB-LINK": oEvent.webLink }),
				...(oEvent.sensitivity && {
					"X-OUTLOOK-SENSITIVITY": oEvent.sensitivity,
				}),
			},
			source: this.config as any, // Type assertion needed for now

			// Sync metadata for two-way sync
			providerEventId: oEvent.id,
			providerCalendarId: calendarId,
			etag: oEvent.changeKey, // Outlook uses changeKey instead of ETag
			canEdit: canWrite && !oEvent.isCancelled,
			recurringEventId: oEvent.seriesMasterId,
			isRecurringInstance:
				oEvent.type === "occurrence" || oEvent.type === "exception",
		};
	}

	/**
	 * Parse Graph API datetime
	 */
	private parseGraphDateTime(
		graphDateTime: GraphDateTime,
		isAllDay: boolean,
	): Date {
		if (isAllDay) {
			// All-day events have just date part
			const datePart = graphDateTime.dateTime.split("T")[0];
			const [year, month, day] = datePart.split("-").map(Number);
			return new Date(year, month - 1, day);
		}

		// For timed events, Graph returns local time in the specified timezone
		// We requested UTC via Prefer header, so we can parse directly
		// But the dateTime doesn't include Z, so we need to handle it
		let dateTimeStr = graphDateTime.dateTime;

		// If timezone is UTC, append Z for correct parsing
		if (
			graphDateTime.timeZone === "UTC" ||
			graphDateTime.timeZone === "Etc/UTC"
		) {
			if (!dateTimeStr.endsWith("Z")) {
				dateTimeStr += "Z";
			}
		}

		return new Date(dateTimeStr);
	}

	/**
	 * Map Outlook event status
	 */
	private mapOutlookStatus(oEvent: GraphEvent): string | undefined {
		if (oEvent.isCancelled) return "CANCELLED";
		if (oEvent.responseStatus?.response === "tentativelyAccepted") {
			return "TENTATIVE";
		}
		return "CONFIRMED";
	}

	/**
	 * Map showAs to transparency
	 */
	private mapShowAsToTransparency(
		showAs?: GraphEvent["showAs"],
	): string | undefined {
		switch (showAs) {
			case "free":
				return "TRANSPARENT";
			case "tentative":
			case "busy":
			case "oof":
			case "workingElsewhere":
				return "OPAQUE";
			default:
				return undefined;
		}
	}

	/**
	 * Map importance to priority (1-9 scale)
	 */
	private mapImportanceToPriority(
		importance?: GraphEvent["importance"],
	): number | undefined {
		switch (importance) {
			case "high":
				return 1;
			case "normal":
				return 5;
			case "low":
				return 9;
			default:
				return undefined;
		}
	}

	/**
	 * Map attendee type to role
	 */
	private mapAttendeeType(type?: GraphAttendee["type"]): string | undefined {
		switch (type) {
			case "required":
				return "REQ-PARTICIPANT";
			case "optional":
				return "OPT-PARTICIPANT";
			case "resource":
				return "NON-PARTICIPANT";
			default:
				return undefined;
		}
	}

	/**
	 * Map attendee response status
	 */
	private mapAttendeeStatus(
		response?:
			| "none"
			| "organizer"
			| "tentativelyAccepted"
			| "accepted"
			| "declined"
			| "notResponded",
	): string | undefined {
		switch (response) {
			case "accepted":
				return "ACCEPTED";
			case "declined":
				return "DECLINED";
			case "tentativelyAccepted":
				return "TENTATIVE";
			case "none":
			case "notResponded":
				return "NEEDS-ACTION";
			case "organizer":
				return "ACCEPTED";
			default:
				return undefined;
		}
	}

	/**
	 * Map Outlook color name to hex color
	 */
	private mapOutlookColor(
		colorName?: GraphCalendar["color"],
		hexColor?: string,
	): string | undefined {
		// Prefer hex color if available
		if (hexColor) return hexColor;

		// Map preset color names
		const colorMap: Record<string, string> = {
			lightBlue: "#0078D4",
			lightGreen: "#107C10",
			lightOrange: "#FF8C00",
			lightGray: "#737373",
			lightYellow: "#FFC000",
			lightTeal: "#008272",
			lightPink: "#E3008C",
			lightBrown: "#8E562E",
			lightRed: "#E81123",
		};

		return colorName ? colorMap[colorName] : undefined;
	}

	// =========================================================================
	// API Request Handling
	// =========================================================================

	/**
	 * Make an authenticated request to Microsoft Graph API
	 */
	private async makeGraphRequest<T>(
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
			// Request UTC timezone for consistent date handling
			Prefer: 'outlook.timezone="UTC"',
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
				console.log(
					"[OutlookCalendarProvider] Received 401, attempting token refresh...",
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
					errorBody?.error?.code ||
					`HTTP ${response.status}`;

				throw new ProviderError(
					`Microsoft Graph API error: ${errorMessage}`,
					response.status === 403 ? "permission" : "unknown",
				);
			}

			return response.json as T;
		} catch (error) {
			if (error instanceof ProviderError) {
				throw error;
			}
			throw ProviderError.from(error, "Microsoft Graph API request");
		}
	}

	/**
	 * Make an authenticated request with custom headers (for ETag support)
	 */
	private async makeGraphRequestWithHeaders<T>(
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
			Prefer: 'outlook.timezone="UTC"',
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
			throw ProviderError.from(error, "Microsoft Graph API request");
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
		return !!this.config.auth;
	}

	/**
	 * Create a new event in Outlook Calendar
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
			this.config.calendarIds[0];

		if (!targetCalendarId) {
			return { success: false, error: "No calendar ID specified" };
		}

		try {
			const graphEvent = this.convertIcsEventToGraphEvent(event);
			const url = `${GRAPH_API_BASE}/me/calendars/${targetCalendarId}/events`;

			const response = await this.makeGraphRequestWithHeaders<GraphEvent>(
				url,
				"POST",
				graphEvent,
			);

			if (response.status >= 400) {
				let errorMessage = `Failed to create event: HTTP ${response.status}`;
				if (response.status === 403) {
					errorMessage =
						"Permission denied. Please ensure you have write access to this calendar. " +
						"You may need to reconnect your Outlook Calendar with write permissions.";
				} else if (response.status === 404) {
					errorMessage =
						"Calendar not found. It may have been deleted or you no longer have access.";
				} else if (response.status === 401) {
					errorMessage =
						"Authentication expired. Please reconnect your Outlook Calendar.";
				}
				return {
					success: false,
					error: errorMessage,
				};
			}

			const createdEvent = this.convertOutlookEvent(
				response.data,
				targetCalendarId,
				true,
			);

			console.log(
				`[OutlookCalendarProvider] Created event: ${createdEvent.providerEventId}`,
			);

			return { success: true, event: createdEvent };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(
				"[OutlookCalendarProvider] Failed to create event:",
				error,
			);
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Update an existing event in Outlook Calendar
	 * Uses PATCH for partial updates
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
			event.customProperties?.["X-OUTLOOK-EVENT-ID"];

		if (!eventId) {
			return { success: false, error: "Event ID not found" };
		}

		try {
			const patchBody = this.buildPatchBody(event);
			const url = `${GRAPH_API_BASE}/me/events/${eventId}`;

			// Use If-Match header with changeKey for optimistic locking
			const customHeaders: Record<string, string> = {};
			const changeKey = originalEvent?.etag || event.etag;
			if (changeKey) {
				customHeaders["If-Match"] = `W/"${changeKey}"`;
			}

			const response = await this.makeGraphRequestWithHeaders<GraphEvent>(
				url,
				"PATCH",
				patchBody,
				customHeaders,
			);

			// Handle conflict (412 Precondition Failed)
			if (response.status === 412) {
				console.warn(
					"[OutlookCalendarProvider] Update conflict detected - remote event was modified",
				);
				return {
					success: false,
					error: "Conflict: The event was modified on the server. Please refresh and try again.",
					conflict: true,
				};
			}

			if (response.status >= 400) {
				let errorMessage = `Failed to update event: HTTP ${response.status}`;
				if (response.status === 403) {
					errorMessage =
						"Permission denied. You may not have permission to edit this event or calendar. " +
						"Only events in calendars you own or have write access to can be modified.";
				} else if (response.status === 404) {
					errorMessage =
						"Event not found. It may have been deleted or moved to a different calendar.";
				} else if (response.status === 401) {
					errorMessage =
						"Authentication expired. Please reconnect your Outlook Calendar.";
				}
				return {
					success: false,
					error: errorMessage,
				};
			}

			const targetCalendarId =
				calendarId ||
				event.providerCalendarId ||
				event.customProperties?.["X-OUTLOOK-CALENDAR-ID"] ||
				this.config.calendarIds[0];

			const updatedEvent = this.convertOutlookEvent(
				response.data,
				targetCalendarId,
				true,
			);

			console.log(
				`[OutlookCalendarProvider] Updated event: ${updatedEvent.providerEventId}`,
			);

			return { success: true, event: updatedEvent };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(
				"[OutlookCalendarProvider] Failed to update event:",
				error,
			);
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Delete an event from Outlook Calendar
	 */
	override async deleteEvent(
		eventId: string,
		calendarId?: string,
		etag?: string,
	): Promise<WriteResult> {
		if (!(await this.connect())) {
			return { success: false, error: "Not authenticated" };
		}

		try {
			const url = `${GRAPH_API_BASE}/me/events/${eventId}`;

			const customHeaders: Record<string, string> = {};
			if (etag) {
				customHeaders["If-Match"] = `W/"${etag}"`;
			}

			const response = await this.makeGraphRequestWithHeaders<void>(
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
					`[OutlookCalendarProvider] Deleted event: ${eventId}`,
				);
				return { success: true };
			}

			// 404 means already deleted
			if (response.status === 404) {
				return { success: true };
			}

			// Handle permission denied
			if (response.status === 403) {
				return {
					success: false,
					error:
						"Permission denied. You may not have permission to delete this event. " +
						"Only events in calendars you own or have write access to can be deleted.",
				};
			}

			// Handle authentication expired
			if (response.status === 401) {
				return {
					success: false,
					error: "Authentication expired. Please reconnect your Outlook Calendar.",
				};
			}

			return {
				success: false,
				error: `Failed to delete event: HTTP ${response.status}`,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(
				"[OutlookCalendarProvider] Failed to delete event:",
				error,
			);
			return { success: false, error: errorMessage };
		}
	}

	// =========================================================================
	// Event Conversion (IcsEvent -> Graph Event)
	// =========================================================================

	/**
	 * Convert IcsEvent to Microsoft Graph event format
	 */
	private convertIcsEventToGraphEvent(event: IcsEvent): Partial<GraphEvent> {
		const graphEvent: Partial<GraphEvent> = {
			subject: event.summary,
			body: event.description
				? {
						contentType: "text",
						content: event.description,
					}
				: undefined,
			start: this.toGraphDateTime(event.dtstart, event.allDay, false),
			end: this.toGraphDateTime(
				event.dtend || event.dtstart,
				event.allDay,
				true, // isEndDate: convert to exclusive for Outlook API
			),
			isAllDay: event.allDay,
		};

		// Map location
		if (event.location) {
			graphEvent.location = {
				displayName: event.location,
			};
		}

		// Map showAs from transp
		if (event.transp) {
			graphEvent.showAs =
				event.transp === "TRANSPARENT" ? "free" : "busy";
		}

		// Map importance from priority
		if (event.priority !== undefined) {
			graphEvent.importance = this.mapPriorityToImportance(
				event.priority,
			);
		}

		return graphEvent;
	}

	/**
	 * Build PATCH body with only modified fields
	 * This avoids overwriting fields we don't track (like reminders, attendees, etc.)
	 */
	private buildPatchBody(event: IcsEvent): Partial<GraphEvent> {
		const patchBody: Partial<GraphEvent> = {};

		if (event.summary !== undefined) {
			patchBody.subject = event.summary;
		}
		if (event.description !== undefined) {
			patchBody.body = {
				contentType: "text",
				content: event.description,
			};
		}
		if (event.location !== undefined) {
			patchBody.location = {
				displayName: event.location,
			};
		}
		if (event.dtstart) {
			patchBody.start = this.toGraphDateTime(
				event.dtstart,
				event.allDay,
				false,
			);
			patchBody.isAllDay = event.allDay;
		}
		if (event.dtend) {
			patchBody.end = this.toGraphDateTime(
				event.dtend,
				event.allDay,
				true, // isEndDate: convert to exclusive for Outlook API
			);
		}
		if (event.transp) {
			patchBody.showAs = event.transp === "TRANSPARENT" ? "free" : "busy";
		}
		if (event.priority !== undefined) {
			patchBody.importance = this.mapPriorityToImportance(event.priority);
		}

		return patchBody;
	}

	/**
	 * Convert Date to Graph DateTime format
	 *
	 * For all-day events, Outlook Graph API expects exclusive end date (the day after the last day).
	 * Since IcsEvent uses inclusive dates, we add one day to end dates when writing.
	 *
	 * @param date - The date to convert
	 * @param allDay - Whether this is an all-day event
	 * @param isEndDate - Whether this is an end date (for all-day event exclusive handling)
	 */
	private toGraphDateTime(
		date: Date,
		allDay: boolean,
		isEndDate = false,
	): GraphDateTime {
		if (allDay) {
			// For all-day end dates, Outlook expects EXCLUSIVE date (day after the last day)
			// Since IcsEvent stores inclusive dates, add one day for end dates
			const targetDate = isEndDate
				? new Date(date.getTime() + 24 * 60 * 60 * 1000) // Add one day
				: date;

			const year = targetDate.getFullYear();
			const month = String(targetDate.getMonth() + 1).padStart(2, "0");
			const day = String(targetDate.getDate()).padStart(2, "0");
			return {
				dateTime: `${year}-${month}-${day}T00:00:00.0000000`,
				timeZone: "UTC",
			};
		} else {
			// Format without Z suffix, specify UTC timezone
			const isoString = date.toISOString();
			return {
				dateTime: isoString.replace("Z", ""),
				timeZone: "UTC",
			};
		}
	}

	/**
	 * Map ICS priority (1-9) to Outlook importance
	 */
	private mapPriorityToImportance(
		priority: number,
	): GraphEvent["importance"] {
		if (priority >= 1 && priority <= 4) return "high";
		if (priority === 5) return "normal";
		if (priority >= 6 && priority <= 9) return "low";
		return "normal";
	}
}
