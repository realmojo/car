import type { Article } from "@/lib/content/common";
import { faqJsonLd } from "@/lib/seo";
import AdSlot from "@/components/ads/AdSlot";

/** JSON-LD <script>. 여러 개를 한 번에 넣을 수 있다 */
export function JsonLd({ data }: { data: object | object[] }) {
  const list = Array.isArray(data) ? data : [data];
  return (
    <>
      {list.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }} />
      ))}
    </>
  );
}

/** 상세 페이지 요약 문단 */
export function ArticleLead({ article }: { article: Article }) {
  if (!article.lead.length) return null;
  return (
    <div className="article-lead">
      {article.lead.map((t, i) => (
        <p key={i}>{t}</p>
      ))}
    </div>
  );
}

/** 상세 페이지 본문 + 자주 묻는 질문(FAQPage JSON-LD 포함) */
export default function ArticleBody({ article }: { article: Article }) {
  // h2 아래 광고는 첫 구역과 가운데 구역 두 곳에만 둔다
  const adAt = new Set([0, Math.floor(article.blocks.length / 2)]);
  return (
    <>
      <article className="article">
        {article.blocks.map((b, bi) => (
          <section key={b.h2} className="article__sec">
            <h2>{b.h2}</h2>
            {adAt.has(bi) && <AdSlot slot="h2" />}
            {b.p?.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
            {b.table && (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      {b.table.head.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.table.rows.map((r, i) => (
                      <tr key={i}>
                        {r.map((c, j) => (
                          <td key={j}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {b.ul && (
              <ul>
                {b.ul.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            )}
            {b.links && (
              <ul className="article__links">
                {b.links.map((l) => (
                  <li key={l.href}>
                    <a target="_self" href={l.href}>
                      {l.label}
                    </a>
                    {l.note && <span> · {l.note}</span>}
                  </li>
                ))}
              </ul>
            )}
            {b.after?.map((t, i) => (
              <p key={`a${i}`}>{t}</p>
            ))}
          </section>
        ))}
      </article>

      {article.faq.length > 0 && (
        <section className="article article--faq">
          <JsonLd data={faqJsonLd(article.faq)} />
          <h2>자주 묻는 질문</h2>
          {article.faq.map((f) => (
            <details key={f.q} className="article__faq" open>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>
      )}
    </>
  );
}
