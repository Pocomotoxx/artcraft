# Data Compatibility and Recovery

Application upgrades keep cases, original media, user edits, tags, projects, the trash and creation records. The application version and the data format version are managed separately; updating the plugin does not require a regular export or re-import of data.

## Projects and Copies

Cases are organized by folder: moving changes the owning project, and copying creates an independent case. Several project positions of the same case in old versions are kept as independent copies; compound order, body, tags and originals are kept. A recovery snapshot is saved locally before conversion and committed together with the conversion result; if writing fails, the original data is kept.

Copies can share original storage, and other references are checked on deletion or undo. Export assigns independent in-package IDs to shared media, keeping the body, cover, embedded media and the corresponding original files.

## Share Packages

The current version exports the latest format and also supports importing officially released historical share package formats. Before import, the version, file integrity and case relations are checked, and the content that can be kept or cannot be recovered is listed. A single damaged resource does not block other recoverable cases.

When importing data that contains a project structure, identical content in different projects is kept as independent cases; duplicate detection uses the full project path and cannot compare only the last-level project name. Different members of a compound are not collapsed merely because their content is the same.

## Complete Folder Backup

A complete backup is for restoring on a new computer, and includes the trash and readable local linked originals. A safe merge keeps existing data; an exact replacement needs a complete backup and creates a restore point before committing. If writing fails or the available space is insufficient, the original library stays unchanged.

The completion marker is produced only after the folder write and read-back verification pass. A backup with some damaged resources can attempt rescue recovery, but cannot directly exactly replace the whole library.

## Cross-Device Sync

Sync keeps visible conflict copies to avoid overwriting content that cannot be confirmed as identical. The installation directory authorization of the original device is not a valid authorization on another device; the upgrade installation location is stored separately from the portable case data.

Content deduplication in sync respects project and compound boundaries, keeping cross-project copies and their own references.

## Interruption and Retry

After an import, restore or sync is interrupted, the existing results can still be checked. When it cannot be determined whether it succeeded, the related media is kept to avoid accidental deletion. Repeated confirmation does not write the same case again or replace the restored data again.

## Capacity and Originals

Sharing, backup and restore support ZIP64, and the actual capacity depends on the resources available to the browser and the device. The bytes of original files and derived covers are stored separately; file paths, declared sizes, checksums and content relations are all checked.

The application sets no separate quota on the total number of cases, the size of originals or the total amount of input body text. The [64 MiB limit of a single extension message](https://developer.chrome.com/docs/extensions/develop/concepts/messaging#message-size-limits) of Chrome only limits a single message; the page reads local data directly, and external reading uses resumable paging and chunking, so the whole data cannot be refused because of the size of a single message.

Tag undo keeps only the latest 10 operations, to prevent recovery snapshots from growing without limit. This rule only affects undo records; current cases, originals, later edits and project relations are kept continuously, and an undo that meets later modifications or references from other data refuses to overwrite.

Tag undo record v4 stores the changes of the compound itself and of its members, and continues to read v2/v3 history. Removing a tag only releases the tag relation of the selected cases and does not delete the vocabulary, originals or original analyses; undo also checks later modifications of the compound and its members. An old version that does not recognize v4 does not execute that record, to avoid restoring only half.

## Generation Info Inside Images

The optional extracted information of newly stored images is saved with the media; the original workflow stays inside the original image. Sharing, backup restore and sync keep the saved information, and do not read the original image to rewrite historical prompts automatically. After manual editing and clearing, it is not filled in again.

Generation info is independent of the identity of the original file; when recognition fails the original image is kept, and a damaged extracted field is reported separately. The detail shows the parameters through the existing source info rows, and the capture source fields keep their original meaning.

After earlier versions filtered the optional parameter cache, the current detail can read the generation info from the original image of that case on demand for display. This read does not write back data, restore prompts or scan other cases; the original file remains the source of generation info.

## Contributor Reference

Changes to the data structure need historical version migrations and regression tests added, and `npm run check:compat` and `npm run verify` must be run. The version manifest is at [`compatibility-matrix.json`](../test/fixtures/compat/compatibility-matrix.json), and the source of test data is at [`provenance.json`](../test/fixtures/compat/provenance.json).
