# Known Limitations

## Large Remote Videos and Website Coverage

In real-world testing, the download of an original Higgsfield video of about 4.7 GB was once interrupted before completion; the body text and the images that had already been saved successfully were kept. This scenario has not yet passed full-save acceptance, stable download of very large remote videos is not guaranteed, and a cover or a partial save is not counted as a successful full video. Originals you have already downloaded yourself can be imported into the case library.

Dedicated adapters do not mean that all page forms of a website have been verified. Login restrictions, access verification, episodes/collections and page redesigns may affect results, so rely on the preview and the actual save receipt.

## Free Video Component Installation

The video component provides a source ZIP, and the user installs the free Node.js, yt-dlp and FFmpeg by themselves. This ZIP is not a signed one-click macOS/Windows installer, does not require buying a developer certificate, and does not require turning off system security protection. The open-source licenses of the dependencies still apply; see [Video component](VIDEO_COMPONENT.md) for installation instructions.

## MPEG-4 Videos the Browser Cannot Decode Directly

PromptDirector currently relies on the native media decoding of Chrome. When it meets an MPEG-4 file that the browser cannot decode but a system player can play, the case still keeps the original file and source information, and provides a path to open it with the system player; the current version does not bundle a software decoder inside the extension.


## GLM-5.3-Flash Direct Local Video Upload Boundary

Local videos in the case library can, after user confirmation, be sent as Base64 to GLM-5.3-Flash for video analysis. The currently public [GLM-5.3-Flash model page](https://docs.bigmodel.cn/cn/guide/models/vlm/glm-5.3-flash) and [Chat Completions API page](https://docs.bigmodel.cn/api-reference/%E6%A8%A1%E5%9E%8B-api/%E5%AF%B9%E8%AF%9D%E8%A1%A5%E5%85%A8) of Zhipu do not declare a file size limit for direct video input. Whether a given file can be processed depends on the format, capacity and account limits of the chosen service.

The current version does not automatically compress, truncate, extract frames or switch to another model, because such downgrades would change the object of analysis or incur extra cost. If the server rejects the file size, format or content, the request shows the error returned by the chosen service and is not retried automatically. Only direct public video file URLs can use URL analysis; the playback pages of YouTube, Bilibili, Douyin, X or Vimeo are not the same as direct video file links.

## Local Program Upgrades

A local upgrade needs Chrome developer mode and read/write authorization for the current installation directory. The first connection of an old version needs the program to be overwritten in the original directory; afterwards upgrade from the settings page, reusing the verified installation directory; when the permission becomes invalid, authorize again. The version is determined by the actual running version shown on the settings page, and an original directory carrying an old version name does not affect in-place updates. An update package with a different extension ID, a non-current installation directory or a newly required permission stops the automatic write. Only a program recovery copy is created, and cases and media are not copied.

If it cannot run after a write is interrupted, load the `PromptDirector-Update-Recovery` program copy in the original directory on the extension management page to restore the original version under the same identity; do not uninstall the plugin first. After a restart, the directory write permission may need to be authorized again before temporary program files can be cleaned.


When the original version has been restored and is usable but update records remain, finish up through Clean up upgrade temporary files and then continue upgrading. The cleanup confirms the directory actually loaded at present, and the program recovery copy that is running is kept.
