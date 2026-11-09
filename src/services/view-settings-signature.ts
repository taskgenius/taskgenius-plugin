/** UI configuration only; saving workspace navigation must not refresh every view. */
export function snapshotViewSettings(settings: any): string {
	return JSON.stringify([
		settings.viewConfiguration,
		settings.customCalendarViews,
		settings.defaultViewMode,
		settings.fluentView,
	]);
}
