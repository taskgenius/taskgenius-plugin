export function getTaskGeniusIcon() {
	return `<svg width="90" height="90" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
<mask id="path-1-inside-1_103_18" fill="white">
<path d="M10 0C15.5228 0 20 4.47715 20 10C20 15.5228 15.5228 20 10 20C4.47715 20 0 15.5228 0 10C0 4.47715 4.47715 0 10 0Z"/>
</mask>
<path d="M10 0V2C14.4183 2 18 5.58172 18 10H20H22C22 3.37258 16.6274 -2 10 -2V0ZM20 10H18C18 14.4183 14.4183 18 10 18V20V22C16.6274 22 22 16.6274 22 10H20ZM10 20V18C5.58172 18 2 14.4183 2 10H0H-2C-2 16.6274 3.37258 22 10 22V20ZM0 10H2C2 5.58172 5.58172 2 10 2V0V-2C3.37258 -2 -2 3.37258 -2 10H0Z" fill="currentColor" mask="url(#path-1-inside-1_103_18)"/>
<path d="M5 12.2803C5.24589 13.3879 6.48927 15.1059 8.0303 15.7084C8.0303 15.7084 8.66246 12.8308 10.1136 11.125C12.7722 8 15.7386 8 15.7386 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
}

export function getStatusIcon(
	status: "notStarted" | "inProgress" | "completed" | "abandoned" | "planned" | "archived" | "paused" | "pause"
) {
	switch (status) {
		case "archived": case "paused": case "pause":
			return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 4H5V20H9V4ZM19 4H15V20H19V4Z" fill="#A1A1A1"/></svg>`;
		case "notStarted":
			return `<svg width="100" height="100" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z" stroke="#A1A1A1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 4"/>
</svg>
`;
		case "inProgress":
			return `<svg width="100" height="100" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z" stroke="#BD8E37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M12 6H17C17.5523 6 18 6.44772 18 7V17C18 17.5523 17.5523 18 17 18H12V6Z" fill="#BD8E37"/>
</svg>
`;
		case "planned":
			return `<svg width="100" height="100" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z" stroke="#A1A1A1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
		case "completed":
			return `<svg width="100" height="100" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M19 2C20.6569 2 22 3.34315 22 5V19C22 20.6569 20.6569 22 19 22H5C3.34315 22 2 20.6569 2 19V5C2 3.34315 3.34315 2 5 2H19ZM15.707 9.29297C15.3409 8.92685 14.7619 8.90426 14.3691 9.22461L14.293 9.29297L11 12.5859L9.70703 11.293L9.63086 11.2246C9.23809 10.9043 8.65908 10.9269 8.29297 11.293C7.92685 11.6591 7.90426 12.2381 8.22461 12.6309L8.29297 12.707L10.293 14.707L10.3691 14.7754C10.7619 15.0957 11.3409 15.0731 11.707 14.707L15.707 10.707L15.7754 10.6309C16.0957 10.2381 16.0731 9.65908 15.707 9.29297Z" fill="#8E68F5"/>
</svg>
`;
		case "abandoned":
			return `<svg width="100" height="100" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M19 2C20.6569 2 22 3.34315 22 5V19C22 20.6569 20.6569 22 19 22H5C3.34315 22 2 20.6569 2 19V5C2 3.34315 3.34315 2 5 2H19ZM15.707 8.29297C15.3165 7.90244 14.6835 7.90244 14.293 8.29297L12 10.5859L9.70703 8.29297L9.63086 8.22461C9.23809 7.90426 8.65908 7.92685 8.29297 8.29297C7.92685 8.65908 7.90426 9.23809 8.22461 9.63086L8.29297 9.70703L10.5859 12L8.29297 14.293C7.90244 14.6835 7.90244 15.3165 8.29297 15.707C8.68349 16.0976 9.31651 16.0976 9.70703 15.707L12 13.4141L14.293 15.707L14.3691 15.7754C14.7619 16.0957 15.3409 16.0731 15.707 15.707C16.0731 15.3409 16.0957 14.7619 15.7754 14.3691L15.707 14.293L13.4141 12L15.707 9.70703C16.0976 9.31651 16.0976 8.68349 15.707 8.29297Z" fill="#A1A1A1"/>
</svg>`;
	}
}
