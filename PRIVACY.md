# Privacy Policy - Task Genius Plugin for Obsidian

**Last Updated: December 2025**

> This privacy policy applies to the **Task Genius Plugin for Obsidian**. For the Task Genius Desktop application privacy policy, please visit our [documentation site](https://taskgenius.md/privacy/desktop).

## 1. Core Privacy Principle

Task Genius Plugin is designed with privacy-first principles. Your core task data remains entirely within your local Obsidian vault. We do not operate any servers that collect or store your personal data.

## 2. Local Storage

All primary data is stored locally in your Obsidian vault:

- **Task data**: Stored as markdown files in your vault
- **Plugin settings**: Stored in `.obsidian/plugins/obsidian-task-genius/data.json`
- **Cache data**: Temporary cache stored locally for performance optimization

You have complete control over your data.

## 3. Google Calendar Integration

Task Genius offers **optional** integration with Google Calendar to display your calendar events alongside tasks. This feature requires your explicit authorization.

### 3.1 What We Access

When you connect your Google Calendar, the plugin requests:

| Permission | Purpose |
|------------|---------|
| `calendar` | Read your calendars and events, and create, update or delete events when you use calendar write-back |
| `userinfo.email` | Display your connected account email in settings |

Microsoft Outlook connections request `Calendars.ReadWrite`, `User.Read` and `offline_access` for the same purposes. Apple iCloud connections use the app-specific password you enter, sent only to `caldav.icloud.com`.

**Important**: these are read/write permissions. The plugin only changes events in your calendar when you use a write-back feature.

### 3.2 How Authorization Works

1. **OAuth 2.0 with PKCE**: We use industry-standard OAuth 2.0 with PKCE for secure authentication
2. **Local Callback**: Authorization is handled via a local HTTP server on your computer (127.0.0.1)
3. **Token Storage**: Access tokens are stored locally in your plugin settings
4. **Direct Communication**: Calendar data is fetched directly from Google to your local Obsidian - we do not proxy or store any data

### 3.3 Data Handling

- Calendar events are fetched directly from Google and cached locally
- No calendar data is transmitted to any third-party servers
- Tokens can be revoked at any time through plugin settings or Google Account settings

### 3.4 Revoking Access

You can revoke access at any time:

1. **In Plugin Settings**: Click "Disconnect" next to your connected account
2. **In Google Account**: Visit [Google Security Settings](https://myaccount.google.com/permissions) and remove "Task Genius for Obsidian"

## 4. ICS/iCal Calendar Integration

For ICS/iCal URL imports:

- Data is fetched directly from the URL you provide
- Data is cached locally in your vault
- No data is transmitted to third-party servers

## 5. MCP Integration

If you enable MCP (Model Context Protocol) integration:

- MCP server runs locally on your computer
- Connection is authenticated using App ID
- You control which AI clients can access your task data

## 6. Network Activity

Out of the box the plugin makes **no network requests**: translations, onboarding images and changelogs are all bundled inside the plugin, and there is no telemetry, analytics, update check or remote configuration.

The plugin only connects to the network when you take one of these actions:

| You... | The plugin contacts |
|--------|---------------------|
| Connect Google Calendar | `accounts.google.com`, `oauth2.googleapis.com`, `www.googleapis.com` |
| Connect Outlook | `login.microsoftonline.com`, `graph.microsoft.com` |
| Connect Apple iCloud | `caldav.icloud.com` |
| Add an ICS/iCal subscription | Only the URL you entered |
| Enable the MCP server | Nothing external: it listens on `127.0.0.1` by default |
| Click "How to use", Documentation, Discord, GitHub or donate links | The linked page (in an embedded viewer or your browser) |

## 7. Open Source Transparency

The source code is publicly available at [GitHub](https://github.com/Quorafind/Obsidian-Task-Progress-Bar), allowing you to verify how the plugin handles your data.

## 8. Children's Privacy

Task Genius does not knowingly collect data from children under 13. The plugin does not collect any personal data from users of any age.

## 9. Contact

- **Developer:** Boninall
- **Email:** quorafind@gmail.com
- **GitHub:** [github.com/Quorafind/Obsidian-Task-Progress-Bar](https://github.com/Quorafind/Obsidian-Task-Progress-Bar)

## 10. Google API Services User Data Policy

Task Genius's use of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.
