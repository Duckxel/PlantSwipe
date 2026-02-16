/**
 * EmailPreviewShell — React component that renders the same visual structure
 * as the email wrapper used for actual sending (emailTemplateShared.ts).
 *
 * This is the SINGLE source of truth for the email preview layout in the admin.
 * Any visual change here should also be reflected in emailTemplateShared.ts
 * (the HTML string version used by Edge Functions / server-side sending).
 *
 * Usage:
 *   <EmailPreviewShell>
 *     <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
 *   </EmailPreviewShell>
 */

import React from "react"
import {
  SOCIAL_MEDIA,
  SOCIAL_ICON_URLS,
  BANNER_URL,
  DEFAULT_WEBSITE_URL,
  getEmailWrapperStrings,
  type SupportedLanguage,
} from "@/lib/emailTemplateShared"

interface EmailPreviewShellProps {
  children: React.ReactNode
  language?: SupportedLanguage
  websiteUrl?: string
}

export const EmailPreviewShell: React.FC<EmailPreviewShellProps> = ({
  children,
  language = "en",
  websiteUrl = DEFAULT_WEBSITE_URL,
}) => {
  const strings = getEmailWrapperStrings(language)
  const currentYear = new Date().getFullYear()

  return (
    <>
      {/* Full-height gradient background wrapper */}
      <div
        style={{
          background: "linear-gradient(180deg, #d1fae5 0%, #ecfdf5 8%, #f0fdf4 20%, #ffffff 45%, #ffffff 55%, #fefce8 75%, #fef3c7 90%, #fde68a 100%)",
          padding: "48px 24px 0 24px",
        }}
      >
        <div style={{ maxWidth: 680, margin: "0 auto" }}>

          {/* Email Container Card */}
          <div
            style={{
              borderRadius: 32,
              overflow: "hidden",
              background: "linear-gradient(170deg, rgba(16,185,129,0.04) 0%, #ffffff 15%, #ffffff 85%, rgba(251,191,36,0.03) 100%)",
              border: "1px solid rgba(16,185,129,0.15)",
              boxShadow: "0 25px 60px -12px rgba(16,185,129,0.15), 0 0 0 1px rgba(255,255,255,0.8) inset",
            }}
          >
            {/* Header Banner */}
            <div
              style={{
                background: "linear-gradient(135deg, #047857 0%, #059669 30%, #10b981 65%, #34d399 100%)",
                padding: "28px 48px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  background: "rgba(255,255,255,0.18)",
                  borderRadius: 18,
                  padding: "12px 28px",
                  backdropFilter: "blur(8px)",
                }}
              >
                <img
                  src={BANNER_URL}
                  alt="Aphylia"
                  style={{ display: "block", height: 48, width: "auto" }}
                />
              </div>
            </div>

            {/* Email Body (caller provides content) */}
            <div
              style={{
                padding: 48,
                color: "#374151",
                fontSize: 16,
                lineHeight: 1.75,
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
              }}
            >
              {children}
            </div>

            {/* Signature Section */}
            <div style={{ margin: "0 48px 48px 48px" }}>
              <div
                style={{
                  borderRadius: 20,
                  padding: "28px 32px",
                  background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 50%, #f5f3ff 100%)",
                  border: "1px solid rgba(16,185,129,0.12)",
                  boxShadow: "0 2px 12px rgba(16,185,129,0.06)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div
                    style={{
                      flexShrink: 0,
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                      boxShadow: "0 6px 20px -4px rgba(16,185,129,0.5)",
                    }}
                  >
                    <img
                      src="/icons/plant-swipe-icon.svg"
                      alt="Aphylia"
                      style={{
                        width: 32,
                        height: 32,
                        filter: "brightness(0) invert(1)",
                      }}
                    />
                  </div>
                  <div>
                    <p
                      style={{
                        margin: "0 0 4px 0",
                        fontWeight: 700,
                        fontSize: 18,
                        color: "#111827",
                        letterSpacing: "-0.3px",
                      }}
                    >
                      {strings.teamName}
                    </p>
                    <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
                      {strings.tagline}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* End white card */}
        </div>
      </div>

      {/* Footer — gradient warm area outside the card */}
      <div
        style={{
          background: "linear-gradient(180deg, #fefce8 0%, #fef3c7 40%, #fde68a 100%)",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            maxWidth: 680,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          {/* Decorative green divider */}
          <div
            style={{
              padding: "32px 0 28px 0",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 80,
                height: 3,
                background: "linear-gradient(90deg, transparent, #10b981, transparent)",
                borderRadius: 2,
              }}
            />
          </div>

          {/* CTA Button */}
          <div style={{ marginBottom: 28 }}>
            <a
              href={websiteUrl}
              style={{
                display: "inline-block",
                padding: "14px 32px",
                fontSize: 14,
                fontWeight: 600,
                color: "#ffffff",
                borderRadius: 9999,
                textDecoration: "none",
                background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                boxShadow: "0 8px 24px -6px rgba(16,185,129,0.4)",
              }}
            >
              {strings.exploreButton}
            </a>
          </div>

          {/* Social Media Links */}
          <div style={{ marginBottom: 24 }}>
            <p
              style={{
                margin: "0 0 12px 0",
                fontSize: 11,
                color: "#92400e",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                fontWeight: 600,
                opacity: 0.6,
              }}
            >
              {strings.followUs}
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 12,
              }}
            >
              {[
                { href: SOCIAL_MEDIA.youtube, icon: SOCIAL_ICON_URLS.youtube, title: "YouTube" },
                { href: SOCIAL_MEDIA.twitter, icon: SOCIAL_ICON_URLS.twitter, title: "X" },
                { href: SOCIAL_MEDIA.instagram, icon: SOCIAL_ICON_URLS.instagram, title: "Instagram" },
              ].map(({ href, icon, title }) => (
                <a
                  key={title}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    backgroundColor: "#374151",
                    borderRadius: 12,
                    textDecoration: "none",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                  }}
                  title={title}
                >
                  <img src={icon} alt={title} style={{ width: 20, height: 20 }} />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <p style={{ margin: "0 0 12px 0", fontSize: 13 }}>
            <a
              href={websiteUrl}
              style={{ color: "#059669", fontWeight: 600, textDecoration: "none" }}
            >
              aphylia.app
            </a>
            <span style={{ margin: "0 8px", color: "#d97706", opacity: 0.4 }}>·</span>
            <a href={`${websiteUrl}/about`} style={{ color: "#92400e", opacity: 0.7, textDecoration: "none" }}>
              {strings.aboutLink}
            </a>
            <span style={{ margin: "0 8px", color: "#d97706", opacity: 0.4 }}>·</span>
            <a href={`${websiteUrl}/contact`} style={{ color: "#92400e", opacity: 0.7, textDecoration: "none" }}>
              {strings.contactLink}
            </a>
          </p>

          {/* Copyright */}
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "#92400e",
              opacity: 0.5,
              paddingBottom: 40,
            }}
          >
            {strings.copyright.replace("{year}", String(currentYear))}
          </p>
        </div>
      </div>
    </>
  )
}
