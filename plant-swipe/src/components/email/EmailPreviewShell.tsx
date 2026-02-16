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
      {/* Top glow bar */}
      <div style={{ height: 8, backgroundColor: "#d1fae5" }} />

      {/* Green-tinted area with card */}
      <div style={{ backgroundColor: "#ecfdf5", padding: "40px 24px 0 24px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>

          {/* Email Container (white card) */}
          <div
            style={{
              borderRadius: 24,
              overflow: "hidden",
              backgroundColor: "#ffffff",
              border: "1px solid #d1fae5",
            }}
          >
            {/* Header Banner */}
            <div
              style={{
                backgroundColor: "#059669",
                padding: "24px 48px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  backgroundColor: "rgba(255,255,255,0.15)",
                  borderRadius: 16,
                  padding: "10px 24px",
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
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #d1fae5",
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
                      backgroundColor: "#10b981",
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

      {/* Footer area — warm amber-tinted background, outside the card */}
      <div style={{ backgroundColor: "#f5f0e8", padding: "0 24px" }}>
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
              padding: "28px 0 24px 0",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 80,
                height: 3,
                backgroundColor: "#10b981",
                borderRadius: 2,
              }}
            />
          </div>

          {/* CTA Button */}
          <div style={{ marginBottom: 24 }}>
            <a
              href={websiteUrl}
              style={{
                display: "inline-block",
                padding: "12px 28px",
                fontSize: 14,
                fontWeight: 600,
                color: "#ffffff",
                borderRadius: 9999,
                textDecoration: "none",
                backgroundColor: "#059669",
              }}
            >
              {strings.exploreButton}
            </a>
          </div>

          {/* Social Media Links */}
          <div style={{ marginBottom: 20 }}>
            <p
              style={{
                margin: "0 0 12px 0",
                fontSize: 11,
                color: "#78716c",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                fontWeight: 600,
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
              <a
                href={SOCIAL_MEDIA.youtube}
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
                }}
                title="YouTube"
              >
                <img
                  src={SOCIAL_ICON_URLS.youtube}
                  alt="YouTube"
                  style={{ width: 20, height: 20 }}
                />
              </a>
              <a
                href={SOCIAL_MEDIA.twitter}
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
                }}
                title="X"
              >
                <img
                  src={SOCIAL_ICON_URLS.twitter}
                  alt="X"
                  style={{ width: 20, height: 20 }}
                />
              </a>
              <a
                href={SOCIAL_MEDIA.instagram}
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
                }}
                title="Instagram"
              >
                <img
                  src={SOCIAL_ICON_URLS.instagram}
                  alt="Instagram"
                  style={{ width: 20, height: 20 }}
                />
              </a>
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
            <span style={{ margin: "0 8px", color: "#a8a29e" }}>·</span>
            <a
              href={`${websiteUrl}/about`}
              style={{ color: "#78716c", textDecoration: "none" }}
            >
              {strings.aboutLink}
            </a>
            <span style={{ margin: "0 8px", color: "#a8a29e" }}>·</span>
            <a
              href={`${websiteUrl}/contact`}
              style={{ color: "#78716c", textDecoration: "none" }}
            >
              {strings.contactLink}
            </a>
          </p>

          {/* Copyright */}
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "#78716c",
              paddingBottom: 32,
            }}
          >
            {strings.copyright.replace("{year}", String(currentYear))}
          </p>
        </div>
      </div>

      {/* Bottom glow bar */}
      <div style={{ height: 8, backgroundColor: "#fef3c7" }} />
    </>
  )
}
