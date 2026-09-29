export default function NotFound() {
  return (
    <div className="empty-box" style={{ marginTop: 40 }}>
      <p style={{ fontSize: 40 }} aria-hidden>🚧</p>
      <p>요청하신 페이지를 찾을 수 없습니다.</p>
      <a target="_self" href="/" className="lp-btn lp-btn--primary" style={{ marginTop: 14 }}>
        홈으로
      </a>
    </div>
  );
}
