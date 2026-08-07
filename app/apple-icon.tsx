import { ImageResponse } from "next/og";

// Home-screen icon for iOS. Generated at build time by next/og (built in —
// no new dependency) so there's no binary asset to keep in sync with
// app/icon.svg. Deliberately full-bleed: iOS applies its own rounded mask,
// so baking in a corner radius would double up.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#141414",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", position: "relative", width: 110, height: 72 }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 72,
              height: 72,
              borderRadius: 36,
              background: "rgba(250, 250, 250, 0.82)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 38,
              top: 0,
              width: 72,
              height: 72,
              borderRadius: 36,
              background: "rgba(250, 250, 250, 0.82)",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
