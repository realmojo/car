import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStationDetail } from "@/lib/opinet";
import { attempt } from "@/lib/errors";
import { brandName, findProduct, findSidoByAddress, PRODUCTS } from "@/lib/codes";
import { kakaoMapLink, kakaoRouteLink, naverSearchLink, won, ymdhm } from "@/lib/format";
import { buildMetadata } from "@/lib/seo";
import Crumbs from "@/components/common/Crumbs";
import { ErrorNotice, SourceNote } from "@/components/common/Notice";

export const dynamic = "force-dynamic";

type Params = { id: string };

const validId = (id: string) => /^[A-Za-z0-9]{6,12}$/.test(id);

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  if (!validId(id)) return {};
  const { data } = await attempt(getStationDetail(id));
  if (!data) return {};
  const priceText = data.prices
    .map((p) => `${findProduct(p.prodcd).short} ${won(p.price)}원`)
    .join(", ");
  return buildMetadata({
    path: `/fuel/station/${id}`,
    title: `${data.name} 기름값 - ${brandName(data.brand)} 주유소 가격·위치 | 김군카`,
    description: `${data.name}(${data.address}) 오늘 판매가격: ${priceText}. 부가서비스와 길찾기 정보를 확인하세요.`,
  });
}

export default async function StationPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  if (!validId(id)) notFound();
  const { data, error } = await attempt(getStationDetail(id));

  if (error) {
    return (
      <>
        <Crumbs trail={[{ name: "유가 정보", path: "/fuel" }, { name: "주유소", path: `/fuel/station/${id}` }]} />
        <ErrorNotice message={error} />
      </>
    );
  }
  if (!data) notFound();

  const sido = findSidoByAddress(data.address);
  const order = PRODUCTS.map((p) => p.code);
  const prices = [...data.prices].sort((a, b) => order.indexOf(a.prodcd) - order.indexOf(b.prodcd));
  const services = [
    { on: data.carWash, name: "세차장" },
    { on: data.cvs, name: "편의점" },
    { on: data.maint, name: "경정비" },
    { on: data.lpg, name: "LPG 충전" },
    { on: data.kpetro, name: "품질인증" },
  ];
  const stationJsonLd = {
    "@context": "https://schema.org",
    "@type": "GasStation",
    name: data.name,
    address: data.address,
    ...(data.tel ? { telephone: data.tel } : {}),
    ...(data.lat && data.lng ? { geo: { "@type": "GeoCoordinates", latitude: data.lat, longitude: data.lng } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(stationJsonLd) }} />
      <Crumbs
        trail={[
          { name: "유가 정보", path: "/fuel" },
          ...(sido ? [{ name: sido.short, path: `/fuel/${sido.slug}` }] : []),
          { name: data.name, path: `/fuel/station/${id}` },
        ]}
      />
      <div className="page-head">
        <h1>
          {data.name}
          <span className="badge">{brandName(data.brand)}</span>
        </h1>
        <p>{data.address}</p>
      </div>

      <section className="sec">
        <div className="sec-head">
          <h2 className="sec-title">판매 가격</h2>
        </div>
        {prices.length > 0 ? (
          <div className="price-grid">
            {prices.map((p) => (
              <div key={p.prodcd} className="price-tile">
                <div className="price-tile__name">{findProduct(p.prodcd).short}</div>
                <div className="price-tile__price num">
                  {won(p.price)}
                  <small>원</small>
                </div>
                <div className="price-tile__diff flat">{ymdhm(p.tradedAt)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-box">등록된 판매 가격이 없습니다.</div>
        )}
      </section>

      <section className="sec">
        <div className="sec-head">
          <h2 className="sec-title">주유소 정보</h2>
        </div>
        <div className="panel panel--pad">
          <dl className="info-list">
            <dt>상표</dt>
            <dd>
              {brandName(data.brand)}
              {data.subBrand && ` · ${brandName(data.subBrand)}`}
            </dd>
            <dt>도로명 주소</dt>
            <dd>{data.address}</dd>
            {data.oldAddress && data.oldAddress !== data.address && (
              <>
                <dt>지번 주소</dt>
                <dd>{data.oldAddress}</dd>
              </>
            )}
            <dt>전화</dt>
            <dd>{data.tel ? <a href={`tel:${data.tel}`}>{data.tel}</a> : "-"}</dd>
            <dt>부가서비스</dt>
            <dd>
              <div className="service-list">
                {services.map((s) => (
                  <span key={s.name} className={s.on ? "badge" : "badge badge--muted"} style={s.on ? undefined : { textDecoration: "line-through" }}>
                    {s.name}
                  </span>
                ))}
              </div>
            </dd>
          </dl>
        </div>
        <div className="lp-hero__actions" style={{ justifyContent: "flex-start", marginTop: 14 }}>
          {data.lat && data.lng ? (
            <>
              <a className="lp-btn lp-btn--primary" href={kakaoRouteLink(data.name, data.lat, data.lng)} target="_blank" rel="noopener noreferrer">
                🧭 카카오맵 길찾기
              </a>
              <a className="lp-btn lp-btn--ghost" href={kakaoMapLink(data.name, data.lat, data.lng)} target="_blank" rel="noopener noreferrer">
                지도에서 보기
              </a>
            </>
          ) : null}
          <a className="lp-btn lp-btn--ghost" href={naverSearchLink(`${data.name} ${data.address}`)} target="_blank" rel="noopener noreferrer">
            네이버 지도
          </a>
        </div>
        <SourceNote kind="fuel" />
      </section>
    </>
  );
}
