# Fastlane Setup Guide

This guide explains how to set up Fastlane for automated signing and publishing of the Aphylia mobile apps to the App Store and Google Play Store.

## Table of Contents

- [Prerequisites](#prerequisites)
- [iOS Setup](#ios-setup)
  - [Apple Developer Account](#apple-developer-account)
  - [Match (Code Signing)](#match-code-signing)
  - [App Store Connect API](#app-store-connect-api)
- [Android Setup](#android-setup)
  - [Google Play Console](#google-play-console)
  - [Signing Key](#signing-key)
- [GitHub Secrets](#github-secrets)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

1. **Ruby** 3.0+ installed
2. **Bundler** gem installed (`gem install bundler`)
3. **Fastlane** installed via Bundler (see below)

```bash
# Install dependencies
cd plant-swipe/ios && bundle install
cd plant-swipe/android && bundle install
```

---

## iOS Setup

### Apple Developer Account

1. **Apple Developer Program**: Ensure you have an active [Apple Developer Program](https://developer.apple.com/programs/) membership ($99/year)

2. **App Store Connect**: Create your app in [App Store Connect](https://appstoreconnect.apple.com/)
   - Bundle ID: `app.aphylia.mobile`
   - App Name: Aphylia

3. **Collect Required IDs**:
   - **Apple ID**: Your Apple Developer email
   - **Team ID**: Found in [Membership Details](https://developer.apple.com/account/#/membership)
   - **ITC Team ID**: Found in App Store Connect (usually same as Team ID for individual accounts)

### Match (Code Signing)

Match stores your certificates and provisioning profiles in a private Git repository, syncing them across your team and CI/CD.

#### 1. Create a Private Git Repository

Create a new **private** repository (e.g., `aphylia-certificates`) to store your certificates.

#### 2. Initialize Match

```bash
cd plant-swipe/ios
bundle exec fastlane match init
```

When prompted:
- Select `git` as storage mode
- Enter your certificates repository URL

#### 3. Generate Certificates

```bash
# Generate App Store certificates and profiles
bundle exec fastlane match appstore

# Generate Development certificates (optional, for local testing)
bundle exec fastlane match development
```

You'll be prompted to:
- Enter your Apple ID credentials
- Create a passphrase for encrypting the certificates

#### 4. Environment Variables

Set these environment variables for CI/CD:

| Variable | Description |
|----------|-------------|
| `MATCH_GIT_URL` | URL of your certificates repository |
| `MATCH_GIT_BASIC_AUTH` | Base64-encoded `username:token` for Git auth |
| `MATCH_PASSWORD` | Passphrase used when creating certificates |

### App Store Connect API

For uploading to TestFlight/App Store, you need an App-Specific Password:

1. Go to [appleid.apple.com](https://appleid.apple.com/)
2. Sign in and go to **Security** > **App-Specific Passwords**
3. Generate a new password
4. Save it as `APPLE_APP_SPECIFIC_PASSWORD` secret

Alternatively, use the App Store Connect API Key (recommended for teams):

1. Go to App Store Connect > Users and Access > Keys
2. Generate a new API key with "App Manager" role
3. Download the `.p8` file
4. Note the Key ID and Issuer ID

---

## Android Setup

### Google Play Console

#### 1. Create Your App

1. Go to [Google Play Console](https://play.google.com/console)
2. Create a new app with package name `app.aphylia.mobile`
3. Complete the store listing setup

#### 2. Enable API Access

1. Go to **Setup** > **API access**
2. Click **Link** to link to a Google Cloud project (or create one)
3. Create a new **Service Account**:
   - Name: `fastlane-aphylia`
   - Role: Service Account User
4. Grant access to the service account:
   - Go back to Play Console API access
   - Click **Manage** on your service account
   - Grant **Admin** permission (or at minimum: Release to production, Manage releases)
5. Create a JSON key:
   - In Google Cloud Console, go to IAM & Admin > Service Accounts
   - Click on your service account
   - Go to **Keys** > **Add Key** > **Create new key** > **JSON**
   - Download the JSON file

#### 3. Save the JSON Key

Save the JSON key content for CI/CD:

```bash
# Encode the JSON key for storage as a secret
base64 -i google-play-key.json
```

### Signing Key

#### 1. Generate a Release Signing Key

```bash
keytool -genkey -v -keystore release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias aphylia
```

You'll be prompted for:
- Keystore password
- Key password
- Certificate information (name, organization, etc.)

**IMPORTANT**: Keep this keystore file and passwords safe! You cannot recover them, and losing them means you cannot update your app.

#### 2. Encode the Keystore for CI/CD

```bash
base64 -i release-key.jks
```

#### 3. Environment Variables

| Variable | Description |
|----------|-------------|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded keystore file |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias (e.g., `aphylia`) |
| `ANDROID_KEY_PASSWORD` | Key password |
| `GOOGLE_PLAY_JSON_KEY_BASE64` | Base64-encoded Google Play service account JSON |

---

## GitHub Secrets

Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):

### iOS Secrets

| Secret | Description |
|--------|-------------|
| `APPLE_ID` | Your Apple ID email |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `ITC_TEAM_ID` | App Store Connect Team ID |
| `MATCH_GIT_URL` | URL to certificates repository |
| `MATCH_GIT_BASIC_AUTH` | Base64-encoded `username:token` |
| `MATCH_PASSWORD` | Match encryption passphrase |
| `MATCH_KEYCHAIN_PASSWORD` | Password for CI keychain (any secure string) |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for Apple ID |

### Android Secrets

| Secret | Description |
|--------|-------------|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded release keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias in keystore |
| `ANDROID_KEY_PASSWORD` | Key password |
| `GOOGLE_PLAY_JSON_KEY_BASE64` | Base64-encoded service account JSON |

### Optional Secrets

| Secret | Description |
|--------|-------------|
| `IOS_APP_IDENTIFIER` | Custom bundle ID (default: `app.aphylia.mobile`) |
| `ANDROID_PACKAGE_NAME` | Custom package name (default: `app.aphylia.mobile`) |

---

## Usage

### Local Development

```bash
# iOS: Build for testing
cd plant-swipe/ios
bundle exec fastlane build_development

# iOS: Upload to TestFlight
bundle exec fastlane beta

# Android: Build debug APK
cd plant-swipe/android
bundle exec fastlane build_debug

# Android: Upload to Internal Testing
bundle exec fastlane internal
```

### CI/CD (GitHub Actions)

The workflow runs automatically after version bumps. For manual publishing:

1. Go to **Actions** > **Build Mobile Apps**
2. Click **Run workflow**
3. Select options:
   - **Publish iOS to TestFlight**: Upload to TestFlight
   - **Publish Android to Play Store**: Upload to selected track
   - **Android release track**: internal/alpha/beta/production

### Available Lanes

#### iOS Lanes

| Lane | Description |
|------|-------------|
| `build_development` | Build debug IPA |
| `build_release` | Build App Store IPA |
| `beta` | Upload to TestFlight |
| `release` | Upload to App Store |
| `ci_beta` | CI: Build + TestFlight |
| `ci_release` | CI: Build + App Store |
| `sync_certificates` | Refresh Match certificates |
| `clean` | Clean build artifacts |

#### Android Lanes

| Lane | Description |
|------|-------------|
| `build_debug` | Build debug APK |
| `build_release` | Build release AAB |
| `build_signed` | Build signed release AAB |
| `internal` | Upload to Internal Testing |
| `alpha` | Upload to Closed Testing |
| `beta` | Upload to Open Testing |
| `release` | Upload to Production (10% rollout) |
| `ci_internal` | CI: Build + Internal |
| `ci_beta` | CI: Build + Beta |
| `ci_release` | CI: Build + Production |
| `promote` | Promote between tracks |
| `clean` | Clean build artifacts |

---

## Troubleshooting

### iOS Issues

#### "No matching provisioning profile found"

```bash
# Force refresh certificates
bundle exec fastlane match appstore --force
```

#### "Session expired"

Your Apple ID session may have expired. Re-run with:

```bash
bundle exec fastlane beta --apple_id your@email.com
```

#### Code signing errors on CI

Ensure all secrets are set correctly:
- `MATCH_GIT_URL` - Must be accessible with `MATCH_GIT_BASIC_AUTH`
- `MATCH_PASSWORD` - Must match what was used when creating certificates

### Android Issues

#### "401 Unauthorized" from Play Store

- Verify the service account has been granted access in Play Console
- Check the JSON key file is valid
- Ensure the API is enabled in Google Cloud Console

#### "Version code already exists"

The version code is calculated from `package.json`. If you need to upload a new build with the same version:

1. Update the version in `package.json`
2. Or manually pass a version code: `bundle exec fastlane internal version_code:123`

#### Gradle build fails

```bash
# Clean and rebuild
cd plant-swipe/android
./gradlew clean
bundle exec fastlane build_release
```

### General Tips

1. **Always test locally first** before pushing to CI
2. **Keep secrets secure** - never commit keys or passwords
3. **Use Match for iOS** - it prevents certificate conflicts
4. **Start with Internal Testing** for Android - test before production

---

## Additional Resources

- [Fastlane Documentation](https://docs.fastlane.tools/)
- [Match Guide](https://docs.fastlane.tools/actions/match/)
- [App Store Connect Guide](https://docs.fastlane.tools/getting-started/ios/appstore-deployment/)
- [Google Play Guide](https://docs.fastlane.tools/getting-started/android/setup/)
- [GitHub Actions Integration](https://docs.fastlane.tools/best-practices/continuous-integration/github/)
