# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0](https://github.com/MMRIZE/MMM-DropboxPictures/compare/v3.0.0...v3.1.0) - 2025-07-20

### Changed

- **DROPBOX SDK DEPENDENCY REMOVED** - Now uses direct HTTP API calls
- Improved authentication with better scope handling
- Better error handling and debugging information
- Reduced bundle size and memory footprint
- Enhanced path detection for App-folder vs Full-Dropbox apps
- Direct HTTP API implementation
- Better authentication flow
- refactor: review linter setup (add prettier, markdown and css linting, ...)
- docs: move changelog to separate file

### Removed

- Dropbox SDK and node-fetch dependency (replaced with native fetch API)

## [3.0.0](https://github.com/MMRIZE/MMM-DropboxPictures/releases/tag/v3.0.0) - 2023-11-09

### Changed

- **FULLY REBUILT FROM SCRATCH** - You need to reinstall and reconfigure
- Using recent Dropbox V2 API (SDK ^10.34)
- New OAUTH authentication
- Dynamic configuration on the fly (by notification)

### Deprecated

- Auto-rotation feature

### Removed

- 3rd-party dependencies as many as possible

### Breaking Changes

- Complete rebuild requires reinstallation and reconfiguration
