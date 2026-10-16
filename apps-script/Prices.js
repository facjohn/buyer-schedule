/**
 * 단가 흐름용: 과일 하나의 모든 시즌 줄.
 * list는 13개월 전까지만 보내니, 지난 시즌은 이걸로 받는다.
 */
function prices_(member, fruit) {
  fruit = str_(fruit);
  if (!fruit) return { ok: false, error: 'bad_request', message: '과일을 골라 주세요.' };

  var rows = [];
  readTable_('schedule').rows.forEach(function (r) {
    if (toBool_(r.deleted) || str_(r.fruit) !== fruit) return;
    var eta = toIsoDate_(r.eta);
    if (!eta) return;
    rows.push({
      id: str_(r.id),
      eta: eta,
      buyer: str_(r.buyer),
      specKo: str_(r.specKo),
      ship: normShip_(r.ship) || str_(r.ship),
      // 그래프용 숫자만. 여러 값('17.3/17.8')은 그리지 않는다
      price: moneyNum_(r.price),
      cost: moneyNum_(r.cost),
      workCost: moneyNum_(r.workCost),
      status: str_(r.status) === '확정' ? '확정' : '미정'
    });
  });
  return { ok: true, fruit: fruit, rows: rows };
}
