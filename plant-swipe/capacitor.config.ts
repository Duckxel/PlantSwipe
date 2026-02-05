import type { CapacitorConfig } from '@capacitor/cli'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ESM __dirname shim
const __dirname = dirname(fileURLToPath(import.meta.url))

// Read version from package.json
const getAppVersion = (): string => {
  try {
    const pkgPath = resolve(__dirname, 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    return pkg.version || '1.0.0'
  } catch {
    return '1.0.0'
  }
}

const appVersion = getAppVersion()

const config: CapacitorConfig = {
  appId: 'app.aphylia.mobile',
  appName: 'Aphylia',
  webDir: 'dist',
  
  // Server configuration - connects to the web app backend
  server: {
    // In production, the app loads the built PWA from the webDir
    // For development with live reload, uncomment the url below:
    // url: 'http://YOUR_DEV_MACHINE_IP:5173',
    // cleartext: true,
    
    // Handle external navigation (e.g., OAuth, deep links)
    allowNavigation: [
      'aphylia.app',
      '*.aphylia.app',
      '*.supabase.co',
      'accounts.google.com',
      '*.google.com',
    ],
  },
  
  // iOS-specific configuration
  ios: {
    // Use the version from package.json
    // Build number will be set by the CI/CD pipeline
    scheme: 'Aphylia',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    // Allows navigation to external URLs
    allowsLinkPreview: true,
    // Status bar style
    overrideUserAgent: `Aphylia/${appVersion} (iOS)`,
  },
  
  // Android-specific configuration
  android: {
    // Use package.json version for versionName
    // versionCode will be calculated from version string
    overrideUserAgent: `Aphylia/${appVersion} (Android)`,
    // Flavor for different build variants (optional)
    // flavor: 'production',
    
    // Allow mixed content for development
    // Set to false for production builds
    allowMixedContent: false,
    
    // Capture external URLs for OAuth and deep linking
    captureInput: true,
    
    // Web view settings
    webContentsDebuggingEnabled: process.env.NODE_ENV !== 'production',
  },
  
  // Plugins configuration
  plugins: {
    // Splash screen configuration
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#052e16',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      androidSpinnerStyle: 'small',
      iosSpinnerStyle: 'small',
      spinnerColor: '#10b981',
      splashFullScreen: true,
      splashImmersive: true,
    },
    
    // Status bar configuration
    StatusBar: {
      style: 'dark',
      backgroundColor: '#052e16',
    },
    
    // Keyboard configuration
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    
    // Push notifications
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    
    // Local notifications (for task reminders)
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#10b981',
      sound: 'default',
    },
  },
}

export default config
