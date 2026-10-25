# Changelog

See the feature changes and usability improvements each version brings. For downloads, go to [GitHub Releases](https://github.com/wchao6891/PromptDirector/releases/latest).

## 1.28.0

- Case details show the image and body text first, then add generation info and similar cases; reduced the cost of repeated tag organizing, repeated transparency scans and dense waterfall reflow.

- Skill import, editing, export and featured saving fully keep the files inside the package, including scripts, licenses and binary resources; viewing a script does not execute it.
- Skill details and the creation center gain a file tree, text editing and media preview, and downloading the whole package or the current file is unified into the original download entry.
- Featured Skills support complete reference files, and source material is no longer silently deleted during submission.
- Simplified the Skill detail title area, and covers now use a unified landscape display area so long images no longer squeeze the reading space.

## 1.27.1

- Fixed the problem that the first manual pick overwrote existing captured content; the body text, prompts, images and screenshots are kept, and usable sources of the same image are merged.
- Generic capture and site adapters now uniformly prefer saving the original image, improving the size of X images; when the original is unavailable, it is clearly stated that a smaller image was saved.
- Fixed the problem that menus could not expand properly after scrolling the case management bar.
- Tidied the general settings and fixed the version and update actions; when offline or on network failure, a short notice is shown only after an active check.
- Fixed the registration problem of the Windows video component in restricted PowerShell environments, re-detecting the installation state after refresh; added the Install with Agent entry.
- The free video component source package is updated to 0.1.1, and an existing working 0.1.0 component can still be used.

## 1.27.0

- The capture sidebar and external Agents share a resumable preview, selection, supplement and save flow, keeping original text, original prompts and manual edits, and showing real task progress and partially successful results.
- Enhanced video capture for the Douyin feed, Bilibili, YouTube and others, and added an optional free local video component; the source installation package does not require buying a developer certificate, and dependencies are installed by the user.
- Fixed the problem that Liblib model pages and Behance project pages mixed in recommended content and hidden templates, and improved article segmentation, manually picked media and supplementary material for duplicate cases.
- Improved case details, review, dragging out originals, project organization, import recovery and sidebar session performance, and unified common controls and the English interface.
- The Agent connector is upgraded to 0.5.0, improving reading of the capture context, complete original text and save results.
- Known limitation: downloads of some large remote videos may still be interrupted; the login, access permissions and page types of each site affect results. See [Known limitations](docs/KNOWN_LIMITATIONS.md) for details.

## 1.26.0

- Large libraries load progressively in the current sort order, showing the interface and the first cases first, with later ones appended while keeping card order and position.
- Independent case storage and incremental refresh reduce the cost of ordinary editing; composer references mount only the visible range, keeping full search, projects and off-screen selection.
- Added recoverable deletion for the Agent, text similarity queries for unstored text and authorized screenshots; reading references reuses unchanged results, and complete originals and prompts are kept.
- The manual pick template for ordinary web pages supports re-recognition after scrolling; batch capture keeps detail videos and original prompts, and fixes template invalidation and duplicate error prompts.
- Supports cross-project compound cases while keeping the project relations of the original members; fixed selection-state problems with refresh and splitting.
- Color swatches are now shown as thin strips; completed English dialogs, composer drafts and dynamic prompts, and added a development-stage check for missed translations.
- The Agent connector is upgraded to 0.4.0, and installation and host pre-checks follow the existing configuration flow.

## 1.25.0

- Extended Agent collaboration: find cases by name and path, read the complete body text and originals, edit and organize, store back creative results and complete image, video and multi-image analyses; manual edits and source relations are kept.
- Improved opening and scrolling of large libraries, with the waterfall and list sharing zoom; list headers sort directly, and the project scope and selection state stay continuous.
- Improved capture of X author threads, original videos and supplementary content; large originals are moved in chunks, a failed save keeps the retry, and cover ownership is kept correctly when reusing originals.
- Tags support batch removal and undo; undo checks later changes and protects newly added cases, originals and organization relations.
- Improved reading of long Markdown material, dragging out original files, shared dialogs, project menus and save feedback.
- Automatic history, caches and temporary handling are managed by resource budgets; composer tool calls support timeout cancellation and resuming, keeping complete user data.

## 1.24.1

- Fixed the problem that a featured-case whole-package download larger than 128 MiB was rejected after reaching 100%; size and content digest verification are kept.

## 1.24.0

- Projects organize cases as folders: dragging moves, explicit copying keeps an independent copy; improved the project tree, case locating and delete recovery.
- Optimized digest reuse and stage progress of complete backups, keeping disk read-back verification; improved shared original recovery and recognition of Skill attachment types.
- Local batch import is submitted in short batches, failed items keep the retry, and the waiting from whole-library processing per item is reduced.
- Improved the capture boundaries of Higgsfield current works and project body text; Pinterest supplements the title, author, source and obtainable engagement info per work, preventing list interface text from mixing into the data.
- Case images support native right-click actions and dragging out originals; unified scroll area behavior, protected unfinished input in dialogs, and video URLs support protocol completion.
- Skill material selection shows video covers and supports preview, project names expand fully, and scrolling down loads more automatically; when distillation finishes Markdown is shown directly, and going back to material selection keeps the draft.
- Reference videos in the composer can be previewed and played in both the image and video creation directions, with a unified play icon; previewing does not change the chosen references or the model input rules.
- Improved the finishing of batch analysis, settings page stability and narrow-screen layout.

## 1.23.0

- Web capture can directly pick images and body text, supplement comments and clipboard content; successful items are cleared, failed items keep the retry, and repeated capture also applies the category explicitly chosen this time.
- Improved capture of X carousel videos, portrait image groups and long comments, keeping the ownership of the main post and quoted content.
- Added capture of Midjourney work details, saving the current work, original prompt, parameters and video cover; Explore can capture loaded work previews.
- Video details provide a centered play button that starts loading when clicked; HLS addresses discovered from the network are connected to playback, and video and cover can be read through the original page after authorization.
- Case details support adjusting the image-text split and the cover, and changing case types in batch; third-level tag organizing is chunked by capacity, and a retry of a failure on the same page keeps the results already completed.
- Improved ZIP import preview, duplicate checking and media supplementing, keeping original prompts, manual edits and organization relations.
- Improved streaming responses of compatible AI services, sending of reference material and resuming of creation sessions; after viewing a distilled Skill you can return to the original session.
- Added a media response observation permission, used only for authorized sites. The built-in updater of old versions refuses to write versions that add a necessary permission automatically; unpack the new installation package over the original installation directory and reload on the extension management page, without uninstalling the extension or clearing data.

## 1.22.4

- Fixed the problem that the plugin refused to show a whole-package preview when a featured collection contained unattributed cases; existing attributions are kept, and unknown authors stay empty.
- The website and the plugin use consistent optional author rules, and still verify the case count, the source and rights statement, and media addresses.

## 1.22.3

- Newly stored PNG, JPEG and WebP images can have the generation prompts and parameters inside the image read, keeping the original image; when multiple branches cannot be matched uniquely, nothing is filled in automatically.
- Original prompts reuse the existing edit area, with a confirmation to overwrite or skip on conflict; generation parameters reuse the source info area.
- Saved data, share packages, backups and sync only restore existing content and do not re-parse images. The Agent can read the generation info of a specified image.
- After a round trip through an old-version share, the detail can read the generation parameters from the original image on demand, keeping edited or cleared prompts.
- Skills can add and update cover screenshots, and the composer, the skill library and featured import follow the same cover saving and cleanup flow.

## 1.22.2

- Fixed the problem that featured submission export omitted the original author attribution and the original work link, keeping spaces and special symbols in names.
- Existing cases do not need to be captured again; export the submission package again after updating to keep the stored source information.

## 1.22.1

- The GitHub installation package is unified as `PromptDirector-version.zip`, and local updates use the same package directly.
- Simplified the installation and update instructions; the Agent connector has its own download entry.

## 1.22.0

- Supports importing DOCX with reading of the body text and embedded images; audio, design source files and other Office documents can be bookmarked as original files.
- The case right-click menu offers download a copy, export and project management; the detail can download the current media, keeping the original file content.
- Project locating expands directly and scrolls the sidebar, keeping the case browsing position.
- Text tagging can be redone for selected cases; settings keep whole-library tag completion. The model call cost is explicitly confirmed before starting and before a failure retry.
- Optimized the maintenance page layout, and fixed the data completion state display and repeated processing of valid color swatches.
- Improved web list batch capture and scan progress, supporting continuous collection of usable cases by the entered count.
- Fixed the problem that a large share package was wrongly reported as timed out while still downloading.
- Fixed the problem that the first message sent before composer initialization finished could be lost.

## 1.21.1

- The Agent connector supports Windows user-level installation, can run in paths with Chinese characters and spaces, and needs no administrator installation.

- A unified connection instruction can be copied in the settings, automatically carrying the library ID, to hand to the Agent for installation and pairing.
- Added a unified installation, configuration and verification entry, supporting the user-level configuration of Codex, Claude Code and WorkBuddy, and outputting a generic stdio MCP configuration for other local hosts.
- Configuration is backed up before installation; other MCPs and user policies are kept, and damaged, conflicting or changed-after-check configurations are refused to be overwritten.
- The connector is verified by an actual MCP handshake and a case query, clearly distinguishing the browser awaiting authorization from whether the current Agent session has loaded the tools.

## 1.21.0

- Added an optional Agent connection: search cases through MCP, read prompts and originals, capture URLs, store back creative material, and query persistent task receipts.
- Original files are transferred in chunks with SHA-256 verification; resumable transfer is supported, the prompt and creative source of each attachment are kept, and repeated requests do not store twice.
- The connection can be enabled or disconnected in the plugin settings; case library access is isolated from AI service keys, and the required permission is requested at enabling.
- Provides a standalone connector source installation package and installation instructions. The first Agent connection version supports macOS Chrome and requires Node.js 22.13 or later; the extension itself keeps supporting the original platforms.

## 1.20.8

- Added Cases in article capture: splits prompts and the corresponding images by explicit case titles or numbers, ticked and saved separately by group, while still allowing the whole article to be saved.
- Improved lazy-loaded image capture of long image-and-text articles such as Xiaoheihe; single-case posts whose image wall and body are separate can be saved together with the complete prompt and several images, excluding avatars and comments; content such as introductions that cannot be grouped clearly is listed separately for checking.
- Strengthened generic document and internal scroll list capture, keeping the original position of repeated paragraphs and prompting about unfinished scans.
- Improved body text capture of Feishu Docs, saving image-and-text inside tables, merged cells and long document content; canvas content whose original cannot be obtained keeps a visible snapshot.
- Distinguishes the highlight locating prompt of the original web page from an actual save failure, avoiding misunderstanding of the capture state.

## 1.20.7

- The composer can find cases, read material, query the featured catalog and existing Skills as the conversation needs; distilled Skills and tag suggestions can be viewed and edited before saving.
- Query candidates show thumbnails beside the answer and are added as references only once chosen; reference cards can be cancelled directly, and many results no longer widen the page.
- Improved continuous conversation and short option replies; models that can see images use the specified original image directly, avoiding repeated pre-analysis.
- Fixed the problems that AI reverse-engineered prompts could not be cleared and that the edit interface still showed old tags after a tag was deleted.
- Skill import supports ZIP, `.skill` and standard Markdown files.
- Adapted to the new Jimeng explore and detail pages, improving batch capture of the current category, original image recognition and reading position recovery.
- Fixed failures caused by state changes of local upgrade files, and made the ZIP import state consistent with the actual checking progress.

## 1.20.6

- Featured cases support browsing and saving the complete public catalog, keeping the source description of each case.
- Improved capture of X videos, ArtStation works and Krea images, making it easier to bookmark works together with their prompts.
- Fixed the problem that the sidebar was not cleared after a case was saved; unsaved content is still kept in the draft.
- Optimized the operation layout of settings, sharing, Skills and the composer.

## 1.20.5

- Projects support drag sorting, search locating and moving, and accidental operations can be undone.
- Sped up the import of large share packages and show reading progress.
- Local upgrade remembers the original installation directory, improving recovery and cleanup after an interrupted upgrade.

## 1.20.4

- Fixed the problem that some old versions could not upgrade the local plugin.
- Upgrades keep using the original installation directory, and existing cases and media need no export or re-import.

## 1.20.3

- The same case can keep appending picked images, screenshots, clipboard and web content, with removal and undo supported.
- Improved capture of X carousel image groups; images of the main post and the quoted post can be selected separately.
- Category, project and tags can be set directly at capture; fixed display problems after cancelling and reconfirming.

## 1.20.2

- Fixed the problem that the folder backup could not open the directory picker window.
- Improved the import, export and backup recovery of large ZIPs and original media, with clearer progress and failure reasons.
- Fixed the problem that some historical GIF and AVIF images failed to restore.

## 1.20.1

- The local version can be upgraded in place in the settings, showing preparation and write progress and providing an interruption recovery entry.
- The settings page is more compact, and backup and sync, license and version information are easier to find.
- Improved web capture, case management, video analysis and share package compatibility; fixed the problem that the browsing position was lost when returning to the case library.

## 1.20.0

- Improved capture of Higgsfield works, tutorials and LibTV cases, and missing media can be supplemented when saving again.
- Cases support continuous selection, moving by project and importing multiple share packages.
- Video analysis can continue in the background, and detail editing keeps the reading and playback position better.
- Improved composer streaming reply recovery and video share package compatibility.

## 1.19.8

- The composer supports streaming replies, and after an interruption the text already received can be recovered.
- Local cases can be used as creative references on demand, and the material and prompts used in each round can be viewed.
- Image and video generation and further edits keep version relations; background tasks show current progress.

## 1.19.7

- Text creation, image analysis and video analysis can each choose a model.
- Optimized the narrow-screen display of the composer model menu to avoid covering the page.

## 1.19.6

- Service connections and the composer can choose models offered by connected accounts.
- Improved the use of standalone image generation services, keeping existing manual model choices.

## 1.19.5

- After connecting an AI service, the service and model can be chosen separately for text, image, video and other tasks.
- Video details gain entries for prompt reverse engineering, creative breakdown, ad review and custom questions.
- Images and videos can be analyzed in batch separately, and before starting, the assets that cannot be processed and the reasons are explained.

## 1.19.4

- Supports connecting Zhipu GLM, with the model chosen by task.
- Local videos can be handed to models that support video input after confirming the sending scope.
- Improved service error messages, making it easier to tell connection problems from asset problems.

## 1.19.3

- Sharing, backup and sync support more image, audio, video, subtitle and document formats.
- When some files are damaged, healthy recoverable cases can still be imported, and the skipped content is shown.
- Improved the reliability of complete library merge, restore and sync.

## 1.19.2

- Improved compatibility with historical share packages and image formats, showing before import what can be kept and what is skipped.
- Complete folder backups include the trash and readable local originals, making it easier to restore on a new computer.
- Fixed problems with project delete recovery, tag retention and repeated import.

## 1.19.1

- Fixed the batch image analysis entry in project and case management, with clearer progress, pause and failure information.
- Improved saving, retrieval and import of image prompts and AI tags.
- The prompt edit entry in case details is more centralized.

## 1.19.0

- Projects support multi-level nesting, cross-level moving and keyboard management.
- Reference material can be shared or analyzed by whole project, and cases can be moved out of a project in batch.
- Batch AI analysis can continue in the background, with better recovery after an interruption.

## 1.18.17

- Improved the English interface, capture feedback and translation of system categories.
- Fixed line wrapping and occlusion problems of the sidebar, project menu, model menu and featured page on narrow screens.

## 1.18.16

- The featured Skill list shows names, purposes and save actions more clearly.
- Skills support direct saving, distinguishing saved from new versions.
- Improved the layout of the composer reference area and the featured page.

## 1.18.15

- Featured Skills keep readable names, which are easier to recognize after saving locally.

## 1.18.14

- Added entries to browse, save and submit featured Skills.
- Improved the display of featured cases and Skill pages in light and dark themes.
- Improved image analysis result parsing and manual cross-device backup.

## 1.18.13

- Improved the operations for project sorting and case selection.
- The project menus in notes, video links and the import window are no longer covered.

## 1.18.12

- Projects support drag, touch and keyboard sorting.
- Improved the layout of batch selection, detail deletion, and tag and project selection.
- Local data organizing shows clearer check and completion states.

## 1.18.11

- Improved dropdown menus, tag editing and multilingual display.
- The trash supports restoring everything, and the project sidebar can be resized.

## 1.18.10

- Case details support more compact multi-project selection, and tag and trash operations are more direct.
- Fixed the problem that a select-all result could not be cleared, and improved case sorting and update reminders.

## 1.18.9

- AI settings support managing the default model per task and the service connections separately.
- Fixed image wall overflow and duplicate candidates in smart image picking.
- Improved the web capture authorization prompt; the sidebar can stay open, making continuous bookmarking easier.

## 1.18.8

- Fixed the problem that some RTF documents in historical backups could not be restored.
- New backups keep the RTF document format more accurately.

## 1.18.7

- Unified the Chinese and English brand display and icons.
- Improved extension installation identity recognition and on-demand requesting of site access permissions.

## 1.18.5

- Web capture supports confirming the content first and then previewing the body text and media.
- Article saving keeps the order of paragraphs, lists, tables and related media.
- Featured cases support detail viewing, video playback and selective saving.
- Improved creative reference use and the operation feedback after generation completes.

## 1.18.4

- Bookmark and organize text, images, videos, documents and prompts.
- Supports visual analysis, creative references and saving of generated results.
- Provides folder backup, encrypted sync, share packages and featured cases.
