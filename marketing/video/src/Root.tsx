import { Composition } from "remotion";
import { MelonReel } from "./MelonReel";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 北海道メロンリール: 案A 数字インパクト */}
      <Composition
        id="MelonReel"
        component={MelonReel}
        durationInFrames={330} // 11秒 @ 30fps（テキストパートのみ）
        fps={30}
        width={1080}
        height={1920} // 9:16 縦型
      />

      {/* シーン1のみ（数字インパクト部分だけ書き出し用） */}
      <Composition
        id="MelonReel-Scene1"
        component={MelonReel}
        durationInFrames={90} // 3秒
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
