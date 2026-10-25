# PromptDirector Privacy Policy

Effective date: September 20, 2026

PromptDirector is a local-first Chrome extension for collecting, organizing, searching, backing up, and sharing personal creative references. It has no developer-operated data server or user account system, does not collect analytics, does not show ads, and does not sell user data.

## Data handled

PromptDirector handles data only when the user explicitly captures, imports, exports, analyzes, generates, or composes with it. This can include selected website text and resources, source URLs and attribution, screenshots, user prompts and notes, projects, tags, Creative Skills, settings, and credentials for AI services chosen by the user.

Cases, media, tags, settings, Creative Skills, and API keys are stored in the browser's local extension storage by default. Image processing, document extraction, archive creation, and offline previews run locally. API keys are excluded from exports, shared packages, drafts, diagnostics, and logs.

When the user saves a selected Douyin, YouTube or Bilibili video, an installed local component may resolve its work URL, download from the original platform and merge audio and video. Only the selected work and media URLs are passed to this component. It does not export browser cookies, login request headers or AI keys, or use paid parsing services. Temporary video files are removed after transfer, cancellation or connection closure; saved originals remain in the library.

## Optional external services

PromptDirector supports seven separately assigned AI tasks: text tagging, Skill extraction, creative planning, image analysis, video analysis, image generation, and video generation. No external AI request runs merely because the extension is installed. A real request requires the configured service, model, required site permission, and the user's sending consent. Paid media analysis or generation also requires a separate confirmation for the current action.

Content selected, submitted, or read in response to the user’s request to search or reference their library is sent directly over HTTPS to the AI provider or compatible endpoint chosen by the user. Composer invokes local case tools only when the user asks to search or reference the library. Search returns brief candidate excerpts; requested reference work reads relevant text and shows sources. Ordinary creation does not automatically search. New conversations use text references by default. Original images or videos require an explicit reference-input choice; selected images are sent directly without a separate visual-analysis call. Retrieval can be disabled for the conversation; that choice survives a page reload. Retrieval does not automatically send case images, videos, or original document files. PromptDirector does not send the full library or API keys as creative content, or silently retry a paid action through another provider. In text-only creation mode, images are neither read nor transmitted. The developer does not receive or proxy AI request content; each provider handles received data under its own terms and privacy policy.

## Sharing, retention, and deletion

When Agent connection is enabled, requested case content and original files are delivered to the paired local Agent. The Agent host may send these materials to its configured model or services according to the user’s instructions and its own settings. PromptDirector does not control that subsequent processing. Downloaded originals and connection receipts remain locally until the user removes them.

Data leaves local storage only when the user explicitly sends it to a configured AI service, exports or migrates it, or creates and distributes a share package. Local data remains until the user edits or deletes it, clears extension storage, or uninstalls the extension. Users can create a local backup before uninstalling and can remove locally saved API keys and consent in AI service settings.

## Chrome Web Store Limited Use

PromptDirector complies with the Limited Use requirements of the Chrome Web Store User Data Policy. Permissions and user data are used only to provide or improve the disclosed, user-facing single purpose and features. User data is not sold or used for personalized, retargeted, or interest-based advertising. Humans are not allowed to read user data unless the user separately authorizes access to specific content for a support request, or access is required for security or legal obligations.

## Permission purposes

- `webRequest`: identify media response URLs and types on authorized websites for video counts and capture previews. Candidates stay in the browser session and are cleared on navigation or tab closure. This does not read credentials, modify requests, or upload browsing history; cross-origin media remains subject to site permissions.

- `activeTab`: access the current page only after a user starts capture, visual selection, or another page action.
- `alarms`: schedule or resume local background work; never for tracking.
- `contextMenus`: provide the explicit right-click capture entry.
- `downloads`: save a user-requested backup, share package, media file, or video component installer.
- `offscreen`: perform local screenshot, media, document, or ZIP work that needs a background document.
- `sidePanel`: show capture and creation controls in the Chrome side panel.
- `scripting`: inject the required capture, selection, or screenshot code only after a user starts that action.
- `storage` and `unlimitedStorage`: retain the user's selected references, media, settings, and local AI configuration.
- `https://wchao6891.github.io/*`: read the official curated catalog, metrics, covers, and read-only previews.
- `https://github.com/*`: read an official curated Release package selected by the user and open public feedback or submission pages. Local development builds also check official versions and download program updates after user confirmation. Video component setup reads the official component installer.
- `https://objects.githubusercontent.com/*` and `https://release-assets.githubusercontent.com/*`: follow GitHub's trusted Release download chain for user-selected curated packages and media, or local development program updates and user-selected video component installers; no other GitHub account data is read.
- Optional `<all_urls>`: not granted at installation. Ordinary capture and AI settings request the necessary origins. Enabling Agent connection requests website access so the paired Agent can capture user-requested URLs in a dedicated tab; browsing history is not recorded or uploaded.
- Optional `downloads.open`: requested only when the user chooses to install the video component, so their explicit Open installer click can open the downloaded official installer. Downloaded files are not executed automatically.
- Optional `nativeMessaging`: requested when the user enables Agent connection or installs local video extraction, to communicate with the locally installed programs. A paired Agent can search cases, read selected originals, capture URLs and save materials. This interface does not expose AI service credentials. Disconnecting Agent connection rejects new Agent requests; submitted tasks continue. Local video extraction operates independently and runs only when the user saves selected videos.
- Optional `clipboardRead`: requested only for a user-triggered feature that reads clipboard content.
- Optional `declarativeNetRequestWithHostAccess`: requested only when a user-granted site permission and the chosen feature require a bounded network rule.

## Contact

Contact the maintainer through the [PromptDirector support page](https://promptdirector.cn/en/support.html).
