import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"

export const runtime = "edge"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const title = searchParams.get("title") || "AI-Powered Parts Ordering System"
  const description =
    searchParams.get("description") ||
    "Your AI calls suppliers and brings back quotes"

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#020617", // slate-950
          padding: "64px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Grid background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.04) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        {/* Glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)",
          }}
        />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: "9999px",
              padding: "8px 16px",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#10b981",
              }}
            />
            <span style={{ color: "#94a3b8", fontSize: "14px", letterSpacing: "0.05em" }}>
              AI Voice Agent
            </span>
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", position: "relative" }}>
          <div style={{ color: "#ffffff", fontSize: "52px", fontWeight: "700", lineHeight: "1.1", letterSpacing: "-0.02em" }}>
            {title}
          </div>
          <div style={{ color: "#64748b", fontSize: "24px", lineHeight: "1.4" }}>
            {description}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          <div style={{ color: "#ffffff", fontSize: "28px", fontWeight: "700" }}>
            PartsIQ
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#10b981",
              borderRadius: "8px",
              padding: "10px 20px",
            }}
          >
            <span style={{ color: "#ffffff", fontSize: "16px", fontWeight: "600" }}>
              partsiqai.com
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
