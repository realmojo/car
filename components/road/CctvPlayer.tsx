"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ITS CCTV 실시간 영상(HLS) 재생.
 * Safari 는 기본 재생, 나머지는 hls.js 로 재생한다.
 * HTTPS 페이지에서 HTTP 영상은 브라우저가 막으므로 새 창 링크로 대신한다.
 */
export default function CctvPlayer({ url, title }: { url: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const insecure = url.startsWith("http://");
  const isStream = /\.m3u8(\?|$)/i.test(url) || url.includes("m3u8");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url || insecure) return;
    let destroy: (() => void) | undefined;

    if (!isStream || video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
    } else {
      import("hls.js").then(({ default: Hls }) => {
        if (!Hls.isSupported()) {
          setError("이 브라우저에서는 실시간 영상을 재생할 수 없습니다.");
          return;
        }
        const hls = new Hls({ lowLatencyMode: true });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) setError("영상을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.");
        });
        hls.loadSource(url);
        hls.attachMedia(video);
        destroy = () => hls.destroy();
      });
    }
    return () => destroy?.();
  }, [url, insecure, isStream]);

  if (!url) return <div className="cctv-box cctv-box--empty">영상 주소가 제공되지 않는 CCTV입니다.</div>;

  if (insecure) {
    return (
      <div className="cctv-box cctv-box--empty">
        <p>이 CCTV는 보안 연결(HTTPS)을 지원하지 않아 여기서 바로 재생할 수 없습니다.</p>
        <a className="lp-btn lp-btn--primary" href={url} target="_blank" rel="noopener noreferrer" style={{ marginTop: 12 }}>
          새 창에서 영상 보기
        </a>
      </div>
    );
  }

  return (
    <div className="cctv-box">
      <video ref={videoRef} controls autoPlay muted playsInline aria-label={`${title} 실시간 CCTV`} onError={() => setError("영상을 불러오지 못했습니다.")} />
      {error && <p className="cctv-box__error">{error}</p>}
    </div>
  );
}
