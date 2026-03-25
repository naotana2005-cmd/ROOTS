import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  spring,
  Img,
  staticFile,
} from "remotion";

// Google Fonts 読み込み
const fontStyle = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Shippori+Mincho&family=Space+Mono&display=swap');
`;

// ROOTS カラーパレット
const COLORS = {
  bg: "#090909",
  text: "#e0e0e0",
  orange: "#F0A032",
  blue: "#50A0F0",
};

// ===================================================================
// シーン1: 数字インパクト（0〜2.5秒）
// 映像の上にテキストを重ねる想定。ここでは暗い背景で仮表示。
// 実際のリールでは、この下にメロン畑の映像が入る。
// ===================================================================
const Scene1_NumberImpact: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "16" のスプリングアニメーション
  const numberScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.5 },
  });

  // "糖度" フェードイン（0.8秒後）
  const labelOpacity = interpolate(
    frame,
    [fps * 0.8, fps * 0.8 + 10],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // "ビールにしていいのか。" フェードイン（1.3秒後）
  const questionOpacity = interpolate(
    frame,
    [fps * 1.3, fps * 1.3 + 10],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // シーン全体のフェードアウト（最後0.5秒で暗転）
  const sceneOpacity = interpolate(
    frame,
    [fps * 2, fps * 2.5],
    [1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: sceneOpacity,
      }}
    >
      <style>{fontStyle}</style>

      {/* 映像の上に重ねるための半透明暗幕 */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(9, 9, 9, 0.5)",
        }}
      />

      {/* テキストレイヤー */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* 糖度 ラベル */}
        <div
          style={{
            fontFamily: "'Shippori Mincho', serif",
            fontSize: 40,
            color: COLORS.blue,
            opacity: labelOpacity,
            marginBottom: 10,
            letterSpacing: 8,
            textShadow: "0 2px 12px rgba(0,0,0,0.8)",
          }}
        >
          糖度
        </div>

        {/* 16 メイン数字（実際の富良野メロン高級品の糖度） */}
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 400,
            color: COLORS.text,
            transform: `scale(${numberScale})`,
            lineHeight: 1,
            textShadow: "0 4px 20px rgba(0,0,0,0.8)",
          }}
        >
          16
        </div>

        {/* ビールにしていいのか。 */}
        <div
          style={{
            fontFamily: "'Shippori Mincho', serif",
            fontSize: 48,
            color: COLORS.text,
            opacity: questionOpacity,
            marginTop: 30,
            letterSpacing: 4,
            textShadow: "0 2px 12px rgba(0,0,0,0.8)",
          }}
        >
          ビールにしていいのか。
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===================================================================
// シーン2: 映像カット上のテキスト（2.5〜8秒）
// 実際の映像（畑→メロン→断面）の上にテキストが出る想定。
// 映像は別途Canva/Kling AIで生成し、CapCutで結合する。
// ===================================================================
const Scene2_OverlayText: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // テキスト: "富良野の夏を"（1秒後にフェードイン）
  const text1Opacity = interpolate(frame, [fps * 1, fps * 1 + 12], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const text1FadeOut = interpolate(frame, [fps * 3, fps * 3.5], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // テキスト: "一杯に閉じ込める。"（3.5秒後にフェードイン、5秒でフェードアウト）
  const text2Opacity = interpolate(frame, [fps * 3.5, fps * 3.5 + 12], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const text2FadeOut = interpolate(frame, [fps * 5, fps * 5.5], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <style>{fontStyle}</style>

      {/* 富良野の夏を */}
      <div
        style={{
          position: "absolute",
          fontFamily: "'Shippori Mincho', serif",
          fontSize: 64,
          color: COLORS.text,
          opacity: text1Opacity * text1FadeOut,
          letterSpacing: 6,
          textShadow: "0 2px 16px rgba(0,0,0,0.9)",
        }}
      >
        富良野の夏。
      </div>

      {/* 一杯に閉じ込める。 */}
      <div
        style={{
          position: "absolute",
          fontFamily: "'Shippori Mincho', serif",
          fontSize: 64,
          color: COLORS.text,
          opacity: text2Opacity * text2FadeOut,
          letterSpacing: 6,
          textShadow: "0 2px 16px rgba(0,0,0,0.9)",
        }}
      >
        一杯に閉じ込める。
      </div>
    </AbsoluteFill>
  );
};

// ===================================================================
// シーン3: ROOTSロゴ（ここだけ黒画面）
// ===================================================================
const Scene3_Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ROOTS ロゴ フェードイン
  const logoOpacity = interpolate(frame, [fps * 0.3, fps * 0.3 + 15], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // タグライン フェードイン（ロゴの0.5秒後）
  const taglineOpacity = interpolate(
    frame,
    [fps * 0.8, fps * 0.8 + 12],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <style>{fontStyle}</style>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* ROOTS ロゴ */}
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 120,
            color: COLORS.orange,
            opacity: logoOpacity,
            letterSpacing: 8,
          }}
        >
          ROOTS
        </div>

        {/* 親愛なる故郷へ */}
        <div
          style={{
            fontFamily: "'Shippori Mincho', serif",
            fontSize: 32,
            color: COLORS.text,
            opacity: taglineOpacity,
            letterSpacing: 6,
          }}
        >
          親愛なる故郷へ
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===================================================================
// メインコンポジション
// ===================================================================
export const MelonReel: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* シーン1: 数字インパクト（0〜2.5秒 = 75フレーム）
          映像の上にテキストを重ねる想定 */}
      <Sequence from={0} durationInFrames={75}>
        <Scene1_NumberImpact />
      </Sequence>

      {/* シーン2: 映像+テキスト（2.5〜8秒 = 165フレーム）
          映像は別途Canva/Klingで生成 → CapCutで結合 */}
      <Sequence from={75} durationInFrames={165}>
        <Scene2_OverlayText />
      </Sequence>

      {/* シーン3: ROOTSロゴ（8〜11秒 = 90フレーム）
          ここだけ黒画面 */}
      <Sequence from={240} durationInFrames={90}>
        <Scene3_Logo />
      </Sequence>
    </AbsoluteFill>
  );
};
