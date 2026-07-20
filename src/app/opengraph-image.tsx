import { ImageResponse } from "next/og";

export const alt = "Vio AI education workspace landing page";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const features = [
  "Chat with documents and links",
  "Plan with AI study agents",
  "Create flashcards and highlights",
  "Generate grounded summaries",
  "Practice with adaptive quizzes",
  "Train with listening tests",
];

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "56px 92px",
        background: "linear-gradient(145deg, #f8faff 0%, #eef4ff 58%, #f5f1ff 100%)",
        color: "#171925",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <svg width="114" height="60" viewBox="0 0 68 36" fill="none">
          <path d="M10.5986 35.6475V30.7913H5.68838V20.9708H0.77817V10.7188H6.22796V20.4313H11.0842V30.2517H15.5088V20.4313H20.365V10.7188H25.8688V20.9708H20.9046V30.7913H16.0484V35.6475H10.5986ZM31.3531 35.6475V10.7188H36.8029V35.6475H31.3531ZM31.3531 6.40209V0.952297H36.8029V6.40209H31.3531ZM47.1709 35.6475V30.7913H42.2607V15.629H47.1709V10.7188H62.3872V15.629H67.3514V30.7913H62.3872V35.6475H47.1709ZM47.7105 30.2517H61.8476V16.1146H47.7105V30.2517Z" fill="#5b61ff" />
        </svg>
      </div>

      <div style={{ display: "flex", fontSize: 42, fontWeight: 700, letterSpacing: "-1.5px", textAlign: "center" }}>
        Learn from anything. Keep teachers in control.
      </div>
      <div style={{ display: "flex", marginTop: 12, marginBottom: 30, fontSize: 21, color: "#646b7c", textAlign: "center" }}>
        Evidence-grounded AI for study, classrooms, and human-reviewed feedback.
      </div>

      <div
        style={{
          width: "870px",
          height: "68px",
          display: "flex",
          alignItems: "center",
          padding: "8px 9px 8px 25px",
          borderRadius: "18px",
          border: "1px solid #dce1eb",
          backgroundColor: "#ffffff",
          boxShadow: "0 8px 24px rgba(29, 35, 57, 0.08)",
        }}
      >
        <div style={{ display: "flex", flex: 1, fontSize: 18, color: "#8990a1" }}>Paste URL or upload a file</div>
        <div style={{ display: "flex", marginRight: 18, fontSize: 25, color: "#767d8d" }}>↑</div>
        <div style={{ display: "flex", alignItems: "center", height: 50, padding: "0 25px", borderRadius: "13px", backgroundColor: "#5b61ff", color: "white", fontSize: 17, fontWeight: 700 }}>
          Get Started
        </div>
      </div>

      <div style={{ width: "870px", display: "flex", flexWrap: "wrap", marginTop: 25, gap: 12 }}>
        {features.map((feature) => (
          <div
            key={feature}
            style={{
              width: "282px",
              height: "56px",
              display: "flex",
              alignItems: "center",
              padding: "0 16px",
              borderRadius: "14px",
              border: "1px solid #dfe3ec",
              backgroundColor: "rgba(255,255,255,0.88)",
              color: "#292c37",
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            <div style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10, borderRadius: 99, backgroundColor: "#eaebff" }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M3 8.2L6.2 11.3L13 4.7" stroke="#555bfa" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ display: "flex" }}>{feature}</div>
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
