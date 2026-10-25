# Extension Identity Migration

Chrome binds extension data to the browser profile and the extension ID. When switching to a different extension ID, the new version cannot read the local data of the old version directly.

A regular update with the same extension ID keeps the original library; just update the program according to [Installation and update](../README.md#install). The backup and restore steps below are only for changing the extension identity.

## Safe Migration

1. Keep the old extension installed, and do not uninstall it first.
2. In Settings → Backup and sync of the old extension, create a complete folder backup.
3. Open the backup directory, confirm that it contains the completion marker and the media files, and note the number of cases shown by the library. New backups created in 1.19.2 and later also contain trashed cases and projects, and copy readable local linked originals into restorable files.
4. Install the new extension, and in Backup and sync choose the complete folder backup just made to restore.
5. Open several cases at random and check the text, media and project relations; remove the old extension only after confirming everything is correct.

A complete folder backup produces the completion marker only after all core assets have been written, read back and passed the integrity check. If any local link or local media cannot be read, this folder is not regarded as a valid backup; authorize again or relocate the corresponding file and then create the backup again.

If the old extension has already been uninstalled and there is no complete folder backup, sync directory or complete browser profile backup, Chrome may have already cleared the old data, and the new extension cannot recover it.

A formal release package must use the stable identity that the Chrome Web Store assigned to this project. `npm run package:release` stops the release when it is missing; the plain `npm run package` is only for development verification.
