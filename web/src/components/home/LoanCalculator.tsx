"use client";
import Link from "next/link";
import { useState } from "react";
import { peso, pesoShort } from "@/lib/catalog";

/** Standard amortization: M = P·r / (1 − (1 + r)^−n). */
export function monthlyPayment(loan: number, annualRatePct: number, years: number) {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (n <= 0) return 0;
  return r ? (loan * r) / (1 - Math.pow(1 + r, -n)) : loan / n;
}

export function LoanCalculator() {
  const [price, setPrice] = useState(8_000_000);
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(7.5);
  const [years, setYears] = useState(20);

  const down = (price * downPct) / 100;
  const loan = price - down;
  const monthly = monthlyPayment(loan, rate, years);

  return (
    <div className="calc">
      <div className="calc-form">
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="c-price">Property price (₱)</label>
          <input className="input" id="c-price" type="number" min={0} step={50000} value={price} onChange={(e) => setPrice(Math.max(0, +e.target.value || 0))} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="c-down">Down payment: {downPct}%</label>
          <div className="range-row">
            <input id="c-down" type="range" min={0} max={80} step={5} value={downPct} onChange={(e) => setDownPct(+e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="c-rate">Interest rate (% per year)</label>
          <input className="input" id="c-rate" type="number" min={0} max={30} step={0.25} value={rate} onChange={(e) => setRate(+e.target.value || 0)} />
        </div>
        <div className="field">
          <label htmlFor="c-years">Loan term</label>
          <select className="select" id="c-years" value={years} onChange={(e) => setYears(+e.target.value)}>
            {[5, 10, 15, 20, 25, 30].map((y) => <option key={y} value={y}>{y} years</option>)}
          </select>
        </div>
      </div>
      <div className="calc-result">
        <span>Estimated monthly payment</span>
        <div className="big">{peso(monthly)}</div>
        <div className="row"><span>Loan amount</span><strong>{peso(loan)}</strong></div>
        <div className="row"><span>Down payment</span><strong>{peso(down)}</strong></div>
        <div className="row"><span>Total interest</span><strong>{peso(monthly * years * 12 - loan)}</strong></div>
        <Link className="btn btn-primary" href={`/listings?mode=buy&max=${Math.round(price)}`}>
          Browse homes up to {pesoShort(price)}
        </Link>
      </div>
    </div>
  );
}
