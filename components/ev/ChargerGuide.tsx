/** 충전기 종류·상태 안내 (정적) */
export default function ChargerGuide() {
  const rows = [
    ["DC콤보 (CCS1)", "급속", "국내 전기차 대부분(현대·기아·GM 등)이 쓰는 표준 급속 규격"],
    ["DC차데모", "급속", "구형 닛산 리프·기아 쏘울EV 등 일부 차량"],
    ["AC3상", "급속", "르노 조에 등 일부 차량의 교류 급속"],
    ["NACS", "급속", "테슬라 슈퍼차저 규격 (북미 표준 충전 규격)"],
    ["AC완속 (5핀)", "완속", "아파트·주차장에 많은 7kW 완속, 대부분 차량 호환"],
  ];
  return (
    <div className="panel">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>충전 규격</th>
              <th>구분</th>
              <th>설명</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, kind, desc]) => (
              <tr key={name}>
                <td><strong>{name}</strong></td>
                <td>
                  <span className={kind === "급속" ? "badge badge--fast" : "badge badge--slow"}>{kind}</span>
                </td>
                <td style={{ whiteSpace: "normal", minWidth: 220 }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
